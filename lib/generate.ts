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

function createLyricTimeline(lines: string[], reelDuration: number): LyricLine[] {
  if (lines.length === 0) return []

  // Always split across two 8-bar verses (verse 1 = first half, verse 2 = second half)
  const verse1Duration = reelDuration / 2
  const verse2Duration = reelDuration / 2

  const midIndex = Math.ceil(lines.length / 2)
  const verse1Lines = lines.slice(0, midIndex)
  const verse2Lines = lines.slice(midIndex)

  const result: LyricLine[] = []

  // Helper to place lines sequentially without shuffle or overlap
  const buildVerseTimeline = (
    verseLines: string[],
    verseStart: number,
    verseDur: number
  ) => {
    if (verseLines.length === 0) return
    const lineDuration = verseDur / verseLines.length

    verseLines.forEach((text, i) => {
      const start = +(verseStart + i * lineDuration).toFixed(3)
      const end = +(start + lineDuration).toFixed(3)

      result.push({
        id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
        text,
        start,
        end,
      })
    })
  }

  buildVerseTimeline(verse1Lines, 0, verse1Duration)
  buildVerseTimeline(verse2Lines, verse1Duration, verse2Duration)

  return result
}

function getRandomClip(
  assets: VideoAsset[],
  targetDuration: number
): ClipItem[] {
  if (!assets.length) return []

  const clips: ClipItem[] = []
  let currentTime = 0

  while (currentTime < targetDuration) {
    const asset = assets[Math.floor(Math.random() * assets.length)]
    const remainingTime = targetDuration - currentTime

    // Randomize clip length between 1.5s and 4s, capped at remaining reel length
    const minClipDur = 1.5
    const maxClipDur = 4.0
    const desiredDur = minClipDur + Math.random() * (maxClipDur - minClipDur)
    const duration = Math.min(remainingTime, desiredDur)

    const offset =
      asset.duration > duration
        ? +(Math.random() * (asset.duration - duration)).toFixed(3)
        : 0

    const start = +currentTime.toFixed(3)
    const end = +(currentTime + duration).toFixed(3)

    clips.push({
      id: `clip-${Math.random().toString(36).substring(2, 9)}`,
      assetId: asset.id,
      start,
      end,
      offset,
    })

    currentTime = end
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
  
  // 1 bar = 4 beats. 16 bars = 64 beats.
  const secondsPerBeat = 60 / bpm
  const totalBeats = 16 * 4
  const reelDuration = +(totalBeats * secondsPerBeat).toFixed(3)

  const rawLines = parseLyrics(song.lyrics)

  const reels: Reel[] = []

  for (let i = 0; i < count; i++) {
    // Lyrics are guaranteed to stay in strict identical order and timings on every spill
    const lyrics = createLyricTimeline(rawLines, reelDuration)
    const clips = getRandomClip(assets, reelDuration)

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