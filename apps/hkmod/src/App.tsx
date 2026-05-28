import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import logoImg from './assets/hkmod-logo.svg'
import {
  Grid3X3, Users, ArrowLeft, Check, MapPin, X, MessageCircle,
  LocateFixed, AlertTriangle, Lock, Gift, Wallet, RefreshCw,
  Eye, EyeOff,
} from 'lucide-react'
import { t, tPref, tRole, type Lang, getLangLabel } from 'dating-core/i18n'
import {
  upsertUser, fetchNearby, setOnlineStatus, fetchUserUnlockStatus,
  getActiveRaffle, buyRaffleTicket, createRaffle, drawRaffleWinner,
  insertFlyingMessage, fetchFlyingMessages,
  fetchTravelEntries,
  type DbUser, type Raffle, type FlyingMessage, type TravelEntry,
} from 'dating-core/supabase'
import { getTg, getUserId, isInTelegram, makeStorage } from 'dating-core/storage'

const storage = makeStorage('hkmod')

// ─── Types ───────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  name: string
  height: number
  weight: number
  position: number      // 0=Bottom, 1=Top, 0.5=Vers
  isSide: boolean
  isOnline: boolean
  distance: number
  lat?: number
  lng?: number
  isOwn?: boolean
  preference1?: 'Safe' | 'Raw'
  preference2?: 'Clean' | 'Party' | 'Party✓'
  preference3?: '1on1' | 'Group'
  preference4?: 'Host' | 'Travel' | 'Outdoor' | 'Sauna'
  openToMessages?: boolean
  tgUsername?: string
  tgPhotoUrl?: string
  updatedAt?: string
  hasPhoto: boolean
  isInvisible: boolean
}

type View = 'MAIN' | 'OWN_PROFILE' | 'TRAVEL'
type TravelTab = 'sauna' | 'accommodation' | 'callboy'
type RoleFilter = 'All' | 'B' | 'VB' | 'V' | 'VT' | 'T' | 'Side'

// ─── Admin ───────────────────────────────────────────────────────────

const ADMIN_IDS = [1231127407, 6837870949]
const ADMIN_USERNAMES = ['HKMembersOnly', 'hkmembersonly']

