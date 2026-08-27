export type ReelMode = 'cut' | 'hook' | 'montage' | null

export type VideoAsset = {
  id: string
  name: string
  url: string
  duration: number
}

export type CustomFont = {
  id: string
  name: string
  url: string
}

export type SongState = {
  name: string | null
  url: string | null
  duration: number
  bpm: number
  lyrics: string
}

export type CaptionStyle = {
  fontId: string
  size: number
  tracking: number
  uppercase: boolean
  align: 'top' | 'center' | 'bottom'
  shadow: boolean
}

export type ClipItem = {
  id: string
  assetId: string
  start: number
  end: number
  offset: number
}

export type LyricLine = {
  id: string
  start: number
  end: number
  text: string
}

export type AudioTrackItem = {
  id: string
  start: number
  end: number
  offset: number // allows dragging song further into the video or cutting the beginning
}

export type Reel = {
  id: string
  name: string
  duration: number
  clips: ClipItem[]
  lyrics: LyricLine[]
  audioTrack?: AudioTrackItem
}