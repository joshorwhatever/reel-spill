// src/app/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { SongPanel } from '@/components/song-panel'
import { ContentPanel } from '@/components/content-panel'
import { FontPanel } from '@/components/font-panel'
import { OutputPanel } from '@/components/output-panel'
import { ReelStage } from '@/components/reel-stage'
import { generateReels } from '@/lib/generate'
import { GOOGLE_FONTS } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import type {
  CaptionStyle,
  CustomFont,
  LyricLine,
  Reel,
  ReelMode,
  SongState,
  VideoAsset,
} from '@/lib/types'

type Drag = {
  id: string
  type: 'lyric' | 'clip'
  edge: 'move' | 'left' | 'right'
  originX: number
  start: number
  end: number
}

function handleTrackDrag<T extends { id: string; start: number; end: number }>(
  items: T[],
  drag: Drag,
  delta: number,
  reelDur: number,
  shouldSnap: boolean,
  snapToTick: (t: number) => number,
  assetMap?: Map<string, VideoAsset>
): T[] {
  const minLen = 0.08
  const { id, edge, start: origStart, end: origEnd } = drag

  const targetIdx = items.findIndex((item) => item.id === id)
  if (targetIdx === -1) return items

  const sorted = items.map((item) => ({ ...item })).sort((a, b) => a.start - b.start)
  const target = sorted.find((item) => item.id === id)!

  const asset = (target as any).assetId && assetMap ? assetMap.get((target as any).assetId) : null
  const maxVideoDur = asset?.duration || 9999
  const clipOffset = (target as any).offset || 0

  if (edge === 'move') {
    const len = origEnd - origStart
    const rawStart = Math.max(0, Math.min(reelDur - len, origStart + delta))
    const start = shouldSnap ? snapToTick(rawStart) : rawStart
    target.start = +start.toFixed(3)
    target.end = +(start + len).toFixed(3)
    return sorted
  }

  if (edge === 'right') {
    const maxAllowedByAsset = origStart + Math.min(maxVideoDur - clipOffset, origEnd - origStart + delta)
    const rawEnd = Math.min(reelDur, Math.max(origStart + minLen, maxAllowedByAsset))
    const newEnd = shouldSnap ? snapToTick(rawEnd) : rawEnd
    target.end = +newEnd.toFixed(3)

    return sorted.filter((item) => {
      if (item.id === id) return true

      if (item.start < target.end && item.end > target.start) {
        if (target.end >= item.end) {
          return false
        } else {
          item.start = target.end
        }
      }
      return item.end - item.start >= 0.01
    })
  }

  if (edge === 'left') {
    const maxAllowedByAsset = origEnd - Math.min(maxVideoDur, origEnd - origStart - delta)
    const rawStart = Math.max(0, Math.min(origEnd - minLen, maxAllowedByAsset))
    const newStart = shouldSnap ? snapToTick(rawStart) : rawStart
    target.start = +newStart.toFixed(3)

    return sorted.filter((item) => {
      if (item.id === id) return true

      if (item.end > target.start && item.start < target.end) {
        if (target.start <= item.start) {
          return false
        } else {
          item.end = target.start
        }
      }
      return item.end - item.start >= 0.01
    })
  }

  return sorted
}