function isAdminUser(user: { id?: number; username?: string } | null): boolean {
  if (!user) return false
  if (user.id && ADMIN_IDS.includes(user.id)) return true
  if (user.username && ADMIN_USERNAMES.includes(user.username)) return true
  return false
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatRole(value: number, isSide: boolean): string {
  if (isSide) return tRole('en', 'Side')
  if (value === 0) return '0 ' + tRole('en', 'B')
  if (value === 1) return '1 ' + tRole('en', 'T')
  if (value <= 0.4) return `${value.toFixed(1)} ` + tRole('en', 'VB')
  if (value === 0.5) return `${value.toFixed(1)} ` + tRole('en', 'V')
  return `${value.toFixed(1)} ` + tRole('en', 'VT')
}

function gridRoleLabel(value: number, isSide: boolean): string {
  if (isSide) return 'Side'
  if (value === 0) return 'B'
  if (value === 1) return 'T'
  if (value <= 0.4) return 'VB'
  if (value === 0.5) return 'V'
  return 'VT'
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

function isRecentlyActive(u: UserProfile): boolean {
  if (u.isOwn) return true
  if (!u.updatedAt) return false
  return Date.now() - new Date(u.updatedAt).getTime() < 60 * 60 * 1000
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3
  const toRad = (x: number) => x * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(d: number): string {
  if (d === 0) return '0m'
  if (d < 1000) return `${Math.round(d)}m`
  return `${(d / 1000).toFixed(1)}km`
}

function getFilterColor(mode: RoleFilter): string {
  const colors: Record<RoleFilter, string> = {
    'All': 'bg-[#1A1A1A] text-[#8E8E93] border-[#2C2C2E]',
    'B': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'VB': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'V': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'VT': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'T': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Side': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  }
  return colors[mode]
}

function dbToProfile(u: DbUser, myLat: number, myLng: number): UserProfile {
  const dist = u.lat && u.lng ? getDistance(myLat, myLng, u.lat, u.lng) : 0
  return {
    id: String(u.id), name: u.name || '', height: u.height || 0, weight: u.weight || 0,
    position: u.position ?? 0.5, isSide: u.is_side ?? false,
    isOnline: u.is_online ?? false, distance: Math.round(dist),
    lat: u.lat ?? undefined, lng: u.lng ?? undefined,
    preference1: (u.preference1 as 'Safe' | 'Raw') || 'Safe',
    preference2: (u.preference2 as 'Clean' | 'Party' | 'Party✓') || 'Clean',
    preference3: (u.preference3 as '1on1' | 'Group') || '1on1',
    preference4: (u.preference4 === 'Off' ? 'Travel' : (u.preference4 as 'Host' | 'Travel' | 'Outdoor' | 'Sauna')) || undefined,
    openToMessages: u.open_to_messages ?? false,
    tgUsername: u.tg_username || undefined,
    tgPhotoUrl: u.photo_url?.startsWith('http') ? u.photo_url : undefined,
    updatedAt: u.updated_at || undefined,
    hasPhoto: !!(u.photo_url && u.photo_url.startsWith('http')),
    isInvisible: !!u.invisible_until && new Date(u.invisible_until).getTime() > Date.now(),
  }
}

// ─── Components ──────────────────────────────────────────────────────

function LocationGate({ onGranted, lang }: { onGranted: (lat: number, lng: number) => void; lang: Lang }) {
  const [status, setStatus] = useState<'checking' | 'needed' | 'requesting' | 'denied'>('checking')

  const request = () => {
    setStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => onGranted(pos.coords.latitude, pos.coords.longitude),
      () => setStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => onGranted(pos.coords.latitude, pos.coords.longitude),
      () => setStatus('needed'),
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }, [onGranted])

  if (status === 'checking') {
    return (
      <div className="fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col items-center justify-center">
        <LocateFixed className="w-12 h-12 text-[#FF6B35] animate-pulse mb-4" />
        <p className="text-white font-semibold">{t(lang, 'checkingLoc')}</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-full bg-[#FF6B35]/10 flex items-center justify-center mb-4">
        <LocateFixed className="w-8 h-8 text-[#FF6B35]" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{t('en', 'locationRequired')}</h2>
      <p className="text-[#8E8E93] text-sm text-center mb-6">{t(lang, 'locationDesc')}</p>
      {status === 'denied' && (
        <div className="bg-[#1A1A1A] border border-[#2C2C2E] rounded-xl p-4 mb-4 w-full max-w-sm">
          <p className="text-[#FF6B35] text-sm font-semibold mb-1">{t(lang, 'permissionDenied')}</p>
          <p className="text-[#8E8E93] text-xs">{t(lang, 'enableLocation')}</p>
        </div>
      )}
      <button onClick={request} disabled={status === 'requesting'}
        className="w-full max-w-sm h-12 gradient-btn rounded-xl text-white font-semibold text-sm nav-press flex items-center justify-center gap-2">
        <LocateFixed className="w-4 h-4" />
        {status === 'requesting' ? t(lang, 'checkingLoc') : t(lang, 'tapToRetry')}
      </button>
    </div>
  )
}

function ProfileTile({ user, onClick }: { user: UserProfile; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const photo = user.tgPhotoUrl
  const role = gridRoleLabel(user.position, user.isSide)

  return (
    <button onClick={onClick} className="card-enter relative aspect-[3/4] rounded-lg overflow-hidden nav-press text-left">
      {user.isInvisible && (
        <div className="absolute top-1 left-1 z-40 w-4 h-4 flex items-center justify-center rounded-full bg-purple-500/40 border border-purple-400/30 text-[8px]" title="Invisible">👁️‍🗨️</div>
      )}
      {photo && !failed && (
        <img src={photo} alt={user.name}
          className={`absolute inset-0 w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ transition: 'opacity 0.3s' }}
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
          loading="eager" referrerPolicy="no-referrer" draggable={false}
        />
      )}
      {(!photo || failed || !loaded) && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#2C2C2E] to-[#1A1A1A] flex items-center justify-center z-10">
          <span className="text-lg font-bold text-[#8E8E93]">{user.name.charAt(0)}</span>
        </div>
      )}
      <div className="absolute inset-0 profile-photo-gradient pointer-events-none z-20" />
      {isRecentlyActive(user) && <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#00D4AA] rounded-full online-pulse z-30" />}
      {user.openToMessages && <div className="absolute top-0.5 left-0.5 z-30 text-[10px] bg-black/50 rounded-full w-5 h-5 flex items-center justify-center">⭐</div>}
      {user.isOwn && <div className="absolute inset-0 border-2 border-[#FF6B35] rounded-lg pointer-events-none z-30" />}
      <div className="absolute bottom-0 left-0 right-0 px-1 pb-1 pointer-events-none z-30">
        <p className={`font-semibold text-[10px] leading-tight truncate ${user.isOwn ? 'text-[#FF6B35]' : 'text-white'}`}>{user.isOwn ? 'You' : user.name}</p>
        <div className="flex items-center justify-between">
          <p className="text-[#FF6B35] text-[9px] font-medium">{formatDist(user.distance)}</p>
          {!user.isOwn && <p className="text-[#8E8E93] text-[8px]">{getTimeAgo(user.updatedAt)}</p>}
          <p className="text-[#8E8E93] text-[8px] font-bold">{role}</p>
        </div>
      </div>
    </button>
  )
}

function PhotoOverlay({ user, onClose, lang }: { user: UserProfile; onClose: () => void; lang: Lang }) {
  const photos = user.tgPhotoUrl ? [user.tgPhotoUrl] : []
  const role = formatRole(user.position, user.isSide)

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-in fade-in duration-200">
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#1A1A1A]/80 flex items-center justify-center z-20 nav-press">
        <X className="w-5 h-5 text-white" />
      </button>
      <div className="flex-1 flex items-center relative">
        {photos.length > 0 ? (
          <div className="w-full flex items-center justify-center">
            <img src={photos[0]} alt={user.name} className="max-w-full max-h-[65vh] object-contain" draggable={false} referrerPolicy="no-referrer" />
          </div>
        ) : (
          <div className="w-full flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <span className="text-4xl font-bold text-[#8E8E93]">{user.name.charAt(0)}</span>
            </div>
          </div>
        )}
      </div>
      <div className="w-full px-4 pb-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-lg">{user.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B35]" />
              <span className="text-[#8E8E93] text-xs">{formatDist(user.distance)}</span>
              {isRecentlyActive(user) && <span className="ml-2 px-1.5 py-0.5 bg-[#00D4AA]/20 text-[#00D4AA] text-[10px] font-bold rounded-full">{t(lang, 'online').toUpperCase()}</span>}
            </div>
          </div>
          {!user.isOwn && (
            <button className="h-10 gradient-btn rounded-xl text-white font-semibold text-sm nav-press flex items-center gap-2 px-5">
              <MessageCircle className="w-4 h-4" />
              {user.openToMessages ? '⭐ ' + t(lang, 'message') : t(lang, 'message')}
            </button>
          )}
        </div>
        <div className="flex gap-3 mt-3 text-xs">
          <span className="text-[#8E8E93]">{user.height}cm</span>
          <span className="text-[#8E8E93]">{user.weight}kg</span>
          <span className="text-[#FF6B35] font-bold">{role}</span>
          {user.preference1 && <span className={`font-bold ${user.preference1 === 'Safe' ? 'text-green-400' : 'text-red-400'}`}>{user.preference1}</span>}
          {user.preference2 && <span className={`font-bold ${user.preference2 === 'Clean' ? 'text-blue-400' : 'text-purple-400'}`}>{tPref(lang, user.preference2)}</span>}
          {user.preference3 && <span className={`font-bold ${user.preference3 === '1on1' ? 'text-yellow-400' : 'text-orange-400'}`}>{user.preference3}</span>}
          {user.preference4 && <span className={`font-bold ${user.preference4 === 'Host' ? 'text-indigo-400' : user.preference4 === 'Travel' ? 'text-cyan-400' : user.preference4 === 'Outdoor' ? 'text-lime-400' : 'text-amber-400'}`}>{user.preference4}</span>}
          {user.openToMessages && <span className="font-bold text-yellow-400">⭐ {t(lang, 'message')}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Raffle Button ───────────────────────────────────────────────────

function RaffleButton({ raffle, isAdmin, onBuy, onSetPrize, lang }: {
  raffle: Raffle | null; isAdmin: boolean; onBuy: () => void;
  onSetPrize: (p: 'filters' | 'invisible') => void; lang: Lang
}) {
  if (!raffle) return null
  if (raffle.status === 'waiting') {
    if (isAdmin) return <button className="text-[10px] px-2 py-1 rounded-full bg-[#1A1A1A] border border-[#2C2C2E] text-[#8E8E93] nav-press" onClick={() => onSetPrize('invisible')}>Set Prize</button>
    return <span className="text-[#8E8E93] text-[9px]">Waiting...</span>
  }
  if (raffle.status === 'active') {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[#FF6B35] text-[10px] font-bold">{raffle.tickets_sold}/{raffle.target_tickets}</span>
        <button className="text-[10px] px-2 py-1 rounded-full gradient-btn text-white nav-press" onClick={onBuy}>50 ⭐</button>
      </div>
    )
  }
  return <span className="text-[#00D4AA] text-[9px]">Winner: {raffle.winner_name || '?'}</span>
}

// ─── Main Screen ─────────────────────────────────────────────────────

function MainScreen({
  ownProfile, users, onViewOwn, onViewPhoto, isLoading, lang, setLang,
  onRefresh, isAdmin, filtersUnlocked, onUnlockFilters, onToggleInvisible,
  gridRowsUnlocked, isInvisible, invisiblePurchased, raffle, onBuyTicket, onSetPrize, onOpenTravel,
}: {
  ownProfile: UserProfile; users: UserProfile[]; onViewOwn: () => void;
  onViewPhoto: (u: UserProfile) => void; isLoading: boolean; lang: Lang; setLang: (l: Lang) => void;
  onRefresh: () => void; isAdmin: boolean; filtersUnlocked: boolean;
  onUnlockFilters: () => void; onToggleInvisible: () => void;
  gridRowsUnlocked: number; isInvisible: boolean; invisiblePurchased: boolean;
  raffle: Raffle | null; onBuyTicket: () => void; onSetPrize: (p: 'filters' | 'invisible') => void; onOpenTravel: () => void;
}) {
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [pref1, setPref1] = useState<'Safe' | 'Raw'>(ownProfile.preference1 || 'Safe')
  const [pref2, setPref2] = useState<'Clean' | 'Party' | 'Party✓'>(ownProfile.preference2 === 'Party✓' ? 'Party' : (ownProfile.preference2 || 'Clean'))
  const [pref3, setPref3] = useState<'1on1' | 'Group'>(ownProfile.preference3 || '1on1')
  const [hostFilter, setHostFilter] = useState<'All' | 'Host' | 'Travel' | 'Outdoor' | 'Sauna'>('All')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All')
  const [photoOnly, setPhotoOnly] = useState(false)

  const LANGS: Lang[] = ['en', 'tc', 'sc']
  const cycleLang = () => {
    const idx = LANGS.indexOf(lang)
    const next = LANGS[(idx + 1) % LANGS.length]
    setLang(next)
    storage.set('lang', next)
  }

  const cycleRole = () => {
    const order: RoleFilter[] = ['All', 'B', 'VB', 'V', 'VT', 'T', 'Side']
    setRoleFilter(order[(order.indexOf(roleFilter) + 1) % order.length])
  }

  const cycleHost = () => {
    const order: Array<'All' | 'Host' | 'Travel' | 'Outdoor' | 'Sauna'> = ['All', 'Host', 'Travel', 'Outdoor', 'Sauna']
    setHostFilter(order[(order.indexOf(hostFilter) + 1) % order.length])
  }

  const allUsers = [{ ...ownProfile, isOwn: true, isInvisible: isInvisible || false }, ...users.filter(u => u.id !== ownProfile.id)]

  const filtered = allUsers.filter(u => {
    if (u.isOwn) return true
    if (onlineOnly && !isRecentlyActive(u)) return false
    if (!isAdmin && u.isInvisible) return false
    if (photoOnly && !u.hasPhoto) return false

    // Role matching
    if (isAdmin && roleFilter !== 'All') {
      if (roleFilter === 'Side') { if (!u.isSide) return false }
      else if (u.isSide) return false
      else if (roleFilter === 'B' && u.position > 0.4) return false
      else if (roleFilter === 'VB' && u.position > 0.4 && u.position !== 0.5) return false
      else if (roleFilter === 'VT' && u.position < 0.5) return false
      else if (roleFilter === 'T' && u.position < 0.6) return false
    } else if (!isAdmin) {
      // Auto opposite matching
      if (ownProfile.isSide) { if (!u.isSide) return false }
      else {
        if (u.isSide) return false
        if (ownProfile.position <= 0.4 && u.position < 0.5) return false
        if (ownProfile.position >= 0.6 && u.position > 0.5) return false
      }
    }

    if (u.preference1 !== pref1) return false
    if (pref2 === 'Party✓') { if (u.preference2 !== 'Party✓') return false }
    else if (pref2 === 'Party') { if (u.preference2 !== 'Party' && u.preference2 !== 'Party✓') return false }
    else if (u.preference2 !== pref2) return false
    if (pref3 === '1on1' && u.preference3 !== '1on1') return false
    if (hostFilter !== 'All' && u.preference4 !== hostFilter) return false
    return true
  }).sort((a, b) => {
    if (a.isOwn) return -1
    if (b.isOwn) return 1
    return (a.distance || Infinity) - (b.distance || Infinity)
  })

  const maxVisible = gridRowsUnlocked * 5 + 1 // +1 for own profile
  const visibleUsers = filtered.slice(0, maxVisible)
  const hasMore = filtered.length > maxVisible

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#2C2C2E] px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="HKMOD" className="w-8 h-8 rounded-full object-cover" />
          <h1 className="text-xl font-bold gradient-text tracking-tight">HKMOD</h1>
          <div className="w-px h-5 bg-[#2C2C2E] mx-0.5" />
          <RaffleButton raffle={raffle} isAdmin={isAdmin} onBuy={onBuyTicket} onSetPrize={onSetPrize} lang={lang} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleInvisible}
            className={`w-7 h-7 rounded-full flex items-center justify-center nav-press text-[10px] border ${
              isInvisible ? 'bg-purple-500/30 text-purple-400 border-purple-500/40' :
              invisiblePurchased ? 'bg-purple-500/10 text-purple-500/60 border-purple-500/20' :
              'bg-[#1A1A1A] text-[#8E8E93] border-[#2C2C2E]'
            }`} title="Invisible Mode">👁️‍🗨️</button>
          <button onClick={onOpenTravel} className="w-7 h-7 rounded-full bg-[#1A1A1A] border border-[#2C2C2E] flex items-center justify-center nav-press" title="Travel Guide">🌏</button>
          <button onClick={onRefresh} className="w-7 h-7 rounded-full bg-[#1A1A1A] border border-[#2C2C2E] flex items-center justify-center nav-press">
            <RefreshCw className="w-3.5 h-3.5 text-[#8E8E93]" />
          </button>
          <button onClick={cycleLang} className="text-[10px] font-bold text-[#FF6B35] px-2 py-1 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/30 nav-press">
            {getLangLabel(lang)}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 pt-1 flex items-center gap-3 text-[10px] text-[#8E8E93]">
        <span>{t(lang, 'nearby')}: {users.length}</span>
        <span className="text-[#00D4AA]">{t(lang, 'active1h')}: {users.filter(u => isRecentlyActive(u)).length + 1}</span>
      </div>

      {/* Filters */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <button onClick={() => setOnlineOnly(!onlineOnly)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all nav-press flex-shrink-0 ${onlineOnly ? 'gradient-btn text-white' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${onlineOnly ? 'bg-[#00D4AA]' : 'bg-[#8E8E93]'}`} />
            {onlineOnly ? 'Online' : 'All'}
          </button>
          <button onClick={() => setPhotoOnly(!photoOnly)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all nav-press flex-shrink-0 ${photoOnly ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
            {photoOnly ? 'Photo' : 'Any'}
          </button>
          <div className="w-px h-4 bg-[#2C2C2E] flex-shrink-0" />

          {/* Role filter */}
          {isAdmin || filtersUnlocked ? (
            <button onClick={cycleRole} className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${getFilterColor(roleFilter)}`}>
              {roleFilter}
            </button>
          ) : (
            <button onClick={onUnlockFilters} className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]">
              🔒 {roleFilter}
            </button>
          )}

          {/* Safe/Raw */}
          {isAdmin || filtersUnlocked ? (
            <button onClick={() => setPref1(pref1 === 'Safe' ? 'Raw' : 'Safe')}
              className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${pref1 === 'Safe' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {tPref(lang, pref1)}
            </button>
          ) : (
            <button onClick={onUnlockFilters} className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]">
              🔒 {tPref(lang, pref1)}
            </button>
          )}

          {/* Clean/Party */}
          <button onClick={() => {
            const order: Array<'Clean' | 'Party' | 'Party✓'> = ['Clean', 'Party', 'Party✓']
            setPref2(order[(order.indexOf(pref2) + 1) % order.length])
          }} className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${
            pref2 === 'Clean' ? 'bg-blue-500/20 text-blue-400' :
            pref2 === 'Party' ? 'bg-purple-500/20 text-purple-400' :
            'bg-pink-500/20 text-pink-400'
          }`}>{tPref(lang, pref2)}</button>

          {/* 1on1/Group */}
          <button onClick={() => setPref3(pref3 === '1on1' ? 'Group' : '1on1')}
            className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${pref3 === '1on1' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-orange-500/20 text-orange-400'}`}>
            {pref3}
          </button>

          {/* Host/Travel */}
          <button onClick={cycleHost}
            className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${
              hostFilter === 'All' ? 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]' :
              hostFilter === 'Host' ? 'bg-indigo-500/20 text-indigo-400' :
              hostFilter === 'Travel' ? 'bg-cyan-500/20 text-cyan-400' :
              hostFilter === 'Outdoor' ? 'bg-lime-500/20 text-lime-400' :
              'bg-amber-500/20 text-amber-400'
            }`}>{hostFilter === 'All' ? t(lang, 'filterAll') : hostFilter}</button>
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
            {visibleUsers.map(u => (
              <ProfileTile key={u.id} user={u} onClick={() => u.isOwn ? onViewOwn() : onViewPhoto(u)} />
            ))}
          </div>
        )}
      </div>

      {/* Unlock more / No more */}
      {hasMore && (
        <div className="px-3 py-3">
          <button onClick={onUnlockFilters}
            className="w-full h-10 rounded-xl border border-dashed border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35] text-xs font-semibold nav-press flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            Unlock more rows — {gridRowsUnlocked < 20 ? '100 ⭐' : 'Max'}
          </button>
        </div>
      )}
      {!hasMore && !isLoading && filtered.length > 1 && (
        <div className="px-3 py-3 text-center">
          <p className="text-[#8E8E93] text-xs">No more nearby users</p>
        </div>
      )}
    </div>
  )
}

// ─── Own Profile Screen ──────────────────────────────────────────────

function OwnProfileScreen({ profile, onSave, onBack, lang, isAdmin, isInvisible, onToggleInvisible }: {
  profile: UserProfile; onSave: (p: Partial<UserProfile>) => void; onBack: () => void;
  lang: Lang; isAdmin: boolean; isInvisible: boolean; onToggleInvisible: () => void;
}) {
  const [height, setHeight] = useState(String(profile.height || ''))
  const [weight, setWeight] = useState(String(profile.weight || ''))
  const [position, setPosition] = useState(profile.position || 0.5)
  const [isSide, setIsSide] = useState(profile.isSide || false)
  const [pref1, setPref1] = useState(profile.preference1 || 'Safe')
  const [pref2, setPref2] = useState(profile.preference2 || 'Clean')
  const [pref3, setPref3] = useState(profile.preference3 || '1on1')
  const [pref4, setPref4] = useState(profile.preference4 || 'Travel')
  const [openMsg, setOpenMsg] = useState(profile.openToMessages || false)
  const [errors, setErrors] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const canEdit = !profile.height || new Date().getDate() === 1 || isAdmin

  const changed = () => setHasChanges(true)

  const handleSave = () => {
    const e: string[] = []
    if (!height) e.push('Height required')
    if (!weight) e.push('Weight required')
    if (e.length > 0) { setErrors(e); return }
    onSave({
      height: parseInt(height), weight: parseInt(weight), position, isSide,
      preference1: pref1, preference2: pref2, preference3: pref3, preference4: pref4,
      openToMessages: openMsg,
    })
    setHasChanges(false)
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2C2E]">
        <button onClick={onBack} className="flex items-center gap-1 text-[#8E8E93] text-sm nav-press">
          <ArrowLeft className="w-4 h-4" /> {t(lang, 'back')}
        </button>
        <span className="text-white font-semibold text-sm">{t(lang, 'yourProfile')}</span>
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

        {/* Height / Weight */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[#8E8E93] text-xs block mb-1">{t(lang, 'height')} {!canEdit && `(${t(lang, 'locked')})`}</label>
            <input type="number" value={height} onChange={e => { setHeight(e.target.value); changed() }}
              disabled={!canEdit} placeholder="cm"
              className="w-full h-10 bg-[#1A1A1A] border border-[#2C2C2E] rounded-lg px-3 text-white text-sm disabled:opacity-50" />
          </div>
          <div>
            <label className="text-[#8E8E93] text-xs block mb-1">{t(lang, 'weight')} {!canEdit && `(${t(lang, 'locked')})`}</label>
            <input type="number" value={weight} onChange={e => { setWeight(e.target.value); changed() }}
              disabled={!canEdit} placeholder="kg"
              className="w-full h-10 bg-[#1A1A1A] border border-[#2C2C2E] rounded-lg px-3 text-white text-sm disabled:opacity-50" />
          </div>
        </div>

        {/* Role slider */}
        <div>
          <label className="text-[#8E8E93] text-xs block mb-2">Role: {formatRole(position, isSide)}</label>
          <input type="range" min="0" max="1" step="0.1" value={position}
            onChange={e => { setPosition(parseFloat(e.target.value)); setIsSide(false); changed() }}
            className="w-full accent-[#FF6B35]" />
          <div className="flex justify-between text-[10px] text-[#8E8E93] mt-1">
            <span>B</span><span>V</span><span>T</span>
          </div>
          <button onClick={() => { setIsSide(!isSide); changed() }}
            className={`mt-2 px-3 py-1.5 rounded-full text-xs font-medium nav-press ${
              isSide ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'
            }`}>Side</button>
        </div>

        {/* Preferences */}
        <div className="space-y-2">
          <label className="text-[#8E8E93] text-xs">Preferences</label>
          <div className="flex flex-wrap gap-2">
            {(['Safe', 'Raw'] as const).map(p => (
              <button key={p} onClick={() => { setPref1(p); changed() }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium nav-press ${pref1 === p ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['Clean', 'Party', 'Party✓'] as const).map(p => (
              <button key={p} onClick={() => { setPref2(p); changed() }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium nav-press ${pref2 === p ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
                {tPref(lang, p)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['1on1', 'Group'] as const).map(p => (
              <button key={p} onClick={() => { setPref3(p); changed() }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium nav-press ${pref3 === p ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['Host', 'Travel', 'Outdoor', 'Sauna'] as const).map(p => (
              <button key={p} onClick={() => { setPref4(p); changed() }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium nav-press ${pref4 === p ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Open to messages */}
        <button onClick={() => { setOpenMsg(!openMsg); changed() }}
          className={`w-full h-10 rounded-xl text-sm font-medium nav-press flex items-center justify-center gap-2 ${
            openMsg ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'
          }`}>
          {openMsg ? '⭐ Open to Messages' : 'Closed to Messages'}
        </button>

        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map(e => <p key={e} className="text-red-400 text-xs">{e}</p>)}
          </div>
        )}

        <button onClick={handleSave} disabled={!hasChanges}
          className={`w-full h-12 rounded-xl font-semibold text-sm nav-press ${
            hasChanges ? 'gradient-btn text-white' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'
          }`}>
          {t(lang, 'save')}
        </button>
      </div>
    </div>
  )
}

// ─── Flying Messages Overlay ─────────────────────────────────────────

function FlyingMessages({ userId, userName, lang }: { userId: number; userName: string; lang: Lang }) {
  const [messages, setMessages] = useState<FlyingMessage[]>([])
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    fetchFlyingMessages().then(msgs => {
      setMessages(msgs.slice(0, 20).reverse())
    })
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 10000)
    return () => clearInterval(iv)
  }, [load])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, expanded])

  const send = () => {
    if (!text.trim()) return
    insertFlyingMessage(userId, userName, text.trim()).then(ok => {
      if (ok) {
        setText('')
        load()
      }
    })
  }

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full gradient-btn flex items-center justify-center shadow-lg nav-press"
        title="Public Chat"
      >
        <MessageCircle className="w-5 h-5 text-white" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {Math.min(messages.length, 9)}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A1A] border-t border-[#2C2C2E] rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-200"
      style={{ maxHeight: '50vh' }}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2C2C2E]">
        <span className="text-white font-semibold text-sm">💬 {t(lang, 'publicChat')}</span>
        <button onClick={() => setExpanded(false)} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center nav-press">
          <X className="w-4 h-4 text-[#8E8E93]" />
        </button>
      </div>
      <div ref={scrollRef} className="px-4 py-2 space-y-2 overflow-y-auto" style={{ maxHeight: '30vh' }}>
        {messages.length === 0 && (
          <p className="text-[#8E8E93] text-xs text-center py-4">{t(lang, 'noMessages')}</p>
        )}
        {messages.map(m => (
          <div key={m.id} className="text-xs"
            style={{ animation: 'fadeIn 0.2s ease' }}
          >
            <span className="text-[#FF6B35] font-bold">{m.user_name}</span>
            <span className="text-[#8E8E93] mx-1">·</span>
            <span className="text-white">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 pb-safe border-t border-[#2C2C2E] flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={t(lang, 'typeMessage')}
          className="flex-1 h-9 bg-[#0A0A0A] border border-[#2C2C2E] rounded-lg px-3 text-white text-xs"
        />
        <button onClick={send} className="h-9 px-4 gradient-btn rounded-lg text-white text-xs font-semibold nav-press">
          {t(lang, 'send')}
        </button>
      </div>
    </div>
  )
}

// ─── Travel Directory ────────────────────────────────────────────────

function TravelDirectory({ onBack, lang }: { onBack: () => void; lang: Lang }) {
  const [tab, setTab] = useState<TravelTab>('sauna')
  const [country, setCountry] = useState('Hong Kong')
  const [entries, setEntries] = useState<TravelEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetchTravelEntries(country, tab).then(data => {
      setEntries(data)
      setLoading(false)
    })
  }, [country, tab])

  useEffect(() => { load() }, [load])

  const tabs: { key: TravelTab; label: string; emoji: string }[] = [
    { key: 'sauna', label: 'Sauna', emoji: '🧖' },
    { key: 'accommodation', label: 'Stay', emoji: '🏨' },
    { key: 'callboy', label: 'Services', emoji: '💼' },
  ]

  const countries = ['Hong Kong', 'Taiwan', 'Thailand']

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2C2E]">
        <button onClick={onBack} className="flex items-center gap-1 text-[#8E8E93] text-sm nav-press">
          <ArrowLeft className="w-4 h-4" /> {t(lang, 'back')}
        </button>
        <span className="text-white font-semibold text-sm">🌏 {t(lang, 'travelGuide')}</span>
        <div className="w-16" />
      </div>

      {/* Country selector */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {countries.map(c => (
          <button key={c} onClick={() => setCountry(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium nav-press flex-shrink-0 ${
              country === c ? 'gradient-btn text-white' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-4 pb-2 flex gap-2 border-b border-[#2C2C2E]">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 h-9 rounded-lg text-xs font-medium nav-press ${
              tab === t.key ? 'bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[#8E8E93] text-sm">{t(lang, 'noEntries')}</p>
          </div>
        )}
        {entries.map(e => (
          <div key={e.id} className="bg-[#1A1A1A] border border-[#2C2C2E] rounded-xl p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">{e.name}</h3>
              {e.cost && <span className="text-[#FF6B35] text-xs font-bold">{e.cost}</span>}
            </div>
            {e.address && <p className="text-[#8E8E93] text-xs">📍 {e.address}</p>}
            {e.contact && <p className="text-[#8E8E93] text-xs">📞 {e.contact}</p>}
            {e.hours && <p className="text-[#8E8E93] text-xs">🕐 {e.hours}</p>}
            {e.website && (
              <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-[#5AC8FA] text-xs underline block">
                🌐 Website
              </a>
            )}
            {e.directions && <p className="text-[#8E8E93] text-xs">🗺️ {e.directions}</p>}
          </div>
        ))}
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
    id: '0', name: '', height: 0, weight: 0, position: 0.5, isSide: false,
    isOnline: false, distance: 0, hasPhoto: false, isInvisible: false,
  })
  const [users, setUsers] = useState<UserProfile[]>([])
  const [locGranted, setLocGranted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<UserProfile | null>(null)

  // Premium state
  const [filtersUnlocked, setFiltersUnlocked] = useState(false)
  const [gridRows, setGridRows] = useState(2)
  const [isInvisible, setIsInvisible] = useState(false)
  const [invisiblePurchased, setInvisiblePurchased] = useState(false)
  const [invisibleUntil, setInvisibleUntil] = useState<string | null>(null)

  // Raffle
  const [raffle, setRaffle] = useState<Raffle | null>(null)

  const tgUserRef = useRef<{ id: number; name: string; photo?: string; username?: string } | null>(null)

  // ─── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tg = getTg()
    if (tg) {
      tg.ready()
      tg.expand()
      const user = tg.initDataUnsafe?.user
      if (user) {
        tgUserRef.current = { id: user.id, name: user.first_name, photo: user.photo_url, username: user.username }
        setIsAdmin(isAdminUser(user))
        setOwnProfile(p => ({ ...p, id: String(user.id), name: user.first_name, tgPhotoUrl: user.photo_url, tgUsername: user.username }))

        // Load unlock status from DB
        fetchUserUnlockStatus(user.id).then(status => {
          if (status) {
            setGridRows(status.grid_rows_unlocked || 2)
            setFiltersUnlocked(!!status.filters_unlocked)
            if (status.invisible_until) {
              const active = new Date(status.invisible_until).getTime() > Date.now()
              setIsInvisible(active)
              setInvisiblePurchased(true)
              setInvisibleUntil(status.invisible_until)
            }
          }
        })
      }
    }

    // Restore lang
    storage.get('lang').then(l => { if (l) setLang(l as Lang) })

    // Load raffle
    getActiveRaffle().then(r => setRaffle(r))
  }, [])

  // ─── Location ──────────────────────────────────────────────────────
  const handleLocation = useCallback((lat: number, lng: number) => {
    setLocGranted(true)
    setOwnProfile(p => ({ ...p, lat, lng }))
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

  // ─── Refresh nearby ──────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    const lat = ownProfile.lat
    const lng = ownProfile.lng
    if (!lat || !lng) return
    setIsLoading(true)
    fetchNearby(lat, lng).then(dbUsers => {
      const myId = tgUserRef.current?.id
      const mapped = dbUsers.filter(u => u.id !== myId).map(u => dbToProfile(u, lat, lng))
      setUsers(mapped)
      setIsLoading(false)
    }).catch(err => {
      console.error('Refresh error:', err)
      setIsLoading(false)
    })
  }, [ownProfile.lat, ownProfile.lng])

  useEffect(() => {
    if (!locGranted || !ownProfile.lat || !ownProfile.lng) return
    handleRefresh()
    const iv = setInterval(handleRefresh, 300000)
    return () => clearInterval(iv)
  }, [locGranted, ownProfile.lat, ownProfile.lng, handleRefresh])

  // ─── Save profile ────────────────────────────────────────────────
  const handleSaveProfile = useCallback((updates: Partial<UserProfile>) => {
    const uid = tgUserRef.current?.id
    if (!uid) return
    const data = {
      id: uid,
      name: ownProfile.name,
      photo_url: ownProfile.tgPhotoUrl || null,
      height: updates.height ?? ownProfile.height,
      weight: updates.weight ?? ownProfile.weight,
      position: updates.position ?? ownProfile.position,
      is_side: updates.isSide ?? ownProfile.isSide,
      preference1: updates.preference1 ?? ownProfile.preference1,
      preference2: updates.preference2 ?? ownProfile.preference2,
      preference3: updates.preference3 ?? ownProfile.preference3,
      preference4: updates.preference4 ?? ownProfile.preference4,
      open_to_messages: updates.openToMessages ?? ownProfile.openToMessages,
      tg_username: ownProfile.tgUsername || null,
      lat: ownProfile.lat,
      lng: ownProfile.lng,
      is_online: true,
      updated_at: new Date().toISOString(),
    }
    upsertUser(data).then(() => {
      setOwnProfile(p => ({ ...p, ...updates }))
    }).catch(console.error)
  }, [ownProfile])

  // ─── Toggle invisible ────────────────────────────────────────────
  const handleToggleInvisible = useCallback(() => {
    if (!invisiblePurchased && !isAdmin) {
      // TODO: trigger Stars payment for invisible mode
      alert('Purchase Invisible Mode (2000 ⭐)')
      return
    }
    const uid = tgUserRef.current?.id
    if (!uid) return
    const newState = !isInvisible
    const until = newState ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
    upsertUser({ id: uid, invisible_until: until }).then(() => {
      setIsInvisible(newState)
      setInvisibleUntil(until)
    })
  }, [isInvisible, invisiblePurchased, isAdmin])

  // ─── Unlock filters ──────────────────────────────────────────────
  const handleUnlockFilters = useCallback(() => {
    // TODO: trigger Stars payment
    alert('Purchase Filter Unlock (300 ⭐)')
  }, [])

  // ─── Raffle ──────────────────────────────────────────────────────
  const handleBuyTicket = useCallback(() => {
    const uid = tgUserRef.current?.id
    const name = tgUserRef.current?.name
    if (!uid || !name) return
    buyRaffleTicket(uid, name).then(ok => {
      if (ok) getActiveRaffle().then(r => setRaffle(r))
    })
  }, [])

  const handleSetPrize = useCallback((prize: 'filters' | 'invisible') => {
    createRaffle(prize).then(r => setRaffle(r))
  }, [])

  if (!locGranted) {
    return <LocationGate onGranted={handleLocation} lang={lang} />
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
          gridRowsUnlocked={gridRows} isInvisible={isInvisible}
          invisiblePurchased={invisiblePurchased}
          raffle={raffle} onBuyTicket={handleBuyTicket} onSetPrize={handleSetPrize}
          onOpenTravel={() => setView('TRAVEL')}
        />
      )}
      {view === 'OWN_PROFILE' && (
        <OwnProfileScreen
          profile={ownProfile} onSave={handleSaveProfile} onBack={() => setView('MAIN')}
          lang={lang} isAdmin={isAdmin} isInvisible={isInvisible}
          onToggleInvisible={handleToggleInvisible}
        />
      )}
      {view === 'TRAVEL' && (
        <TravelDirectory onBack={() => setView('MAIN')} lang={lang} />
      )}
      {selectedPhoto && (
        <PhotoOverlay user={selectedPhoto} onClose={() => setSelectedPhoto(null)} lang={lang} />
      )}
      {tgUserRef.current && locGranted && (
        <FlyingMessages userId={tgUserRef.current.id} userName={tgUserRef.current.name} lang={lang} />
      )}
    </div>
  )
}
