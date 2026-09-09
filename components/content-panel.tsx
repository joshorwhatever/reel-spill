// src/components/content-panel.tsx
'use client'

import { useRef } from 'react'
import type { VideoAsset } from '@/lib/types'
import { Panel } from '@/components/primitives'
import { GripVertical } from 'lucide-react'

interface ContentPanelProps {
  assets?: VideoAsset[]
  onChange: React.Dispatch<React.SetStateAction<VideoAsset[]>>
}

export function ContentPanel({ assets = [], onChange }: ContentPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const newAssets: VideoAsset[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      url: URL.createObjectURL(file),
      file,
    }))
    onChange((prev) => [...(prev || []), ...newAssets])
  }

  const handleRemove = (id: string) => {
    onChange((prev) => (prev || []).filter((a) => a.id !== id))
  }

  return (
    <Panel
      n="02"
      title="CONTENT"
      meta={
        <div className="flex items-center">
          <span className="font-mono text-[11px] text-white/40">
            {assets.length} {assets.length === 1 ? 'clip' : 'clips'}
          </span>
        </div>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex flex-col h-full min-h-0 gap-3">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className="flex-1 min-h-0 flex flex-col items-center justify-center border border-dashed border-border/60 hover:border-cream/50 cursor-pointer p-6 text-center transition-colors bg-white/[0.01]"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-white/90 mb-1">
            DROP FOOTAGE
          </span>
          <span className="font-mono text-[10px] text-white/40">mp4 • mov • webm</span>
        </div>

        {assets.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto shrink-0 p-1 border border-border/40 bg-black/40">
            {assets.map((asset) => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', asset.id)
                  e.dataTransfer.setData('application/json', JSON.stringify(asset))
                }}
                title={asset.name}
                className="flex items-center gap-1.5 border border-border bg-black px-2 py-1.5 font-mono text-xs text-white select-none cursor-grab active:cursor-grabbing hover:bg-white/10 hover:border-white/30 group transition-colors rounded-xs min-w-0"
              >
                <GripVertical className="h-3 w-3 shrink-0 text-yellow-300 opacity-70 group-hover:opacity-100" />
                <span className="truncate min-w-0 flex-1">{asset.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(asset.id)
                  }}
                  className="text-white/40 hover:text-white cursor-pointer shrink-0 ml-auto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}