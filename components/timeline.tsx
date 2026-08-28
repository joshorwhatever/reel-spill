'use client'

import { useEffect, useRef, useState } from 'react'
import type { LyricLine, Reel, VideoAsset } from '@/lib/types'
import { cn } from '@/lib/utils'

type Drag = {
  id: string
  edge: 'move' | 'left' | 'right'
  originX: number
  start: number
  end: number
}

export function Timeline({
  reel,
  time = 0,
  editing = false,
  selected = null,
  onSelect = () => {},
  onSeek = () => {},
  onUpdateLine = () => {},
  assetMap = new Map(),
}: {
  reel?: Reel | null
  time?: number
  editing?: boolean
  selected?: string | null
  onSelect?: (id: string | null) => void
  onSeek?: (t: number) => void
  onUpdateLine?: (id: string, patch: Partial<LyricLine>) => void
  assetMap?: Map<string, VideoAsset>
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false)

  const duration = reel?.duration || 1
  const clips = reel?.clips || []
  const lyrics = reel?.lyrics || []

  const pct = (t: number) => `${(t / duration) * 100}%`

  function xToTime(clientX: number) {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box) return 0
    const x = Math.max(0, Math.min(clientX - box.left, box.width))
    return (x / box.width) * duration
  }

  const latest = useRef({ drag, reel, duration, onUpdateLine, isScrubbing, onSeek })
  latest.current = { drag, reel, duration, onUpdateLine, isScrubbing, onSeek }

  useEffect(() => {
    if (!drag && !isScrubbing) return

    const move = (e: PointerEvent) => {
      const { drag: d, duration: dur, onUpdateLine: up, isScrubbing: scrubbing, onSeek: seek } = latest.current
      const box = trackRef.current?.getBoundingClientRect()
      if (!box) return

      if (scrubbing) {
        const newTime = Math.max(0, Math.min(dur, xToTime(e.clientX)))
        seek(+newTime.toFixed(3))
        return
      }

      if (!d) return
      const delta = ((e.clientX - d.originX) / box.width) * dur
      const min = 0.08
      if (d.edge === 'move') {
        const len = d.end - d.start
        const start = Math.max(0, Math.min(dur - len, d.start + delta))
        up(d.id, {
          start: +start.toFixed(3),
          end: +(start + len).toFixed(3),
        })
      } else if (d.edge === 'left') {
        const start = Math.max(0, Math.min(d.end - min, d.start + delta))
        up(d.id, { start: +start.toFixed(3) })
      } else {
        const end = Math.min(
          dur,
          Math.max(d.start + min, d.end + delta),
        )
        up(d.id, { end: +end.toFixed(3) })
      }
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
  }, [drag, isScrubbing])

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 px-2 pb-2 pt-1.5 transition-opacity select-none',
        editing ? 'opacity-100' : 'opacity-70',
      )}
    >
      {/* 1. Video Clip Track */}
      <div className="flex h-2.5 w-full gap-px">
        {clips.map((c) => (
          <div
            key={c.id}
            style={{ width: pct(c.end - c.start) }}
            className={cn(
              'h-full border transition-colors',
              time >= c.start && time < c.end
                ? 'border-cream bg-cream/85'
                : 'border-white/20 bg-white/10',
            )}
          />
        ))}
      </div>

      {/* 2. Audio Track */}
      <div className="relative h-2 w-full bg-zinc-900 border border-white/10 rounded-sm overflow-hidden">
        {reel?.audioTrack && (
          <div
            className="absolute inset-y-0 bg-blue-500/40 border border-blue-400/50"
            style={{
              left: pct(reel.audioTrack.start),
              width: pct(reel.audioTrack.end - reel.audioTrack.start),
            }}
          />
        )}
      </div>

      {/* 3. Lyric Track */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            onSelect(null)
            setIsScrubbing(true)
            onSeek(xToTime(e.clientX))
          }
        }}
        className="relative h-7 w-full cursor-crosshair border border-white/15 bg-black/40 touch-none"
      >
        {lyrics.map((l) => (
          <div
            key={l.id}
            style={{ left: pct(l.start), width: pct(l.end - l.start) }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onSelect(l.id)
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
              'absolute inset-y-0 flex items-center overflow-hidden border px-1',
              editing ? 'cursor-grab' : 'cursor-pointer',
              selected === l.id
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
                    onSelect(l.id)
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

        {/* Playhead */}
        <div
          aria-hidden="true"
          style={{ left: pct(time) }}
          className="pointer-events-none absolute inset-y-0 w-px bg-cream z-20"
        />
      </div>

      {editing && (
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">
          drag block to move · drag edges to trim
        </p>
      )}
    </div>
  )
}