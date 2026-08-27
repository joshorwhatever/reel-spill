import type { ClipItem, LyricLine, Reel, ReelMode, SongState, VideoAsset } from '@/lib/types'

type GenerateOptions = {
  song: SongState
  assets: VideoAsset[]
  count: number
  modes: ReelMode[]
  baseName: string
}

type WhisperSegment = {
  start: number
  end: number
  text: string
}

function parseLyrics(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function snapToNearestBeat(timeInSeconds: number, bpm: number): number {
  const secondsPerBeat = 60 / bpm
  const beatIndex = Math.round(timeInSeconds / secondsPerBeat)
  return +(beatIndex * secondsPerBeat).toFixed(3)
}

export async function alignLyricsWithWhisper(
  audioFile: File,
  bpm: number,
  fallbackLyrics: string,
  totalBars: number = 16
): Promise<LyricLine[]> {
  try {
    const formData = new FormData()
    formData.append('file', audioFile)

    const response = await fetch('/api/align-lyrics', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Whisper alignment failed')
    }

    const data = await response.json()
    const segments: WhisperSegment[] = data.segments || []

    if (!segments.length) {
      return createBeatGridLyricTimeline(parseLyrics(fallbackLyrics), bpm, totalBars)
    }

    const secondsPerBeat = 60 / bpm
    const maxDuration = totalBars * 4 * secondsPerBeat

    return segments
      .map((seg) => {
        const snappedStart = snapToNearestBeat(seg.start, bpm)
        const rawEnd = snapToNearestBeat(seg.end, bpm)
        const snappedEnd = Math.max(rawEnd, +(snappedStart + secondsPerBeat).toFixed(3))

        return {
          id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
          text: seg.text.trim(),
          start: snappedStart,
          end: snappedEnd,
        }
      })
      .filter((l) => l.start < maxDuration)
  } catch (err) {
    console.warn('Whisper alignment error, using grid fallback:', err)
    return createBeatGridLyricTimeline(parseLyrics(fallbackLyrics), bpm, totalBars)
  }
}

function createBeatGridLyricTimeline(
  lines: string[],
  bpm: number,
  totalBars: number = 16
): LyricLine[] {
  if (lines.length === 0) return []

  const secondsPerBeat = 60 / bpm
  const beatsPerBar = 4
  const totalBeats = totalBars * beatsPerBar
  const barsPerLine = Math.max(1, Math.floor(totalBars / lines.length))

  const result: LyricLine[] = []

  lines.forEach((text, i) => {
    const startBeat = i * barsPerLine * beatsPerBar
    if (startBeat >= totalBeats) return

    const endBeat = Math.min(startBeat + barsPerLine * beatsPerBar, totalBeats)

    const start = +(startBeat * secondsPerBeat).toFixed(3)
    const end = +(endBeat * secondsPerBeat).toFixed(3)

    result.push({
      id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
      text,
      start,
      end,
    })
  })

  return result
}

function getGridAlignedClips(
  assets: VideoAsset[],
  bpm: number,
  totalBars: number = 16
): ClipItem[] {
  if (!assets.length) return []

  const secondsPerBeat = 60 / bpm
  const beatsPerBar = 4
  const totalBeats = totalBars * beatsPerBar

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
  baseName,
}: GenerateOptions): Promise<Reel[]> {
  const bpm = song.bpm || 120
  const totalBars = 16
  const secondsPerBeat = 60 / bpm
  const reelDuration = +(totalBars * 4 * secondsPerBeat).toFixed(3)

  let lyrics: LyricLine[] = []

  if (song.file) {
    lyrics = await alignLyricsWithWhisper(song.file, bpm, song.lyrics, totalBars)
  } else {
    lyrics = createBeatGridLyricTimeline(parseLyrics(song.lyrics), bpm, totalBars)
  }

  const reels: Reel[] = []

  for (let i = 0; i < count; i++) {
    const clips = getGridAlignedClips(assets, bpm, totalBars)

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