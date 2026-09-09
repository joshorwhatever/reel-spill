// src/lib/types.ts
export type ReelMode = 'cut' | 'hook' | 'montage'

export type VideoAsset = {
  id: string
  name: string
  url: string
  duration: number
  width: number
  height: number
}

export type CustomFont = {
  id: string
  name: string
  family: string
}

export type LyricLine = {
  id: string
  text: string
  /** seconds, relative to reel start */
  start: number
  end: number
}

export type Clip = {
  id: string
  /** VideoAsset id */
  assetId: string
  /** where this clip sits on the reel timeline, seconds */
  start: number
  end: number
  /** in-point within the source video, seconds */
  offset: number
}

export type Reel = {
  id: string
  index: number
  name: string
  mode: ReelMode
  duration: number
  /** offset into the song where this reel begins */
  songStart: number
  clips: Clip[]
  lyrics: LyricLine[]
  fontId?: string
}

export type CaptionStyle = {
  fontId: string
  size: number
  tracking: number
  uppercase: boolean
  invert: boolean
  lines: number // 0 = default 'lines', 1-4 = lines (1) to lines (4)
  randomFont: boolean
  shadow: boolean
}

export type SongState = {
  name: string | null
  url: string | null
  file?: File
  duration: number
  bpm: number
  lyrics: string
}

export const MODE_LABEL: Record<ReelMode, string> = {
  cut: 'Cut',
  hook: 'Hook',
  montage: 'Montage',
}

export const MODE_DESC: Record<ReelMode, string> = {
  cut: '1 beat / cut',
  hook: 'Bar-based, first 2s focus',
  montage: 'Cuts on line changes',
}