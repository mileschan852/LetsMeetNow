import { useState, useEffect, useCallback } from 'react'

export interface UnlockTip {
  text: string
  isAction?: boolean
  actionId?: string
}

export interface UnlockTipCycleProps {
  tips: UnlockTip[]
  intervalMs?: number
  onActionTip?: (tip: UnlockTip) => void
  className?: string
}

export function UnlockTipCycle({ tips, intervalMs = 5000, onActionTip, className }: UnlockTipCycleProps) {
  const [idx, setIdx] = useState(0)
  const safeTips = tips.length ? tips : [{ text: '' }]

  useEffect(() => {
    const i = setInterval(() => setIdx(j => (j + 1) % safeTips.length), intervalMs)
    return () => clearInterval(i)
  }, [safeTips.length, intervalMs])

  const current = safeTips[idx % safeTips.length]

  return (
    <button
      onClick={() => {
        if (current.isAction && onActionTip) {
          onActionTip(current)
        }
      }}
      className={`w-full text-center py-2 px-3 text-sm rounded-lg transition-colors ${
        current.isAction
          ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 cursor-pointer'
          : 'bg-gray-800/50 text-gray-400'
      } ${className || ''}`}
    >
      <span className="flex items-center justify-center gap-2">
        {current.isAction && <span>💡</span>}
        <span className="font-medium">{current.text}</span>
      </span>
    </button>
  )
}
