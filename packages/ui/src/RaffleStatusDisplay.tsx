import { useState, useEffect } from 'react'
import { t, type Lang } from 'dating-core/i18n'
import type { Raffle } from 'dating-core'

export function RaffleStatusDisplay({ raffle, lang }: { raffle: Raffle | null; lang: Lang }) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [showCountdown, setShowCountdown] = useState(false)

  // Countdown timer effect — targets raffle.ends_at (8pm next day)
  useEffect(() => {
    if (!raffle?.ends_at || raffle.status !== 'active') {
      setTimeLeft(0)
      return
    }
    const update = () => {
      const end = new Date(raffle.ends_at!).getTime()
      setTimeLeft(Math.max(0, end - Date.now()))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [raffle?.ends_at, raffle?.status])

  // Cycle: message marquee (5s) ↔ countdown (5s) only when active
  useEffect(() => {
    if (!raffle || raffle.status !== 'active') {
      setShowCountdown(false)
      return
    }
    const cycle = setInterval(() => {
      setShowCountdown(prev => !prev)
    }, 5000)
    return () => clearInterval(cycle)
  }, [raffle?.status])

  // ── Build message text ──
  let messageText = ''
  let isRed = false

  if (!raffle || raffle.status === 'completed') {
    if (raffle?.winner_name) {
      const prizeLabel = raffle.prize_type === 'filters' ? '🔓 FILTER' : '👁️ INVISIBLE'
      messageText = `${t(lang, 'raffleWinnerCongrats')}: ${raffle.winner_name} — ${prizeLabel}`
      isRed = false
    } else {
      messageText = t(lang, 'raffleNoDraws')
      isRed = true
    }
  } else if (raffle.status === 'pending') {
    const prizeLabel = raffle.prize_type === 'filters' ? '🔓 FILTER' : '👁️ INVISIBLE'
    const price = raffle.ticket_price || 100
    messageText = `${price}★ ${prizeLabel} — ${t(lang, 'raffleForSale')}`
    isRed = false
  } else if (raffle.status === 'active') {
    const prizeLabel = raffle.prize_type === 'filters' ? '🔓 FILTER' : '👁️ INVISIBLE'
    messageText = `${t(lang, 'raffleLive')} — ${prizeLabel}`
    isRed = false
  }

  // ── Countdown text ──
  const h = Math.floor(timeLeft / 3600000)
  const m = Math.floor((timeLeft % 3600000) / 60000)
  const s = Math.floor((timeLeft % 60000) / 1000)
  const countdownText = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  const neonColor = isRed ? '#FF4444' : '#00FF41'
  const neonShadow = isRed
    ? '0 0 4px #FF4444, 0 0 8px #FF4444'
    : '0 0 4px #00FF41, 0 0 8px #00FF41, 0 0 12px #00CC33'
  const borderColor = isRed ? 'rgba(255,68,68,0.35)' : 'rgba(0,255,65,0.3)'
  const insetGlow = isRed
    ? 'inset 0 0 8px rgba(255,68,68,0.15)'
    : 'inset 0 0 8px rgba(0,255,65,0.15)'

  const displayCountdown = raffle?.status === 'active' && showCountdown && timeLeft > 0

  return (
    <div
      className="relative overflow-hidden rounded bg-black/85"
      style={{
        width: '90px',
        height: '22px',
        border: `1px solid ${borderColor}`,
        boxShadow: `${insetGlow}, 0 0 4px ${borderColor}`,
      }}
    >
      {/* ── Marquee message (scrolls R → L) ── */}
      {!displayCountdown && (
        <div className="absolute inset-0 flex items-center" style={{ overflow: 'hidden' }}>
          <span
            className="whitespace-nowrap text-[11px] font-bold tracking-wider absolute"
            style={{
              fontFamily: '"Courier New", "Consolas", monospace',
              color: neonColor,
              textShadow: neonShadow,
              animation: 'marquee-scroll 4s linear infinite',
            }}
          >
            {messageText}
          </span>
        </div>
      )}

      {/* ── Static countdown ── */}
      {displayCountdown && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[11px] font-bold tracking-widest"
            style={{
              fontFamily: '"Courier New", "Consolas", monospace',
              color: neonColor,
              textShadow: neonShadow,
            }}
          >
            {countdownText}
          </span>
        </div>
      )}
    </div>
  )
}
