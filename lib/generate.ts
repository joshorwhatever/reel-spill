import type {
  Clip,
  LyricLine,
  Reel,
  ReelMode,
  SongState,
  VideoAsset,
} from './types'

const uid = () => Math.random().toString(36).slice(2, 9)

function rng(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function syllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 1
  const groups = w.match(/[aeiouy]+/g)
  let n = groups ? groups.length : 1
  if (w.endsWith('e') && n > 1) n -= 1
  return Math.max(1, n)
}

export function lineWeight(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .reduce((acc, w) => acc + syllables(w), 0)
}

export function parseLyrics(raw: string) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

export function syncLyrics(
  lines: string[],
  windowStart: number,
  windowEnd: number,
  beat: number,
): LyricLine[] {
  if (!lines.length) return []
  const span = Math.max(0.001, windowEnd - windowStart)
  const total = lines.reduce((a, l) => a + lineWeight(l), 0) || lines.length
  const snap = (t: number) =>
    windowStart + Math.round((t - windowStart) / beat) * beat

  let cursor = windowStart
  const out: LyricLine[] = []
  lines.forEach((text, i) => {
    const share = (lineWeight(text) / total) * span
    const rawEnd = i === lines.length - 1 ? windowEnd : cursor + share
    let end = i === lines.length - 1 ? windowEnd : snap(rawEnd)
    if (end - cursor < beat) end = Math.min(windowEnd, cursor + beat)
    out.push({
      id: uid(),
      text,
      start: +cursor.toFixed(3),
      end: +Math.min(end, windowEnd).toFixed(3),
    })
    cursor = end
    if (cursor >= windowEnd) cursor = windowEnd
  })
  return out.filter((l) => l.end > l.start)
}

function linesForWindow(all: string[], songStart: number, songDur: number) {
  if (!all.length) return []
  const per = songDur / all.length
  const from = Math.floor(songStart / per)
  return all.slice(from)
}

function buildCutPoints(
  mode: ReelMode | 'viral',
  duration: number,
  beat: number,
  lyrics: LyricLine[],
): number[] {
  const pts: number[] = [0]
  if (mode === 'cut') {
    for (let t = beat; t < duration - 0.05; t += beat) pts.push(+t.toFixed(3))
  } else if (mode === 'hook') {
    const fast = beat / 2
    for (let t = fast; t < Math.min(2, duration); t += fast)
      pts.push(+t.toFixed(3))
    const bar = beat * 4
    let t = Math.ceil(Math.min(2, duration) / bar) * bar
    for (; t < duration - 0.05; t += bar) pts.push(+t.toFixed(3))
  } else if (mode === 'montage') {
    for (const l of lyrics) {
      if (l.start > 0.05 && l.start < duration - 0.05)
        pts.push(+l.start.toFixed(3))
      if (l.end - l.start > beat * 6) {
        const mid = l.start + (l.end - l.start) / 2
        if (mid < duration - 0.05) pts.push(+mid.toFixed(3))
      }
    }
  } else {
    // Viral Smart Default Engine
    const bar = beat * 4
    for (let t = bar; t < duration - 0.05; t += bar * 2) {
      pts.push(+t.toFixed(3))
    }
  }
  const uniq = Array.from(new Set(pts)).sort((a, b) => a - b)
  return uniq.filter((p, i) => i === 0 || p - uniq[i - 1] > 0.08)
}

function assembleClips(
  points: number[],
  duration: number,
  assets: VideoAsset[],
  rand: () => number,
): Clip[] {
  const clips: Clip[] = []
  const pool = assets.map((_, i) => i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  let p = 0
  points.forEach((start, i) => {
    const end = i === points.length - 1 ? duration : points[i + 1]
    const asset = assets[pool[p % pool.length]]
    p++
    const len = end - start
    const room = Math.max(0, (asset.duration || len) - len)
    clips.push({
      id: uid(),
      assetId: asset.id,
      start: +start.toFixed(3),
      end: +end.toFixed(3),
      offset: +(room > 0 ? rand() * room : 0).toFixed(3),
    })
  })
  return clips
}

export function reelDuration(mode: ReelMode | 'viral', beat: number, songDur: number) {
  const bar = beat * 4
  const bars = mode === 'hook' ? 4 : 8
  return +Math.min(songDur || bars * bar, bars * bar).toFixed(3)
}

export type GenerateOptions = {
  song: SongState
  assets: VideoAsset[]
  count: number
  modes: ReelMode[]
  baseName: string
}

export function generateReels({
  song,
  assets,
  count,
  modes,
  baseName,
}: GenerateOptions): Reel[] {
  if (!assets.length) return []
  const beat = 60 / Math.max(40, Math.min(220, song.bpm || 120))
  const songDur = song.duration || 180
  const allLines = parseLyrics(song.lyrics)
  const reels: Reel[] = []

  const activeModes = modes.length > 0 ? modes : ['viral' as const]

  for (let i = 0; i < count; i++) {
    const mode = activeModes[i % activeModes.length]
    const modeKey = mode === 'viral' ? 'v' : mode
    const rand = rng(i + 1 + modeKey.length * 17)
    const duration = reelDuration(mode, beat, songDur)
    
    const bar = beat * 4
    const maxStart = Math.max(0, songDur - duration)
    const songStart = +(
      Math.round(((maxStart * (i / Math.max(1, count))) % (maxStart + 0.001)) / bar) * bar
    ).toFixed(3)

    const windowLines = linesForWindow(allLines, songStart, songDur)
    const lineBudget =
      mode === 'hook' ? 2 : mode === 'cut' ? 4 : Math.min(6, windowLines.length)
    const lyrics = syncLyrics(
      windowLines.slice(0, Math.max(1, lineBudget)),
      0,
      duration,
      beat,
    )
    const points = buildCutPoints(mode, duration, beat, lyrics)
    
    const prefix = baseName.trim() || 'reel'
    const suffix = mode === 'viral' ? 'viral' : mode

    reels.push({
      id: uid(),
      index: i + 1,
      name: `${prefix} ${suffix} ${i + 1}`.toUpperCase(),
      mode: mode === 'viral' ? undefined : (mode as ReelMode),
      duration,
      songStart,
      clips: assembleClips(points, duration, assets, rand),
      lyrics,
    })
  }
  return reels
}