'use client'

import type { Reel, ReelMode } from '@/lib/types'
import { Panel } from '@/components/primitives'

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
  status = 'idle',
}: OutputPanelProps) {
  const toggle = (m: ReelMode, v: boolean) => {
    if (onToggleMode) {
      onToggleMode(m, v)
    }
  }

  const displayBase = !baseName || baseName.toLowerCase() === 'reel' ? 'spill' : baseName

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
      title="OUTPUT"
      meta={<div className="font-mono text-[11px]">{renderStatus()}</div>}
    >
      <div className="flex flex-col h-full min-h-0 gap-3">
        {/* Naming Convention Input */}
        <div className="relative flex items-center shrink-0">
          <input
            type="text"
            value={baseName}
            onChange={(e) => onChangeBaseName?.(e.target.value)}
            placeholder="spill"
            className="w-full border border-border bg-black py-1.5 pl-2.5 pr-28 font-mono text-xs text-white placeholder-white/20 focus:border-cream/60 focus:outline-none"
          />
          <span className="absolute right-2.5 pointer-events-none text-[9px] font-mono text-white/30 truncate max-w-[100px]">
            → {displayBase} 1, {displayBase} 2, ...
          </span>
        </div>

        {/* Reel Types */}
        <div className="flex flex-col gap-1.5 flex-1 min-h-0">
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">
              REEL TYPES
            </span>
            <span className="text-[9px] text-white/30 font-mono">
              (if none chosen engine defaults to virality)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 overflow-y-auto">
            {ALL_MODES.map((m) => {
              const checked = Array.isArray(modes) && modes.includes(m)
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggle(m, !checked)}
                  className={`flex items-center justify-between border p-2 text-left font-mono transition cursor-pointer ${
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
      </div>
    </Panel>
  )
}