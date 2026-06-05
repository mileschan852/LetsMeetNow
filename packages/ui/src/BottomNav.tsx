import { useState } from 'react'
import { Send, Grid3X3, Users, Gift, Wallet } from 'lucide-react'
import { t, type Lang } from 'dating-core/i18n'

interface BottomNavProps {
  lang: Lang
  cooldownRemaining: number
  onSend: (text: string) => void
  groupChatUrl?: string
  referShareUrl?: string
  walletUrl?: string
}

export function BottomNav({
  lang,
  cooldownRemaining,
  onSend,
  groupChatUrl,
  referShareUrl,
  walletUrl,
}: BottomNavProps) {
  const [inputText, setInputText] = useState('')

  const openLink = (url: string) => {
    try {
      const tg = (window as any).Telegram?.WebApp
      if (tg?.openTelegramLink) { tg.openTelegramLink(url); return }
      if (tg?.openLink) { tg.openLink(url, { try_instant_view: false }); return }
    } catch {}
    window.open(url, '_blank')
  }

  const handleGroupChat = () => {
    if (groupChatUrl) openLink(groupChatUrl)
  }

  const handleRefer = () => {
    if (referShareUrl) openLink(referShareUrl)
  }

  const handleWallet = () => {
    if (walletUrl) openLink(walletUrl)
  }

  const handleSend = () => {
    if (!inputText.trim() || cooldownRemaining > 0) return
    const text = inputText.trim()
    onSend(text)
    setInputText('')
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#2C2C2E]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="w-full max-w-[min(520px,100vw)] mx-auto">
        <div className="flex items-center gap-2 px-3 py-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t(lang, 'message')}
            className="flex-1 h-9 px-3 rounded-full bg-[#1A1A1A] border border-[#2C2C2E] text-sm text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#FF6B35]/50"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || cooldownRemaining > 0}
            className="w-9 h-9 rounded-full bg-[#FF6B35] flex items-center justify-center nav-press disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <nav className="h-14 flex items-center justify-around">
          <button className="nav-press flex flex-col items-center gap-0.5 min-w-[50px] text-[#FF6B35]">
            <Grid3X3 className="w-5 h-5" />
            <span className="text-[9px] font-medium">{t(lang, 'profiles')}</span>
          </button>
          <button onClick={handleGroupChat} className="nav-press flex flex-col items-center gap-0.5 min-w-[50px] text-[#FF6B35]">
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-medium">{t(lang, 'groupChat')}</span>
          </button>
          <button onClick={handleRefer} className="nav-press flex flex-col items-center gap-0.5 min-w-[50px] text-[#FF6B35]">
            <Gift className="w-5 h-5" />
            <span className="text-[9px] font-medium">{t(lang, 'refer')}</span>
          </button>
          <button onClick={handleWallet} className="nav-press flex flex-col items-center gap-0.5 min-w-[50px] text-[#FF6B35]">
            <Wallet className="w-5 h-5" />
            <span className="text-[9px] font-medium">{t(lang, 'wallet')}</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
