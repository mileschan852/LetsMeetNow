import React, { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import lmnLogo from './assets/lmn-logo.svg'
import lmnLogoAnim from './assets/lmn-logo-animated.mp4'
import {
  MapPin, X, MessageCircle, LocateFixed, RefreshCw,
  Eye, EyeOff, ArrowLeft, Lock, Gift, Unlock,
} from 'lucide-react'
import { t, tZodiac, type Lang, getLangLabel } from 'dating-core/i18n'
import {
  upsertUser, fetchNearby, setOnlineStatus, fetchUserUnlockStatus,
  getActiveRaffle, buyRaffleTicket, createRaffle, drawRaffleWinner, setRaffleDrawToNextWednesday,
  getZodiac, getZodiacEmoji, getAge, ensureFilterUnlock, type DbUser, type Raffle,
} from 'dating-core/supabase'
import { getTg, getUserId, makeStorage } from 'dating-core/storage'
import { requestPayment } from 'dating-core/payments'

const storage = makeStorage('lmn')

// ─── Types ───────────────────────────────────────────────────────────

interface UserProfile {
  id: number
  name: string
  tgPhotoUrl: string
  height: number
  weight: number
  lat: number
  lng: number
  gender: string          // Male | Female
  seekingGender: string   // Men | Women
  dob: string | null
  seekingToday: string | null  // Just Browsing | Chat | Meetup | Webcam
  meetupType: string | null    // Coffee | Meals | Outdoor | Charity | Bar & Parties | Bed
  isOnline: boolean
  isOwn: boolean
  updatedAt: string
  distance?: number
  isInvisible: boolean
  openToMessages: boolean
  hideAgeUntil: string | null
}

type View = 'MAIN' | 'OWN_PROFILE' | 'AGE_GATE' | 'GENDER_SETUP' | 'DISCLAIMER'

const ADMIN_IDS = [5202742795, 725368127]
const ADMIN_USERNAMES = ['mileschan852']
function isAdminUser(user: any) { return !!user?.id && (ADMIN_IDS.includes(user.id) || ADMIN_USERNAMES.includes(user?.username || '')) }

const ZODIAC_SIGNS = [
  { name: 'Aries', emoji: '\u2648' }, { name: 'Taurus', emoji: '\u2649' },
  { name: 'Gemini', emoji: '\u264A' }, { name: 'Cancer', emoji: '\u264B' },
  { name: 'Leo', emoji: '\u264C' }, { name: 'Virgo', emoji: '\u264D' },
  { name: 'Libra', emoji: '\u264E' }, { name: 'Scorpio', emoji: '\u264F' },
  { name: 'Sagittarius', emoji: '\u2650' }, { name: 'Capricorn', emoji: '\u2651' },
  { name: 'Aquarius', emoji: '\u2652' }, { name: 'Pisces', emoji: '\u2653' },
]

const GENDERS = ['Male', 'Female']
const SEEKING_GENDERS = ['Men', 'Women']
const SEEKING_TODAY_OPTS = ['Just Browsing', 'Chat', 'Meetup', 'Webcam']
const MEETUP_TYPES = ['Coffee', 'Meals', 'Outdoor', 'Charity', 'Bar & Parties', 'Bed']
const AGE_FILTERS = ['any', 'older', 'same', 'younger']

// ─── Helpers ─────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isRecentlyActive(updatedAt?: string): boolean {
  if (!updatedAt) return false
  return Date.now() - new Date(updatedAt).getTime() < 60 * 60 * 1000
}

function formatDist(d?: number): string {
  if (!d) return ''
  if (d < 1) return `${(d * 1000).toFixed(0)}m`
  return `${d.toFixed(1)}km`
}

function getTimeAgo(updatedAt?: string): string {
  if (!updatedAt) return ''
  const min = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  return `${Math.floor(hr / 24)}d`
}

function dbToProfile(u: DbUser, ownId: number): UserProfile {
  const dist = u.lat && u.lng ? undefined : undefined // calculated client-side
  return {
    id: u.id, name: u.name || 'User', tgPhotoUrl: u.photo_url || '',
    height: u.height || 0, weight: u.weight || 0, lat: u.lat || 0, lng: u.lng || 0,
    gender: u.gender || '', seekingGender: u.seeking_gender || '',
    dob: u.dob || null, seekingToday: u.seeking_today || null, meetupType: u.meetup_type || null,
    isOnline: u.is_online || false, isOwn: u.id === ownId, updatedAt: u.updated_at || '',
    distance: dist, isInvisible: !!u.invisible_until && new Date(u.invisible_until).getTime() > Date.now(),
    openToMessages: u.open_to_messages ?? true, hideAgeUntil: u.hide_age_until || null,
  }
}

