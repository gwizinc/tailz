'use client'

import { useEffect, useState } from 'react'

import { Progress } from './progress'

interface LoadingProgressProps {
  className?: string
  label?: string
}

export function LoadingProgress({
  className,
  label = 'Loading...',
}: LoadingProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Simulate loading progress with realistic animation
    const timer = setTimeout(() => setProgress(13), 100)
    const timer2 = setTimeout(() => setProgress(25), 300)
    const timer3 = setTimeout(() => setProgress(45), 600)
    const timer4 = setTimeout(() => setProgress(66), 1000)
    const timer5 = setTimeout(() => setProgress(85), 1400)
    const timer6 = setTimeout(() => setProgress(95), 1800)

    return () => {
      clearTimeout(timer)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
      clearTimeout(timer5)
      clearTimeout(timer6)
    }
  }, [])

  return (
    <div className="flex items-center justify-center h-screen bg-background text-foreground">
      <div className="w-1/2 max-w-md space-y-4">
        <div className="text-center text-sm text-muted-foreground">{label}</div>
        <Progress value={progress} className={className} />
      </div>
    </div>
  )
}
