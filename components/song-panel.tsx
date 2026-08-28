'use client'

import { useRef, useState } from 'react'
import type { SongState } from '@/lib/types'
import { Panel, Field } from '@/components/primitives'
import { GripVertical, Edit3, Check } from 'lucide-react'

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isBulkEditing, setIsBulkEditing] = useState<boolean>(!song.lyrics)
  const beatDuration = 60 / (song.bpm || 120)

  // Filter out blank/empty lines for draggable mode
  const rawLines = song.lyrics ? song.lyrics.split('\n') : []
  const lyricLines = rawLines.filter((line) => line.trim().length > 0)

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.src = url
    audio.onloadedmetadata = () => {
      onChange({
        name: file.name,
        url,
        file,
        duration: audio.duration || 32,
      })
    }
  }

  const updateLineText = (idx: number, newText: string) => {
    const nextLines = [...lyricLines]
    nextLines[idx] = newText
    onChange({ lyrics: nextLines.join('\n') })
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
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                  LYRICS — {lyricLines.length} LINES
                </span>
                <button
                  type="button"
                  onClick={() => setIsBulkEditing(!isBulkEditing)}
                  className="font-mono text-[9px] uppercase tracking-widest text-yellow-300 hover:text-yellow-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {isBulkEditing ? (
                    <>
                      <Check className="h-2.5 w-2.5" /> Done
                    </>
                  ) : (
                    <>
                      <Edit3 className="h-2.5 w-2.5" /> Edit Raw Text
                    </>
                  )}
                </button>
              </div>

              <div className="relative flex-1 min-h-0 border border-border bg-black focus-within:border-cream/60 overflow-hidden">
                {isBulkEditing ? (
                  <textarea
                    autoFocus
                    value={song.lyrics}
                    onChange={(e) => onChange({ lyrics: e.target.value })}
                    placeholder="Paste entire lyrics block here (one line per row)..."
                    className="w-full h-full p-3 bg-transparent font-mono text-xs text-white placeholder:text-white/20 focus:outline-none resize-none leading-[22px]"
                  />
                ) : (
                  <div className="w-full h-full overflow-y-auto p-2 flex flex-col gap-1">
                    {lyricLines.map((line, idx) => {
                      const isEditingThis = editingIndex === idx

                      if (isEditingThis) {
                        return (
                          <div key={idx} className="h-[26px] flex items-center">
                            <input
                              autoFocus
                              type="text"
                              value={line}
                              onChange={(e) => updateLineText(idx, e.target.value)}
                              onBlur={() => setEditingIndex(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setEditingIndex(null)
                              }}
                              className="w-full bg-white/10 text-white font-mono text-xs px-2 py-1 focus:outline-none border border-cream/60 rounded-xs"
                            />
                          </div>
                        )
                      }

                      return (
                        <div
                          key={idx}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', line)
                          }}
                          onDoubleClick={() => setEditingIndex(idx)}
                          className="h-[26px] flex items-center gap-2 px-2 rounded transition-colors select-none cursor-grab active:cursor-grabbing hover:bg-white/10 border border-transparent hover:border-white/20 group"
                          title="Drag line to timeline (Double-click to edit)"
                        >
                          <GripVertical className="h-3 w-3 shrink-0 text-yellow-300 opacity-70 group-hover:opacity-100" />
                          <span className="font-mono text-xs text-white truncate w-full">
                            {line}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}