export default function Page() {
  const [song, setSong] = useState<SongState>({
    name: null,
    url: null,
    duration: 32,
    bpm: 120,
    lyrics: '',
  })

  const [assets, setAssets] = useState<VideoAsset[]>([])
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([])
  const [reels, setReels] = useState<Reel[]>([])
  const [syncedLyrics, setSyncedLyrics] = useState<LyricLine[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedLyricId, setSelectedLyricId] = useState<string | null>(null)
  const [modes, setModes] = useState<ReelMode[]>([])
  const [baseName, setBaseName] = useState<string>('')
  const [reelCount, setReelCount] = useState<number>(6)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)

  const [style, setStyle] = useState<CaptionStyle>({
    fontId: GOOGLE_FONTS[0].id,
    size: 42,
    tracking: 0,
    uppercase: false,
    invert: false,
    lines: 0,
    randomFont: false,
    shadow: false,
  })

  const [time, setTime] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [editing, setEditing] = useState<boolean>(true)
  const [cuePoint, setCuePoint] = useState<number | null>(null)

  const [drag, setDrag] = useState<Drag | null>(null)
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false)

  const dragSnapshot = useRef<{ clips: any[]; lyrics: any[] } | null>(null)

  const innerTrackRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const assetMap = new Map(assets.map((a) => [a.id, a]))
  const activeReel = reels.find((r) => r.id === selectedId) || reels[0] || null
  const activeStyle = activeReel?.style || style

  const beatDuration = 60 / (song.bpm || 120)
  const totalBeats = 64
  const totalDuration = totalBeats * beatDuration

  const hypotheticalReel: Reel = activeReel || {
    id: 'hypothetical',
    name: 'Hypothetical Track',
    duration: totalDuration,
    clips: [],
    lyrics: syncedLyrics,
    style: { ...style },
  }

  const baseDuration = hypotheticalReel.duration || totalDuration
  const duration = baseDuration
  const maxDur = activeReel ? activeReel.duration : totalDuration

  const clips = hypotheticalReel.clips || []
  const lyrics = hypotheticalReel.lyrics || []
  const pct = (t: number) => `${(t / duration) * 100}%`

  const visualMarkers: { time: number; type: 'big' | 'small' | 'medium' }[] = []
  for (let beatIndex = 0; beatIndex < totalBeats; beatIndex++) {
    const beatInBar = beatIndex % 4
    const t = +(beatIndex * beatDuration).toFixed(3)
    let type: 'big' | 'small' | 'medium' = 'small'
    if (beatInBar === 0) type = 'big'
    else if (beatInBar === 2) type = 'medium'
    else type = 'small'

    visualMarkers.push({ time: t, type })
  }

  const snapToTick = (t: number) => {
    if (!beatDuration) return t
    const idx = Math.round(t / beatDuration)
    return +(idx * beatDuration).toFixed(3)
  }

  function xToTime(clientX: number) {
    const box = innerTrackRef.current?.getBoundingClientRect()
    if (!box) return 0
    const x = Math.max(0, Math.min(clientX - box.left, box.width))
    return (x / box.width) * duration
  }

  const latest = useRef({ drag, hypotheticalReel, duration, isScrubbing, cuePoint, selectedLyricId, activeReel, maxDur, assetMap })
  latest.current = { drag, hypotheticalReel, duration, isScrubbing, cuePoint, selectedLyricId, activeReel, maxDur, assetMap }

  const handleLyricsAligned = (alignedLyrics: LyricLine[]) => {
    setSyncedLyrics(alignedLyrics)

    if (reels.length === 0) {
      const defaultReel: Reel = {
        id: 'reel-1',
        name: 'spill 1',
        duration: totalDuration,
        clips: [],
        lyrics: alignedLyrics,
        style: { ...style },
      }
      setReels([defaultReel])
      setSelectedId(defaultReel.id)
    } else {
      setReels((prev) =>
        prev.map((r) => ({
          ...r,
          lyrics: alignedLyrics,
        }))
      )
    }
  }

  const startDragging = (dragInfo: Drag) => {
    if (activeReel) {
      dragSnapshot.current = {
        clips: JSON.parse(JSON.stringify(activeReel.clips)),
        lyrics: JSON.parse(JSON.stringify(activeReel.lyrics)),
      }
    }
    setDrag(dragInfo)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !song.url) return
    if (isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [isPlaying, song.url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !song.url) return
    if (Math.abs(audio.currentTime - time) > 0.15) {
      audio.currentTime = time
    }
  }, [time, song.url])

  useEffect(() => {
    if (time >= maxDur && isPlaying) {
      const resetTime = cuePoint !== null ? cuePoint : 0
      setTime(resetTime)
      if (audioRef.current) {
        audioRef.current.currentTime = resetTime
        audioRef.current.play().catch(() => {})
      }
    }
  }, [time, maxDur, isPlaying, cuePoint])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const targetTag = target.tagName.toLowerCase()
      const isTextInput =
        targetTag === 'textarea' ||
        (targetTag === 'input' &&
          ['text', 'number', 'search', 'email', 'password', 'url'].includes(
            (target as HTMLInputElement).type
          ))

      if (isTextInput) return

      if (e.code === 'Space') {
        e.preventDefault()
        e.stopPropagation()
        setIsPlaying((prev) => {
          const willPlay = !prev
          const activeCue = latest.current.cuePoint
          if (willPlay) {
            const startT = activeCue !== null ? activeCue : time
            setTime(startT)
            if (audioRef.current) {
              audioRef.current.currentTime = startT
            }
            return true
          } else {
            if (activeCue !== null) {
              setTime(activeCue)
              if (audioRef.current) {
                audioRef.current.currentTime = activeCue
              }
            }
            return false
          }
        })
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        setTime((t) => Math.min(maxDur, +(t + beatDuration).toFixed(3)))
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        setTime((t) => Math.max(0, +(t - beatDuration).toFixed(3)))
      } else if (e.code === 'Backspace' || e.code === 'Delete') {
        const { selectedLyricId: selLyric } = latest.current
        if (selLyric) {
          e.preventDefault()
          e.stopPropagation()
          setReels((prev) =>
            prev.map((r) => ({
              ...r,
              lyrics: r.lyrics.filter((l) => l.id !== selLyric),
            }))
          )
          setSelectedLyricId(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [beatDuration, maxDur])

  useEffect(() => {
    if (!drag && !isScrubbing) return

    const move = (e: PointerEvent) => {
      const { drag: d, duration: dur, isScrubbing: scrubbing, activeReel: curReel, maxDur: maxD, assetMap: curAssetMap } = latest.current
      const box = innerTrackRef.current?.getBoundingClientRect()
      if (!box) return

      if (scrubbing) {
        const rawTime = Math.max(0, Math.min(maxD, ((e.clientX - box.left) / box.width) * dur))
        const newTime = snapToTick(rawTime)
        setTime(+newTime.toFixed(3))
        if (audioRef.current) {
          audioRef.current.currentTime = +newTime.toFixed(3)
        }
        return
      }

      if (!curReel) return
      const currentSnapshot = dragSnapshot.current
      if (!d || !currentSnapshot) return
      const delta = ((e.clientX - d.originX) / box.width) * dur
      const reelDur = curReel.duration

      setReels((prev) =>
        prev.map((r) => {
          if (d.type === 'lyric') {
            const updatedLyrics = handleTrackDrag(currentSnapshot.lyrics || [], d, delta, reelDur, false, snapToTick)
            return {
              ...r,
              lyrics: updatedLyrics,
            }
          } else {
            if (r.id !== curReel.id) return r
            return {
              ...r,
              clips: handleTrackDrag(currentSnapshot.clips || [], d, delta, reelDur, true, snapToTick, curAssetMap),
            }
          }
        })
      )
    }

    const stop = () => {
      setDrag(null)
      setIsScrubbing(false)
      dragSnapshot.current = null
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [drag, isScrubbing, beatDuration])

  const handleSpill = async () => {
    if (!assets.length || isGenerating) return
    setIsGenerating(true)
    
    try {
      let safeSong = { ...song, duration: totalDuration }

      if (!safeSong.file && safeSong.url) {
        try {
          const res = await fetch(safeSong.url)
          const blob = await res.blob()
          safeSong.file = new File([blob], safeSong.name || 'audio.mp3', {
            type: blob.type || 'audio/mpeg'
          })
        } catch (err) {
          console.warn('Failed to reconstruct File from blob URL:', err)
        }
      }

      const generated = await generateReels({
        song: safeSong,
        assets,
        count: reelCount,
        modes,
        baseName: baseName.trim() || 'spill',
        existingLyrics: syncedLyrics.length > 0 ? syncedLyrics : undefined,
        captionStyle: style,
      })
      const reelsWithStyles = generated.map((r) => ({
        ...r,
        style: r.style || { ...style },
      }))
      setReels(reelsWithStyles)
      if (reelsWithStyles.length > 0) {
        setSelectedId(reelsWithStyles[0].id)
        setTime(0)
      }
    } catch (err) {
      console.error('Failed to generate reels:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleToggleMode = (mode: ReelMode, value: boolean) => {
    if (value) {
      setModes((prev) => [...prev, mode])
    } else {
      setModes((prev) => prev.filter((m) => m !== mode))
    }
  }

  const handleStartScrub = (clientX: number) => {
    setIsScrubbing(true)
    const newTime = snapToTick(xToTime(clientX))
    setTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground p-3 gap-3">
      {song.url && (
        <audio
          ref={audioRef}
          src={song.url}
          preload="auto"
          onTimeUpdate={(e) => {
            if (isPlaying && !isScrubbing) {
              setTime(e.currentTarget.currentTime)
            }
          }}
          onEnded={() => {
            setIsPlaying(false)
            if (cuePoint !== null) {
              setTime(cuePoint)
              if (audioRef.current) audioRef.current.currentTime = cuePoint
            }
          }}
        />
      )}

      <main className="flex flex-1 flex-col overflow-hidden space-y-3">
        <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-3 overflow-hidden">
          <SongPanel
            song={song}
            onChange={(patch) => setSong((s) => ({ ...s, ...patch }))}
            onLyricsAligned={handleLyricsAligned}
          />
          <ContentPanel assets={assets} onChange={setAssets} />
          <FontPanel
            style={activeStyle}
            onChange={(patch) => {
              if (activeReel) {
                setReels((prev) =>
                  prev.map((r) =>
                    r.id === activeReel.id
                      ? {
                          ...r,
                          style: { ...(r.style || style), ...patch },
                          ...(patch.fontId !== undefined ? { fontId: patch.fontId } : {}),
                        }
                      : r
                  )
                )
              }
              setStyle((s) => ({ ...s, ...patch }))
              if (patch.randomFont !== undefined) {
                setReels((prev) =>
                  prev.map((r) => ({
                    ...r,
                    fontId: patch.randomFont
                      ? GOOGLE_FONTS[Math.floor(Math.random() * GOOGLE_FONTS.length)].id
                      : r.fontId,
                  }))
                )
              }
            }}
            customFonts={customFonts}
            onUploadFont={(f) => setCustomFonts((prev) => [...prev, f])}
          />
          <OutputPanel
            reels={reels}
            selectedId={activeReel?.id || null}
            onSelectReel={setSelectedId}
            onSpill={handleSpill}
            modes={modes}
            onToggleMode={handleToggleMode}
            baseName={baseName}
            onChangeBaseName={setBaseName}
            reelCount={reelCount}
            onChangeReelCount={setReelCount}
          />
        </div>

        <div className="w-full bg-black flex m-0 p-0 relative touch-none select-none">
          <div className="flex flex-col shrink-0 cursor-default">
            <div className="flex items-center h-6 bg-black">
              <span className="w-16 font-mono text-[9px] uppercase tracking-widest text-cream-dim">beat</span>
            </div>
            <div className="flex items-center h-8 bg-black">
              <span className="w-16 font-mono text-[9px] uppercase tracking-widest text-cream-dim">video</span>
            </div>
            <div className="flex items-center h-8 bg-black">
              <span className="w-16 font-mono text-[9px] uppercase tracking-widest text-cream-dim">lyric</span>
            </div>
          </div>

          <div
            onPointerDown={(e) => {
              setSelectedLyricId(null)
              handleStartScrub(e.clientX)
            }}
            className="flex-1 flex flex-col relative pr-0 cursor-pointer"
          >
            <div ref={innerTrackRef} className="relative flex flex-col w-full h-full">
              <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                {Array.from({ length: totalBeats }).map((_, beatIndex) => {
                  const beatInBar = beatIndex % 4
                  const isBig = beatInBar === 0
                  const isMedium = beatInBar === 2
                  const leftPositionSeconds = beatIndex * beatDuration

                  return (
                    <div
                      key={beatIndex}
                      className={cn(
                        'absolute top-0 bottom-0 pointer-events-none',
                        isBig && 'w-[2px] bg-white/40 h-full',
                        isMedium && 'w-[1px] bg-white/25 h-3/5',
                        !isBig && !isMedium && 'w-[1px] bg-white/10 h-2/5',
                      )}
                      style={{
                        left: `${(leftPositionSeconds / duration) * 100}%`,
                      }}
                    />
                  )
                })}
              </div>

              <div
                onPointerDown={(e) => {
                  e.stopPropagation()
                  handleStartScrub(e.clientX)
                }}
                className="flex items-center h-6 bg-black relative cursor-pointer z-10"
              >
                <div className="w-full h-2 bg-transparent relative">
                  {visualMarkers.map((m, i) => {
                    const b = m.time
                    const isCue = cuePoint === b
                    const isActive = Math.abs(time - b) < 0.001
                    return (
                      <div
                        key={i}
                        style={{ left: pct(b) }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          setCuePoint(b)
                          handleStartScrub(e.clientX)
                        }}
                        className={cn(
                          'absolute top-0 bottom-0 w-[12px] -ml-[6px] cursor-pointer z-10 flex items-center justify-center group',
                        )}
                        title={`Cue Beat: ${b}s`}
                      >
                        <div
                          className={cn(
                            'transition-all rounded-xs',
                            m.type === 'big' && 'w-[3px] h-full',
                            m.type === 'medium' && 'w-[2px] h-[70%]',
                            m.type === 'small' && 'w-[1px] h-[40%]',
                            isCue
                              ? 'bg-yellow-200/80 border border-yellow-300/60 shadow-[0_0_8px_rgba(253,224,71,0.4)]'
                              : isActive
                              ? 'bg-cream'
                              : 'bg-white/40 group-hover:bg-cream/60',
                          )}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="relative flex flex-col z-10">
                <div
                  style={{ left: pct(time) }}
                  className="absolute inset-y-0 -ml-[1px] w-[2px] bg-cream z-40 pointer-events-none shadow-[0_0_6px_rgba(255,255,255,0.6)]"
                />

                <div
                  onPointerDown={(e) => {
                    handleStartScrub(e.clientX)
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const assetIdData = e.dataTransfer.getData('text/plain')
                    const assetJson = e.dataTransfer.getData('application/json')
                    let assetId = assetIdData
                    if (!assetId && assetJson) {
                      try {
                        const parsed = JSON.parse(assetJson)
                        assetId = parsed.id
                      } catch {}
                    }
                    if (!assetId) return

                    const droppedAsset = assetMap.get(assetId)
                    if (!droppedAsset) return

                    if (activeReel) setSelectedId(activeReel.id)
                    const dropTime = xToTime(e.clientX)
                    const oneBarDuration = 4 * beatDuration
                    const targetClipDuration = Math.min(droppedAsset.duration || oneBarDuration, oneBarDuration)

                    setReels((prev) =>
                      prev.map((r) => {
                        if (r.id !== (activeReel?.id || r.id)) return r
                        const clips = [...r.clips]

                        const targetClipIndex = clips.findIndex(
                          (c) => Math.abs(dropTime - c.start) <= 0.3 || (dropTime >= c.start && dropTime <= c.start + 0.3)
                        )

                        if (targetClipIndex !== -1) {
                          const existingClip = clips[targetClipIndex]
                          const curDur = existingClip.end - existingClip.start
                          clips[targetClipIndex] = {
                            ...existingClip,
                            assetId,
                            offset: 0,
                            end: +Math.min(r.duration, existingClip.start + Math.min(curDur, droppedAsset.duration)).toFixed(3),
                          }
                        } else {
                          const newStart = snapToTick(dropTime)
                          const newEnd = snapToTick(Math.min(maxDur, newStart + targetClipDuration))
                          const newClip = {
                            id: `clip-${Math.random().toString(36).substring(2, 9)}`,
                            assetId,
                            start: newStart,
                            end: newEnd > newStart ? newEnd : +(newStart + beatDuration).toFixed(3),
                            offset: 0,
                          }

                          const filteredClips = clips.map((c) => {
                            if (c.start < newClip.start && c.end > newClip.start && c.end <= newClip.end) {
                              return { ...c, end: newClip.start }
                            }
                            if (c.start >= newClip.start && c.start < newClip.end && c.end > newClip.end) {
                              return { ...c, start: newClip.end }
                            }
                            return c
                          }).filter((c) => !(c.start >= newClip.start && c.end <= newClip.end) && c.end - c.start >= 0.05)

                          filteredClips.push(newClip)
                          filteredClips.sort((a, b) => a.start - b.start)
                          clips.length = 0
                          clips.push(...filteredClips)
                        }

                        return { ...r, clips }
                      })
                    )
                  }}
                  className="h-8 bg-black flex items-stretch border-b-2 border-border relative cursor-pointer"
                >
                  <div className="w-full h-full bg-transparent relative overflow-hidden">
                    {clips.map((c) => {
                      const clipAsset = assetMap.get(c.assetId)
                      const isDraggingThis = drag?.id === c.id
                      return (
                        <div
                          key={c.id}
                          style={{ left: pct(c.start), width: pct(c.end - c.start) }}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            if (activeReel) setSelectedId(activeReel.id)
                            if (!editing) return
                            startDragging({
                              id: c.id,
                              type: 'clip',
                              edge: 'move',
                              originX: e.clientX,
                              start: c.start,
                              end: c.end,
                            })
                          }}
                          className={cn(
                            'absolute inset-y-0 flex items-center overflow-hidden border px-1 bg-black',
                            isDraggingThis ? 'z-30 shadow-lg border-cream' : 'z-20 border-white/40',
                            editing ? 'cursor-grab' : 'cursor-pointer',
                          )}
                        >
                          <span className="truncate font-mono text-[9px] uppercase tracking-[0.1em] text-white/90">
                            {clipAsset?.name || 'Clip'}
                          </span>
                          {editing &&
                            (['left', 'right'] as const).map((edge) => (
                              <span
                                key={edge}
                                role="presentation"
                                onPointerDown={(e) => {
                                  e.stopPropagation()
                                  if (activeReel) setSelectedId(activeReel.id)
                                  startDragging({
                                    id: c.id,
                                    type: 'clip',
                                    edge,
                                    originX: e.clientX,
                                    start: c.start,
                                    end: c.end,
                                  })
                                }}
                                className={cn(
                                  'absolute inset-y-0 w-1.5 cursor-ew-resize bg-cream/80 hover:bg-cream',
                                  edge === 'left' ? 'left-0' : 'right-0',
                                )}
                              />
                            ))}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div
                  onPointerDown={(e) => {
                    handleStartScrub(e.clientX)
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const text = e.dataTransfer.getData('text/plain')
                    if (!text || e.dataTransfer.getData('application/json')) return
                    const dropTime = xToTime(e.clientX)
                    const defaultLen = 2.5
                    const newLyric = {
                      id: Math.random().toString(36).substring(2, 9),
                      text,
                      start: +dropTime.toFixed(3),
                      end: +(dropTime + defaultLen).toFixed(3),
                    }

                    setReels((prev) =>
                      prev.map((r) => ({
                        ...r,
                        lyrics: [...r.lyrics, newLyric],
                      }))
                    )
                    setSelectedLyricId(newLyric.id)
                  }}
                  className="h-8 bg-black flex items-stretch relative cursor-pointer"
                >
                  <div className="w-full h-full bg-transparent relative overflow-hidden">
                    {lyrics.map((l) => {
                      const isSelected = selectedLyricId === l.id
                      const isDraggingThis = drag?.id === l.id
                      return (
                        <div
                          key={l.id}
                          style={{ left: pct(l.start), width: pct(l.end - l.start) }}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            if (activeReel) setSelectedId(activeReel.id)
                            setSelectedLyricId(l.id)
                            if (!editing) return
                            startDragging({
                              id: l.id,
                              type: 'lyric',
                              edge: 'move',
                              originX: e.clientX,
                              start: l.start,
                              end: l.end,
                            })
                          }}
                          className={cn(
                            'absolute inset-y-0 flex items-center overflow-hidden border px-1 bg-black transition-colors',
                            isDraggingThis ? 'z-30 shadow-lg' : isSelected ? 'z-25' : 'z-20',
                            editing ? 'cursor-grab' : 'cursor-pointer',
                            isSelected
                              ? 'border-yellow-300/80 shadow-[inset_0_0_8px_rgba(253,224,71,0.3)]'
                              : 'border-white/40',
                          )}
                        >
                          <span className="truncate font-mono text-[9px] uppercase tracking-[0.1em] text-white/90">
                            {l.text}
                          </span>
                          {editing &&
                            (['left', 'right'] as const).map((edge) => (
                              <span
                                key={edge}
                                role="presentation"
                                onPointerDown={(e) => {
                                  e.stopPropagation()
                                  if (activeReel) setSelectedId(activeReel.id)
                                  setSelectedLyricId(l.id)
                                  startDragging({
                                    id: l.id,
                                    type: 'lyric',
                                    edge,
                                    originX: e.clientX,
                                    start: l.start,
                                    end: l.end,
                                  })
                                }}
                                className={cn(
                                  'absolute inset-y-0 w-1.5 cursor-ew-resize transition-colors',
                                  isSelected
                                    ? 'bg-yellow-300 shadow-[0_0_6px_rgba(253,224,71,0.6)]'
                                    : 'bg-cream/80',
                                  edge === 'left' ? 'left-0' : 'right-0',
                                )}
                              />
                            ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <aside className="relative flex h-full aspect-[9/16] shrink-0 flex-col items-center justify-center bg-transparent">
        <ReelStage
          reels={reels}
          selectedId={selectedId}
          onSelectReel={setSelectedId}
          reel={activeReel}
          time={time}
          isPlaying={isPlaying}
          assetMap={assetMap}
          style={style}
          customFonts={customFonts}
          onSpill={handleSpill}
        />
      </aside>
    </div>
  )
}