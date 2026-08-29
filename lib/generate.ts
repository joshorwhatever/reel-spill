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

function alignSection(
  sectionLines: string[],
  words: WhisperWord[],
  sectionStart: number,
  sectionEnd: number,
  sectionName: 'A' | 'B'
): { aligned: LyricLine[]; failed: boolean } {
  if (sectionLines.length === 0) return { aligned: [], failed: false }
  const sectionDuration = sectionEnd - sectionStart

  // 1. Filter words within section boundaries (with 1s buffer)
  const sectionWords = words.filter(
    (w) => w.start >= Math.max(0, sectionStart - 1.0) && w.end <= sectionEnd + 1.0
  )

  const matched: (LyricLine | null)[] = new Array(sectionLines.length).fill(null)
  let wordPointer = 0

  // 2. Try word-level matching within section
  for (let i = 0; i < sectionLines.length; i++) {
    const lineText = sectionLines[i]
    const lineTokens = lineText.split(/\s+/).map(cleanText).filter(Boolean)
    if (lineTokens.length === 0) continue

    let lineStart: number | null = null
    let lineEnd: number | null = null
    let lastMatchedIdx = -1

    const searchEnd = Math.min(sectionWords.length, wordPointer + 25)
    for (let j = wordPointer; j < searchEnd; j++) {
      const w = sectionWords[j]
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
        start: +Math.max(sectionStart, lineStart).toFixed(3),
        end: +Math.min(sectionEnd, Math.max(lineStart + 0.8, lineEnd)).toFixed(3),
      }
    }
  }

  const matchedCount = matched.filter(Boolean).length

  // Scenario 1: Entire section failed matching
  if (matchedCount === 0) {
    const slotDuration = sectionDuration / sectionLines.length
    const fallbackLines: LyricLine[] = sectionLines.map((text, i) => {
      const start = +(sectionStart + i * slotDuration).toFixed(3)
      const end = +Math.min(sectionEnd, sectionStart + (i + 1) * slotDuration).toFixed(3)
      return { id: `lyric-${Math.random().toString(36).substring(2, 9)}`, text, start, end }
    })
    return { aligned: fallbackLines, failed: true }
  }

  // Scenario 2: Partial matches -> Use matched lines as anchors for unmatched lines
  const slotDuration = sectionDuration / sectionLines.length
  const result: LyricLine[] = []

  for (let i = 0; i < sectionLines.length; i++) {
    if (matched[i]) {
      result.push(matched[i]!)
    } else {
      let prevIdx = -1
      for (let p = i - 1; p >= 0; p--) {
        if (matched[p]) { prevIdx = p; break }
      }
      let nextIdx = -1
      for (let n = i + 1; n < sectionLines.length; n++) {
        if (matched[n]) { nextIdx = n; break }
      }

      let estStart: number
      let estEnd: number

      if (prevIdx !== -1 && nextIdx !== -1) {
        const prevEnd = matched[prevIdx]!.end
        const nextStart = matched[nextIdx]!.start
        const steps = nextIdx - prevIdx
        const stepSize = Math.max(0.4, (nextStart - prevEnd) / steps)
        estStart = prevEnd + (i - prevIdx - 1) * stepSize + 0.1
        estEnd = estStart + Math.min(stepSize - 0.1, 1.5)
      } else if (prevIdx !== -1) {
        const prevEnd = matched[prevIdx]!.end
        estStart = Math.min(sectionEnd - 1.0, prevEnd + 0.2)
        estEnd = Math.min(sectionEnd, estStart + Math.min(slotDuration * 0.8, 1.8))
      } else if (nextIdx !== -1) {
        const nextStart = matched[nextIdx]!.start
        estStart = Math.max(sectionStart, nextStart - slotDuration)
        estEnd = Math.min(nextStart - 0.1, estStart + Math.min(slotDuration * 0.8, 1.8))
      } else {
        estStart = sectionStart + i * slotDuration
        estEnd = estStart + slotDuration * 0.8
      }

      result.push({
        id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
        text: sectionLines[i],
        start: +Math.max(sectionStart, estStart).toFixed(3),
        end: +Math.min(sectionEnd, Math.max(estStart + 0.8, estEnd)).toFixed(3),
      })
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
  const sectionADuration = (totalBars / 2) * 4 * secondsPerBeat

  if (parsedLines.length === 0) {
    return { lines: [], hasError: false, failedSections: [] }
  }

  const mid = Math.ceil(parsedLines.length / 2)
  const linesA = parsedLines.slice(0, mid)
  const linesB = parsedLines.slice(mid)

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
    const words: WhisperWord[] = data.words || segments.flatMap((s) => s.words || [])

    const alignA = alignSection(linesA, words, 0, sectionADuration, 'A')
    const alignB = alignSection(linesB, words, sectionADuration, maxDuration, 'B')

    const failedSections: ('A' | 'B')[] = []
    if (alignA.failed) failedSections.push('A')
    if (alignB.failed) failedSections.push('B')

    const combinedLines = [...alignA.aligned, ...alignB.aligned]

    return {
      lines: combinedLines,
      hasError: failedSections.length > 0,
      failedSections,
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