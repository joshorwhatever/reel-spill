'use client'

import { useEffect, useRef, useState } from 'react'
import type { CaptionStyle, CustomFont, Reel, VideoAsset } from '@/lib/types'
import { resolveFont } from '@/lib/fonts'
import { Logo } from '@/components/logo'
import { ChevronDown } from 'lucide-react'

interface ReelStageProps {
  reels?: Reel[]
  selectedId?: string | null
  onSelectReel?: (id: string) => void
  reel: Reel | null
  time: number
  isPlaying: boolean
  assetMap: Map<string, VideoAsset>
  style: CaptionStyle
  customFonts: CustomFont[]
  onSpill?: () => void
}

export function ReelStage({
  reels = [],
  selectedId = null,
  onSelectReel,
  reel,
  time,
  isPlaying,
  assetMap,
  style,
  customFonts,
  onSpill,
}: ReelStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const logoRef = useRef<HTMLDivElement | null>(null)

  const [logoSize, setLogoSize] = useState({ width: 96, height: 80 })
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const currentClip = reel?.clips?.find((c) => time >= c.start && time < c.end)
  const asset = currentClip ? assetMap.get(currentClip.assetId) : null
  const currentLine = reel?.lyrics?.find((l) => time >= l.start && time <= l.end)

  // Measure exact bounding dimensions so border notch dynamically recalculates
  useEffect(() => {
    if (!logoRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setLogoSize({
          width: entry.borderBoxSize[0]?.inlineSize || entry.contentRect.width,
          height: entry.borderBoxSize[0]?.blockSize || entry.contentRect.height,
        })
      }
    })

    observer.observe(logoRef.current)
    return () => observer.disconnect()
  }, [])

  // Safely load Google Fonts stylesheet so canvas can render them instantly
  useEffect(() => {
    const fontInfo = resolveFont(style.fontId, customFonts)
    if (fontInfo?.family && !fontInfo.family.startsWith('up-')) {
      const fontName = fontInfo.name.replace(/\s+/g, '+')
      const linkId = `google-font-${style.fontId}`
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link')
        link.id = linkId
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@700&display=swap`
        document.head.appendChild(link)
      }
    }
  }, [style.fontId, customFonts])

  // Force video reload when asset changes to avoid black frames
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load()
    }
  }, [asset?.id])

  // Sync video play/pause state and time offset seamlessly
  useEffect(() => {
    if (!videoRef.current || !currentClip || !asset) return
    const video = videoRef.current
    const targetTime = time - currentClip.start + currentClip.offset

    if (isPlaying) {
      if (video.paused) {
        video.play().catch(() => {})
      }
      if (Math.abs(video.currentTime - targetTime) > 0.3) {
        video.currentTime = targetTime
      }
    } else {
      video.pause()
      video.currentTime = targetTime
    }
  }, [time, isPlaying, currentClip, asset])

  // Canvas frame & lyric text rendering loop reacting to all style changes
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const video = videoRef.current
    if (!ctx) return

    let animationId: number

    const drawFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (asset && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      } else {
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      if (currentLine?.text) {
        const textToDraw = style.uppercase
          ? currentLine.text.toUpperCase()
          : currentLine.text

        // Resolve font family safely and apply to canvas context
        const fontInfo = resolveFont(style.fontId, customFonts)
        const fontFamily = fontInfo?.stack || fontInfo?.family || 'sans-serif'
        const fontSize = style.size * 2.2

        ctx.font = `700 ${fontSize}px ${fontFamily}`

        if ('letterSpacing' in ctx) {
          ctx.letterSpacing = `${style.tracking || 0}em`
        }

        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const centerX = canvas.width / 2
        let centerY = canvas.height / 2

        if (style.align === 'top') centerY = canvas.height * 0.2
        if (style.align === 'bottom') centerY = canvas.height * 0.8

        if (style.shadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
          ctx.shadowBlur = 18
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 4
        } else {
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }

        ctx.fillStyle = '#ffffff'
        ctx.fillText(textToDraw, centerX, centerY)
      }

      if (isPlaying) {
        animationId = requestAnimationFrame(drawFrame)
      }
    }

    drawFrame()

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [time, isPlaying, currentClip, currentLine, style, asset, customFonts])

  return (
    <div className="relative h-full w-auto aspect-[9/16] bg-black">
      {/* 1. Inner Video Display Surface */}
      <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
        {!reel ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
            No reel selected
          </div>
        ) : (
          <>
            {asset && (
              <video
                ref={videoRef}
                src={asset.url}
                aria-hidden="true"
                className="hidden"
                playsInline
                muted
                preload="auto"
              />
            )}

            <canvas
              ref={canvasRef}
              width={1080}
              height={1920}
              className="h-full w-full object-cover"
            />
          </>
        )}
      </div>

      {/* Top-Left Dropdown Menu Switcher */}
      <div className="absolute left-3 top-3 z-30">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md border border-white/20 bg-black/80 px-2.5 py-1 backdrop-blur-md transition hover:bg-black shadow-lg"
          >
            <span className="max-w-[120px] truncate font-mono text-[10px] uppercase tracking-wider text-white">
              {reel?.name || 'Select Output'}
            </span>
            <ChevronDown className="h-3 w-3 text-white/70" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-48 rounded-md border border-white/15 bg-zinc-900/95 p-1 shadow-xl backdrop-blur-lg z-40">
              {reels.length === 0 ? (
                <div className="px-3 py-2 text-center font-mono text-[10px] text-white/40">
                  No outputs generated
                </div>
              ) : (
                reels.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onSelectReel?.(r.id)
                      setDropdownOpen(false)
                    }}
                    className={`w-full text-left rounded px-2 py-1.5 font-mono text-[10px] transition ${
                      r.id === selectedId
                        ? 'bg-white/20 text-white font-medium'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {r.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Precision Cutout Borders */}
      <div className="pointer-events-none absolute inset-0 rounded-xl border-l border-b border-white/10" />
      <div
        className="pointer-events-none absolute top-0 left-0 border-t border-white/10"
        style={{ width: `calc(100% - ${logoSize.width}px)` }}
      />
      <div
        className="pointer-events-none absolute right-0 bottom-0 border-r border-white/10"
        style={{ top: `${logoSize.height}px` }}
      />

      {/* 3. Floating ASCII Logo (Pinned directly to top-right origin) */}
      <div
        ref={logoRef}
        className="absolute top-0 right-0 z-30 pointer-events-auto leading-none overflow-hidden pr-0.5"
      >
        <Logo onClick={onSpill} />
      </div>
    </div>
  )
}