'use client'

import { useRef } from 'react'
import type { VideoAsset } from '@/lib/types'
import { Panel } from '@/components/primitives'

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
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto shrink-0">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center justify-between border border-border bg-black px-3 py-1.5 font-mono text-xs text-white"
              >
                <span className="truncate pr-2">{asset.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(asset.id)
                  }}
                  className="text-white/40 hover:text-white cursor-pointer"
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