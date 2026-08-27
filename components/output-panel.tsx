'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import type { Reel, ReelMode } from '@/lib/types'
import { Panel, Field, Slider } from '@/components/primitives'

export type SpillStatus = 'idle' | 'spilling' | 'completed'

interface OutputPanelProps {
  reels?: Reel[]
  selectedId?: string | null
  onSelectReel?: (id: string) => void
  onSpill?: () => void
  modes?: ReelMode[]
  onToggleMode?: (mode: ReelMode, value: boolean) => void
  baseName?: string
  onChangeBaseName?: (name: string) => void
  reelCount?: number
  onChangeReelCount?: (count: number) => void
  status?: SpillStatus
}

const ALL_MODES: ReelMode[] = ['cut', 'hook', 'montage']

const MODE_LABEL: Record<ReelMode, string> = {
  cut: 'CUT',
  hook: 'HOOK',
  montage: 'MONTAGE',
}

const MODE_DESC: Record<ReelMode, string> = {
  cut: '1 beat / cut',
  hook: 'Bar-based, first 2s focus',
  montage: 'Cuts on line changes',
}

export function OutputPanel({
  reels = [],
  selectedId,
  onSelectReel,
  onSpill,
  modes = [],
  onToggleMode,
  baseName = '',
  onChangeBaseName,
  reelCount = 6,
  onChangeReelCount,
  status = 'idle',
}: OutputPanelProps) {
  const [isExporting, setIsExporting] = useState(false)

  const toggle = (m: ReelMode, v: boolean) => {
    if (onToggleMode) {
      onToggleMode(m, v)
    }
  }

  const displayBase = !baseName || baseName.toLowerCase() === 'reel' ? 'spill' : baseName

  const handleExportZip = async () => {
    if (!reels || reels.length === 0) return
    setIsExporting(true)

    try {
      // Dynamic CDN load to prevent bundler missing module errors
      const JSZipModule = await import('https://esm.sh/jszip@3.10.1' as any)
      const JSZip = JSZipModule.default || JSZipModule
      const zip = new JSZip()
      const folderName = displayBase

      reels.forEach((reel, index) => {
        const fileName = `${reel.name || `${folderName}_${index + 1}`}.json`
        const content = JSON.stringify(reel, null, 2)
        zip.file(fileName, content)
      })

      const blob = await zip.generateAsync({ type: 'blob' })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${folderName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to generate export zip:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const renderStatus = () => {
    switch (status) {
      case 'spilling':
        return <span className="text-white animate-pulse">spilling...</span>
      case 'completed':
        return <span className="text-white/40">spilled</span>
      case 'idle':
      default:
        return <span className="text-white/40">waiting to spill...</span>
    }
  }

  return (
    <Panel
      n="04"
      title="SPILL"
      meta={<div className="font-mono text-[11px]">{renderStatus()}</div>}
    >
      <div className="flex flex-col h-full min-h-0 gap-2">
        <div className="relative flex items-center shrink-0">
          <input
            type="text"
            value={baseName}
            onChange={(e) => onChangeBaseName?.(e.target.value)}
            placeholder="spill"
            className="w-full border border-border bg-black py-1 pl-2.5 pr-28 font-mono text-xs text-white placeholder-white/20 focus:border-cream/60 focus:outline-none"
          />
          <span className="absolute right-2.5 pointer-events-none text-[9px] font-mono text-white/30 truncate max-w-[100px]">
            → {displayBase} 1, {displayBase} 2, ...
          </span>
        </div>

        <div className="shrink-0">
          <Field label={`AMOUNT ${reelCount}`}>
            <Slider
              aria-label="Reel amount output"
              value={reelCount}
              min={1}
              max={20}
              step={1}
              onChange={(v) => onChangeReelCount?.(v)}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-h-0">
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">
              REEL TYPES
            </span>
            <span className="text-[9px] text-white/30 font-mono">
              (engine defaults to virality)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1 overflow-y-auto min-h-0">
            {ALL_MODES.map((m) => {
              const checked = Array.isArray(modes) && modes.includes(m)
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggle(m, !checked)}
                  className={`flex items-center justify-between border p-1.5 text-left font-mono transition cursor-pointer ${
                    checked
                      ? 'border-cream/70 bg-cream/10 text-cream'
                      : 'border-border bg-transparent text-cream-dim hover:border-cream/40'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="h-3 w-3 shrink-0 border border-white/30 flex items-center justify-center">
                      {checked && <div className="h-1.5 w-1.5 bg-cream" />}
                    </div>
                    <span className="text-xs font-medium">{MODE_LABEL[m]}</span>
                  </div>
                  <span className="text-[9px] text-white/30">{MODE_DESC[m]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={reels.length === 0 || isExporting}
          onClick={handleExportZip}
          className={`shrink-0 w-full flex items-center justify-center gap-1.5 border py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors cursor-pointer ${
            reels.length > 0 && !isExporting
              ? 'border-cream/70 bg-cream/10 text-cream hover:bg-cream/20'
              : 'border-border text-white/20 cursor-not-allowed opacity-50'
          }`}
        >
          <Download className="h-3 w-3" />
          <span>{isExporting ? 'exporting...' : `${displayBase}.zip`}</span>
        </button>
      </div>
    </Panel>
  )
}