import type { ClipItem, LyricLine, Reel, ReelMode, SongState, VideoAsset } from '@/lib/types'

type GenerateOptions = {
  song: SongState
  assets: VideoAsset[]
  count: number
  modes: ReelMode[]
  baseName: string
}

function parseLyrics(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function createBeatGridLyricTimeline(
  lines: string[],
  bpm: number,
  totalBars: number = 16
): LyricLine[] {
  if (lines.length === 0) return []

  const secondsPerBeat = 60 / bpm
  const beatsPerBar = 4 // Standard 4/4 musical time
  const totalBeats = totalBars * beatsPerBar

  // Calculate how many bars each lyric line gets
  // Round to nearest bar interval so every lyric starts on Beat 1 of a bar
  const barsPerLine = Math.max(1, Math.floor(totalBars / lines.length))

  const result: LyricLine[] = []

  lines.forEach((text, i) => {
    const startBeat = i * barsPerLine * beatsPerBar

    // Stop if lyrics exceed the 16-bar boundary
    if (startBeat >= totalBeats) return

    const endBeat = Math.min(startBeat + (barsPerLine * beatsPerBar), totalBeats)

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
  const totalDuration = totalBeats * secondsPerBeat

  const clips: ClipItem[] = []
  let currentBeat = 0

  // Cut video clips strictly on 2-bar or 4-bar musical boundaries
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

export function generateReels({
  song,
  assets,
  count,
  baseName,
}: GenerateOptions): Reel[] {
  const bpm = song.bpm || 120
  const totalBars = 16
  const secondsPerBeat = 60 / bpm
  const reelDuration = +(totalBars * 4 * secondsPerBeat).toFixed(3)

  const rawLines = parseLyrics(song.lyrics)

  const reels: Reel[] = []

  for (let i = 0; i < count; i++) {
    // Both lyrics and clips are strictly quantised to musical bar boundaries
    const lyrics = createBeatGridLyricTimeline(rawLines, bpm, totalBars)
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