import type { ClipItem, LyricLine, Reel, ReelMode, SongState, VideoAsset } from '@/lib/types'

type GenerateOptions = {
  song: SongState
  assets: VideoAsset[]
  count: number
  modes: ReelMode[]
  baseName: string
  existingLyrics?: LyricLine[]
}

type WhisperWord = {
  word: string
  start: number
  end: number
}

type WhisperSegment = {
  start: number
  end: number
  text: string
  words?: WhisperWord[]
}

function parseLyrics(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function cleanText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function alignLyricsWithWhisper(
  audioFile: File,
  bpm: number,
  fallbackLyrics: string,
  totalBars: number = 16
): Promise<LyricLine[]> {
  const parsedLines = parseLyrics(fallbackLyrics)
  const secondsPerBeat = 60 / bpm
  const maxDuration = totalBars * 4 * secondsPerBeat

  try {
    const formData = new FormData()
    formData.append('file', audioFile)
    if (fallbackLyrics) {
      formData.append('prompt', fallbackLyrics)
    }

    const response = await fetch('/api/align-lyrics', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error || 'Whisper alignment failed')
    }

    const data = await response.json()
    const segments: WhisperSegment[] = data.segments || []
    const words: WhisperWord[] = data.words || segments.flatMap((s) => s.words || [])

    if (parsedLines.length === 0) return []

    const alignedLines: LyricLine[] = []

    if (words.length > 0) {
      let wordPointer = 0

      for (let i = 0; i < parsedLines.length; i++) {
        const lineText = parsedLines[i]
        const lineTokens = lineText.split(/\s+/).map(cleanText).filter(Boolean)

        if (lineTokens.length === 0) continue

        let lineStart: number | null = null
        let lineEnd: number | null = null
        let matchedCount = 0

        for (let j = wordPointer; j < words.length; j++) {
          const w = words[j]
          const cleanedW = cleanText(w.word)

          if (!cleanedW) continue

          const tokenMatchIndex = lineTokens.findIndex(
            (token, tIdx) => tIdx >= matchedCount && token === cleanedW
          )

          if (tokenMatchIndex !== -1) {
            if (lineStart === null) lineStart = w.start
            lineEnd = w.end
            wordPointer = j + 1
            matchedCount++

            if (matchedCount >= Math.min(lineTokens.length, 3)) {
              const remainingTokens = lineTokens.length - matchedCount
              if (remainingTokens > 0 && j + remainingTokens < words.length) {
                lineEnd = words[j + remainingTokens].end
                wordPointer = j + 1 + remainingTokens
              }
              break
            }
          }
        }

        if (lineStart !== null && lineEnd !== null) {
          alignedLines.push({
            id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
            text: lineText,
            start: +Math.max(0, lineStart).toFixed(3),
            end: +Math.max(lineStart + 0.3, lineEnd).toFixed(3),
          })
        } else {
          // Fallback placement for unmatched lines based on previous line end
          const prevEnd = alignedLines.length > 0 ? alignedLines[alignedLines.length - 1].end : 0
          const estimatedStart = prevEnd + 0.3
          alignedLines.push({
            id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
            text: lineText,
            start: +Math.min(maxDuration, estimatedStart).toFixed(3),
            end: +Math.min(maxDuration, estimatedStart + 1.5).toFixed(3),
          })
        }
      }
    } else if (segments.length > 0) {
      parsedLines.forEach((lineText, idx) => {
        const seg = segments[Math.min(segments.length - 1, idx)]
        const start = +Math.max(0, seg.start).toFixed(3)
        const end = +Math.max(start + 0.5, seg.end).toFixed(3)

        alignedLines.push({
          id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
          text: lineText,
          start,
          end: Math.min(maxDuration, end),
        })
      })
    }

    if (alignedLines.length > 0) {
      return alignedLines.filter((l) => l.start < maxDuration)
    }

    throw new Error('No valid alignment mapping generated')
  } catch (err) {
    console.warn('Whisper alignment error, using fallback timeline:', err)
    return createFallbackTimeline(parsedLines, maxDuration)
  }
}

function createFallbackTimeline(lines: string[], maxDuration: number): LyricLine[] {
  if (lines.length === 0) return []
  const durationPerLine = maxDuration / lines.length

  return lines.map((text, i) => {
    const start = +(i * durationPerLine).toFixed(3)
    const end = +Math.min(maxDuration, (i + 1) * durationPerLine).toFixed(3)
    return {
      id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
      text,
      start,
      end,
    }
  })
}

