// src/components/logo.tsx
'use client'

import { useState, useEffect } from 'react'

const ART_FRAMES = [
  [
    ' ______',
    '|~~~~~~|__',
    'click me!  )',
    '|______|_/',
    ' \\    /',
    '  \\__/ ,',
    '    , °',
    '   °',
  ],
  [
    ' ______',
    '|~~~~~~|__',
    'click me!  )',
    '|______|_/',
    ' \\    /',
    '  \\__/ °',
    '    ° ,',
    '   ,',
  ],
  [
    ' ______',
    '|~~~~~~|__',
    'click me! )',
    '|______|_/',
    ' \\    /',
    '  \\__/ ,',
    '    ° °',
    '   ,',
  ],
]

interface LogoProps {
  onClick?: () => void
}

export function Logo({ onClick }: LogoProps) {
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % ART_FRAMES.length)
    }, 400)

    return () => clearInterval(timer)
  }, [])

  const currentFrame = ART_FRAMES[frameIndex] || ART_FRAMES[0]

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-end text-right leading-none transition hover:opacity-80 active:scale-95 focus:outline-none"
    >
      <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.3em] text-cream">
        reel spill
      </div>
      <pre
        aria-hidden="true"
        className="translate-x-[4px] font-mono text-[14px] leading-[1.15] text-cream/70 group-hover:text-cream whitespace-pre"
      >
        {currentFrame.join('\n')}
      </pre>
      <span className="sr-only">Reel Spill</span>
    </button>
  )
}
