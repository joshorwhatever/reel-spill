'use client'

import { useRef } from 'react'
import type { SongState } from '@/lib/types'
import { Panel, Field } from '@/components/primitives'
import { GripVertical } from 'lucide-react'

interface SongPanelProps {
  song: SongState
  onChange: (patch: Partial<SongState>) => void
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0m00s'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}m${secs.toString().padStart(2, '0')}s`
}

export function SongPanel({ song, onChange }: SongPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const beatDuration = 60 / (song.bpm || 120)

  const lyricLines = song.lyrics
    ? song.lyrics.split('\n').map((l) => l.trim()).filter(Boolean)
    : []

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.src = url
    audio.onloadedmetadata = () => {
      onChange({
        name: file.name,
        url,
        duration: audio.duration || 32,
      })
    }
  }

  return (
    <Panel
      n="01"
      title="SONG"
      meta={
        <div className="flex items-center gap-2">
          {song.name && (
            <span className="font-mono text-[11px] text-cream-dim font-normal">
              length {formatDuration(song.duration)}
            </span>
          )}
          {song.name ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="font-mono text-[11px] text-white/60 hover:text-white transition-colors truncate max-w-[140px] text-right cursor-pointer"
              title="Click to change song"
            >
              {song.name}
            </button>
          ) : (
            <span className="font-mono text-[11px] text-cream-dim/50">no file</span>
          )}
        </div>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />

      <div className="flex flex-col h-full min-h-0">
        {!song.name ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) handleFile(f)
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-0 flex flex-col items-center justify-center border border-dashed border-border/60 hover:border-cream/50 cursor-pointer p-6 text-center transition-colors bg-white/[0.01]"
          >
            <span className="font-mono text-xs uppercase tracking-widest text-white/90 mb-1">
              DROP AUDIO
            </span>
            <span className="font-mono text-[10px] text-white/40">mp3 · wav · m4a</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <Field label="BPM">
                <input
                  type="number"
                  value={song.bpm}
                  onChange={(e) => onChange({ bpm: Number(e.target.value) })}
                  className="bg-black border border-border px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-cream/60"
                />
              </Field>
              <Field label="BEAT">
                <input
                  type="text"
                  readOnly
                  value={`${beatDuration.toFixed(3)}s`}
                  className="bg-black border border-border px-3 py-2 font-mono text-xs text-white/70 focus:outline-none"
                />
              </Field>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-h-0">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                LYRICS — {lyricLines.length} LINES
              </span>
              <textarea
                rows={2}
                value={song.lyrics}
                onChange={(e) => onChange({ lyrics: e.target.value })}
                placeholder="one line per row&#10;the engine weights each line by syllables"
                className="bg-black border border-border p-2 font-mono text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-cream/60 resize-none shrink-0"
              />
              
              {/* Draggable individual lyric lines list */}
              {lyricLines.length > 0 && (
                <div className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto mt-1 pr-1">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-cream-dim/70">
                    Drag lines to timeline:
                  </span>
                  <div className="flex flex-col gap-1">
                    {lyricLines.map((line, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', line)
                        }}
                        className="flex items-center gap-1.5 bg-black border border-border/80 hover:border-yellow-300/50 hover:bg-yellow-200/10 px-2 py-1 cursor-grab active:cursor-grabbing transition-colors"
                        title="Drag onto lyric timeline track"
                      >
                        <GripVertical className="h-3 w-3 text-white/40 shrink-0" />
                        <span className="font-mono text-[10px] text-white/90 truncate">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}