{/* Dynamic Ableton Timeline Grid Lines */}
<div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
  {(() => {
    const bpm = reel?.bpm || 120
    const secondsPerBeat = 60 / bpm
    const totalBeats = Math.ceil(duration / secondsPerBeat)

    return Array.from({ length: totalBeats }).map((_, beatIndex) => {
      const beatInBar = beatIndex % 4
      const isBig = beatInBar === 0
      const isMedium = beatInBar === 2
      const leftPositionSeconds = beatIndex * secondsPerBeat

      return (
        <div
          key={beatIndex}
          className={cn(
            'absolute top-0 bottom-0 pointer-events-none',
            isBig && 'w-[2px] bg-white/40 h-full',
            isMedium && 'w-[1px] bg-white/25 h-3/5',
            !isBig && !isMedium && 'w-[1px] bg-white/10 h-2/5',
          )}
          style={{
            left: `${(leftPositionSeconds / duration) * 100}%`,
          }}
        />
      )
    })
  )()}
</div>