import { useState, useEffect } from 'react'
import type { Lang } from 'dating-core/types'

export interface SplashScreenProps {
  logoUrl?: string
  isVideo?: boolean
  duration?: number
  onComplete: () => void
}

export function SplashScreen({ logoUrl, isVideo, duration = 2500, onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          setTimeout(onComplete, 300)
          return 100
        }
        return p + 4
      })
    }, duration / 25)

    return () => clearInterval(interval)
  }, [duration, onComplete])

  return (
    <div className="fixed inset-0 z-[60] bg-[#0A0A0A] flex flex-col items-center justify-center">
      {isVideo && logoUrl ? (
        <video
          src={logoUrl}
          autoPlay
          muted
          loop={false}
          playsInline
          className="w-40 h-40 object-contain"
        />
      ) : logoUrl ? (
        <img src={logoUrl} alt="Logo" className="w-40 h-40 object-contain" />
      ) : (
        <div className="w-40 h-40 rounded-2xl bg-[#FF6B35] flex items-center justify-center text-white text-4xl font-bold">
          ♥
        </div>
      )}

      <div className="mt-8 w-48 h-1 bg-[#2C2C2E] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FF6B35] rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
