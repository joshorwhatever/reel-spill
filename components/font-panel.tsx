'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Upload, ChevronDown } from 'lucide-react'
import type { CaptionStyle, CustomFont } from '@/lib/types'
import { GOOGLE_FONTS, resolveFont } from '@/lib/fonts'
import { Panel, Field, DropZone, Slider } from '@/components/primitives'
import { cn } from '@/lib/utils'

const uid = () => Math.random().toString(36).slice(2, 9)

export function FontPanel({
  style,
  onChange,
  onChangeStyle,
  customFonts,
  onAddFont,
  onUploadFont,
}: {
  style: CaptionStyle
  onChange?: (patch: Partial<CaptionStyle>) => void
  onChangeStyle?: (patch: Partial<CaptionStyle>) => void
  customFonts?: CustomFont[]
  onAddFont?: (f: CustomFont) => void
  onUploadFont?: (f: CustomFont) => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; right: number; width: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleChange = onChange || onChangeStyle || (() => {})
  const handleAddFont = onAddFont || onUploadFont || (() => {})
  const safeCustomFonts = customFonts || []

  const active = resolveFont(style?.fontId, safeCustomFonts)

  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right,
        width: Math.max(rect.width, 220),
      })
    }
    setDropdownOpen((prev) => !prev)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  async function loadFont(files: File[]) {
    for (const file of files) {
      const family = `up-${file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '-')}`
      const buf = await file.arrayBuffer()
      try {
        const face = new FontFace(family, buf)
        await face.load()
        document.fonts.add(face)
        const f = { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), family }
        handleAddFont(f)
        handleChange({ fontId: f.id })
      } catch {
        console.log('[v0] font load failed:', file.name)
      }
    }
  }

  return (
    <Panel
      n="03"
      title="TYPE"
      meta={
        <div className="relative pointer-events-auto">
          <button
            ref={buttonRef}
            type="button"
            onClick={toggleDropdown}
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 transition hover:bg-white/10 cursor-pointer"
          >
            <span
              className="max-w-[140px] truncate text-[13px] leading-none text-cream"
              style={{ fontFamily: active?.stack }}
            >
              {active?.name}
            </span>
            <ChevronDown className="h-3 w-3 text-cream-dim" />
          </button>

          {dropdownOpen &&
            coords &&
            createPortal(
              <div
                ref={dropdownRef}
                style={{
                  top: `${coords.top}px`,
                  right: `${coords.right}px`,
                  width: `${coords.width}px`,
                }}
                className="fixed max-h-60 overflow-y-auto rounded-md border border-white/15 bg-zinc-950 p-1 shadow-2xl z-[99999] text-left"
              >
                <div className="px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-white/40">
                  Google Fonts
                </div>
                {GOOGLE_FONTS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => {
                      handleChange({ fontId: font.id })
                      setDropdownOpen(false)
                    }}
                    className={cn(
                      'w-full text-left rounded px-2.5 py-1.5 text-xs transition flex flex-col cursor-pointer',
                      font.id === style?.fontId
                        ? 'bg-white/20 text-white font-medium'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <span className="text-sm truncate" style={{ fontFamily: font.stack }}>
                      {font.name}
                    </span>
                    {font.note && (
                      <span className="font-mono text-[9px] text-white/40 font-normal">
                        {font.note}
                      </span>
                    )}
                  </button>
                ))}

                {safeCustomFonts.length > 0 && (
                  <>
                    <div className="mt-1 border-t border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-white/40">
                      Uploaded
                    </div>
                    {safeCustomFonts.map((font) => (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => {
                          handleChange({ fontId: font.id })
                          setDropdownOpen(false)
                        }}
                        className={cn(
                          'w-full text-left rounded px-2.5 py-1.5 text-xs transition cursor-pointer truncate',
                          font.id === style?.fontId
                            ? 'bg-white/20 text-white font-medium'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        )}
                        style={{ fontFamily: font.family }}
                      >
                        {font.name}
                      </button>
                    ))}
                  </>
                )}
              </div>,
              document.body
            )}
        </div>
      }
    >
      <div className="flex flex-col h-full min-h-0 gap-2">
        <div className="flex flex-col gap-1 shrink-0">
          <Field label={`SIZE ${style?.size || 16}`}>
            <Slider
              aria-label="Caption size"
              value={style?.size || 16}
              min={16}
              max={110}
              onChange={(v) => handleChange({ size: v })}
            />
          </Field>

          <Field label={`SPACING ${(style?.tracking || 0).toFixed(2)}`}>
            <Slider
              aria-label="Caption spacing"
              value={style?.tracking || 0}
              min={-0.05}
              max={0.4}
              step={0.01}
              onChange={(v) => handleChange({ tracking: v })}
            />
          </Field>

          <div className="flex gap-1 mt-0.5">
            {(['top', 'center', 'bottom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={style?.align === p}
                onClick={() => handleChange({ align: p })}
                className={cn(
                  'flex-1 border py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors cursor-pointer',
                  style?.align === p
                    ? 'border-cream/70 bg-cream/10 text-cream'
                    : 'border-border text-cream-dim hover:border-cream/40',
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex gap-1 mt-0.5">
            {(
              [
                ['uppercase', style?.uppercase, 'AA'],
                ['shadow', style?.shadow, 'shadow'],
              ] as const
            ).map(([key, on, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => handleChange({ [key]: !on } as Partial<CaptionStyle>)}
                className={cn(
                  'flex-1 border py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors cursor-pointer',
                  on
                    ? 'border-cream/70 bg-cream/10 text-cream'
                    : 'border-border text-cream-dim hover:border-cream/40',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <DropZone 
          accept=".ttf,.otf,.woff,.woff2" 
          multiple 
          onFiles={loadFont}
          className="flex-1 min-h-0 py-0 flex items-center justify-center border border-dashed border-border/60 hover:border-cream/50 transition-colors bg-white/[0.01]"
        >
          <div className="flex items-center justify-center gap-1.5">
            <Upload className="size-3 text-cream-dim" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream-dim">
              upload font
            </span>
          </div>
        </DropZone>
      </div>
    </Panel>
  )
}