// ─── Splash Screen ───────────────────────────────────────────────────

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fade, setFade] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 2500)
    const t2 = setTimeout(() => onDone(), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div className={`fixed inset-0 z-[80] bg-[#0A0A0A] flex flex-col items-center justify-center transition-opacity duration-500 ${fade ? 'opacity-0' : 'opacity-100'}`}>
      <video
        src={lmnLogoAnim}
        autoPlay
        muted
        playsInline
        loop
        className="w-28 h-28 rounded-2xl mb-4 object-cover"
      />
      <h1 className="text-3xl font-bold gradient-text tracking-tight mb-1">Let's Meet Now</h1>
      <p className="text-[#8E8E93] text-sm">Meet people nearby</p>
      <div className="absolute bottom-8">
        <div className="w-6 h-6 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

// ─── Disclaimer Modal ────────────────────────────────────────────────

function DisclaimerModal({ onAgree, lang }: { onAgree: () => void; lang: Lang }) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col items-center justify-center px-5">
      <img src={lmnLogo} alt="LMN" className="w-16 h-16 rounded-2xl mb-4" />
      <h1 className="text-xl font-bold gradient-text mb-1">Let's Meet Now</h1>
      <p className="text-[#8E8E93] text-xs mb-6">{t(lang, 'splashTagline')}</p>

      <div className="w-full max-w-sm bg-[#1A1A1A] border border-[#2C2C2E] rounded-xl p-5 space-y-4 max-h-[60vh] overflow-y-auto">
        <h2 className="text-white font-bold text-lg">{t(lang, 'disclaimerTitle')}</h2>

        <div className="space-y-3 text-[#8E8E93] text-xs leading-relaxed">
          <div className="flex items-start gap-2">
            <span className="text-[#FF6B35] font-bold flex-shrink-0">18+</span>
            <span>{t(lang, 'disclaimerAge')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#FF6B35] font-bold flex-shrink-0">📍</span>
            <span>{t(lang, 'disclaimerLoc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#FF6B35] font-bold flex-shrink-0">🤝</span>
            <span>{t(lang, 'disclaimerConduct')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#FF6B35] font-bold flex-shrink-0">🔒</span>
            <span>{t(lang, 'disclaimerPrivacy')}</span>
          </div>
        </div>

        <label className="flex items-start gap-2 cursor-pointer pt-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#2C2C2E] bg-[#0A0A0A] text-[#FF6B35] accent-[#FF6B35]"
          />
          <span className="text-[#8E8E93] text-xs">{t(lang, 'disclaimerAgree')}</span>
        </label>

        <button
          onClick={onAgree}
          disabled={!checked}
          className={`w-full h-11 rounded-xl text-white font-semibold text-sm nav-press ${
            checked ? 'gradient-btn' : 'bg-[#2C2C2E] text-[#8E8E93] cursor-not-allowed'
          }`}
        >
          {t(lang, 'disclaimerContinue')}
        </button>
      </div>
    </div>
  )
}

// ─── Age Gate ─────────────────────────────────────────────────────────

function AgeGate({ onConfirm, lang }: { onConfirm: (dob: string) => void; lang: Lang }) {
  const [dob, setDob] = useState('')
  const [err, setErr] = useState('')
  return (
    <div className="fixed inset-0 z-[60] bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
      <img src={lmnLogo} alt="LMN" className="w-20 h-20 rounded-2xl mb-4" />
      <h1 className="text-2xl font-bold text-white mb-1">Let's Meet Now</h1>
      <p className="text-[#8E8E93] text-sm mb-8">Meet people nearby</p>
      <div className="w-full max-w-sm bg-[#1A1A1A] border border-[#2C2C2E] rounded-xl p-5">
        <h2 className="text-white font-bold text-lg mb-1">Confirm Your Age</h2>
        <p className="text-[#8E8E93] text-xs mb-4">You must be 18 or older.</p>
        <input type="date" value={dob} onChange={e => setDob(e.target.value)}
          className="w-full h-10 bg-[#0A0A0A] border border-[#2C2C2E] rounded-lg px-3 text-white text-sm" />
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <button onClick={() => {
          if (!dob) { setErr('Please enter your date of birth'); return }
          const age = getAge(dob)
          if (age < 18) { setErr('You must be 18 or older'); return }
          onConfirm(dob)
        }} className="w-full h-11 mt-4 gradient-btn rounded-xl text-white font-semibold text-sm nav-press">
          Enter
        </button>
      </div>
    </div>
  )
}

// ─── Gender Setup ─────────────────────────────────────────────────────

function GenderSetup({ onComplete, lang }: { onComplete: (gender: string, seeking: string) => void; lang: Lang }) {
  const [gender, setGender] = useState('')
  const [seeking, setSeeking] = useState('')
  const [err, setErr] = useState('')
  return (
    <div className="fixed inset-0 z-[60] bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm bg-[#1A1A1A] border border-[#2C2C2E] rounded-xl p-5">
        <h2 className="text-white font-bold text-lg mb-4">Set Up Profile</h2>
        <p className="text-[#8E8E93] text-xs mb-3">I am:</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {GENDERS.map(g => (
            <button key={g} onClick={() => setGender(g)}
              className={`h-12 rounded-xl font-semibold text-sm nav-press ${
                gender === g ? 'bg-[#FF6B35]/10 text-[#FF6B35] border-2 border-[#FF6B35]' : 'bg-[#0A0A0A] text-white border border-[#2C2C2E]'
              }`}>
              {g === 'Male' ? t(lang, 'genderMale', 'lmn') : t(lang, 'genderFemale', 'lmn')}
            </button>
          ))}
        </div>
        <p className="text-[#8E8E93] text-xs mb-3">Looking for:</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {SEEKING_GENDERS.map(g => (
            <button key={g} onClick={() => setSeeking(g)}
              className={`h-12 rounded-xl font-semibold text-sm nav-press ${
                seeking === g ? 'bg-[#5AC8FA]/10 text-[#5AC8FA] border-2 border-[#5AC8FA]' : 'bg-[#0A0A0A] text-white border border-[#2C2C2E]'
              }`}>
              {g === 'Men' ? t(lang, 'seekingMen', 'lmn') : t(lang, 'seekingWomen', 'lmn')}
            </button>
          ))}
        </div>
        {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
        <button onClick={() => {
          if (!gender || !seeking) { setErr('Please select both'); return }
          onComplete(gender, seeking)
        }} className="w-full h-11 gradient-btn rounded-xl text-white font-semibold text-sm nav-press">
          Continue
        </button>
      </div>
    </div>
  )
}

// ─── Profile Grid Tile ───────────────────────────────────────────────

function ProfileTile({ user, onClick }: { user: UserProfile; onClick: () => void }) {
  const zodiac = user.dob ? getZodiac(user.dob) : ''
  const emoji = zodiac ? getZodiacEmoji(zodiac) : ''
  const hiddenAge = user.hideAgeUntil && new Date(user.hideAgeUntil).getTime() > Date.now()
  const age = user.dob ? (hiddenAge ? 'N/A' : String(getAge(user.dob))) : '?'
  return (
    <button onClick={onClick} className="card-enter tile-aspect rounded-lg overflow-hidden nav-press text-left" style={{ minHeight: '68px' }}>
      {user.tgPhotoUrl ? (
        <img src={user.tgPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#2C2C2E] to-[#1A1A1A] flex items-center justify-center">
          <span className="text-lg font-bold text-[#8E8E93]">{user.name.charAt(0)}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
      {user.isInvisible && (
        <div className="absolute top-0.5 left-0.5 z-30 w-3 h-3 rounded-full bg-purple-500/40 border border-purple-400/30 flex items-center justify-center text-[7px]">
          👁️‍🗨️
        </div>
      )}
      {user.openToMessages && (
        <div className="absolute top-0.5 left-4 z-30 w-3 h-3 rounded-full bg-black/50 flex items-center justify-center text-[7px]">⭐</div>
      )}
      {user.isOnline && <div className="absolute top-0.5 right-0.5 z-30 w-2 h-2 bg-[#00D4AA] rounded-full" />}
      {user.isOwn && <div className="absolute inset-0 border-2 border-[#FF6B35] rounded-lg pointer-events-none z-30" />}
      <div className="absolute bottom-0 left-0 right-0 px-[3px] pb-[1px] z-30 pointer-events-none">
        <p className={`font-semibold text-[8px] truncate ${user.isOwn ? 'text-[#FF6B35]' : 'text-white'}`}>
          {user.isOwn ? 'You' : user.name}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[#FF6B35] text-[7px]">{formatDist(user.distance)}</span>
          <span className="text-[#8E8E93] text-[6px]">{age} {emoji}</span>
        </div>
        <p className="text-[6px] text-[#8E8E93]">{user.seekingToday || ''} {user.meetupType ? `| ${user.meetupType}` : ''}</p>
      </div>
    </button>
  )
}

// ─── Photo Overlay ────────────────────────────────────────────────────

function PhotoOverlay({ user, onClose, lang }: { user: UserProfile; onClose: () => void; lang: Lang }) {
  const zodiac = user.dob ? getZodiac(user.dob) : ''
  const emoji = zodiac ? getZodiacEmoji(zodiac) : ''
  const hiddenAge = user.hideAgeUntil && new Date(user.hideAgeUntil).getTime() > Date.now()
  const age = user.dob ? (hiddenAge ? 'Hidden' : getAge(user.dob)) : '?'
  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-in fade-in duration-200">
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#1A1A1A]/80 flex items-center justify-center z-20 nav-press">
        <X className="w-5 h-5 text-white" />
      </button>
      <div className="flex-1 flex items-center justify-center p-4">
        {user.tgPhotoUrl ? (
          <img src={user.tgPhotoUrl} alt="" className="max-w-full max-h-[70vh] object-contain rounded-2xl" draggable={false} referrerPolicy="no-referrer" />
        ) : (
          <div className="w-32 h-32 rounded-full bg-[#1A1A1A] flex items-center justify-center">
            <span className="text-4xl font-bold text-[#8E8E93]">{user.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-lg">{user.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B35]" />
              <span className="text-[#8E8E93] text-xs">{formatDist(user.distance)}</span>
              {isRecentlyActive(user.updatedAt) && <span className="ml-2 px-1.5 py-0.5 bg-[#00D4AA]/20 text-[#00D4AA] text-[10px] font-bold rounded-full">ONLINE</span>}
            </div>
          </div>
          {!user.isOwn && (
            <button className="h-10 gradient-btn rounded-xl text-white font-semibold text-sm nav-press flex items-center gap-2 px-5">
              <MessageCircle className="w-4 h-4" />
              {user.openToMessages ? '⭐ Message' : 'Message'}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <span className="text-[#8E8E93]">H: {user.height}cm</span>
          <span className="text-[#8E8E93]">W: {user.weight}kg</span>
          <span className="text-[#FF6B35] font-bold">{age} {emoji}</span>
          <span className="text-[#8E8E93]">{user.seekingToday || ''}</span>
          <span className="text-[#8E8E93]">{user.meetupType || ''}</span>
          {user.openToMessages && <span className="font-bold text-yellow-400">⭐ Open</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Raffle Button ───────────────────────────────────────────────────

function RaffleButton({ raffle, isAdmin, onBuy, onStartNext, lang }: {
  raffle: Raffle | null; isAdmin: boolean; onBuy: () => void;
  onStartNext: () => void; lang: Lang
}) {
  if (!raffle || raffle.status === 'complete') {
    return (
      <button
        onClick={() => { if (isAdmin) onStartNext() }}
        className={`text-[10px] px-2 py-1 rounded-full nav-press ${
          isAdmin
            ? 'bg-[#1A1A1A] border border-[#2C2C2E] text-[#8E8E93] hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/30'
            : 'bg-[#1A1A1A] border border-[#2C2C2E] text-[#8E8E93] opacity-50'
        }`}
        title={isAdmin ? 'Start Next Raffle' : 'No raffles'}
      >
        🎁
      </button>
    )
  }
  if (raffle.status === 'waiting' || raffle.status === 'active') {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[#FF6B35] text-[10px] font-bold">{raffle.tickets_sold}/{raffle.target_tickets}</span>
        <button className="text-[10px] px-2 py-1 rounded-full gradient-btn text-white nav-press" onClick={onBuy}>50 ⭐</button>
      </div>
    )
  }
  return null
}

// ─── Auto-Rotating Unlock Tip ────────────────────────────────────────
function UnlockTip({ lang, gridRows, channelFollowUnlock, onClaimChannelFollow }: {
  lang: Lang; gridRows: number; channelFollowUnlock: number; onClaimChannelFollow: () => void;
}) {
  const [idx, setIdx] = useState(0)
  const tips = {
    en: [
      'Base: 2 rows free',
      'Add a Telegram photo +1',
      'Boost @LetsMeetNowApp +1~4',
      '⭐ = charge stars per message',
      channelFollowUnlock ? 'Channel: +1 ✅' : 'Join @LetsMeetNowApp +1',
      'Buy rows with ⭐ Stars',
    ],
    tc: [
      '基礎: 2 行免費',
      '加入 Telegram 頭像 +1',
      'Boost @LetsMeetNowApp +1~4',
      '⭐ = 按訊息收費',
      channelFollowUnlock ? '頻道: +1 行 ✅' : '加入 @LetsMeetNowApp +1',
      '用 ⭐ 星星購買行數',
    ],
    sc: [
      '基础: 2 行免费',
      '加入 Telegram 头像 +1',
      'Boost @LetsMeetNowApp +1~4',
      '⭐ = 按消息收费',
      channelFollowUnlock ? '频道: +1 行 ✅' : '加入 @LetsMeetNowApp +1',
      '用 ⭐ 星星购买行数',
    ],
    ru: [
      'База: 2 строки бесплатно',
      'Добавь фото в Telegram +1',
      'Boost @LetsMeetNowApp +1~4',
      '⭐ = плата за сообщение',
      channelFollowUnlock ? 'Канал: +1 строка ✅' : 'Вступи в @LetsMeetNowApp +1',
      'Купить строки за ⭐',
    ],
  }
  const list = tips[lang] || tips.en
  const isChannelTip = idx % list.length === 4

  // Auto-rotate every 5 seconds
  useEffect(() => {
    const i = setInterval(() => setIdx(i => (i + 1) % list.length), 5000)
    return () => clearInterval(i)
  }, [list.length])

  return (
    <button
      onClick={() => { if (isChannelTip && !channelFollowUnlock) onClaimChannelFollow() }}
      className={`ml-auto text-[9px] nav-press flex items-center gap-1 ${isChannelTip && !channelFollowUnlock ? 'text-[#5AC8FA]' : 'text-[#8E8E93]'}`}
    >
      <span className="w-4 h-4 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[8px]">💡</span>
      <span className="truncate max-w-[140px]">{list[idx % list.length]}</span>
    </button>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────

function MainScreen({
  ownProfile, users, onViewOwn, onViewPhoto, isLoading, lang, setLang,
  onRefresh, isAdmin, filtersUnlocked, onUnlockFilters, onToggleInvisible,
  gridRows, channelFollowUnlock, onClaimChannelFollow, isInvisible, invisiblePurchased, raffle, onBuyTicket, onStartNext,
  profileUnlocked, onUnlockProfile,
}: {
  ownProfile: UserProfile; users: UserProfile[]; onViewOwn: () => void;
  onViewPhoto: (u: UserProfile) => void; isLoading: boolean; lang: Lang; setLang: (l: Lang) => void;
  onRefresh: () => void; isAdmin: boolean; filtersUnlocked: boolean;
  onUnlockFilters: () => void; onToggleInvisible: () => void;
  gridRows: number; channelFollowUnlock: number; onClaimChannelFollow: () => void; isInvisible: boolean; invisiblePurchased: boolean;
  raffle: Raffle | null; onBuyTicket: () => void; onStartNext: () => void;
  profileUnlocked: boolean; onUnlockProfile: () => void;
}) {
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [photoOnly, setPhotoOnly] = useState(false)
  const [sexFilter, setSexFilter] = useState<string | null>(null) // null = locked, 'All' = unlocked all
  const [ageFilter, setAgeFilter] = useState('any')
  const [zodiacFilter, setZodiacFilter] = useState<string | null>(null)
  const [activityFilter, setActivityFilter] = useState<string | null>(null)

  const LANGS: Lang[] = ['en', 'tc', 'sc']
  const cycleLang = () => {
    const idx = LANGS.indexOf(lang)
    const next = LANGS[(idx + 1) % LANGS.length]
    setLang(next)
    storage.set('lang', next)
  }

  const cycleSex = () => {
    if (!filtersUnlocked && !isAdmin) return
    const opts = ['All', 'Men', 'Women']
    const current = sexFilter || 'All'
    setSexFilter(opts[(opts.indexOf(current) + 1) % opts.length])
  }

  const cycleAge = () => {
    if (!filtersUnlocked && !isAdmin) return
    const idx = AGE_FILTERS.indexOf(ageFilter)
    setAgeFilter(AGE_FILTERS[(idx + 1) % AGE_FILTERS.length])
  }

  const cycleZodiac = () => {
    if (!filtersUnlocked && !isAdmin) return
    const signs = ZODIAC_SIGNS.map(z => z.name)
    if (!zodiacFilter) setZodiacFilter(signs[0])
    else {
      const idx = signs.indexOf(zodiacFilter)
      setZodiacFilter(idx < signs.length - 1 ? signs[idx + 1] : null)
    }
  }

  const cycleActivity = () => {
    if (!filtersUnlocked && !isAdmin) return
    const opts = [null, ...SEEKING_TODAY_OPTS]
    const idx = opts.indexOf(activityFilter)
    setActivityFilter(opts[(idx + 1) % opts.length])
  }

  const filtered = [{ ...ownProfile, isOwn: true }, ...users.filter(u => u.id !== ownProfile.id)].filter(u => {
    if (u.isOwn) return true
    if (onlineOnly && !isRecentlyActive(u.updatedAt)) return false
    if (!isAdmin && u.isInvisible) return false
    if (photoOnly && !u.tgPhotoUrl) return false

    // Gender matching - auto-filter to seeking preference
    if (!isAdmin) {
      if (ownProfile.seekingGender === 'Men' && u.gender !== 'Male') return false
      if (ownProfile.seekingGender === 'Women' && u.gender !== 'Female') return false
      if (u.seekingGender === 'Men' && ownProfile.gender !== 'Male') return false
      if (u.seekingGender === 'Women' && ownProfile.gender !== 'Female') return false
    }
    // Manual sex filter (unlocked)
    if ((isAdmin || filtersUnlocked) && sexFilter && sexFilter !== 'All') {
      if (sexFilter === 'Men' && u.gender !== 'Male') return false
      if (sexFilter === 'Women' && u.gender !== 'Female') return false
    }

    // Age filter
    if ((isAdmin || filtersUnlocked) && ageFilter !== 'any' && u.dob) {
      const age = getAge(u.dob)
      const myAge = ownProfile.dob ? getAge(ownProfile.dob) : 30
      if (ageFilter === 'older' && age <= myAge) return false
      if (ageFilter === 'younger' && age >= myAge) return false
      if (ageFilter === 'same' && Math.abs(age - myAge) > 3) return false
    }

    // Zodiac filter
    if ((isAdmin || filtersUnlocked) && zodiacFilter && u.dob) {
      if (getZodiac(u.dob) !== zodiacFilter) return false
    }

    // Activity filter
    if ((isAdmin || filtersUnlocked) && activityFilter && u.seekingToday !== activityFilter) return false

    return true
  }).sort((a, b) => {
    if (a.isOwn) return -1
    if (b.isOwn) return 1
    return (a.distance || Infinity) - (b.distance || Infinity)
  })

  // New: matching users first, then fill remaining slots with closest non-matching (greyed out)
  const allUsers = [{ ...ownProfile, isOwn: true }, ...users.filter(u => u.id !== ownProfile.id)]
  const matchingIds = new Set(filtered.map(u => u.id))
  const nonMatching = allUsers.filter(u => !matchingIds.has(u.id)).sort((a, b) => {
    if (a.isOwn) return -1
    if (b.isOwn) return 1
    return (a.distance || Infinity) - (b.distance || Infinity)
  })
  const sortedUsers = [...filtered, ...nonMatching]

  const maxVisible = (gridRows + channelFollowUnlock) * 5 + 1
  const hasMore = sortedUsers.length > maxVisible

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#2C2C2E] px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={lmnLogo} alt="LMN" className="w-8 h-8 rounded-full object-cover" />
          <h1 className="text-xl font-bold gradient-text tracking-tight">LMN</h1>
          <div className="w-px h-5 bg-[#2C2C2E] mx-0.5" />
          <RaffleButton raffle={raffle} isAdmin={isAdmin} onBuy={onBuyTicket} onStartNext={onStartNext} lang={lang} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cycleLang} className="text-[10px] font-bold text-[#FF6B35] px-2 py-1 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/30 nav-press">
            {getLangLabel(lang)}
          </button>
          <button onClick={onRefresh} className="w-7 h-7 rounded-full bg-[#1A1A1A] border border-[#2C2C2E] flex items-center justify-center nav-press">
            <RefreshCw className="w-3.5 h-3.5 text-[#8E8E93]" />
          </button>
          {!profileUnlocked && (
            <button onClick={onUnlockProfile}
              className="w-7 h-7 rounded-full bg-[#1A1A1A] border border-[#FF6B35]/30 flex items-center justify-center nav-press"
              title="Unlock Profile (100 ⭐)">
              <Unlock className="w-3.5 h-3.5 text-[#FF6B35]" />
            </button>
          )}
          <button onClick={onToggleInvisible}
            className={`w-7 h-7 rounded-full flex items-center justify-center nav-press text-[10px] border ${
              isInvisible ? 'bg-purple-500/30 text-purple-400 border-purple-500/40' :
              invisiblePurchased ? 'bg-purple-500/10 text-purple-500/60 border-purple-500/20' :
              'bg-[#1A1A1A] text-[#8E8E93] border-[#2C2C2E]'
            }`} title="Invisible Mode">👁️‍🗨️</button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 pt-1 flex items-center gap-2 text-[10px] text-[#8E8E93]">
        <span>{t(lang, 'nearby')}: {users.length}</span>
        <span className="text-[#00D4AA]">{t(lang, 'active1h')}: {users.filter(u => isRecentlyActive(u.updatedAt)).length + 1}</span>
        <span className="text-[#2C2C2E]">|</span>
        <span className="text-[#FF6B35] font-bold">{lang === 'tc' ? '已解鎖行數' : lang === 'sc' ? '已解锁行数' : lang === 'ru' ? 'Разблокировано строк' : 'Rows'}: {gridRows + channelFollowUnlock}</span>
        <span className="text-[#2C2C2E]">|</span>
        <span className="text-[#8E8E93]" style={{ opacity: filtersUnlocked ? 1 : 0.4 }}>Purchased {filtersUnlocked ? '✅' : '❌'}</span>
        <UnlockTip lang={lang} gridRows={gridRows} channelFollowUnlock={channelFollowUnlock} onClaimChannelFollow={onClaimChannelFollow} />
      </div>

      {/* Filters */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <button onClick={() => setOnlineOnly(!onlineOnly)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all nav-press flex-shrink-0 ${onlineOnly ? 'gradient-btn text-white' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${onlineOnly ? 'bg-[#00D4AA]' : 'bg-[#8E8E93]'}`} />
            {onlineOnly ? t(lang, 'online') : t(lang, 'filterAll')}
          </button>
          <button onClick={() => setPhotoOnly(!photoOnly)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all nav-press flex-shrink-0 ${photoOnly ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
            {photoOnly ? t(lang, 'photo') : t(lang, 'any')}
          </button>
          <div className="w-px h-4 bg-[#2C2C2E] flex-shrink-0" />

          {/* Sex filter */}
          {isAdmin || filtersUnlocked ? (
            <button onClick={cycleSex}
              className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${
                sexFilter === 'Men' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                sexFilter === 'Women' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' :
                'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'
              }`}>
              {sexFilter || t(lang, 'filterAll')}
            </button>
          ) : (
            <button onClick={onUnlockFilters} className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E] cursor-not-allowed">🔒</button>
          )}

          {/* Age filter */}
          {isAdmin || filtersUnlocked ? (
            <button onClick={cycleAge}
              className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]">
              {t(lang, 'age' + ageFilter.charAt(0).toUpperCase() + ageFilter.slice(1)) || ageFilter}
            </button>
          ) : (
            <button onClick={onUnlockFilters} className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E] cursor-not-allowed">🔒</button>
          )}

          {/* Zodiac filter */}
          {isAdmin || filtersUnlocked ? (
            <button onClick={cycleZodiac}
              className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]">
              {zodiacFilter ? getZodiacEmoji(zodiacFilter) : t(lang, 'zodiac')}
            </button>
          ) : (
            <button onClick={onUnlockFilters} className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E] cursor-not-allowed">🔒</button>
          )}

          {/* Activity filter */}
          {isAdmin || filtersUnlocked ? (
            <button onClick={cycleActivity}
              className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]">
              {activityFilter ? (t(lang, 'seek' + activityFilter.replace(/\s/g, ''), 'lmn') || activityFilter) : t(lang, 'activity')}
            </button>
          ) : (
            <button onClick={onUnlockFilters} className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E] cursor-not-allowed">🔒</button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="px-3 pt-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-1">
            {(() => {
              const visibleUsers = sortedUsers.slice(0, maxVisible)
              const firstNonMatchingIdx = visibleUsers.findIndex(u => !matchingIds.has(u.id))
              const showDivider = firstNonMatchingIdx > 0
              return visibleUsers.map((u, idx) => {
                const isMatching = matchingIds.has(u.id)
                return (
                  <React.Fragment key={u.id}>
                    {showDivider && idx === firstNonMatchingIdx && (
                      <div className="col-span-5 py-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-[#2C2C2E]" />
                          <span className="text-[9px] text-[#8E8E93] uppercase tracking-wider">{lang === 'tc' ? '其他用戶' : lang === 'sc' ? '其他用户' : 'Others'}</span>
                          <div className="flex-1 h-px bg-[#2C2C2E]" />
                        </div>
                      </div>
                    )}
                    <div
                      style={!isMatching ? { opacity: 0.3, pointerEvents: 'none' } : undefined}
                    >
                      <ProfileTile user={u} onClick={() => u.isOwn ? onViewOwn() : onViewPhoto(u)} />
                    </div>
                  </React.Fragment>
                )
              })
            })()}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="px-3 py-3">
          <button onClick={onUnlockFilters}
            className="w-full h-10 rounded-xl border border-dashed border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35] text-xs font-semibold nav-press flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            {isAdmin ? 'Unlock more rows (Admin)' : 'Unlock more rows — 100 ⭐'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Own Profile Screen ──────────────────────────────────────────────

function OwnProfileScreen({ profile, onSave, onBack, lang, isAdmin, isInvisible, onToggleInvisible, profileUnlocked }: {
  profile: UserProfile; onSave: (p: any) => void; onBack: () => void;
  lang: Lang; isAdmin: boolean; isInvisible: boolean; onToggleInvisible: () => void;
  profileUnlocked: boolean;
}) {
  const [height, setHeight] = useState(String(profile.height || ''))
  const [weight, setWeight] = useState(String(profile.weight || ''))
  const [seekingToday, setSeekingToday] = useState(profile.seekingToday || 'Just Browsing')
  const [meetupType, setMeetupType] = useState(profile.meetupType || '')
  const [hideAge, setHideAge] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const zodiac = profile.dob ? getZodiac(profile.dob) : ''
  const emoji = zodiac ? getZodiacEmoji(zodiac) : ''
  const age = profile.dob ? getAge(profile.dob) : '?'
  const canEdit = !profile.height || new Date().getDate() === 1 || isAdmin || profileUnlocked

  const changed = () => setHasChanges(true)

  const handleSave = () => {
    onSave({
      height: parseInt(height) || profile.height,
      weight: parseInt(weight) || profile.weight,
      seeking_today: seekingToday,
      meetup_type: meetupType,
      hide_age_until: hideAge ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
    })
    setHasChanges(false)
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2C2E]">
        <button onClick={onBack} className="flex items-center gap-1 text-[#8E8E93] text-sm nav-press">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-white font-semibold text-sm">Your Profile</span>
        <div className="w-16" />
      </div>

      <div className="flex flex-col items-center px-4 py-5">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#FF6B35] mb-3 bg-[#1A1A1A] flex items-center justify-center">
          {profile.tgPhotoUrl ? (
            <img src={profile.tgPhotoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-[#8E8E93]">{profile.name.charAt(0)}</span>
          )}
        </div>
        <h2 className="text-white font-bold text-lg">{profile.name}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-2xl">{emoji}</span>
          <span className="text-[#8E8E93] text-sm">{age} years old · {zodiac}</span>
        </div>
        <p className="text-[#8E8E93] text-xs mt-1">{profile.gender} seeking {profile.seekingGender}</p>
      </div>

      <div className="flex-1 px-4 pb-24 space-y-4">
        {/* Invisible toggle */}
        <button onClick={onToggleInvisible}
          className={`w-full h-11 rounded-xl font-semibold text-sm nav-press flex items-center justify-center gap-2 ${
            isInvisible ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'
          }`}>
          {isInvisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {isInvisible ? 'Invisible ON' : 'Invisible OFF'}
        </button>

        {/* Hide age */}
        <button onClick={() => { setHideAge(!hideAge); changed() }}
          className={`w-full h-11 rounded-xl font-semibold text-sm nav-press flex items-center justify-center gap-2 ${
            hideAge ? 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]' : 'gradient-btn text-white'
          }`}>
          {hideAge ? '🔓 Age Hidden' : '🔒 Age Visible'}
        </button>

        {/* Height / Weight */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[#8E8E93] text-xs block mb-1">Height {!canEdit && '(locked)'}</label>
            <input type="number" value={height} onChange={e => { setHeight(e.target.value); changed() }}
              disabled={!canEdit} placeholder="cm"
              className="w-full h-10 bg-[#1A1A1A] border border-[#2C2C2E] rounded-lg px-3 text-white text-sm disabled:opacity-50" />
          </div>
          <div>
            <label className="text-[#8E8E93] text-xs block mb-1">Weight {!canEdit && '(locked)'}</label>
            <input type="number" value={weight} onChange={e => { setWeight(e.target.value); changed() }}
              disabled={!canEdit} placeholder="kg"
              className="w-full h-10 bg-[#1A1A1A] border border-[#2C2C2E] rounded-lg px-3 text-white text-sm disabled:opacity-50" />
          </div>
        </div>

        {/* Seeking Today */}
        <div>
          <label className="text-[#8E8E93] text-xs block mb-2">What I'm looking for today</label>
          <div className="grid grid-cols-2 gap-2">
            {SEEKING_TODAY_OPTS.map(o => (
              <button key={o} onClick={() => { setSeekingToday(o); changed() }}
                className={`h-10 rounded-lg text-xs font-medium nav-press ${
                  seekingToday === o ? 'bg-[#FF6B35]/10 text-[#FF6B35] border-2 border-[#FF6B35]' : 'bg-[#1A1A1A] text-white border border-[#2C2C2E]'
                }`}>
                {t(lang, 'seek' + o.replace(/\s/g, ''), 'lmn') || o}
              </button>
            ))}
          </div>
        </div>

        {/* Meetup Type */}
        {seekingToday === 'Meetup' && (
          <div>
            <label className="text-[#8E8E93] text-xs block mb-2">Meetup type</label>
            <div className="grid grid-cols-3 gap-2">
              {MEETUP_TYPES.map(m => (
                <button key={m} onClick={() => { setMeetupType(m); changed() }}
                  className={`h-10 rounded-lg text-[10px] font-medium nav-press ${
                    meetupType === m ? 'bg-[#5AC8FA]/10 text-[#5AC8FA] border-2 border-[#5AC8FA]' : 'bg-[#1A1A1A] text-white border border-[#2C2C2E]'
                  }`}>
                  {t(lang, 'meet' + m.replace(/\s/g, '').replace('&', ''), 'lmn') || m}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleSave} disabled={!hasChanges}
          className={`w-full h-12 rounded-xl font-semibold text-sm nav-press ${
            hasChanges ? 'gradient-btn text-white' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'
          }`}>
          Save
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// APP
// ══════════════════════════════════════════════════════════════════════

export default function App() {
  const [view, setView] = useState<View>('MAIN')
  const [lang, setLang] = useState<Lang>('en')
  const [ownProfile, setOwnProfile] = useState<UserProfile>({
    id: 0, name: '', tgPhotoUrl: '', height: 0, weight: 0, lat: 0, lng: 0,
    gender: '', seekingGender: '', dob: null, seekingToday: null, meetupType: null,
    isOnline: false, isOwn: false, updatedAt: '', isInvisible: false, openToMessages: true, hideAgeUntil: null,
  })
  const [users, setUsers] = useState<UserProfile[]>([])
  const [locGranted, setLocGranted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<UserProfile | null>(null)
  const [showAgeGate, setShowAgeGate] = useState(false)
  const [showGenderSetup, setShowGenderSetup] = useState(false)
  const [tempDob, setTempDob] = useState('')

  // Splash + Disclaimer
  const [showSplash, setShowSplash] = useState(true)
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  // Premium
  const [filtersUnlocked, setFiltersUnlocked] = useState(false)
  const [gridRows, setGridRows] = useState(2)
  const [channelFollowUnlock, setChannelFollowUnlock] = useState(0)
  const [isInvisible, setIsInvisible] = useState(false)
  const [invisiblePurchased, setInvisiblePurchased] = useState(false)
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [profileUnlocked, setProfileUnlocked] = useState(false)

  const tgUserRef = useRef<any>(null)

  // ─── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tg = getTg()
    if (tg) {
      tg.ready(); tg.expand()
      const user = tg.initDataUnsafe?.user
      if (user) {
        tgUserRef.current = user
        setIsAdmin(isAdminUser(user))
        setOwnProfile(p => ({
          ...p, id: user.id, name: user.first_name, tgPhotoUrl: user.photo_url || '',
        }))

        // Check if profile exists in DB
        fetchUserUnlockStatus(user.id).then(status => {
          if (status) {
            setGridRows(status.grid_rows_unlocked || 2)
            setFiltersUnlocked(!!status.filters_unlocked)
            setProfileUnlocked(!!status.profile_unlocked)
            if (status.invisible_until) {
              const active = new Date(status.invisible_until).getTime() > Date.now()
              setIsInvisible(active)
              setInvisiblePurchased(true)
            }
          }
          // Signal successful mount — hide loading screen if any
          if (typeof window !== 'undefined' && (window as any).__lmnHideLoading) {
            ;(window as any).__lmnHideLoading()
          }
        }).catch(err => {
          console.error('[Init] fetchUserUnlockStatus failed:', err)
          // Still hide loading on error
          if (typeof window !== 'undefined' && (window as any).__lmnHideLoading) {
            ;(window as any).__lmnHideLoading()
          }
        })
      }
    }

    // Load channel follow unlock
    storage.get('channelFollowed').then(v => {
      if (v === '1') setChannelFollowUnlock(1)
    })

    // Check onboarding
    Promise.all([
      storage.get('dob'),
      storage.get('gender'),
      storage.get('seekingGender'),
      storage.get('disclaimerAgreed'),
    ]).then(([savedDob, savedGender, savedSeekingGender, disclaimerAgreed]) => {
      if (!disclaimerAgreed) {
        setShowDisclaimer(true)
      } else if (!savedDob) {
        setShowAgeGate(true)
      } else {
        setOwnProfile(p => ({ ...p, dob: savedDob }))
        if (!savedGender) setShowGenderSetup(true)
        else {
          setOwnProfile(p => ({
            ...p, gender: savedGender,
            seekingGender: savedSeekingGender || '',
          }))
        }
      }
    })

    storage.get('lang').then(l => { if (l) setLang(l as Lang) })
    getActiveRaffle().then(r => setRaffle(r))

    // Get location — try Telegram native first, then browser fallback
    if (tg?.requestLocation) {
      tg.requestLocation((location) => {
        if (location) {
          setOwnProfile(p => ({ ...p, lat: location.latitude, lng: location.longitude }))
          setLocGranted(true)
        } else {
          // Telegram denied — try browser as fallback
          navigator.geolocation?.getCurrentPosition(
            (pos) => {
              setOwnProfile(p => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude }))
              setLocGranted(true)
            },
            () => setLocGranted(false),
            { enableHighAccuracy: true, timeout: 15000 }
          )
        }
      })
    } else {
      // No Telegram native API — use browser
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setOwnProfile(p => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude }))
          setLocGranted(true)
        },
        () => setLocGranted(false),
        { enableHighAccuracy: true, timeout: 15000 }
      )
    }
  }, [])

  // ─── Heartbeat ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!locGranted) return
    const uid = tgUserRef.current?.id
    if (!uid) return
    const ping = () => setOnlineStatus(uid, true).catch(console.error)
    ping()
    const iv = setInterval(ping, 30000)
    return () => clearInterval(iv)
  }, [locGranted])

  // ─── Refresh ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    if (!ownProfile.lat || !ownProfile.lng) return
    setIsLoading(true)
    fetchNearby(ownProfile.lat, ownProfile.lng).then(dbUsers => {
      const myId = ownProfile.id
      const mapped = dbUsers.filter(u => u.id !== myId).map(u => {
        const p = dbToProfile(u, myId)
        p.distance = haversineKm(ownProfile.lat, ownProfile.lng, u.lat || 0, u.lng || 0)
        return p
      })
      setUsers(mapped)
      setIsLoading(false)
    }).catch(err => {
      console.error('Refresh error:', err)
      setIsLoading(false)
    })
  }, [ownProfile.lat, ownProfile.lng, ownProfile.id])

  useEffect(() => {
    if (!locGranted || !ownProfile.lat || !ownProfile.lng) return
    handleRefresh()
    const iv = setInterval(handleRefresh, 300000)
    return () => clearInterval(iv)
  }, [locGranted, ownProfile.lat, ownProfile.lng, handleRefresh])

  // ─── Save profile ──────────────────────────────────────────────────
  const handleSaveProfile = useCallback((updates: any) => {
    const uid = tgUserRef.current?.id
    if (!uid) return
    const data = {
      id: uid,
      name: ownProfile.name,
      photo_url: ownProfile.tgPhotoUrl || null,
      height: updates.height ?? ownProfile.height,
      weight: updates.weight ?? ownProfile.weight,
      gender: ownProfile.gender,
      seeking_gender: ownProfile.seekingGender,
      dob: ownProfile.dob,
      seeking_today: updates.seeking_today ?? ownProfile.seekingToday,
      meetup_type: updates.meetup_type ?? ownProfile.meetupType,
      lat: ownProfile.lat,
      lng: ownProfile.lng,
      is_online: true,
      updated_at: new Date().toISOString(),
      hide_age_until: updates.hide_age_until ?? ownProfile.hideAgeUntil,
    }
    upsertUser(data).then((result) => {
      setOwnProfile(p => ({ ...p, ...updates }))
      // Auto 7-day filter unlock for new users
      if (result && !result.filters_unlocked_expires_at) {
        ensureFilterUnlock(result.id).then(ok => {
          console.log('Auto filter unlock:', ok ? 'set 7 days' : 'failed')
        })
      }
    }).catch(console.error)
  }, [ownProfile])

  // ─── Disclaimer ───────────────────────────────────────────────────
  const handleDisclaimerAgree = () => {
    storage.set('disclaimerAgreed', 'true')
    setShowDisclaimer(false)
    // Continue to next onboarding step
    Promise.all([storage.get('dob'), storage.get('gender')]).then(([savedDob, savedGender]) => {
      if (!savedDob) setShowAgeGate(true)
      else if (!savedGender) setShowGenderSetup(true)
    })
  }

  // ─── Onboarding ────────────────────────────────────────────────────
  const handleAgeConfirm = (dob: string) => {
    storage.set('dob', dob)
    setOwnProfile(p => ({ ...p, dob }))
    setTempDob(dob)
    setShowAgeGate(false)
    setShowGenderSetup(true)
  }

  const handleGenderComplete = (gender: string, seeking: string) => {
    storage.set('gender', gender)
    storage.set('seekingGender', seeking)
    setOwnProfile(p => ({ ...p, gender, seekingGender: seeking }))
    setShowGenderSetup(false)
    // Save to DB immediately
    const uid = tgUserRef.current?.id
    if (uid) {
      upsertUser({
        id: uid, name: ownProfile.name, photo_url: ownProfile.tgPhotoUrl || null,
        gender, seeking_gender: seeking, dob: tempDob || ownProfile.dob,
        lat: ownProfile.lat, lng: ownProfile.lng,
        is_online: true, updated_at: new Date().toISOString(),
      })
    }
  }

  // ─── Invisible ─────────────────────────────────────────────────────
  const handleToggleInvisible = useCallback(() => {
    if (!invisiblePurchased && !isAdmin) {
      alert('Purchase Invisible Mode (2000 ⭐)')
      return
    }
    const uid = tgUserRef.current?.id
    if (!uid) return
    const newState = !isInvisible
    const until = newState ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
    upsertUser({ id: uid, invisible_until: until }).then(() => {
      setIsInvisible(newState)
    })
  }, [isInvisible, invisiblePurchased, isAdmin])

  // ─── Channel Follow Unlock — +1 row for following @LetsMeetNowApp ──
  const handleClaimChannelFollow = useCallback(async () => {
    if (channelFollowUnlock) return
    const url = 'https://t.me/LetsMeetNowApp'
    try {
      const tg = getTg()
      if (tg?.openTelegramLink) { tg.openTelegramLink(url) }
      else if (tg?.openLink) { tg.openLink(url) }
      else { window.open(url, '_blank') }
    } catch {}
    setChannelFollowUnlock(1)
    storage.set('channelFollowed', '1')
  }, [channelFollowUnlock])

  // ─── Unlock profile (100 ⭐ one-off) ─────────────────────────────
  const handleUnlockProfile = useCallback(async () => {
    const uid = tgUserRef.current?.id
    if (!uid) return

    if (isAdmin) {
      await upsertUser({ id: uid, profile_unlocked: true })
      setProfileUnlocked(true)
      return
    }

    try {
      const tg = getTg() as any
      const res = await fetch('https://lmn-d.mileschan852.workers.dev/createinvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid, amount: 100, purpose: 'profile' }),
      })
      const data = await res.json()
      if (data.ok && data.result && tg?.openInvoice) {
        tg.openInvoice(data.result, async (status: string) => {
          if (status === 'paid') {
            await upsertUser({ id: uid, profile_unlocked: true })
            setProfileUnlocked(true)
          }
        })
      }
    } catch (e) { console.error('Profile unlock failed:', e) }
  }, [isAdmin])
  const handleUnlockFilters = useCallback(async () => {
    const uid = tgUserRef.current?.id
    if (!uid) return

    // Admin: free row unlock (+1)
    if (isAdmin) {
      try {
        const newRows = gridRows + 1
        await upsertUser({ id: uid, grid_rows_unlocked: newRows })
        setGridRows(newRows)
      } catch (e) { console.error('Admin unlock failed:', e) }
      return
    }

    // Regular user: Stars payment
    try {
      const tg = getTg() as any
      const res = await fetch('https://lmn-d.mileschan852.workers.dev/createinvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid, amount: 1000, purpose: 'unlock_rows' }),
      })
      const data = await res.json()
      if (data.ok && data.result && tg?.openInvoice) {
        tg.openInvoice(data.result, async (status: string) => {
          if (status === 'paid') {
            const newRows = gridRows + 1
            await upsertUser({ id: uid, grid_rows_unlocked: newRows })
            setGridRows(newRows)
          }
        })
      }
    } catch (e) { console.error('Invoice failed:', e) }
  }, [isAdmin, gridRows])

  // ─── Raffle ────────────────────────────────────────────────────────
  const handleBuyTicket = useCallback(async () => {
    const uid = tgUserRef.current?.id
    const name = tgUserRef.current?.first_name
    if (!uid || !name) return

    // Admin gets free ticket
    if (isAdmin) {
      const ok = await buyRaffleTicket(uid, name)
      if (ok) {
        const updated = await getActiveRaffle()
        if (updated) {
          setRaffle(updated)
          if (updated.tickets_sold > 10 && updated.status === 'waiting') {
            await setRaffleDrawToNextWednesday(updated.id)
            const final = await getActiveRaffle()
            if (final) setRaffle(final)
          }
        }
      }
      return
    }

    // Regular user: Stars payment (50 ⭐ per ticket)
    try {
      const tg = getTg() as any
      const res = await fetch('https://lmn-d.mileschan852.workers.dev/createinvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid, amount: 50, purpose: 'raffle' }),
      })
      const data = await res.json()
      if (data.ok && data.result && tg?.openInvoice) {
        tg.openInvoice(data.result, async (status: string) => {
          if (status === 'paid') {
            const ok = await buyRaffleTicket(uid, name)
            if (ok) {
              const updated = await getActiveRaffle()
              if (updated) {
                setRaffle(updated)
                if (updated.tickets_sold > 10 && updated.status === 'waiting') {
                  await setRaffleDrawToNextWednesday(updated.id)
                  const final = await getActiveRaffle()
                  if (final) setRaffle(final)
                }
              }
            }
          }
        })
      }
    } catch (e) { console.error('Raffle ticket purchase failed:', e) }
  }, [isAdmin, gridRows])

  const handleStartNextRaffle = useCallback(async () => {
    if (!isAdmin) return
    try {
      console.log('[Raffle] Admin creating raffle...')
      const nextType = (!raffle || raffle.prize_type === 'invisible') ? 'filters' : 'invisible'
      const newRaffle = await createRaffle(nextType)
      console.log('[Raffle] Created:', newRaffle)
      if (newRaffle) setRaffle(newRaffle)
    } catch (err) {
      console.error('[Raffle] createRaffle failed:', err)
      alert('Failed to start raffle. Check console.')
    }
  }, [isAdmin, raffle])

  // Poll raffle to check if deadline reached — auto-draw winner
  useEffect(() => {
    if (!raffle || !raffle.ends_at) return
    const checkDeadline = async () => {
      if (new Date(raffle.ends_at!).getTime() <= Date.now()) {
        const winner = await drawRaffleWinner(raffle.id)
        if (winner) {
          // If prize is invisible, update winner's invisible_until
          if (raffle.prize_type === 'invisible') {
            const until = new Date(Date.now() + 30 * 86400000).toISOString()
            await upsertUser({ id: winner.id, invisible_until: until })
          }
        }
        const final = await getActiveRaffle()
        setRaffle(final || null)
      }
    }
    const interval = setInterval(checkDeadline, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [raffle?.ends_at, raffle?.id, raffle?.prize_type])

  // ─── Splash done ────────────────────────────────────────────────────
  const handleSplashDone = () => {
    setShowSplash(false)
  }

  // ─── Render ───────────────────────────────────────────────────────
  if (showSplash) return <SplashScreen onDone={handleSplashDone} />
  if (showDisclaimer) return <DisclaimerModal onAgree={handleDisclaimerAgree} lang={lang} />
  if (showAgeGate) return <AgeGate onConfirm={handleAgeConfirm} lang={lang} />
  if (showGenderSetup) return <GenderSetup onComplete={handleGenderComplete} lang={lang} />
  if (!locGranted) {
    return (
      <div className="fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full bg-[#FF6B35]/10 flex items-center justify-center mb-4">
          <LocateFixed className="w-8 h-8 text-[#FF6B35]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Location Required</h2>
        <p className="text-[#8E8E93] text-sm text-center mb-6">We need your location to show people nearby.</p>
        <button onClick={() => {
          const tg2 = getTg()
          const onGranted = (lat: number, lng: number) => {
            setOwnProfile(p => ({ ...p, lat, lng }))
            setLocGranted(true)
          }
          const onDenied = () => alert(t(lang, 'permissionDenied') || 'Permission denied. Please enable location.')
          if (tg2?.requestLocation) {
            tg2.requestLocation((location) => {
              if (location) onGranted(location.latitude, location.longitude)
              else {
                navigator.geolocation?.getCurrentPosition(
                  (pos) => onGranted(pos.coords.latitude, pos.coords.longitude),
                  onDenied,
                  { enableHighAccuracy: true, timeout: 10000 }
                )
              }
            })
          } else {
            navigator.geolocation?.getCurrentPosition(
              (pos) => onGranted(pos.coords.latitude, pos.coords.longitude),
              onDenied,
              { enableHighAccuracy: true, timeout: 10000 }
            )
          }
        }} className="w-full max-w-sm h-12 gradient-btn rounded-xl text-white font-semibold text-sm nav-press flex items-center justify-center gap-2">
          <LocateFixed className="w-4 h-4" /> Grant Location
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A]">
      {view === 'MAIN' && (
        <MainScreen
          ownProfile={ownProfile} users={users}
          onViewOwn={() => setView('OWN_PROFILE')}
          onViewPhoto={setSelectedPhoto}
          isLoading={isLoading} lang={lang} setLang={setLang}
          onRefresh={handleRefresh} isAdmin={isAdmin}
          filtersUnlocked={filtersUnlocked} onUnlockFilters={handleUnlockFilters}
          onToggleInvisible={handleToggleInvisible}
          gridRows={gridRows} channelFollowUnlock={channelFollowUnlock} onClaimChannelFollow={handleClaimChannelFollow}
          isInvisible={isInvisible}
          invisiblePurchased={invisiblePurchased}
          raffle={raffle} onBuyTicket={handleBuyTicket} onStartNext={handleStartNextRaffle}
          profileUnlocked={profileUnlocked} onUnlockProfile={handleUnlockProfile}
        />
      )}
      {view === 'OWN_PROFILE' && (
        <OwnProfileScreen
          profile={ownProfile} onSave={handleSaveProfile} onBack={() => setView('MAIN')}
          lang={lang} isAdmin={isAdmin} isInvisible={isInvisible}
          onToggleInvisible={handleToggleInvisible}
          profileUnlocked={profileUnlocked}
        />
      )}
      {selectedPhoto && (
        <PhotoOverlay user={selectedPhoto} onClose={() => setSelectedPhoto(null)} lang={lang} />
      )}
    </div>
  )
}
