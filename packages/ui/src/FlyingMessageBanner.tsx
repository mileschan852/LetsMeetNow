import { useState, useEffect, useRef } from 'react'
import type { FlyingMessage, Lang } from 'dating-core/types'

export interface FlyingMessageBannerProps {
  messages: FlyingMessage[]
  lang: Lang
  onDismiss?: (id: string) => void
}

export function FlyingMessageBanner({ messages, lang, onDismiss }: FlyingMessageBannerProps) {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (messages.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent(i => (i + 1) % messages.length)
    }, 4000)
    return () => clearInterval(timerRef.current)
  }, [messages.length])

  if (!messages.length) return null

  const msg = messages[current]

  return (
    <div className="mx-3 mb-2 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 px-3 py-2 flex items-center gap-2">
      <span className="text-[#FF6B35] text-lg">✈️</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs truncate">
          <span className="text-[#FF6B35] font-medium">{msg.from_user_name}</span>
          <span className="text-[#8E8E93]"> → </span>
          <span className="text-[#8E8E93]">{msg.content}</span>
        </p>
      </div>
      {onDismiss && (
        <button
          onClick={() => onDismiss(msg.id)}
          className="text-[#8E8E93] hover:text-white text-xs px-1"
        >
          ✕
        </button>
      )}
    </div>
  )
}
