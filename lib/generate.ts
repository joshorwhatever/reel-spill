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
        // Exact spoken duration: no artificial padding before or after
        const start = +Math.max(0, seg.start).toFixed(3)
        const end = +Math.max(start + 0.05, seg.end).toFixed(3)

        return {
          id: `lyric-${Math.random().toString(36).substring(2, 9)}`,
          text: seg.text.trim(),
          start,
          end,
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

  // MONTAGE -> cuts video on every beat
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

  // CUT -> changes video when the line changes (syncs clips to lyric lines)
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

  // Default / Hook mode: Grid aligned clips (2 or 4 bar intervals)
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