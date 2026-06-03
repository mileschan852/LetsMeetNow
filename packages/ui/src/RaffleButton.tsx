import { t, type Lang } from 'dating-core/i18n'
import type { Raffle } from 'dating-core'

export function RaffleButton({
  raffle,
  isAdmin,
  onBuyTicket,
  onStartNextRaffle,
  lang,
}: {
  raffle: Raffle | null
  isAdmin: boolean
  onBuyTicket: () => void
  onStartNextRaffle: () => void
  lang: Lang
}) {
  // No raffle active — greyed out, admin can click to auto-start next raffle
  if (!raffle || raffle.status === 'completed') {
    return (
      <button
        onClick={() => {
          if (isAdmin) onStartNextRaffle()
        }}
        className={`w-7 h-7 rounded-full flex items-center justify-center nav-press text-[10px] border ${
          isAdmin
            ? 'bg-[#1A1A1A] text-[#8E8E93] border-[#2C2C2E] hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/30'
            : 'bg-[#1A1A1A] text-[#8E8E93] border-[#2C2C2E] opacity-50'
        }`}
        title={isAdmin ? t(lang, 'raffleStartNext') : t(lang, 'raffleNoDraws')}
      >
        🎁
      </button>
    )
  }

  // Pending raffle — show ticket count, clickable to buy
  if (raffle.status === 'pending') {
    const ticketInfo = `${raffle.current_tickets}/${raffle.target_tickets}`
    return (
      <button
        onClick={onBuyTicket}
        className="h-7 rounded-full flex items-center justify-center nav-press text-[10px] border px-1.5 gap-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
        title={`${t(lang, 'raffleBuyTicket')} — ${ticketInfo}`}
      >
        🎁
        <span className="text-[9px] font-bold">{ticketInfo}</span>
      </button>
    )
  }

  // Active raffle — pulsing, clickable to buy
  const ticketInfo = `${raffle.current_tickets}/${raffle.target_tickets}`
  return (
    <button
      onClick={onBuyTicket}
      className="h-7 rounded-full flex items-center justify-center nav-press text-[10px] border px-1.5 gap-1 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-300 border-yellow-500/40 animate-pulse"
      title={`${t(lang, 'raffleBuyTicket')} — ${ticketInfo}`}
    >
      🎁
      <span className="text-[9px] font-bold">{ticketInfo}</span>
    </button>
  )
}