function getClipsForMode(
  assets: VideoAsset[],
  bpm: number,
  totalBars: number = 16,
  modes: ReelMode[] = [],
  lyrics: LyricLine[] = []
): ClipItem[] {
  if (!assets.length) return []

  const secondsPerBeat = 60 / bpm
  const beatsPerBar = 4
  const totalBeats = totalBars * beatsPerBar
  const totalDuration = totalBeats * secondsPerBeat

  if (modes.includes('montage')) {
    const clips: ClipItem[] = []
    let currentBeat = 0

    while (currentBeat < totalBeats) {
      const asset = assets[Math.floor(Math.random() * assets.length)]
      const clipBeats = 1
      const duration = clipBeats * secondsPerBeat
      const start = +(currentBeat * secondsPerBeat).toFixed(3)
      const end = +((currentBeat + clipBeats) * secondsPerBeat).toFixed(3)

      if (start >= totalDuration) break

      const offset =
        asset.duration > duration
          ? +(Math.random() * (asset.duration - duration)).toFixed(3)
          : 0

      clips.push({
        id: `clip-${Math.random().toString(36).substring(2, 9)}`,
        assetId: asset.id,
        start,
        end: Math.min(end, totalDuration),
        offset,
      })

      currentBeat += clipBeats
    }
    return clips
  }

  if (modes.includes('cut') && lyrics.length > 0) {
    const clips: ClipItem[] = []
    let currentTime = 0

    lyrics.forEach((lyric) => {
      if (lyric.start > currentTime) {
        const asset = assets[Math.floor(Math.random() * assets.length)]
        const dur = lyric.start - currentTime
        const offset =
          asset.duration > dur
            ? +(Math.random() * (asset.duration - dur)).toFixed(3)
            : 0
        clips.push({
          id: `clip-${Math.random().toString(36).substring(2, 9)}`,
          assetId: asset.id,
          start: currentTime,
          end: lyric.start,
          offset,
        })
      }

      const asset = assets[Math.floor(Math.random() * assets.length)]
      const dur = lyric.end - lyric.start
      const offset =
        asset.duration > dur
          ? +(Math.random() * (asset.duration - dur)).toFixed(3)
          : 0
      clips.push({
        id: `clip-${Math.random().toString(36).substring(2, 9)}`,
        assetId: asset.id,
        start: lyric.start,
        end: lyric.end,
        offset,
      })

      currentTime = lyric.end
    })

    if (currentTime < totalDuration) {
      const asset = assets[Math.floor(Math.random() * assets.length)]
      const dur = totalDuration - currentTime
      const offset =
        asset.duration > dur
          ? +(Math.random() * (asset.duration - dur)).toFixed(3)
          : 0
      clips.push({
        id: `clip-${Math.random().toString(36).substring(2, 9)}`,
        assetId: asset.id,
        start: currentTime,
        end: totalDuration,
        offset,
      })
    }

    return clips
  }

  const clips: ClipItem[] = []
  let currentBeat = 0
  const barIntervals = [2, 4]

  while (currentBeat < totalBeats) {
    const asset = assets[Math.floor(Math.random() * assets.length)]
    const remainingBeats = totalBeats - currentBeat

    const chosenBarInterval = barIntervals[Math.floor(Math.random() * barIntervals.length)]
    const clipBeats = Math.min(remainingBeats, chosenBarInterval * beatsPerBar)
    const duration = clipBeats * secondsPerBeat

    const offset =
      asset.duration > duration
        ? +(Math.random() * (asset.duration - duration)).toFixed(3)
        : 0

    const start = +(currentBeat * secondsPerBeat).toFixed(3)
    const end = +((currentBeat + clipBeats) * secondsPerBeat).toFixed(3)

    clips.push({
      id: `clip-${Math.random().toString(36).substring(2, 9)}`,
      assetId: asset.id,
      start,
      end,
      offset,
    })

    currentBeat += clipBeats
  }

  return clips
}

export async function generateReels({
  song,
  assets,
  count,
  modes,
  baseName,
  existingLyrics,
}: GenerateOptions): Promise<Reel[]> {
  const bpm = song.bpm || 120
  const totalBars = 16
  const secondsPerBeat = 60 / bpm
  const reelDuration = +(totalBars * 4 * secondsPerBeat).toFixed(3)

  let lyrics: LyricLine[] = []

  // If user has edited lyrics on the timeline, respect them unless an explicit sync is forced
  if (existingLyrics && existingLyrics.length > 0) {
    lyrics = existingLyrics
  } else if (song.file) {
    lyrics = await alignLyricsWithWhisper(song.file, bpm, song.lyrics, totalBars)
  } else {
    lyrics = createFallbackTimeline(parseLyrics(song.lyrics), reelDuration)
  }

  const reels: Reel[] = []

  for (let i = 0; i < count; i++) {
    const clips = getClipsForMode(assets, bpm, totalBars, modes, lyrics)

    reels.push({
      id: `reel-${i + 1}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${baseName} ${i + 1}`,
      duration: reelDuration,
      clips,
      lyrics,
    })
  }

  return reels
}