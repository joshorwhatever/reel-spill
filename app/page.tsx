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
  Reel,
  ReelMode,
  SongState,
  VideoAsset,
} from '@/lib/types'

type Drag = {
  id: string
  edge: 'move' | 'left' | 'right'
  originX: number
  start: number
  end: number
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modes, setModes] = useState<ReelMode[]>([])
  const [baseName, setBaseName] = useState<string>('')

  const [style, setStyle] = useState<CaptionStyle>({
    fontId: GOOGLE_FONTS[0].id,
    size: 42,
    tracking: 0,
    uppercase: false,
    align: 'center',
    shadow: true,
  })

  const [time, setTime] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [editing, setEditing] = useState<boolean>(false)

  const [drag, setDrag] = useState<Drag | null>(null)
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false)
  const trackAreaRef = useRef<HTMLDivElement | null>(null)
  const innerTrackRef = useRef<HTMLDivElement | null>(null)

  const assetMap = new Map(assets.map((a) => [a.id, a]))
  const activeReel = reels.find((r) => r.id === selectedId) || reels[0] || null

  const beatDuration = 60 / (song.bpm || 120)
  const hypotheticalReel: Reel = activeReel || {
    id: 'hypothetical',
    name: 'Hypothetical Track',
    duration: song.duration || 32,
    clips: [],
    lyrics: [],
  }

  // Extend timeline duration by two extra beat slots to add one more tick and hit the right boundary correctly.
  const baseDuration = hypotheticalReel.duration || 1
  const duration = baseDuration + beatDuration * 2
  const clips = hypotheticalReel.clips || []
  const lyrics = hypotheticalReel.lyrics || []
  const pct = (t: number) => `${(t / duration) * 100}%`

  // Generate beat markers up to baseDuration + beatDuration so one extra tick is added
  const beats: number[] = []
  for (let t = 0; t <= baseDuration + beatDuration + 0.001; t += beatDuration) {
    beats.push(+t.toFixed(3))
  }

  const snapToBeat = (t: number) => {
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

  const latest = useRef({ drag, hypotheticalReel, duration, isScrubbing })
  latest.current = { drag, hypotheticalReel, duration, isScrubbing }

  // Global Keyboard Shortcuts (Spacebar & Arrow Keys) - Allows sliders/buttons, blocks only text inputs
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

      const maxDur = activeReel ? activeReel.duration : song.duration || 32

      if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying((prev) => !prev)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        setTime((t) => Math.min(maxDur, +(t + beatDuration).toFixed(3)))
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        setTime((t) => Math.max(0, +(t - beatDuration).toFixed(3)))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [beatDuration, activeReel, song.duration])

  // Playback Timer Loop (30fps with automatic Reel/TikTok Looping)
  useEffect(() => {
    if (!isPlaying) return
    const maxDur = activeReel ? activeReel.duration : song.duration || 32
    const interval = setInterval(() => {
      setTime((t) => {
        if (t >= maxDur) {
          return 0 // Loops back to start seamlessly without stopping playback
        }
        return +(t + 0.033).toFixed(3)
      })
    }, 33)
    return () => clearInterval(interval)
  }, [isPlaying, activeReel, song.duration])

  // Timeline Drag & Scrub Listeners
  useEffect(() => {
    if (!drag && !isScrubbing) return

    const move = (e: PointerEvent) => {
      const { drag: d, duration: dur, isScrubbing: scrubbing } = latest.current
      const box = innerTrackRef.current?.getBoundingClientRect()
      if (!box) return

      if (scrubbing) {
        const rawTime = Math.max(0, Math.min(dur, ((e.clientX - box.left) / box.width) * dur))
        const newTime = snapToBeat(rawTime)
        setTime(+newTime.toFixed(3))
        return
      }

      if (!d || !activeReel) return
      const delta = ((e.clientX - d.originX) / box.width) * dur
      const min = 0.08
      const reelDur = activeReel.duration

      setReels((prev) =>
        prev.map((r) => {
          if (r.id !== activeReel.id) return r
          return {
            ...r,
            lyrics: r.lyrics.map((l) => {
              if (l.id !== d.id) return l
              if (d.edge === 'move') {
                const len = d.end - d.start
                const start = snapToBeat(Math.max(0, Math.min(reelDur - len, d.start + delta)))
                return {
                  ...l,
                  start: +start.toFixed(3),
                  end: +(start + len).toFixed(3),
                }
              } else if (d.edge === 'left') {
                const start = snapToBeat(Math.max(0, Math.min(d.end - min, d.start + delta)))
                return { ...l, start: +start.toFixed(3) }
              } else {
                const end = snapToBeat(Math.min(reelDur, Math.max(d.start + min, d.end + delta)))
                return { ...l, end: +end.toFixed(3) }
              }
            }),
          }
        })
      )
    }

    const stop = () => {
      setDrag(null)
      setIsScrubbing(false)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [drag, isScrubbing, activeReel, beatDuration])

  const handleSpill = () => {
    if (!assets.length) return
    const generated = generateReels({
      song,
      assets,
      count: 6,
      modes,
      baseName: baseName.trim() || song.name || 'reel',
    })
    setReels(generated)
    if (generated.length > 0) {
      setSelectedId(generated[0].id)
      setTime(0)
    }
  }

  const handleToggleMode = (mode: ReelMode, value: boolean) => {
    if (value) {
      setModes((prev) => [...prev, mode])
    } else {
      setModes((prev) => prev.filter((m) => m !== mode))
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground p-3 gap-3">
      {/* Workspace Left Panels & Timeline */}
      <main className="flex flex-1 flex-col overflow-hidden space-y-3">
        {/* 2x2 Grid with exact equal sizing for all 4 panels */}
        <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-3 overflow-hidden">
          <SongPanel
            song={song}
            onChange={(patch) => setSong((s) => ({ ...s, ...patch }))}
          />
          <FontPanel
            style={style}
            onChange={(patch) => setStyle((s) => ({ ...s, ...patch }))}
            onChangeStyle={(patch) => setStyle((s) => ({ ...s, ...patch }))}
            customFonts={customFonts}
            onUploadFont={(f) => setCustomFonts((prev) => [...prev, f])}
            onSpill={handleSpill}
          />
          <ContentPanel assets={assets} onChange={setAssets} />
          <OutputPanel
            reels={reels}
            selectedId={activeReel?.id || null}
            onSelectReel={setSelectedId}
            onSpill={handleSpill}
            modes={modes}
            onToggleMode={handleToggleMode}
            baseName={baseName}
            onChangeBaseName={setBaseName}
          />
        </div>

        {/* Flush Unified Three-Section Timeline at the Bottom */}
        <div className="w-full bg-black flex m-0 p-0 relative touch-none select-none">
          {/* Left Column: Row Labels */}
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

          {/* Right Column: Shared Track Content Area */}
          <div
            ref={trackAreaRef}
            onPointerDown={(e) => {
              setIsScrubbing(true)
              setTime(snapToBeat(xToTime(e.clientX)))
            }}
            className="flex-1 flex flex-col relative pl-4 pr-0 cursor-pointer"
          >
            <div ref={innerTrackRef} className="relative flex flex-col w-full h-full">
              {/* Track 1: beat */}
              <div className="flex items-center h-6 bg-black relative">
                <div className="w-full h-2 bg-transparent relative">
                  {beats.map((b, i) => {
                    const isActive = time >= b && time < b + beatDuration
                    return (
                      <div
                        key={i}
                        style={{ left: pct(b) }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          setTime(b)
                        }}
                        className={cn(
                          'absolute top-0 bottom-0 w-[2px] -ml-[1px] cursor-pointer z-10 transition-colors',
                          isActive ? 'bg-cream' : 'bg-white/40 hover:bg-cream/60',
                        )}
                        title={`Beat: ${b}s`}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Video & Lyric Wrapper containing the continuous playhead */}
              <div className="relative flex flex-col">
                {/* Playhead line matched to beat tick thickness (w-[2px] -ml-[1px]) */}
                <div
                  aria-hidden="true"
                  style={{ left: pct(time) }}
                  className="pointer-events-none absolute inset-y-0 w-[2px] -ml-[1px] bg-cream z-30"
                />

                {/* Track 2: video */}
                <div className="h-8 bg-black flex items-stretch border-b-2 border-border">
                  <div className="w-full h-full bg-transparent relative overflow-hidden flex">
                    {clips.map((c) => (
                      <div
                        key={c.id}
                        style={{ width: pct(c.end - c.start) }}
                        className={cn(
                          'h-full border-r border-border/30 transition-colors',
                          time >= c.start && time < c.end ? 'bg-cream/85' : 'bg-white/10',
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Track 3: lyric */}
                <div className="h-8 bg-black flex items-stretch">
                  <div className="w-full h-full bg-transparent relative overflow-hidden">
                    {lyrics.map((l) => (
                      <div
                        key={l.id}
                        style={{ left: pct(l.start), width: pct(l.end - l.start) }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          if (activeReel) setSelectedId(activeReel.id)
                          if (!editing) return
                          setDrag({
                            id: l.id,
                            edge: 'move',
                            originX: e.clientX,
                            start: l.start,
                            end: l.end,
                          })
                        }}
                        className={cn(
                          'absolute inset-y-0 flex items-center overflow-hidden border px-1 z-20',
                          editing ? 'cursor-grab' : 'cursor-pointer',
                          activeReel?.id === selectedId && l.id
                            ? 'border-cream bg-cream/25'
                            : 'border-white/25 bg-white/10',
                        )}
                      >
                        <span className="truncate font-mono text-[9px] uppercase tracking-[0.1em] text-white/85">
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
                                setDrag({
                                  id: l.id,
                                  edge,
                                  originX: e.clientX,
                                  start: l.start,
                                  end: l.end,
                                })
                              }}
                              className={cn(
                                'absolute inset-y-0 w-1.5 cursor-ew-resize bg-cream/80',
                                edge === 'left' ? 'left-0' : 'right-0',
                              )}
                            />
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reel Stage Preview */}
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