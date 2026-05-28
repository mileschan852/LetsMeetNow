import { useState } from 'react'
import type { Lang, Raffle } from 'dating-core/types'

export interface RafflePanelProps {
  raffle: Raffle | null
  lang: Lang
  isAdmin: boolean
  ticketCount: number
  onBuyTicket: () => void
  onStartNext: () => void
}

export function RafflePanel({ raffle, lang, isAdmin, ticketCount, onBuyTicket, onStartNext }: RafflePanelProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  if (!raffle) {
    if (isAdmin) {
      return (
        <div className="px-3 py-2">
          <button
            onClick={onStartNext}
            className="w-full py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            🎁 Start New Raffle
          </button>
        </div>
      )
    }
    return (
      <div className="px-3 py-2 text-center text-[#8E8E93] text-xs">
        🎁 No active raffle right now
      </div>
    )
  }

  const progress = Math.min(100, ((raffle.current_tickets || 0) / (raffle.target_tickets || 1)) * 100)
  const isFull = (raffle.current_tickets || 0) >= (raffle.target_tickets || 1)

  return (
    <div className="mx-3 mb-2 rounded-xl bg-[#1A1A1A] border border-[#2C2C2E] overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-white text-sm font-semibold">🎁 Raffle #{raffle.id.slice(0, 4)}</span>
        <span className="text-[#FF6B35] text-xs">{raffle.prize_type}</span>
      </div>

      <div className="px-3 pb-2">
        <div className="flex justify-between text-xs text-[#8E8E93] mb-1">
          <span>{raffle.current_tickets || 0} / {raffle.target_tickets || 20} tickets</span>
          <span>Your tickets: {ticketCount}</span>
        </div>
        <div className="h-2 bg-[#2C2C2E] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#FF6B35] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="px-3 pb-3 flex gap-2">
        {!isFull ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex-1 py-2.5 rounded-lg bg-[#FF6B35] text-white text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            🎟️ Buy Ticket — 50 ⭐
          </button>
        ) : (
          <div className="flex-1 py-2.5 rounded-lg bg-[#2C2C2E] text-[#8E8E93] text-sm text-center">
            🎉 Full! Drawing soon...
          </div>
        )}
        {isAdmin && (
          <button
            onClick={onStartNext}
            className="px-3 py-2.5 rounded-lg bg-[#2C2C2E] text-[#8E8E93] text-sm"
          >
            Next
          </button>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] rounded-2xl p-5 max-w-sm w-full space-y-4">
            <h3 className="text-white text-lg font-semibold text-center">Buy Raffle Ticket?</h3>
            <p className="text-[#8E8E93] text-sm text-center">
              50 Stars for a chance to win <span className="text-[#FF6B35]">{raffle.prize_type}</span>!
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-[#2C2C2E] text-white text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); onBuyTicket() }}
                className="flex-1 py-3 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold"
              >
                Buy — 50 ⭐
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
