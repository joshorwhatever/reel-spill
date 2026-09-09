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
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const logoRef = useRef<HTMLDivElement | null>(null)

  const [logoSize, setLogoSize] = useState({ width: 96, height: 80 })
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const currentClip = reel?.clips?.find((c) => time >= c.start && time < c.end) || reel?.clips?.[0]
  const asset = currentClip ? assetMap.get(currentClip.assetId) : null
  const currentLine = reel?.lyrics?.find((l) => time >= l.start && time <= l.end)

  const effectiveStyle = {
    ...style,
    ...(reel?.style || {}),
  }

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

  useEffect(() => {
    const activeFontId = reel?.fontId || effectiveStyle.fontId
    const fontInfo = resolveFont(activeFontId, customFonts)
    const rawFamily = fontInfo?.family || fontInfo?.name || ''

    if (rawFamily && typeof rawFamily === 'string' && !rawFamily.startsWith('up-')) {
      const fontName = rawFamily.replace(/\s+/g, '+')
      const linkId = `google-font-${activeFontId}`
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link')
        link.id = linkId
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@700&display=swap`
        document.head.appendChild(link)
      }
    }

    if (fontInfo) {
      const familyName = typeof rawFamily === 'string' ? rawFamily : 'sans-serif'
      document.fonts.load(`700 16px "${familyName}"`).then(() => {
        drawCanvasFrame()
      }).catch(() => {
        drawCanvasFrame()
      })
    }
  }, [reel?.fontId, effectiveStyle.fontId, customFonts])

  useEffect(() => {
    if (!currentClip || !asset) return
    const videoEl = videoElementsRef.current.get(asset.id)
    if (!videoEl) return

    const rawTarget = time - currentClip.start + currentClip.offset
    const targetTime = Math.max(0, Math.min(rawTarget, asset.duration || 9999))

    if (isPlaying) {
      if (videoEl.paused) {
        videoEl.play().catch(() => {})
      }
      if (Math.abs(videoEl.currentTime - targetTime) > 0.3) {
        videoEl.currentTime = targetTime
      }
    } else {
      videoEl.pause()
      if (Math.abs(videoEl.currentTime - targetTime) > 0.05) {
        videoEl.currentTime = targetTime
      }
    }
  }, [time, isPlaying, currentClip, asset])

  const drawCanvasFrame = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const videoEl = asset ? videoElementsRef.current.get(asset.id) : null
    if (asset && videoEl && videoEl.readyState >= 2) {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
    } else {
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    if (currentLine?.text) {
      let textToDraw = effectiveStyle.uppercase
        ? currentLine.text.toUpperCase()
        : currentLine.text

      if (effectiveStyle.lines && effectiveStyle.lines > 0) {
        const words = textToDraw.split(' ')
        const linesArray: string[] = []
        const wordsPerLine = Math.ceil(words.length / effectiveStyle.lines)
        for (let i = 0; i < words.length; i += wordsPerLine) {
          linesArray.push(words.slice(i, i + wordsPerLine).join(' '))
        }
        textToDraw = linesArray.slice(0, effectiveStyle.lines).join('\n')
      }

      const activeFontId = reel?.fontId || effectiveStyle.fontId
      const fontInfo = resolveFont(activeFontId, customFonts)
      let rawFamily = fontInfo?.family || fontInfo?.name || 'sans-serif'
      if (typeof rawFamily !== 'string') rawFamily = 'sans-serif'

      let fontFamily = rawFamily
      if (!fontFamily.startsWith('up-') && fontFamily.includes(' ') && !fontFamily.startsWith('"')) {
        fontFamily = `"${fontFamily}", sans-serif`
      } else if (!fontFamily.startsWith('up-')) {
        fontFamily = `${fontFamily}, sans-serif`
      }

      const fontSize = effectiveStyle.size * 2.2
      ctx.font = `700 ${fontSize}px ${fontFamily}`

      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = `${effectiveStyle.tracking || 0}em`
      }

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const centerX = canvas.width / 2
      let centerY = canvas.height / 2

      if (effectiveStyle.align === 'top') centerY = canvas.height * 0.2
      if (effectiveStyle.align === 'bottom') centerY = canvas.height * 0.8

      if (effectiveStyle.shadow) {
        ctx.shadowColor = effectiveStyle.invert ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
        ctx.shadowBlur = 18
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 4
      } else {
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
      }

      ctx.fillStyle = effectiveStyle.invert ? '#000000' : '#ffffff'

      const linesToDraw = textToDraw.split('\n')
      const lineHeight = fontSize * 1.2
      const totalHeight = linesToDraw.length * lineHeight

      linesToDraw.forEach((line, idx) => {
        const lineY = centerY - totalHeight / 2 + lineHeight / 2 + idx * lineHeight
        ctx.fillText(line, centerX, lineY)
      })
    }
  }

  useEffect(() => {
    let animationId: number

    const renderLoop = () => {
      drawCanvasFrame()
      if (isPlaying) {
        animationId = requestAnimationFrame(renderLoop)
      }
    }

    renderLoop()

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [time, isPlaying, currentClip, currentLine, effectiveStyle, asset, customFonts, reel?.fontId])

  return (
    <div className="relative h-full w-auto aspect-[9/16] bg-black">
      {Array.from(assetMap.values()).map((ast) => (
        <video
          key={ast.id}
          ref={(el) => {
            if (el) videoElementsRef.current.set(ast.id, el)
          }}
          src={ast.url}
          aria-hidden="true"
          className="absolute inset-0 opacity-0 pointer-events-none object-cover"
          playsInline
          muted
          preload="auto"
          onLoadedData={drawCanvasFrame}
          onSeeked={drawCanvasFrame}
        />
      ))}

      <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
        {!reel ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
            No reel selected
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="absolute left-3 top-3 z-30">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md border border-white/20 bg-black/80 px-2.5 py-1 backdrop-blur-md transition hover:bg-black shadow-lg cursor-pointer"
          >
            <span className="max-w-[120px] truncate font-mono text-[10px] uppercase tracking-wider text-white">
              {reel?.name || 'Select Spill'}
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
                    className={`w-full text-left rounded px-2 py-1.5 font-mono text-[10px] transition cursor-pointer ${
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

      <div className="pointer-events-none absolute inset-0 rounded-xl border-l border-b border-white/10" />
      <div
        className="pointer-events-none absolute top-0 left-0 border-t border-white/10"
        style={{ width: `calc(100% - ${logoSize.width}px)` }}
      />
      <div
        className="pointer-events-none absolute right-0 bottom-0 border-r border-white/10"
        style={{ top: `${logoSize.height}px` }}
      />

      <div
        ref={logoRef}
        className="absolute top-0 right-0 z-30 pointer-events-auto leading-none overflow-hidden pr-0.5"
      >
        <Logo onClick={onSpill} />
      </div>
    </div>
  )
}