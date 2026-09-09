// src/lib/generate.ts
import type { ClipItem, LyricLine, Reel, ReelMode, SongState, VideoAsset, CaptionStyle } from '@/lib/types'
import { GOOGLE_FONTS } from '@/lib/fonts'

type GenerateOptions = {
  song: SongState
  assets: VideoAsset[]
  count: number
  modes: ReelMode[]
  baseName: string
  existingLyrics?: LyricLine[]
  captionStyle?: CaptionStyle
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

export type AlignmentResult = {
  lines: LyricLine[]
  hasError: boolean
  failedSections: ('A' | 'B')[]
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

function isSimilar(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true
  return false
}

function alignGlobal(
  parsedLines: string[],
  words: WhisperWord[],
  maxDuration: number
): { aligned: LyricLine[]; failed: boolean } {
  if (parsedLines.length === 0) return { aligned: [], failed: false }

  const matched: (LyricLine | null)[] = new Array(parsedLines.length).fill(null)
  let wordPointer = 0

  for (let i = 0; i < parsedLines.length; i++) {
    const lineText = parsedLines[i]
    const lineTokens = lineText.split(/\s+/).map(cleanText).filter(Boolean)
    if (lineTokens.length === 0) continue

    let lineStart: number | null = null
    let lineEnd: number | null = null
    let lastMatchedIdx = -1

    const searchEnd = Math.min(words.length, wordPointer + 35)
    for (let j = wordPointer; j < searchEnd; j++) {
      const w = words[j]
      const cleanedW = cleanText(w.word)
      if (!cleanedW) continue

      if (lineTokens.some((t) => isSimilar(t, cleanedW))) {
        if (lineStart === null) lineStart = w.start
        lineEnd = w.end
        lastMatchedIdx = j
      }
    }

    if (lineStart !== null && lineEnd !== null) {
      wordPointer = lastMatchedIdx + 1
      matched[i] = {
        id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
        text: lineText,
        start: +Math.max(0, lineStart).toFixed(3),
        end: +Math.min(maxDuration, Math.max(lineStart + 0.6, lineEnd)).toFixed(3),
      }
    }
  }

  const matchedCount = matched.filter(Boolean).length
  if (matchedCount === 0) {
    return { aligned: createFallbackTimeline(parsedLines, maxDuration), failed: true }
  }

  const result: LyricLine[] = []
  const slotDuration = maxDuration / parsedLines.length

  for (let i = 0; i < parsedLines.length; i++) {
    if (matched[i]) {
      result.push(matched[i]!)
    } else {
      let prevIdx = -1
      for (let p = i - 1; p >= 0; p--) {
        if (matched[p]) { prevIdx = p; break }
      }
      let nextIdx = -1
      for (let n = i + 1; n < parsedLines.length; n++) {
        if (matched[n]) { nextIdx = n; break }
      }

      let estStart: number
      let estEnd: number

      if (prevIdx !== -1 && nextIdx !== -1) {
        const prevEnd = matched[prevIdx]!.end
        const nextStart = matched[nextIdx]!.start
        const steps = nextIdx - prevIdx
        const stepSize = Math.max(0.5, (nextStart - prevEnd) / steps)
        estStart = prevEnd + 0.2
        estEnd = estStart + Math.min(stepSize - 0.2, 2.0)
      } else if (prevIdx !== -1) {
        const prevEnd = matched[prevIdx]!.end
        estStart = Math.min(maxDuration - 1.5, prevEnd + 0.3)
        estEnd = Math.min(maxDuration, estStart + 1.5)
      } else if (nextIdx !== -1) {
        const nextStart = matched[nextIdx]!.start
        estStart = Math.max(0, nextStart - slotDuration)
        estEnd = Math.min(nextStart - 0.2, estStart + 1.5)
      } else {
        estStart = i * slotDuration
        estEnd = estStart + 1.5
      }

      result.push({
        id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
        text: parsedLines[i],
        start: +Math.max(0, estStart).toFixed(3),
        end: +Math.min(maxDuration, Math.max(estStart + 0.6, estEnd)).toFixed(3),
      })
    }
  }

  const minGap = 0.2
  for (let i = 0; i < result.length - 1; i++) {
    const current = result[i]
    const next = result[i + 1]
    if (current.end > next.start - minGap) {
      current.end = +Math.max(current.start + 0.6, next.start - minGap).toFixed(3)
    }
  }

  return { aligned: result, failed: false }
}

export async function alignLyricsWithWhisper(
  audioFile: File,
  bpm: number,
  fallbackLyrics: string,
  totalBars: number = 16
): Promise<AlignmentResult> {
  const parsedLines = parseLyrics(fallbackLyrics)
  const secondsPerBeat = 60 / bpm
  const maxDuration = totalBars * 4 * secondsPerBeat

  if (parsedLines.length === 0) {
    return { lines: [], hasError: false, failedSections: [] }
  }

  try {
    const formData = new FormData()
    formData.append('file', audioFile)
    if (fallbackLyrics) formData.append('prompt', fallbackLyrics)

    const response = await fetch('/api/align-lyrics', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Whisper alignment API request failed')
    }

    const data = await response.json()
    const segments: WhisperSegment[] = data.segments || []

    if (segments.length > 0) {
      const minGap = 0.2
      const lines: LyricLine[] = parsedLines.map((text, i) => {
        const seg = segments[i]
        const nextSeg = segments[i + 1]
        const slotDuration = maxDuration / parsedLines.length
        
        const start = seg ? +Math.max(0, seg.start).toFixed(3) : +(i * slotDuration).toFixed(3)
        let end = seg ? seg.end : start + 1.5

        if (nextSeg) {
          const maxAllowedEnd = nextSeg.start - minGap
          if (end > maxAllowedEnd) {
            end = Math.max(start + 0.6, maxAllowedEnd)
          }
        }

        const finalEnd = +Math.min(maxDuration, Math.max(start + 0.6, end)).toFixed(3)

        return {
          id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
          text: text,
          start,
          end: finalEnd,
        }
      })
      return { lines, hasError: false, failedSections: [] }
    }

    const words: WhisperWord[] = data.words || segments.flatMap((s) => s.words || [])
    const alignResult = alignGlobal(parsedLines, words, maxDuration)

    return {
      lines: alignResult.aligned,
      hasError: alignResult.failed,
      failedSections: alignResult.failed ? ['A', 'B'] : [],
    }
  } catch (err) {
    console.warn('Whisper alignment error, defaulting to fallback:', err)
    return {
      lines: createFallbackTimeline(parsedLines, maxDuration),
      hasError: true,
      failedSections: ['A', 'B'],
    }
  }
}

function createFallbackTimeline(lines: string[], maxDuration: number): LyricLine[] {
  if (lines.length === 0) return []
  const slotDuration = maxDuration / lines.length

  return lines.map((text, i) => {
    const start = +(i * slotDuration).toFixed(3)
    const end = +Math.min(maxDuration, start + Math.min(1.5, slotDuration * 0.8)).toFixed(3)
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

  let lastAssetId: string | null = null

  const getNextAsset = () => {
    if (assets.length <= 1) return assets[0]
    const pool = assets.filter((a) => a.id !== lastAssetId)
    const chosen = pool[Math.floor(Math.random() * pool.length)] || assets[0]
    lastAssetId = chosen.id
    return chosen
  }

  if (modes.includes('montage')) {
    const clips: ClipItem[] = []
    let currentBeat = 0

    while (currentBeat < totalBeats) {
      const asset = getNextAsset()
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
        const asset = getNextAsset()
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

      const asset = getNextAsset()
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
      const asset = getNextAsset()
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
    const asset = getNextAsset()
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
  captionStyle,
}: GenerateOptions): Promise<Reel[]> {
  const bpm = song.bpm || 120
  const totalBars = 16
  const secondsPerBeat = 60 / bpm
  const reelDuration = +(totalBars * 4 * secondsPerBeat).toFixed(3)

  let lyrics: LyricLine[] = []

  if (existingLyrics && existingLyrics.length > 0) {
    lyrics = existingLyrics
  } else if (song.file) {
    const res = await alignLyricsWithWhisper(song.file, bpm, song.lyrics, totalBars)
    lyrics = res.lines
  } else {
    lyrics = createFallbackTimeline(parseLyrics(song.lyrics), reelDuration)
  }

  const reels: Reel[] = []

  for (let i = 0; i < count; i++) {
    const clips = getClipsForMode(assets, bpm, totalBars, modes, lyrics)
    
    let fontId: string | undefined = undefined
    if (captionStyle?.randomFont) {
      const randomFontObj = GOOGLE_FONTS[Math.floor(Math.random() * GOOGLE_FONTS.length)]
      fontId = randomFontObj.id
    }

    reels.push({
      id: `reel-${i + 1}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${baseName} ${i + 1}`,
      duration: reelDuration,
      clips,
      lyrics,
      fontId,
    })
  }

  return reels
}