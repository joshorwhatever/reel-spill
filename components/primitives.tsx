'use client'

import type React from 'react'
import { cn } from '@/lib/utils'

export function Panel({
  n,
  title,
  meta,
  children,
  className,
}: {
  n: string
  title: string
  meta?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col border border-border bg-card h-full',
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2">
        <span className="label text-cream-dim">{n}</span>
        <h2 className="label text-foreground">{title}</h2>
        <div className="ml-auto min-w-0 truncate">{meta}</div>
      </header>
      {/* Changed overflow-y-auto to overflow-hidden */}
      <div className="min-h-0 flex-1 flex flex-col overflow-hidden p-3">{children}</div>
    </section>
  )
}

export function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'h-8 w-full border border-input px-2 font-mono text-xs text-foreground outline-none transition-colors focus:border-cream/60'

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  'aria-label': ariaLabel,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  'aria-label': string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-6 w-full cursor-pointer appearance-none bg-transparent outline-none [&::-webkit-slider-runnable-track]:h-px [&::-webkit-slider-runnable-track]:bg-cream-dim [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-[11px] [&::-webkit-slider-thumb]:w-[11px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-cream [&::-moz-range-thumb]:h-[11px] [&::-moz-range-thumb]:w-[11px] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-cream [&::-moz-range-track]:h-px [&::-moz-range-track]:bg-cream-dim"
      style={{ ['--pct' as string]: `${pct}%` }}
    />
  )
}

export function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-2.5 border border-border px-2.5 py-2 text-left transition-colors hover:border-cream/40"
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-[2px] grid size-3 shrink-0 place-items-center border',
          checked ? 'border-cream bg-cream' : 'border-cream-dim',
        )}
      >
        {checked && (
          <span className="h-[5px] w-[5px] bg-background" />
        )}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block font-mono text-[11px] uppercase tracking-[0.14em]',
            checked ? 'text-foreground' : 'text-cream-dim',
          )}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </button>
  )
}

export function DropZone({
  onFiles,
  accept,
  children,
  multiple,
  className,
}: {
  onFiles: (files: File[]) => void
  accept: string
  children: React.ReactNode
  multiple?: boolean
  className?: string
}) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        onFiles(Array.from(e.dataTransfer.files))
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-cream-dim px-3 py-4 text-center transition-colors hover:border-cream/70",
        className
      )}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []))
          e.currentTarget.value = ''
        }}
      />
      {children}
    </label>
  )
}