import { useState } from 'react'
import { Send } from 'lucide-react'
import { t, type Lang } from 'dating-core/i18n'

export function BottomNav({ lang, cooldownRemaining, onSend }: { lang: Lang; cooldownRemaining: number; onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1C1C1E]/95 backdrop-blur-lg border-t border-[#2C2C2E] px-4 py-3 z-50">
      <div className="flex items-center gap-2 max-w-md mx-auto">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(lang, 'message')}
          className="flex-1 bg-[#2C2C2E] text-white rounded-full px-4 py-2 text-sm outline-none placeholder-[#8E8E93]"
          maxLength={100}
        />
        <button
          onClick={() => {
            if (!text.trim() || cooldownRemaining > 0) return
            onSend(text.trim())
            setText('')
          }}
          disabled={cooldownRemaining > 0 || !text.trim()}
          className={`p-2 rounded-full ${cooldownRemaining > 0 || !text.trim() ? 'bg-[#3A3A3C] text-[#8E8E93]' : 'bg-[#FF6B35] text-white'}`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      {cooldownRemaining > 0 && (
        <p className="text-center text-[#8E8E93] text-xs mt-1">{cooldownRemaining}s cooldown</p>
      )}
    </div>
  )
}
