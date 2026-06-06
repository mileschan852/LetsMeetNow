import { getTg, isInTelegram, getUserId, getTimeAgo, getDistance, formatDist, isUserActive, isPrefLocked, getDefaultLang, isAdminUser, detectRealPhoto, usePaymentUnlock } from 'dating-core'
import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import logoImg from './assets/hkmod-logo.png'
import logoAnim from './assets/hkmod-logo-animated.mp4'
import { t, tPref, type Lang, getLangLabel } from './lib/i18n'
import {
  ArrowLeft,
  Check,
  MapPin,
  MessageCircle,
  AlertTriangle,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { upsertUser, fetchNearby, setOnlineStatus, fetchGlobalUnlock, hasValidKey, fetchUserUnlockStatus, insertFlyingMessage, fetchFlyingMessages, updateInvisibleStatus, getActiveRaffle, createRaffle, buyRaffleTicket, startRaffleCountdown, drawRaffleWinner, completeRaffle, checkRealPhoto, updateRealPhotoStatus, fetchUserPhotoStatus, relockUserFeatures, setRaffleDrawToNextWednesday, ensureFilterUnlock, setGridRowsUnlocked as saveGridRowsUnlocked, setFiltersUnlocked as saveFiltersUnlocked, type DbUser, type Raffle } from './lib/supabase'
import { LocationGate, FlyingMessagesOverlay, BottomNav, RaffleStatusDisplay, RaffleButton, ProfileGrid, PhotoOverlay as PhotoOverlayBase } from 'dating-ui'

// ─── Types ───────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  name: string
  age: number
  height: number
  weight: number
  position: number
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
  tgPhotos?: string[]
  updatedAt?: string
  hasPhoto: boolean   // true = has any avatar URL
  hasRealPhoto?: boolean // true = real photo (from DB, detected via Content-Type)
  // Invisible mode
  invisibleUntil?: string
  isInvisible: boolean
}

type View = 'MAIN' | 'OWN_PROFILE'

// ─── Telegram API ────────────────────────────────────────────────────

interface TgWebApp {
  ready: () => void
  expand: () => void
  setHeaderColor: (color: string) => void
  openTelegramLink: (url: string) => void
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      photo_url?: string
      is_premium?: boolean
    }
    chat?: {
      id: number
      type: 'private' | 'group' | 'supergroup' | 'channel'
      title?: string
      username?: string
    }
    chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel'
    chat_instance?: string
    start_param?: string
  }
  version: string
  platform: string
  openInvoice: (url: string, callback?: (status: string) => void) => void
  requestLocation: (callback: (location: { latitude: number; longitude: number } | null) => void) => void
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text: string }> }, callback?: (buttonId: string) => void) => void
  CloudStorage: {
    setItem: (key: string, value: string, cb?: (err: string | null, done: boolean) => void) => void
    getItems: (keys: string[], cb: (err: string | null, result: Record<string, string>) => void) => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

function formatRole(value: number, isSide: boolean): string {
  if (isSide) return 'Side'
  return value === 0 ? '0' : value === 1 ? '1' : String(value)
}

function getGridRoleLabel(value: number, isSide: boolean): string {
  if (isSide) return 'Side'
  return value === 0 ? '0 (Bottom)' : value === 1 ? '1 (Top)' : String(value)
}

// ─── Admin Config ────────────────────────────────────────────────────

// Only these Telegram usernames / IDs are admins. Bot owner is always included.
// Add more here when requested.
const ADMIN_IDS = [1231127407, 6837870949, 7735683983]
const ADMIN_USERNAMES = ['HKMembersOnly', 'hkmembersonly', 'MilesChan852', 'mileschan852']

// ─── Storage Keys ────────────────────────────────────────────────────

const CLOUD = {
  age: 'hk_age',
  height: 'hk_height',
  weight: 'hk_weight',
  position: 'hk_position',
  isSide: 'hk_isSide',
  pref1: 'hk_pref1',
  pref2: 'hk_pref2',
  pref3: 'hk_pref3',
  pref4: 'hk_pref4',
  openMsg: 'hk_open_msg',
  lat: 'hk_lat',
  lng: 'hk_lng',
  photoUrl: 'hk_photo_url',
  name: 'hk_name',
  lang: 'hk_lang',
  prefChangedAt: 'hk_pref_changed_at',
  prefLockedAt: 'hk_pref_locked_at',
  filtersUnlocked: 'hk_filters_unlocked',
  filtersUnlockedAt: 'hk_filters_unlocked_at',
  gridRowsUnlocked: 'hk_grid_rows_unlocked',
  gridRowsUnlockedAt: 'hk_grid_rows_unlocked_at',
  invisibleActive: 'hk_invisible_active',
  channelFollowed: 'hk_channel_followed',
}

// Telegram CloudStorage
function cloudSet(key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tg = getTg()
    if (!tg?.CloudStorage) { resolve(false); return }
    tg.CloudStorage.setItem(key, value, (err, done) => {
      if (err) console.error('CloudStorage set error:', key, err)
      resolve(!err && done)
    })
  })
}

function cloudGetAll(keys: string[]): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const tg = getTg()
    if (!tg?.CloudStorage) { resolve(null); return }
    tg.CloudStorage.getItems(keys, (err, result) => {
      if (err) { console.error('CloudStorage get error:', err); resolve(null); return }
      resolve(result || {})
    })
  })
}

function userKey(key: string): string {
  const uid = getUserId()
  return uid ? `${uid}_${key}` : key
}

const lsSet = (key: string, value: string) => {
  const k = userKey(key)
  try { localStorage.setItem('hkmoc_' + k, value) } catch {}
}

const lsGet = (key: string): string | null => {
  const k = userKey(key)
  try { return localStorage.getItem('hkmoc_' + k) } catch { return null }
}

const lsGetAll = (): Record<string, string> => {
  const r: Record<string, string> = {}
  const uid = getUserId()
  const prefix = uid ? `hkmoc_${uid}_` : 'hkmoc_'
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(prefix)) {
        const shortKey = uid ? k.replace(`hkmoc_${uid}_`, '') : k.replace('hkmoc_', '')
        r[shortKey] = localStorage.getItem(k) || ''
      }
    })
  } catch {}
  return r
}

// Unified storage: saves to both Telegram CloudStorage AND localStorage with user ID prefix
async function storageSet(key: string, value: string): Promise<void> {
  lsSet(key, value)
  const k = userKey(key)
  await cloudSet(k, value)
}

async function storageGet(key: string): Promise<string | null> {
  const k = userKey(key)
  try {
    const cloud = await cloudGetAll([k])
    if (cloud && cloud[k]) return cloud[k]
  } catch {}
  return lsGet(key)
}

async function storageGetAll(): Promise<Record<string, string>> {
  const keys = Object.values(CLOUD).map(k => userKey(k))
  const cloud = await cloudGetAll(keys)
  const ls = lsGetAll()
  // Un-prefix cloud keys back to short form
  const uid = getUserId()
  const unPrefixed: Record<string, string> = {}
  if (cloud && uid) {
    Object.entries(cloud).forEach(([k, v]) => {
      const shortKey = k.replace(`${uid}_`, '')
      unPrefixed[shortKey] = v
    })
  }
  return { ...ls, ...unPrefixed }
}

// ─── Role Helpers ────────────────────────────────────────────────────

// ─── Filter Logic ────────────────────────────────────────────────────

type RoleFilterMode = 'All' | 'B' | 'VB' | 'V' | 'VT' | 'T' | 'Side'

function getFilterColor(mode: RoleFilterMode): string {
  const colors: Record<RoleFilterMode, string> = {
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

// ─── Distance

// ─── DbUser → UserProfile ────────────────────────────────────────────

function dbToProfile(u: DbUser, myLat: number, myLng: number): UserProfile {
  const dist = u.lat && u.lng ? getDistance(myLat, myLng, u.lat, u.lng) : 0
  return {
    id: String(u.id),
    name: u.name,
    age: 0,
    height: u.height,
    weight: u.weight,
    position: u.position,
    isSide: u.is_side,
    isOnline: u.is_online,
    distance: Math.round(dist),
    lat: u.lat,
    lng: u.lng,
    preference1: (u.preference1 as 'Safe' | 'Raw') || 'Raw',
    preference2: (u.preference2 as 'Clean' | 'Party' | 'Party✓') || 'Party',
    preference3: (u.preference3 as '1on1' | 'Group') || 'Group',
    preference4: (u.preference4 === 'Off' ? 'Travel' : u.preference4 as 'Host' | 'Travel' | 'Outdoor' | 'Sauna') || 'Travel',
    openToMessages: u.open_to_messages || false,
    tgUsername: u.tg_username || undefined,
    tgPhotoUrl: u.photo_url?.startsWith('http') ? u.photo_url : undefined,
    tgPhotos: u.photo_url?.startsWith('http') ? [u.photo_url] : [],
    updatedAt: u.updated_at,
    // hasPhoto: true = has any avatar image (real photo, initials, emoji)
    hasPhoto: !!(u.photo_url && u.photo_url.startsWith('http')),
    // hasRealPhoto: from DB (detected via Content-Type on user's login)
    hasRealPhoto: u.has_real_photo ?? undefined,
    // Invisible mode
    invisibleUntil: u.invisible_until ?? undefined,
    isInvisible: !!u.invisible_until && new Date(u.invisible_until).getTime() > Date.now(),
  }
}

// ─── Photo Overlay ────────────────────────────────────────────────────

function PhotoOverlay({ user, onClose, onMessage, lang }: { user: UserProfile; onClose: () => void; onMessage: (u: UserProfile) => void; lang: Lang }) {
  const role = formatRole(user.position, user.isSide)
  return (
    <PhotoOverlayBase
      user={user}
      onClose={onClose}
      renderFooter={(u) => (
        <div className="w-full px-4 pb-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-lg">{u.age ? `${u.name}, ${u.age}` : u.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#FF6B35]" />
                <span className="text-[#8E8E93] text-xs">{formatDist(u.distance ?? 0)}</span>
                {isUserActive(u) && <span className="ml-2 px-1.5 py-0.5 bg-[#00D4AA]/20 text-[#00D4AA] text-[10px] font-bold rounded-full">{t(lang, 'online').toUpperCase()}</span>}
              </div>
            </div>
            {!u.isOwn && (
              <button onClick={() => onMessage(u as UserProfile)} className="h-10 gradient-btn rounded-xl text-white font-semibold text-sm nav-press flex items-center gap-2 px-5">
                <MessageCircle className="w-4 h-4" />
                {u.openToMessages ? '⭐ ' + t(lang, 'message') : t(lang, 'message')}
              </button>
            )}
          </div>
          <div className="flex gap-3 mt-3 text-xs">
            <span className="text-[#8E8E93]">{u.height}cm</span>
            <span className="text-[#8E8E93]">{u.weight}kg</span>
            <span className="text-[#FF6B35] font-bold">{role}</span>
            {u.preference1 && <span className={`font-bold ${u.preference1 === 'Safe' ? 'text-green-400' : 'text-red-400'}`}>{u.preference1}</span>}
            {u.preference2 && <span className={`font-bold ${u.preference2 === 'Clean' ? 'text-blue-400' : 'text-purple-400'}`}>{u.preference2}</span>}
            {u.preference3 && <span className={`font-bold ${u.preference3 === '1on1' ? 'text-yellow-400' : 'text-orange-400'}`}>{u.preference3}</span>}
            {u.preference4 && <span className={`font-bold ${u.preference4 === 'Host' ? 'text-indigo-400' : u.preference4 === 'Travel' ? 'text-cyan-400' : u.preference4 === 'Outdoor' ? 'text-lime-400' : 'text-amber-400'}`}>{u.preference4}</span>}
            {u.openToMessages && <span className="font-bold text-yellow-400">⭐ {t(lang, 'message')}</span>}
          </div>
        </div>
      )}
    />
  )
}

// ─── Unlock Tip Cycle — cycles through ways to unlock more rows ──────

function UnlockTipCycle({ lang, isPremium, gridRowsUnlocked, channelFollowUnlock, onClaimChannelFollow }: { lang: Lang; isPremium: boolean; gridRowsUnlocked: number; channelFollowUnlock: number; onClaimChannelFollow: () => void }) {
  const [idx, setIdx] = useState(0)
  const tips = {
    en: [
      `Base: 2 rows free`,
      isPremium ? `Premium: +1 row` : `Premium: +1 row (not active)`,
      `Purchased: ${gridRowsUnlocked} rows`,
      `Add a Telegram photo +1`,
      `Boost @HKMembersOnlyChat +1~4`,
      `⭐ = charge stars per message`,
      channelFollowUnlock ? `Group: +1 row ✅` : `Join @HKMembersOnlyChat +1`,
      `Buy rows with ⭐ Stars`,
    ],
    tc: [
      `基礎: 2 行免費`,
      isPremium ? `Premium: +1 行` : `Premium: +1 行 (未激活)`,
      `已購: ${gridRowsUnlocked} 行`,
      `加入 Telegram 頭像 +1`,
      `Boost @HKMembersOnlyChat +1~4`,
      `⭐ = 按訊息收費`,
      channelFollowUnlock ? `群組: +1 行 ✅` : `加入 @HKMembersOnlyChat +1`,
      `用 ⭐ 星星購買行數`,
    ],
    sc: [
      `基础: 2 行免费`,
      isPremium ? `Premium: +1 行` : `Premium: +1 行 (未激活)`,
      `已购: ${gridRowsUnlocked} 行`,
      `加入 Telegram 头像 +1`,
      `Boost @HKMembersOnlyChat +1~4`,
      `⭐ = 按消息收费`,
      channelFollowUnlock ? `群组: +1 行 ✅` : `加入 @HKMembersOnlyChat +1`,
      `用 ⭐ 星星购买行数`,
    ],
    ru: [
      `База: 2 строки бесплатно`,
      isPremium ? `Premium: +1 строка` : `Premium: +1 строка (не активен)`,
      `Куплено: ${gridRowsUnlocked} строк`,
      `Добавь фото в Telegram +1`,
      `Boost @HKMembersOnlyChat +1~4`,
      `⭐ = плата за сообщение`,
      channelFollowUnlock ? `Группа: +1 строка ✅` : `Вступи в @HKMembersOnlyChat +1`,
      `Купить строки за ⭐`,
    ],
  }
  const list = tips[lang] || tips.en

  // Auto-rotate every 5 seconds
  useEffect(() => {
    const i = setInterval(() => setIdx(i => (i + 1) % list.length), 5000)
    return () => clearInterval(i)
  }, [list.length])

  const current = list[idx % list.length]
  const isChannelTip = idx % list.length === 6

  return (
    <button
      onClick={() => {
        if (isChannelTip && !channelFollowUnlock) {
          onClaimChannelFollow()
        } else {
          setIdx((i) => i + 1)
        }
      }}
      className="ml-auto flex items-center gap-1 text-[9px] text-[#8E8E93] nav-press"
    >
      <span className="w-4 h-4 rounded-full bg-[#2C2C2E] flex items-center justify-center">💡</span>
      <span className={`truncate max-w-[140px] ${isChannelTip && !channelFollowUnlock ? 'text-[#5AC8FA]' : ''}`}>{current}</span>
    </button>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

function MainScreen({ ownProfile, users, onViewOwnProfile, onViewPhoto, showDbWarning, isLoadingUsers, lang, setLang, onRefresh, isAdmin, filtersUnlocked, onPromptUnlock, onPromptFilterUnlock, onToggleInvisible, gridRowsUnlocked, lastRefreshTime, setLastRefreshTime, isInvisible, invisiblePurchased, raffle, onBuyRaffleTicket, onStartNextRaffle, onPromptUnlockProfile, isPremium, channelFollowUnlock, onClaimChannelFollow }: {
  ownProfile: UserProfile
  users: UserProfile[]
  onViewOwnProfile: () => void
  onViewPhoto: (u: UserProfile) => void
  showDbWarning: boolean
  isLoadingUsers: boolean
  lang: Lang
  setLang: (l: Lang) => void
  onRefresh: () => void
  isAdmin: boolean
  filtersUnlocked: boolean
  onPromptUnlock: () => void
  onPromptFilterUnlock: () => void
  onToggleInvisible: () => void
  gridRowsUnlocked: number
  lastRefreshTime: number
  setLastRefreshTime: (t: number) => void
  isInvisible: boolean
  invisiblePurchased: boolean
  raffle: Raffle | null
  onBuyRaffleTicket: () => void
  onStartNextRaffle: () => void
  onPromptUnlockProfile: () => void
  isPremium: boolean
  channelFollowUnlock: number
  onClaimChannelFollow: () => void
}) {
  const [onlineOnly, setOnlineOnly] = useState(false)
  // Role/Host filters have 'All' (multiple options). Safe/Raw/Clean/Party/1on1/Group are binary — no 'All'.
  const [pref1Filter, setPref1Filter] = useState<'Safe' | 'Raw'>(ownProfile.preference1 || 'Safe')
  const [pref2Filter, setPref2Filter] = useState<'Clean' | 'Party' | 'Party✓'>(
    ownProfile.preference2 === 'Party✓' ? 'Party' : (ownProfile.preference2 || 'Clean')
  )
  const [pref3Filter, setPref3Filter] = useState<'1on1' | 'Group'>(ownProfile.preference3 || '1on1')
  const [hostFilter, setHostFilter] = useState<'All' | 'Host' | 'Travel' | 'Outdoor' | 'Sauna'>('All')
  const [roleFilter, setRoleFilter] = useState<RoleFilterMode>('All')
  const [photoFilter, setPhotoFilter] = useState<'有圖' | '沒圖'>('沒圖')
  // Admin: hidden test users removed
  // const [showTestUsers, setShowTestUsers] = useState(false)

  const LANG_CYCLE: Lang[] = ['en', 'tc', 'sc', 'ru']
  const cycleLang = () => {
    const idx = LANG_CYCLE.indexOf(lang)
    const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length]
    setLang(next)
    storageSet(CLOUD.lang, next)
  }

  const cyclePref1Filter = () => {
    setPref1Filter(pref1Filter === 'Safe' ? 'Raw' : 'Safe')
  }
  const cyclePref2Filter = () => {
    const order: Array<'Clean' | 'Party' | 'Party✓'> = ['Clean', 'Party', 'Party✓']
    const idx = order.indexOf(pref2Filter)
    setPref2Filter(order[(idx + 1) % order.length])
  }
  const cyclePref3Filter = () => {
    setPref3Filter(pref3Filter === '1on1' ? 'Group' : '1on1')
  }
  const cycleHostFilter = () => {
    const order: Array<'All' | 'Host' | 'Travel' | 'Outdoor' | 'Sauna'> = ['All', 'Host', 'Travel', 'Outdoor', 'Sauna']
    setHostFilter(order[(order.indexOf(hostFilter) + 1) % order.length])
  }
  // Party filter: Clean users = locked, Party/Party✓ users = only Party↔Party✓ (no Clean)
  const cyclePartyPref2Filter = () => {
    if (ownProfile.preference2 === 'Clean') return // locked, no-op
    // Toggle between Party ↔ Party✓ only
    setPref2Filter(pref2Filter === 'Party' ? 'Party✓' : 'Party')
  }

  const cycleRoleFilter = () => {
    const order: RoleFilterMode[] = ['All', 'B', 'VB', 'V', 'VT', 'T', 'Side']
    const idx = order.indexOf(roleFilter)
    setRoleFilter(order[(idx + 1) % order.length])
  }

  // Online = updated within 1 hour. Own profile always counts as active.
  const ONE_HOUR = 60 * 60 * 1000
  const isRecentlyActive = (u: UserProfile) => {
    if (u.isOwn) return true
    if (!u.updatedAt) return false
    return Date.now() - new Date(u.updatedAt).getTime() < ONE_HOUR
  }

  // Patch own profile with current invisible state (toggle may have changed it)
  const patchedOwnProfile = { ...ownProfile, isOwn: true, isInvisible: isInvisible || false }
  const allGridUsers: UserProfile[] = [patchedOwnProfile, ...users.filter(u => u.id !== ownProfile.id)]
  
  // Invisible users: completely hidden from non-admins (not even greyed out)
  const visibleGridUsers = isAdmin ? allGridUsers : allGridUsers.filter(u => u.isOwn || !u.isInvisible)
  
  const filteredGrid = visibleGridUsers.filter((u) => {
    if (u.isOwn) return true
    if (onlineOnly && !isRecentlyActive(u)) return false
    // Test users: hidden by default, admin can show
    // When shown, test users go through SAME filters as real users
    if (u.tgUsername === '_test_') return false
    
    // 1. Role filter
    if (isAdmin && roleFilter !== 'All') {
      if (roleFilter === 'Side') {
        if (!u.isSide) return false
      } else {
        if (u.isSide) return false
        if (roleFilter === 'B') {
          // B: B(0) + VB(0.1-0.4)
          if (u.position > 0.4) return false
        } else if (roleFilter === 'VB') {
          // VB: B(0) + VB(0.1-0.4) + V(0.5)
          if (u.position > 0.4 && u.position !== 0.5) return false
        } else if (roleFilter === 'V') {
          // V: all non-side (no position restriction)
        } else if (roleFilter === 'VT') {
          // VT: V(0.5) + VT(0.6-0.9) + T(1)
          if (u.position < 0.5) return false
        } else if (roleFilter === 'T') {
          // T: VT(0.6-0.9) + T(1)
          if (u.position < 0.6) return false
        }
      }
    } else if (!isAdmin) {
      // Non-admin: auto opposite role filter
      if (ownProfile.isSide) {
        if (!u.isSide) return false
      } else {
        if (u.isSide) return false
        // B/VB sees V/VT/T (position >= 0.5)
        if (ownProfile.position <= 0.4 && u.position < 0.5) return false
        // VT/T sees B/VB/V (position <= 0.5)
        if (ownProfile.position >= 0.6 && u.position > 0.5) return false
        // V (0.5) sees all non-side — no filter
      }
    }
    
    // 2. Preference1 filter (Safe/Raw) — binary, always active
    if (u.preference1 !== pref1Filter) return false
    // 3. Preference2 filter — 'Party' shows both Party and Party✓
    if (pref2Filter === 'Party✓') {
      if (u.preference2 !== 'Party✓') return false
    } else if (pref2Filter === 'Party') {
      if (u.preference2 !== 'Party' && u.preference2 !== 'Party✓') return false
    } else {
      if (u.preference2 !== pref2Filter) return false
    }
    // 4. Preference3 filter (1on1/Group) — 1on1 filters to 1on1 only, Group shows all
    if (pref3Filter === '1on1' && u.preference3 !== '1on1') return false
    // 5. Host/Travel/Outdoor/Sauna — 'All' = no filter
    if (hostFilter !== 'All' && u.preference4 !== hostFilter) return false
    // 6. Photo filter — '有圖' = only users with real uploaded photos (hasRealPhoto from DB)
    if (photoFilter === '有圖' && u.hasRealPhoto !== true) return false
    return true
  }).sort((a, b) => {
    // Own profile always first, then sort by distance (closest first)
    if (a.isOwn) return -1
    if (b.isOwn) return 1
    return (a.distance || Infinity) - (b.distance || Infinity)
  })

  // New: matching users first, then fill remaining slots with closest non-matching (greyed out)
  const matchingIds = new Set(filteredGrid.map(u => u.id))
  const nonMatchingGrid = visibleGridUsers.filter(u => !matchingIds.has(u.id)).sort((a, b) => {
    if (a.isOwn) return -1
    if (b.isOwn) return 1
    return (a.distance || Infinity) - (b.distance || Infinity)
  })
  const sortedUsers = [...filteredGrid, ...nonMatchingGrid]

  // Debug count (include own profile)
  // const nearbyCount = users.filter(u => u.id !== ownProfile.id).length
  // const onlineCount = users.filter(u => u.id !== ownProfile.id && u.tgUsername !== '_test_' && isRecentlyActive(u)).length + 1 // +1 for self, exclude test users

  return (
    <div className="flex-1 overflow-y-auto min-h-0 pb-20">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#2C2C2E] px-3 py-2 flex items-center justify-between">
        {/* LEFT: Logo + HKMOD + Raffle + Dot Matrix Timer */}
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="HKMOD" className="w-8 h-8 rounded-full object-cover" />
          <h1 className="text-xl font-bold gradient-text tracking-tight">HKMOD</h1>
          <div className="w-px h-5 bg-[#2C2C2E] mx-0.5" />
          {/* Prize Draw (Raffle) button */}
          <RaffleButton
            raffle={raffle}
            isAdmin={isAdmin}
            onBuyTicket={onBuyRaffleTicket}
            onStartNextRaffle={onStartNextRaffle}
            lang={lang}
          />
          {/* Dot matrix raffle status display */}
          <RaffleStatusDisplay raffle={raffle} lang={lang} />
        </div>

        {/* RIGHT: Test Users | Invisible | Unlock | Refresh | Language */}
        <div className="flex items-center gap-2">
          {/* Invisible mode toggle */}
          <button
            onClick={onToggleInvisible}
            className={`w-7 h-7 rounded-full flex items-center justify-center nav-press text-[10px] border ${
              isInvisible
                ? 'bg-purple-500/30 text-purple-400 border-purple-500/40'
                : invisiblePurchased
                ? 'bg-purple-500/10 text-purple-500/60 border-purple-500/20'
                : 'bg-[#1A1A1A] text-[#8E8E93] border-[#2C2C2E]'
            }`}
            title={
              isAdmin
                ? (isInvisible ? 'Invisible ON (admin)' : 'Toggle Invisible (admin)')
                : isInvisible
                ? 'Invisible ON'
                : invisiblePurchased
                ? 'Invisible purchased — click to toggle'
                : 'Purchase Invisible Mode (2000 ⭐)'
            }
          >
            👁️‍🗨️
          </button>

          {/* Unlock profile lock — all users (admin free, others 100 Stars) */}
          <button
            onClick={onPromptUnlockProfile}
            className="w-7 h-7 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/30 flex items-center justify-center nav-press"
            title={isAdmin ? 'Release Locks (Free)' : 'Unlock Profile (100 ⭐)'}
          >
            <span className="text-[10px]">🔓</span>
          </button>

          <button
            onClick={() => {
              if (Date.now() - lastRefreshTime < 5 * 60 * 1000) return
              setLastRefreshTime(Date.now())
              onRefresh()
            }}
            className="w-7 h-7 rounded-full bg-[#1A1A1A] border border-[#2C2C2E] flex items-center justify-center nav-press"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#8E8E93]" />
          </button>
          <button
            onClick={cycleLang}
            className="text-[10px] font-bold text-[#FF6B35] px-2 py-1 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/30 nav-press"
          >
            {getLangLabel(lang)}
          </button>
        </div>
      </div>

      {/* User stats bar — compact: total rows only, cycle unlock tips on tap */}
      <div className="px-3 pt-1 flex items-center gap-2 text-[10px] text-[#8E8E93]">
        <span className="text-[#FF6B35] font-bold">{lang === 'tc' ? '已解鎖行數' : lang === 'sc' ? '已解锁行数' : 'Rows'}: {2 + (isPremium ? 1 : 0) + gridRowsUnlocked + channelFollowUnlock}</span>
        <span className="text-[#2C2C2E]">|</span>
        <span className="text-[#5AC8FA]">v17.2H</span>
        <span className="text-[#2C2C2E]">|</span>
        <UnlockTipCycle lang={lang} isPremium={isPremium} gridRowsUnlocked={gridRowsUnlocked} channelFollowUnlock={channelFollowUnlock} onClaimChannelFollow={onClaimChannelFollow} />
      </div>

      {showDbWarning && (
        <div className="mx-3 mt-2 bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#FF6B35] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#FF6B35] text-xs font-semibold">{t(lang, 'dbNotConfigured')}</p>
            <p className="text-[#8E8E93] text-[10px]">{t(lang, 'dbConfigHint')}</p>
          </div>
        </div>
      )}

      {/* Filter bar: 6 buttons — 1.online 2.photos 3.role(🔒) 4.safe/raw 5.party 6.1on1 | host always open */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {/* 1. Offline/Online toggle */}
          <button
            onClick={() => setOnlineOnly(!onlineOnly)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all nav-press flex-shrink-0 ${onlineOnly ? 'gradient-btn text-white' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${onlineOnly ? 'bg-[#00D4AA]' : 'bg-[#8E8E93]'}`} />
            {onlineOnly ? t(lang, 'onlineStatus') : t(lang, 'offlineStatus')}
          </button>

          {/* 2. No pic/Photos toggle */}
          <button
            onClick={() => setPhotoFilter(photoFilter === '有圖' ? '沒圖' : '有圖')}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all nav-press flex-shrink-0 ${photoFilter === '有圖' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}
          >
            {photoFilter === '有圖' ? t(lang, 'hasPic') : t(lang, 'noPic')}
          </button>

          {/* Divider */}
          <div className="w-px h-4 bg-[#2C2C2E] flex-shrink-0" />

          {/* 3. Role filter (🔒 until purchased) → All/Bottom/Versatile/Vers Bottom/Vers Top/Top/Side */}
          {isAdmin || filtersUnlocked ? (
            <button onClick={cycleRoleFilter}
              className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${getFilterColor(roleFilter)}`}
            >
              {roleFilter === 'All' ? t(lang, 'allRoles') : roleFilter}
            </button>
          ) : (
            <button onClick={onPromptFilterUnlock}
              className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]"
              title="Purchase filters to unlock"
            >
              🔒 {roleFilter}
            </button>
          )}

          {/* 4. Safe/Raw */}
          {isAdmin || filtersUnlocked ? (
            <button onClick={cyclePref1Filter}
              className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${pref1Filter === 'Safe' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
            >
              {tPref(lang, pref1Filter)}
            </button>
          ) : (
            <button onClick={onPromptFilterUnlock}
              className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]"
            >
              🔒 {tPref(lang, pref1Filter)}
            </button>
          )}

          {/* 5. Party/Clean */}
          <button onClick={isAdmin || filtersUnlocked ? cyclePref2Filter : cyclePartyPref2Filter}
            className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${pref2Filter === 'Clean' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}
          >
            {tPref(lang, pref2Filter)}
          </button>

          {/* 6. 1on1/Group */}
          {isAdmin || filtersUnlocked ? (
            <button onClick={cyclePref3Filter}
              className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${pref3Filter === '1on1' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-orange-500/20 text-orange-400'}`}
            >
              {tPref(lang, pref3Filter)}
            </button>
          ) : (
            <button onClick={onPromptFilterUnlock}
              className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]"
            >
              🔒 {tPref(lang, pref3Filter)}
            </button>
          )}

          {/* Host — always unlocked */}
          <button onClick={cycleHostFilter}
            className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${hostFilter === 'All' ? 'bg-[#1A1A1A] text-[#8E8E93]' : hostFilter === 'Host' ? 'bg-indigo-500/20 text-indigo-400' : hostFilter === 'Travel' ? 'bg-cyan-500/20 text-cyan-400' : hostFilter === 'Outdoor' ? 'bg-lime-500/20 text-lime-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {hostFilter === 'All' ? t(lang, 'anywhere') : tPref(lang, hostFilter)}
          </button>
        </div>
      </div>

      <div className="px-3">
        {isLoadingUsers && users.length === 0 && (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[#8E8E93] text-xs">{t(lang, 'findingMembers')}</p>
          </div>
        )}

{(() => {
          const effectiveRows = 2 + gridRowsUnlocked + (isPremium ? 1 : 0) + channelFollowUnlock + (ownProfile.hasRealPhoto ? 1 : 0)
          const unlockedSlots = effectiveRows * 5
          const totalRealUsers = sortedUsers.length
          const hasMoreUsers = totalRealUsers > unlockedSlots
          return (
            <>
              <ProfileGrid
                users={sortedUsers.filter(u => u.id !== ownProfile.id)}
                ownProfile={{...ownProfile, isOwn: true}}
                unlockedSlots={unlockedSlots}
                totalRealUsers={totalRealUsers}
                hasMoreUsers={hasMoreUsers}
                onPromptUnlock={onPromptUnlock}
                onViewOwnProfile={onViewOwnProfile}
                onViewPhoto={onViewPhoto}
                isAdmin={isAdmin}
                isLoading={isLoadingUsers && users.length === 0}
                matchingIds={matchingIds}
                renderTileBottom={(user) => {
                  const roleLabel = getGridRoleLabel(user.position ?? 0, user.isSide ?? false)
                  return (
                    <div className="flex items-center justify-between">
                      <p className="text-[#FF6B35] text-[7px] font-medium">{formatDist(user.distance ?? 0)}</p>
                      {!user.isOwn && <p className="text-[#8E8E93] text-[6px]">{getTimeAgo(user.updatedAt)}</p>}
                      <p className="text-[6px] font-bold text-[#8E8E93]">{roleLabel}</p>
                    </div>
                  )
                }}
              />
              {!hasMoreUsers && (
                <div className="mt-1.5 mx-0.5 select-none">
                  <button
                    className={"w-full rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all " + (
                      Date.now() - lastRefreshTime >= 5 * 60 * 1000
                        ? "bg-[#1A1A1A] border border-[#5AC8FA] text-[#5AC8FA] cursor-pointer active:scale-[0.98]"
                        : "bg-[#1A1A1A]/60 border border-[#2C2C2E] text-[#8E8E93] cursor-not-allowed"
                    )}
                    onClick={() => {
                      if (Date.now() - lastRefreshTime >= 5 * 60 * 1000) {
                        setLastRefreshTime(Date.now());
                        onRefresh();
                      }
                    }}
                    disabled={Date.now() - lastRefreshTime < 5 * 60 * 1000}
                  >
                    {Date.now() - lastRefreshTime >= 5 * 60 * 1000 ? (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span className="text-[11px] font-medium">{lang === 'tc' ? '刷新' : lang === 'sc' ? '刷新' : 'Refresh'}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px]">{'\u{1F551}'}</span>
                        <span className="text-[11px] font-medium">{(() => { const s = Math.ceil((5 * 60 * 1000 - (Date.now() - lastRefreshTime)) / 1000); return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}` })()}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )
        })()}
      </div>

      <div className="px-3 pt-2 flex items-center justify-between text-[10px] text-[#8E8E93]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]" />{lang === 'en' ? 'Online' : lang === 'ru' ? 'Онлайн' : '在線'}</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#8E8E93]" />{t(lang, 'offlineStatus')}</span>
        </div>
        <span className="text-[#FF6B35]">{t(lang, 'youOrangeBorder')}</span>
      </div>

    </div>
  )
}

// ─── 30-day lock helper ──────────────────────────────────────────────

// ─── Own Profile Screen with SAVE button ──────────────────────────────

function OwnProfileScreen({ profile, onSave, onBack, lang, editProfileUnlocked }: {
  profile: UserProfile
  onSave: (updated: UserProfile) => void
  onBack: () => void
  lang: Lang
  editProfileUnlocked: boolean
}) {
  const [draft, setDraft] = useState<UserProfile>({ ...profile })
  const [saved, setSaved] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [photoLoaded, setPhotoLoaded] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(0)
  const [globalUnlockAt, setGlobalUnlockAt] = useState(0)

  // Load last saved timestamp from storage + global unlock
  useEffect(() => {
    storageGetAll().then(result => {
      // Migrate old month key to timestamp
      const oldMonth = result?.[CLOUD.prefChangedAt]
      const newTs = result?.[CLOUD.prefLockedAt]
      if (newTs) {
        setLastSavedAt(parseInt(newTs) || 0)
      } else if (oldMonth && oldMonth.length >= 7) {
        // Convert "2026-05" → timestamp of 1st of that month
        const ts = new Date(`${oldMonth}-01T00:00:00Z`).getTime()
        setLastSavedAt(ts)
        // Also save in new format
        storageSet(CLOUD.prefLockedAt, String(ts))
      }
    })
    // Fetch global unlock timestamp from Supabase
    fetchGlobalUnlock().then(ts => setGlobalUnlockAt(ts))
  }, [])

  useEffect(() => { setDraft({ ...profile }) }, [profile.id])

  // Sync photo updates from profile without resetting entire draft
  useEffect(() => {
    setDraft(prev => ({ ...prev, tgPhotoUrl: profile.tgPhotoUrl, tgPhotos: profile.tgPhotos }))
  }, [profile.tgPhotoUrl, profile.tgPhotos])

  // Reset photo state when photo URL changes
  useEffect(() => {
    setPhotoLoaded(false)
    setPhotoIndex(0)
  }, [draft.tgPhotoUrl])

  const updateDraft = (field: keyof UserProfile, value: unknown) => {
    setDraft(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const togglePref = (field: 'preference1' | 'preference2' | 'preference3' | 'preference4', a: string, b: string, c?: string) => {
    // If edit profile unlocked via ⭐ button, skip all locks
    if (editProfileUnlocked) {
      if (c) {
        const current = draft[field]
        if (current === a) updateDraft(field, b)
        else if (current === b) updateDraft(field, c)
        else updateDraft(field, a)
      } else {
        updateDraft(field, draft[field] === a ? b : a)
      }
      return
    }
    // preference4 is always unlocked (two-state: Host <-> Travel, no monthly lock)
    if (field !== 'preference4') {
      // preference2: unlocked = free 3-state cycle; locked = Party↔Party✓ only
      if (field === 'preference2') {
        const current = draft.preference2
        const locked = isPrefLocked(lastSavedAt, globalUnlockAt)
        const isParty = (current === 'Party' || current === 'Party✓')

        if (locked && !isParty) {
          // Already Clean while locked — shouldn't happen, but block
          alert(`${lang === 'tc' ? '30天內不可更改' : lang === 'sc' ? '30天内不可更改' : lang === 'ru' ? 'Нельзя менять 30 дней' : 'Can only change every 30 days'}`)
          return
        }

        if (locked && isParty) {
          // Locked + Party/Party✓ → only toggle between Party↔Party✓
          updateDraft('preference2', current === 'Party' ? 'Party✓' : 'Party')
          return
        }

        // Unlocked — full 3-state cycle Clean → Party → Party✓ → Clean
        if (current === 'Clean') updateDraft('preference2', 'Party')
        else if (current === 'Party') updateDraft('preference2', 'Party✓')
        else updateDraft('preference2', 'Clean')
        return
      }
      // Check 30-day lock for preference1, preference3, role, stats
      if (isPrefLocked(lastSavedAt, globalUnlockAt)) {
        const labels: Record<string, string> = { preference1: 'Safe/Raw', preference3: '1on1/Group' }
        alert(`${labels[field]}: ${lang === 'tc' ? '30天內不可更改' : lang === 'sc' ? '30天内不可更改' : lang === 'ru' ? 'Нельзя менять 30 дней' : 'Can only change every 30 days'}`)
        return
      }
    }
    if (c) {
      // Three-state cycle: a -> b -> c -> a
      const current = draft[field]
      if (current === a) updateDraft(field, b)
      else if (current === b) updateDraft(field, c)
      else updateDraft(field, a)
    } else {
      updateDraft(field, draft[field] === a ? b : a)
    }
  }

  const cyclePref4 = () => {
    const order: Array<'Host' | 'Travel' | 'Outdoor' | 'Sauna'> = ['Host', 'Travel', 'Outdoor', 'Sauna']
    const current = draft.preference4 || 'Travel'
    const idx = order.indexOf(current)
    updateDraft('preference4', order[(idx + 1) % order.length])
  }

  const handleSave = async () => {
    // Validation: required fields must be filled
    if (!draft.height || draft.height <= 0 || !draft.weight || draft.weight <= 0) {
      alert(lang === 'tc' ? '請輸入身高和體重' : lang === 'sc' ? '请输入身高和体重' : lang === 'ru' ? 'Введите рост и вес' : 'Please enter height and weight')
      return
    }
    if (!draft.isSide && (draft.position < 0 || draft.position > 1)) {
      alert(lang === 'tc' ? '請選擇角色' : lang === 'sc' ? '请选择角色' : lang === 'ru' ? 'Выберите роль' : 'Please select a role')
      return
    }

    // Saving profile locks ALL lockable fields for 30 days
    const now = Date.now()
    await storageSet(CLOUD.prefLockedAt, String(now))
    setLastSavedAt(now)
    await storageSet(CLOUD.height, String(draft.height))
    await storageSet(CLOUD.weight, String(draft.weight))
    await storageSet(CLOUD.position, String(draft.position))
    await storageSet(CLOUD.isSide, String(draft.isSide))
    await storageSet(CLOUD.pref1, draft.preference1 || 'Safe')
    await storageSet(CLOUD.pref2, draft.preference2 || 'Clean')
    await storageSet(CLOUD.pref3, draft.preference3 || '1on1')
    await storageSet(CLOUD.pref4, draft.preference4 || 'Travel')
    await storageSet(CLOUD.openMsg, String(draft.openToMessages || false))
    onSave(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const photos = draft.tgPhotos?.length ? draft.tgPhotos : (draft.tgPhotoUrl ? [draft.tgPhotoUrl] : [])
  const currentPhoto = photos[photoIndex % photos.length]
  const hasMultiplePhotos = photos.length > 1

  return (
    <div className="view-enter h-full flex flex-col">
      {/* Fixed Header */}
      <div className="shrink-0 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#2C2C2E] px-3 py-2.5 flex items-center justify-between z-10">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center nav-press">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h2 className="text-base font-semibold text-white">{t(lang, 'editProfile')}</h2>
        <div className="w-8" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">

        {/* Photo + Stats Row */}
        <div className="flex gap-3 mb-3">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-b from-[#2C2C2E] to-[#1A1A1A]">
            {/* Placeholder always visible underneath */}
            <div className="absolute inset-0 flex items-center justify-center z-0">
              <span className="text-2xl font-bold text-[#8E8E93]">{draft.name.charAt(0)}</span>
            </div>
            {/* Image layered on top — click to rotate */}
            {currentPhoto && (
              <img
                src={currentPhoto}
                alt="You"
                className={`absolute inset-0 w-full h-full object-cover z-10 ${photoLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 active:opacity-70`}
                referrerPolicy="no-referrer"
                draggable={false}
                loading="eager"
                decoding="async"
                onLoad={() => setPhotoLoaded(true)}
                onError={() => setPhotoLoaded(false)}
                onClick={() => hasMultiplePhotos && setPhotoIndex((prev) => (prev + 1) % photos.length)}
              />
            )}
            {/* Photo counter badge */}
            {hasMultiplePhotos && (
              <div className="absolute top-0.5 right-0.5 bg-black/60 rounded-full px-1 py-0 z-20">
                <span className="text-white text-[8px] font-bold">{photoIndex + 1}/{photos.length}</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-[#0088CC]/70 text-center py-0.5 z-20">
              <span className="text-white text-[7px] font-bold uppercase">TG</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-base">{draft.name}</span>
              {draft.isOnline && <span className="px-1.5 py-0.5 bg-[#00D4AA]/20 text-[#00D4AA] text-[9px] font-bold rounded-full">{t(lang, 'online').toUpperCase()}</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#8E8E93]">
              <span>{draft.height}cm</span><span className="text-[#2C2C2E]">|</span>
              <span>{draft.weight}kg</span><span className="text-[#2C2C2E]">|</span>
              <span className="text-[#FF6B35] font-bold">{formatRole(draft.position, draft.isSide)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => togglePref('preference1', 'Safe', 'Raw')} className={`text-[10px] font-bold px-2 py-0.5 rounded-full nav-press ${draft.preference1 === 'Safe' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} ${isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked ? 'opacity-40' : ''}`}>{isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked ? '🔒' : ''}{tPref(lang, draft.preference1 || 'Safe')}</button>
              <button onClick={() => togglePref('preference2', 'Clean', 'Party', 'Party✓')} className={`text-[10px] font-bold px-2 py-0.5 rounded-full nav-press ${draft.preference2 === 'Clean' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'} ${isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked && draft.preference2 === 'Clean' ? 'opacity-40 pointer-events-none' : ''}`}>{isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked && draft.preference2 === 'Clean' ? '🔒' : ''}{tPref(lang, draft.preference2 || 'Clean')}</button>
              <button onClick={() => togglePref('preference3', '1on1', 'Group')} className={`text-[10px] font-bold px-2 py-0.5 rounded-full nav-press ${draft.preference3 === '1on1' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-orange-500/20 text-orange-400'} ${isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked ? 'opacity-40' : ''}`}>{isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked ? '🔒' : ''}{tPref(lang, draft.preference3 || '1on1')}</button>
              <button onClick={cyclePref4} className={`text-[10px] font-bold px-2 py-0.5 rounded-full nav-press ${draft.preference4 === 'Host' ? 'bg-indigo-500/20 text-indigo-400' : draft.preference4 === 'Travel' ? 'bg-cyan-500/20 text-cyan-400' : draft.preference4 === 'Outdoor' ? 'bg-lime-500/20 text-lime-400' : 'bg-amber-500/20 text-amber-400'}`}>{tPref(lang, draft.preference4 || 'Travel')}</button>
              <span className="text-[9px] text-[#8E8E93] ml-1">👆 Click to change</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[#2C2C2E] mb-3" />

        {/* Height & Weight — same row, monthly locked */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#8E8E93] font-medium uppercase">{t(lang, 'height')} / {t(lang, 'weight')}</span>
            {isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked && <span className="text-[10px] text-[#8E8E93]">🔒 {lang === 'tc' ? '30天內不可更改' : lang === 'sc' ? '30天内不可更改' : lang === 'ru' ? '30 дней' : 'Locked 30 days'}</span>}
          </div>
          <div className={`flex gap-2 ${isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex-1 flex items-center justify-between px-3 py-2.5 bg-[#1A1A1A] rounded-lg">
              <span className="text-xs text-[#8E8E93] font-medium uppercase">{t(lang, 'height')}</span>
              <input type="number" value={draft.height || ''} placeholder="0"
                onChange={(e) => updateDraft('height', parseInt(e.target.value) || 0)}
                className="bg-transparent text-white text-sm font-medium text-right outline-none w-16" />
            </div>
            <div className="flex-1 flex items-center justify-between px-3 py-2.5 bg-[#1A1A1A] rounded-lg">
              <span className="text-xs text-[#8E8E93] font-medium uppercase">{t(lang, 'weight')}</span>
              <input type="number" value={draft.weight || ''} placeholder="0"
                onChange={(e) => updateDraft('weight', parseInt(e.target.value) || 0)}
                className="bg-transparent text-white text-sm font-medium text-right outline-none w-16" />
            </div>
          </div>
        </div>

        <div className="h-px bg-[#2C2C2E] mb-3" />

        {/* Role Section */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8E8E93] font-medium uppercase">{t(lang, 'role') || 'Role'}</span>
            {isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked && <span className="text-[10px] text-[#8E8E93]">🔒 {lang === 'tc' ? '30天內不可更改' : lang === 'sc' ? '30天内不可更改' : lang === 'ru' ? '30 дней' : 'Locked 30 days'}</span>}
          </div>
          <div className={`flex gap-2 ${isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button onClick={() => updateDraft('isSide', false)} className={`flex-1 h-10 rounded-lg text-xs font-bold transition-all nav-press ${!draft.isSide ? 'gradient-btn text-white' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
              {formatRole(draft.position, false)}
            </button>
            <button onClick={() => updateDraft('isSide', true)} className={`flex-1 h-10 rounded-lg text-xs font-bold transition-all nav-press ${draft.isSide ? 'gradient-btn text-white' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'}`}>
              Side
            </button>
          </div>

          {!draft.isSide && (
            <div className={`space-y-1 ${isPrefLocked(lastSavedAt, globalUnlockAt) && !editProfileUnlocked ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between text-[10px] text-[#8E8E93]">
                <span>{t(lang, 'bottom0')}</span>
                <span className="text-white font-bold text-xs">{draft.position.toFixed(1)}</span>
                <span>{t(lang, 'top1')}</span>
              </div>
              <input type="range" min="0" max="1" step="0.1" value={draft.position}
                onChange={(e) => updateDraft('position', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#2C2C2E] rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#FF6B35' }} />
              <div className="flex justify-between px-1">
                {[0, 0.2, 0.4, 0.6, 0.8, 1].map(v => (
                  <span key={v} className={`text-[8px] ${Math.abs(draft.position - v) < 0.05 ? 'text-[#FF6B35] font-bold' : 'text-[#8E8E93]'}`}>{v.toFixed(1)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── FIXED SAVE BAR at bottom ─── */}
      <div className="shrink-0 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#2C2C2E] px-3 pt-3 pb-5 z-20">
        {saved && (
          <div className="text-center text-[#00D4AA] text-xs font-semibold mb-2 animate-pulse">
            {t(lang, 'saved')}
          </div>
        )}
        {/* Only show Save when there are changes */}
        {(draft.height !== profile.height || draft.weight !== profile.weight ||
          draft.position !== profile.position || draft.isSide !== profile.isSide ||
          draft.preference1 !== profile.preference1 || draft.preference2 !== profile.preference2 ||
          draft.preference3 !== profile.preference3 || draft.preference4 !== profile.preference4) ? (
          <button onClick={handleSave} className="w-full h-14 gradient-btn rounded-xl text-white font-bold text-lg nav-press flex items-center justify-center gap-2">
            <Check className="w-6 h-6" />{t(lang, 'saveProfile')}
          </button>
        ) : (
          <button onClick={onBack} className="w-full h-12 bg-[#1A1A1A] border border-[#2C2C2E] rounded-xl text-[#8E8E93] font-medium text-sm nav-press">
            Back
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Flying Messages Overlay ─────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>('MAIN')
  const [showSplash, setShowSplash] = useState(true)
  const [adminAction, setAdminAction] = useState<'release' | null>(null)
  const [ownProfile, setOwnProfile] = useState<UserProfile>({
    id: 'own', name: 'You', age: 0, height: 178, weight: 72,
    position: 0.5, isSide: false, isOnline: true, distance: 0, isOwn: true,
    preference1: 'Raw', preference2: 'Party', preference3: 'Group', preference4: 'Travel',
    openToMessages: false, tgUsername: '', tgPhotoUrl: '', tgPhotos: [],
    hasPhoto: false, hasRealPhoto: undefined,
    isInvisible: false,
  })
  const [users, setUsers] = useState<UserProfile[]>([])
  const [photoOverlay, setPhotoOverlay] = useState<UserProfile | null>(null)
  const [locationGranted, setLocationGranted] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [groupCheck, setGroupCheck] = useState<'checking' | 'member' | 'not_member'>('checking')

  const [lang, setLang] = useState<Lang>(getDefaultLang())
  const [starsPaidFor, setStarsPaidFor] = useState<Set<string>>(new Set())
  const [filtersUnlocked, setFiltersUnlocked] = useState(false)
  const [editProfileUnlocked] = useState(false)
  const [gridRowsUnlocked, setGridRowsUnlocked] = useState(0)
  const [channelFollowUnlock, setChannelFollowUnlock] = useState(0)
  const [isPremium, setIsPremium] = useState(false)
  const [invisibleUntil, setInvisibleUntil] = useState<string | null>(null)
  const [invisibleActive, setInvisibleActive] = useState(false)
  const isInvisible = invisibleActive && (invisibleUntil ? new Date(invisibleUntil).getTime() > Date.now() : false)
  const hasPurchasedInvisible = invisibleUntil !== null
  const [raffle, setRaffle] = useState<Raffle | null>(null)

  // Flying messages: shared across all users via Supabase
  const [flyingMessages, setFlyingMessages] = useState<{id: number; text: string; top: string}[]>([])
  const lastFlyingSendRef = useRef(0) // 1 min cooldown per user


  // "Show More Users" button → unlock +1 grid row (5 users)
  // Admin skips payment, regular users pay 1000 Stars

  // ─── Unlock Profile Lock — 100 Stars for non-admin ─────────────────
  const promptUnlockProfile = usePaymentUnlock({
    isAdmin,
    workerUrl: 'https://hkmo-d.mileschan852.workers.dev/createinvoice',
    amount: 100,
    purpose: 'edit',
    onAdminUnlock: useCallback(() => {
      setAdminAction('release')
    }, []),
    onPaymentSuccess: useCallback(() => {
      storageSet(CLOUD.prefLockedAt, '0')
      alert('Profile lock released! Refresh to apply.')
      window.location.reload()
    }, []),
    onError: useCallback((err: any) => {
      console.error('Profile unlock payment error:', err)
    }, []),
  })

  // ─── Raffle (Prize Draw) handlers ──────────────────────────────────

  const handleBuyRaffleTicket = useCallback(async () => {
    if (!raffle || raffle.status === 'completed') return
    const tg = getTg()
    const userId = tg?.initDataUnsafe?.user?.id
    if (!userId) return

    // Check if raffle has already ended (deadline passed)
    if (raffle.status === 'active' && raffle.ends_at && new Date(raffle.ends_at).getTime() <= Date.now()) {
      // Draw winner
      const winner = await drawRaffleWinner(raffle.id)
      if (winner) {
        await completeRaffle(raffle.id, winner.user_id, winner.name)
        // Apply prize to winner
        if (raffle.prize_type === 'invisible') {
          const until = new Date(Date.now() + 30 * 86400000).toISOString()
          await updateInvisibleStatus(winner.user_id, until)
        }
      }
      const final = await getActiveRaffle()
      setRaffle(final || null)
      return
    }

    // Admin gets free ticket
    if (isAdmin) {
      const ok = await buyRaffleTicket(raffle.id, userId)
      if (ok) {
        const updated = await getActiveRaffle()
        if (updated) {
          setRaffle(updated)
          // Auto-start countdown when >10 tickets reached, draw on next Wednesday
          if (updated.current_tickets > 10 && updated.status === 'pending') {
            await startRaffleCountdown(updated.id)
            await setRaffleDrawToNextWednesday(updated.id)
            const final = await getActiveRaffle()
            if (final) setRaffle(final)
          }
        }
      }
      return
    }

    // Regular user: Stars payment
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch('https://hkmo-d.mileschan852.workers.dev/createinvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount: 100, purpose: 'raffle' }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.ok && data.result && tg?.openInvoice) {
        tg.openInvoice(data.result, async (status) => {
          if (status === 'paid') {
            const ok = await buyRaffleTicket(raffle.id, userId)
            if (ok) {
              const updated = await getActiveRaffle()
              if (updated) {
                setRaffle(updated)
                if (updated.current_tickets > 10 && updated.status === 'pending') {
                  await startRaffleCountdown(updated.id)
                  await setRaffleDrawToNextWednesday(updated.id)
                  const final = await getActiveRaffle()
                  if (final) setRaffle(final)
                }
              }
            }
          }
        })
      }
    } catch { /* Worker failed */ }
  }, [raffle, isAdmin])

  const handleStartNextRaffle = useCallback(async () => {
    if (!isAdmin) return
    // Auto-alternate: if last raffle was invisible (or none), start filters next
    const nextType = (!raffle || raffle.prize_type === 'invisible') ? 'filters' : 'invisible'
    const newRaffle = await createRaffle(nextType)
    if (newRaffle) setRaffle(newRaffle)
  }, [isAdmin, raffle])

  // Poll active raffle to check if deadline reached — auto-draw winner
  useEffect(() => {
    if (!raffle || raffle.status !== 'active' || !raffle.ends_at) return
    const checkDeadline = async () => {
      if (new Date(raffle.ends_at!).getTime() <= Date.now()) {
        const winner = await drawRaffleWinner(raffle.id)
        if (winner) {
          await completeRaffle(raffle.id, winner.user_id, winner.name)
          if (raffle.prize_type === 'invisible') {
            const until = new Date(Date.now() + 30 * 86400000).toISOString()
            await updateInvisibleStatus(winner.user_id, until)
          }
        }
        const final = await getActiveRaffle()
        setRaffle(final || null)
      }
    }
    const interval = setInterval(checkDeadline, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [raffle?.status, raffle?.ends_at, raffle?.id, raffle?.prize_type])

  const promptUnlock = usePaymentUnlock({
    isAdmin,
    workerUrl: 'https://hkmo-d.mileschan852.workers.dev/createinvoice',
    amount: 1000,
    purpose: 'grid',
    onAdminUnlock: useCallback(() => {
      const newRows = gridRowsUnlocked + 1
      setGridRowsUnlocked(newRows)
      storageSet(CLOUD.gridRowsUnlocked, String(newRows))
      storageSet(CLOUD.gridRowsUnlockedAt, String(Date.now()))
      const uid = getUserId()
      if (uid) saveGridRowsUnlocked(uid, newRows)
    }, [gridRowsUnlocked]),
    onPaymentSuccess: useCallback(() => {
      const newRows = gridRowsUnlocked + 1
      setGridRowsUnlocked(newRows)
      storageSet(CLOUD.gridRowsUnlocked, String(newRows))
      storageSet(CLOUD.gridRowsUnlockedAt, String(Date.now()))
      const uid = getUserId()
      if (uid) saveGridRowsUnlocked(uid, newRows)
    }, [gridRowsUnlocked]),
    onError: useCallback((err: any) => {
      console.error('Grid unlock payment error:', err)
    }, []),
  })

  // Admin re-check: if user data arrives late (e.g. bot menu open), re-check admin status
  useEffect(() => {
    const interval = setInterval(() => {
      const tg = getTg()
      const user = tg?.initDataUnsafe?.user
      if (user && user.id) {
        const adminCheck = isAdminUser(user, ADMIN_IDS, ADMIN_USERNAMES)
        if (adminCheck !== isAdmin) {
          console.log(`Admin re-check: id=${user.id}, username=${user.username}, admin=${adminCheck}`)
          setIsAdmin(adminCheck)
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isAdmin])

  const promptFilterUnlock = usePaymentUnlock({
    isAdmin,
    workerUrl: 'https://hkmo-d.mileschan852.workers.dev/createinvoice',
    amount: 500,
    purpose: 'filters',
    onAdminUnlock: useCallback(() => {
      setFiltersUnlocked(true)
      const now = Date.now()
      const expiresAt = new Date(now + 30 * 86400000).toISOString()
      storageSet(CLOUD.filtersUnlocked, 'true')
      storageSet(CLOUD.filtersUnlockedAt, String(now))
      const uid = getUserId()
      if (uid) saveFiltersUnlocked(uid, true, expiresAt)
    }, []),
    onPaymentSuccess: useCallback(() => {
      setFiltersUnlocked(true)
      const now = Date.now()
      const expiresAt = new Date(now + 30 * 86400000).toISOString()
      storageSet(CLOUD.filtersUnlocked, 'true')
      storageSet(CLOUD.filtersUnlockedAt, String(now))
      const uid = getUserId()
      if (uid) saveFiltersUnlocked(uid, true, expiresAt)
    }, []),
    onError: useCallback((err: any) => {
      console.error('Filter unlock payment error:', err)
    }, []),
  })

  const handleClaimChannelFollow = useCallback(async () => {
    if (channelFollowUnlock) return
    // Open the channel
    const url = 'https://t.me/HKMO_D'
    try {
      const tg = getTg()
      if (tg?.openTelegramLink) { tg.openTelegramLink(url) }
      else if (tg?.openLink) { tg.openLink(url, { try_instant_view: false }) }
      else { window.open(url, '_blank') }
    } catch {}
    // Give the unlock immediately (we trust the user - it's a one-time thing)
    setChannelFollowUnlock(1)
    storageSet(CLOUD.channelFollowed, '1')
  }, [channelFollowUnlock])

  // Invisible mode payment — 2000 Stars for 30 days
  const promptInvisiblePayment = usePaymentUnlock({
    isAdmin: false, // Admin doesn't use this path - they get it free via toggle
    workerUrl: 'https://hkmo-d.mileschan852.workers.dev/createinvoice',
    amount: 2000,
    purpose: 'invisible',
    onAdminUnlock: useCallback(() => {}, []),
    onPaymentSuccess: useCallback(() => {
      const until = new Date(Date.now() + 30 * 86400000).toISOString()
      setInvisibleUntil(until)
      setInvisibleActive(true)
      storageSet(CLOUD.invisibleActive, 'true')
      const uid = getUserId()
      if (uid) updateInvisibleStatus(uid, until)
    }, []),
    onError: useCallback((err: any) => {
      console.error('Invisible payment error:', err)
    }, []),
  })

  const tgUserId = useRef<number | null>(null)

  // Splash screen: auto-dismiss after 2.5s
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500)
    return () => clearTimeout(timer)
  }, [])
  // ─── Group membership check ───────────────────────────────────────
  useEffect(() => {
    const tg = getTg()
    const inTg = isInTelegram()
    const user = tg?.initDataUnsafe?.user

    console.log('=== HKMOD Check === inTelegram:', inTg)

    // Admin bypass FIRST — always allow admins even outside Telegram
    if (isAdminUser(user, ADMIN_IDS, ADMIN_USERNAMES)) {
      console.log('  result: ADMIN BYPASS')
      setGroupCheck('member')
      return
    }

    // Must be inside Telegram WebApp (profiles need Telegram user data)
    if (!inTg || !tg) {
      console.log('  result: NOT in Telegram')
      setGroupCheck('not_member')
      return
    }

    // Any Telegram user can access (app is shared in group)
    console.log('  result: PASSED - Telegram user')
    setGroupCheck('member')
  }, [])

  // ─── Init: Load Telegram user + saved data ─────────────────────────
  useEffect(() => {
    const tg = getTg()
    const inTg = isInTelegram()
    console.log('=== HKMOD Init === inTelegram:', inTg, 'WebApp:', !!tg)

    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor('#0A0A0A')

      const user = tg.initDataUnsafe?.user
      console.log('TG user:', user ? { id: user.id, name: user.first_name, photo_url: user.photo_url?.substring(0, 50) } : 'none')

      if (user) {
        tgUserId.current = user.id
        setIsPremium(!!user.is_premium)
        const adminCheck = isAdminUser(user, ADMIN_IDS, ADMIN_USERNAMES)
        console.log(`Admin check: id=${user.id}, username=${user.username}, admin=${adminCheck}`)
        setIsAdmin(adminCheck)
        const photoUrl = user.photo_url || ''
        setOwnProfile(prev => ({
          ...prev,
          id: String(user.id),
          name: user.first_name || prev.name,
          tgUsername: user.username || prev.tgUsername,
          tgPhotoUrl: photoUrl || prev.tgPhotoUrl,
          tgPhotos: photoUrl ? [photoUrl] : prev.tgPhotos,
          hasPhoto: (!!photoUrl && photoUrl.startsWith('http')) || prev.hasPhoto,
        }))
        // Save photo_url to CloudStorage (it expires after ~1hr!)
        if (photoUrl) {
          storageSet(CLOUD.photoUrl, photoUrl)
        }
        // Photo gate: check if user has a real photo on every login
        const runPhotoCheck = async () => {
          const uid = tgUserId.current
          if (!uid) return
          const isRealNow = checkRealPhoto(photoUrl)
          const dbStatus = await fetchUserPhotoStatus(uid)
          if (dbStatus) {
            // If photo was real before but not now -> relock (background, no UI block)
            if (dbStatus.has_real_photo && !isRealNow) {
              console.log('[PhotoGate] Photo removed, relocking features')
              await relockUserFeatures(uid)
              await updateRealPhotoStatus(uid, false)
            } else if (!dbStatus.has_real_photo && isRealNow) {
              // New real photo detected
              await updateRealPhotoStatus(uid, true)
            }
            // If was real and still real -> no change
          } else {
            // No DB record -> first time
            await updateRealPhotoStatus(uid, isRealNow)
          }
          // Also update the local profile
          setOwnProfile(prev => ({ ...prev, hasRealPhoto: isRealNow }))
        }
        runPhotoCheck()
        // Legacy: also run detectRealPhoto for hasRealPhoto UI state
        detectRealPhoto(photoUrl).then(isReal => {
          setOwnProfile(prev => ({ ...prev, hasRealPhoto: isReal }))
        })
        if (user.first_name) {
          storageSet(CLOUD.name, user.first_name)
        }
      }
    }

    // Load saved data (including backup photo_url)
    storageGetAll().then(result => {
      if (!result || Object.keys(result).length === 0) return
      console.log('Storage loaded keys:', Object.keys(result))

      const loaded: Partial<UserProfile> = {}
      // Load photo_url backup ONLY if we don't already have a fresh one from initData
      const savedPhoto = result[CLOUD.photoUrl]
      if (savedPhoto && savedPhoto.trim() !== '' && !loaded.tgPhotoUrl) {
        loaded.tgPhotoUrl = savedPhoto
        loaded.tgPhotos = [savedPhoto]
      }
      // Load name backup
      const savedName = result[CLOUD.name]
      if (savedName && savedName.trim() !== '') loaded.name = savedName

      const hVal = result[CLOUD.height]
      if (hVal && hVal.trim() !== '') { const p = parseInt(hVal); if (!isNaN(p) && p > 0) loaded.height = p }
      const wVal = result[CLOUD.weight]
      if (wVal && wVal.trim() !== '') { const p = parseInt(wVal); if (!isNaN(p) && p > 0) loaded.weight = p }
      const pVal = result[CLOUD.position]
      if (pVal && pVal.trim() !== '') { const p = parseFloat(pVal); if (!isNaN(p)) loaded.position = p }
      loaded.isSide = result[CLOUD.isSide] === 'true'
      if (result[CLOUD.pref1]) loaded.preference1 = result[CLOUD.pref1] as 'Safe' | 'Raw'
      if (result[CLOUD.pref2]) loaded.preference2 = result[CLOUD.pref2] as 'Clean' | 'Party' | 'Party✓'
      if (result[CLOUD.pref3]) loaded.preference3 = result[CLOUD.pref3] as '1on1' | 'Group'
      if (result[CLOUD.pref4]) {
        const p4 = result[CLOUD.pref4]
        // Migrate old 'Off' value to 'Travel'
        loaded.preference4 = (p4 === 'Off' ? 'Travel' : p4) as 'Host' | 'Travel' | 'Outdoor' | 'Sauna'
      }
      loaded.openToMessages = result[CLOUD.openMsg] === 'true'
      if (result[CLOUD.lang]) setLang(result[CLOUD.lang] as Lang)

      // Check if grid filters are unlocked (from gift/deep link), with 30-day expiry
      const tg2 = getTg()
      const startParam = tg2?.initDataUnsafe?.start_param
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
      const unlockedAt = parseInt(result[CLOUD.filtersUnlockedAt] || '0')
      const now = Date.now()
      const isExpired = unlockedAt > 0 && (now - unlockedAt) > THIRTY_DAYS_MS
      
      if (!isExpired && (startParam === 'unlocked' || result[CLOUD.filtersUnlocked] === 'true')) {
        setFiltersUnlocked(true)
        if (startParam === 'unlocked') {
          storageSet(CLOUD.filtersUnlocked, 'true')
          storageSet(CLOUD.filtersUnlockedAt, String(now))
        }
      } else if (isExpired) {
        // Expired — clear unlock
        storageSet(CLOUD.filtersUnlocked, '')
        storageSet(CLOUD.filtersUnlockedAt, '')
        setFiltersUnlocked(false)
      }
      // Load saved grid rows unlocked
      const savedGridRows = result[CLOUD.gridRowsUnlocked]
      if (savedGridRows) {
        const parsed = parseInt(savedGridRows)
        if (!isNaN(parsed) && parsed > 0) {
          setGridRowsUnlocked(parsed)
        }
      }
      // Load channel follow unlock
      if (result[CLOUD.channelFollowed] === '1') {
        setChannelFollowUnlock(1)
      }

      // Sync unlock status from Supabase (handles refunds + cross-device)
      const syncUserId = tgUserId.current
      if (syncUserId) {
        fetchUserUnlockStatus(syncUserId).then(status => {
          if (!status) return
          const now = Date.now()
          // Sync filters_unlocked
          const filtersExpired = status.filters_unlocked_expires_at
            ? new Date(status.filters_unlocked_expires_at).getTime() < now
            : !status.filters_unlocked
          if (!filtersExpired && status.filters_unlocked) {
            setFiltersUnlocked(true)
            storageSet(CLOUD.filtersUnlocked, 'true')
            storageSet(CLOUD.filtersUnlockedAt, String(now))
          } else if (filtersExpired || !status.filters_unlocked) {
            setFiltersUnlocked(false)
            storageSet(CLOUD.filtersUnlocked, '')
            storageSet(CLOUD.filtersUnlockedAt, '')
          }
          // Sync grid_rows_unlocked
          const dbRows = status.grid_rows_unlocked || 0
          if (dbRows >= 0) {
            setGridRowsUnlocked(dbRows)
            storageSet(CLOUD.gridRowsUnlocked, String(dbRows))
          }
          // Sync has_real_photo
          setOwnProfile(prev => ({ ...prev, hasRealPhoto: !!status.has_real_photo }))
          // Sync invisible_until — check timer expiry on login
          const dbInvisible = status.invisible_until
          if (dbInvisible) {
            const expired = new Date(dbInvisible).getTime() < now
            if (!expired) {
              setInvisibleUntil(dbInvisible)
              // Load saved active state, default to on
              storageGet(CLOUD.invisibleActive).then(saved => {
                setInvisibleActive(saved === 'false' ? false : true)
              }).catch(() => setInvisibleActive(true))
            } else {
              // Timer expired — make user visible (clear DB + local state)
              setInvisibleUntil(null)
              setInvisibleActive(false)
              storageSet(CLOUD.invisibleActive, 'false')
              updateInvisibleStatus(syncUserId, null)
            }
          }
        }).catch(err => console.error('fetchUserUnlockStatus error:', err))

        // Load active raffle
        getActiveRaffle().then(r => {
          if (r) setRaffle(r)
        })
      }

      // Restore lat/lng from CloudStorage
      const savedLat = result[CLOUD.lat]
      const savedLng = result[CLOUD.lng]
      if (savedLat && savedLng) {
        const lat = parseFloat(savedLat)
        const lng = parseFloat(savedLng)
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          loaded.lat = lat
          loaded.lng = lng
          setLocationGranted(true)
        }
      }

      if (Object.keys(loaded).length > 0) {
        setOwnProfile(prev => {
          const merged = { ...prev, ...loaded }
          console.log('Profile merged from storage:', { name: merged.name, photoUrl: merged.tgPhotoUrl?.substring(0,30), height: merged.height, weight: merged.weight })
          return merged
        })
      }
    })
  }, [])

  // ─── Auto upsert when user+location ready ─────────────────────────
  useEffect(() => {
    const uid = tgUserId.current
    const lat = ownProfile.lat
    const lng = ownProfile.lng
    if (!uid || !lat || !lng || !hasValidKey) return

    console.log('Auto upsert for user', uid, 'at', lat, lng)
    upsertUser({
      id: uid,
      name: ownProfile.name,
      photo_url: ownProfile.tgPhotoUrl || null,
      height: ownProfile.height,
      weight: ownProfile.weight,
      position: ownProfile.position,
      is_side: ownProfile.isSide,
      preference1: ownProfile.preference1 || 'Raw',
      preference2: ownProfile.preference2 || 'Party',
      preference3: ownProfile.preference3 || 'Group',
      preference4: ownProfile.preference4 || 'Travel',
      open_to_messages: ownProfile.openToMessages || false,
      tg_username: ownProfile.tgUsername || null,
      lat,
      lng,
      is_online: true,
      updated_at: new Date().toISOString(),
    }).then(result => {
      console.log('Upsert result:', result ? `success id=${result.id}` : 'null')
      // Auto 7-day filter unlock for new users
      if (result && !result.filters_unlocked_expires_at) {
        ensureFilterUnlock(result.id).then(ok => {
          console.log('Auto filter unlock:', ok ? 'set 7 days' : 'failed')
        })
      }
    }).catch(err => {
      console.error('Upsert error:', String(err).substring(0, 200))
    })
  }, [ownProfile.lat, ownProfile.lng, ownProfile.name, ownProfile.tgPhotoUrl, ownProfile.height, ownProfile.weight, ownProfile.position, ownProfile.isSide, ownProfile.preference1, ownProfile.preference2, ownProfile.preference3, ownProfile.preference4, ownProfile.openToMessages, ownProfile.tgUsername])

  // ─── Heartbeat: update timestamp every 30s ────────────────────────
  useEffect(() => {
    if (!locationGranted) return
    const uid = tgUserId.current
    if (!uid) return

    const ping = () => {
      setOnlineStatus(uid, true).catch(console.error)
    }
    ping()
    const heartbeat = setInterval(ping, 30000)
    return () => clearInterval(heartbeat)
  }, [locationGranted])

  // ─── Refresh nearby users (manual + auto) ─────────────────────────
  // Initialize to -120s so first refresh is allowed immediately
  // Shared 5-min cooldown between top refresh and bottom button
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now() - 300000)

  const handleRefresh = useCallback(() => {
    const lat = ownProfile.lat
    const lng = ownProfile.lng
    if (!lat || !lng) return
    setIsLoadingUsers(true)
    fetchNearby(lat, lng).then(dbUsers => {
      const myId = tgUserId.current
      const mapped = dbUsers.filter(u => u.id !== myId).map(u => dbToProfile(u, lat, lng))
      // Override own invisible status with local state (in case DB column missing)
      const ownIdx = mapped.findIndex(u => u.isOwn)
      if (ownIdx >= 0) {
        mapped[ownIdx] = { ...mapped[ownIdx], isInvisible: isInvisible, invisibleUntil: invisibleUntil || undefined }
      }
      console.log('Nearby refresh:', mapped.length, 'users')
      setUsers(mapped)
      setIsLoadingUsers(false)
    }).catch(err => {
      console.error('Refresh error:', String(err).substring(0, 200))
      setIsLoadingUsers(false)
    })
  }, [ownProfile.lat, ownProfile.lng])

  // Auto refresh every 5 minutes — triggers when lat/lng available
  useEffect(() => {
    const lat = ownProfile.lat
    const lng = ownProfile.lng
    if (!lat || !lng) return
    handleRefresh()
    const interval = setInterval(handleRefresh, 300000)
    return () => clearInterval(interval)
  }, [ownProfile.lat, ownProfile.lng, handleRefresh])

  // ─── Poll flying messages from Supabase (shared across all users) ────
  useEffect(() => {
    const poll = () => {
      const oneMinAgo = new Date(Date.now() - 65000).toISOString()
      fetchFlyingMessages(oneMinAgo).then(msgs => {
        if (!msgs.length) return
        // Deduplicate by Supabase id
        setFlyingMessages(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const newItems = msgs
            .filter(m => !existingIds.has(m.id))
            .map(m => ({
              id: m.id,
              text: `@${m.username} said: ${m.text}`,
              top: `${m.top_percent}vh`,
            }))
          if (newItems.length === 0) return prev
          return [...prev, ...newItems]
        })
      })
    }
    poll()
    const interval = setInterval(poll, 8000)
    return () => clearInterval(interval)
  }, [])

  // ─── Location granted ──────────────────────────────────────────────
  const handleLocationGranted = useCallback((lat: number, lng: number) => {
    console.log('Location granted:', lat.toFixed(6), lng.toFixed(6))
    setLocationGranted(true)
    setIsLoadingUsers(true)
    setOwnProfile(prev => ({ ...prev, lat, lng }))
    storageSet(CLOUD.lat, String(lat))
    storageSet(CLOUD.lng, String(lng))
  }, [])

  // ─── Save profile handler ──────────────────────────────────────────
  const handleSaveProfile = useCallback((updated: UserProfile) => {
    console.log('Saving profile:', { age: updated.age, height: updated.height, weight: updated.weight, position: updated.position, isSide: updated.isSide })
    setOwnProfile(updated)
    // Sync to Supabase
    const uid = tgUserId.current
    if (uid && updated.lat && updated.lng) {
      upsertUser({
        id: uid,
        name: updated.name,
        photo_url: updated.tgPhotoUrl || null,
        height: updated.height,
        weight: updated.weight,
        position: updated.position,
        is_side: updated.isSide,
        preference1: updated.preference1 || 'Raw',
        preference2: updated.preference2 || 'Party',
        preference3: updated.preference3 || 'Group',
        preference4: updated.preference4 || 'Travel',
        open_to_messages: updated.openToMessages || false,
        tg_username: updated.tgUsername || null,
        lat: updated.lat,
        lng: updated.lng,
        is_online: true,
        updated_at: new Date().toISOString(),
      }).then(result => {
        console.log('Profile upsert result:', result ? 'success' : 'failed')
      }).catch(err => {
        console.error('Profile upsert error:', err)
      })
    }
  }, [])

  // ─── Message handler ──────────────────────────────────────────────
  // ─── Message handler with stars gate ──────────────────────────────
  const handleMessage = useCallback((user: UserProfile) => {
    // Profile picture gate: target has real photo, current user doesn't
    if (user.hasRealPhoto && ownProfile.hasRealPhoto !== true) {
      const tg = getTg()
      const title = lang === 'tc' ? '需要個人頭像' : lang === 'sc' ? '需要个人头像' : lang === 'ru' ? 'Требуется фото' : 'Profile Picture Required'
      const msg = lang === 'tc'
        ? '你需要上傳真實個人頭像才能向此人發送訊息。如果剛剛上傳，請等待幾分鐘後重新啟動應用。'
        : lang === 'sc'
        ? '你需要上传真实个人头像才能向此人发送消息。如果刚刚上传，请等待几分钟后重新启动应用。'
        : lang === 'ru'
        ? 'Вам нужно загрузить реальное фото профиля, чтобы отправить сообщение. Если вы только что загрузили, подождите несколько минут и перезапустите приложение.'
        : 'You require a real profile picture to send this person a message. If you just uploaded one to your Telegram profile, wait a few minutes then restart the app and try again.'
      if (tg?.showPopup) {
        tg.showPopup({ title, message: msg, buttons: [{ type: 'ok', text: 'OK' }] })
      } else {
        alert(msg)
      }
      return
    }

    // Stars gate: user requires payment first
    if (user.openToMessages && !starsPaidFor.has(user.id)) {
      const tg = getTg()
      if (tg?.showPopup) {
        tg.showPopup({
          title: '⭐ Send Stars to Chat',
          message: `${user.name} requires sending Telegram Stars to open chat. Send stars now?`,
          buttons: [
            { id: 'pay', type: 'default', text: 'Send ⭐ 50' },
            { type: 'cancel', text: 'Cancel' }
          ]
        }, (btnId: string) => {
          if (btnId === 'pay') {
            setStarsPaidFor(prev => new Set(prev).add(user.id))
            handleMessage(user)
          }
        })
      } else {
        if (confirm(`Send 50 ⭐ to ${user.name} to open chat?`)) {
          setStarsPaidFor(prev => new Set(prev).add(user.id))
          handleMessage(user)
        }
      }
      return
    }

    // Open Telegram DM directly
    const tgUrl = `https://t.me/${user.tgUsername || 'hkmembersonlychat'}`
    const tg = getTg()
    if (tg?.openTelegramLink) { tg.openTelegramLink(tgUrl); return }
    if (tg?.openLink) { tg.openLink(tgUrl, { try_instant_view: false }); return }
    window.open(tgUrl, '_blank')
  }, [starsPaidFor, ownProfile.hasRealPhoto, lang])

  // ─── Render ───────────────────────────────────────────────────────
  // Splash screen
  if (showSplash) {
    return (
      <div className="min-h-[100vh] bg-[#0A0A0A] flex items-center justify-center px-6">
        <div className="w-full max-w-[min(520px,100vw)] flex flex-col items-center justify-center gap-5">
          <video
            src={logoAnim}
            autoPlay
            loop
            muted
            playsInline
            className="w-48 h-48 rounded-full object-cover"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold gradient-text tracking-tight">HKMOD</h1>
            <p className="text-[#8E8E93] text-xs mt-1">Hong Kong Members Only Dating Bot</p>
          </div>
          <p className="text-[#8E8E93]/60 text-[9px] text-center leading-relaxed max-w-[320px]">
            By using this app, you confirm you are 18+. HKMOD only connects users via Telegram.
            We do not store messages. All chat happens in Telegram. You are responsible for your own safety when meeting others.
            We collect: Telegram profile, preferences, and approximate location (to show nearby users only).
            We do not share data with third parties. Report issues: @HKMembersOnly
          </p>
          <p className="text-[#8E8E93]/50 text-[8px] text-center leading-relaxed max-w-[320px] mt-2">
            Features: Role matching (B/VB/V/VT/T/Side), Preference filters (Safe/Raw, Clean/Party, 1on1/Group, Host/Travel/Outdoor/Sauna),
            Photo filters, Location-based discovery, Profile editing with 30-day lock, Stars payments for unlocks, Admin tools.
          </p>
        </div>
      </div>
    )
  }

  if (groupCheck === 'checking') {
    return (
      <div className="min-h-[100vh] bg-neutral-950 flex justify-center">
        <div className="w-full max-w-[min(520px,100vw)] bg-[#0A0A0A] h-[100vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (groupCheck === 'not_member') {
    // Gather debug info for the lock screen
    const tg = getTg()
    const raw = tg ? JSON.stringify(tg.initDataUnsafe, null, 2) : 'no Telegram WebApp'

    return (
      <div className="min-h-[100vh] bg-neutral-950 flex justify-center">
        <div className="w-full max-w-[min(520px,100vw)] bg-[#0A0A0A] h-[100vh] relative flex flex-col px-6 pt-16 pb-6 overflow-y-auto">
          <div className="flex flex-col items-center text-center flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-[#FF6B35]/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-[#FF6B35]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t(lang, 'membersOnly')}</h1>
            <p className="text-[#8E8E93] text-sm mb-1">
              This app is exclusively for members of
            </p>
            <p className="text-[#FF6B35] font-semibold text-sm mb-4">@hkmembersonlychat</p>
            <button
              onClick={() => {
                const tg2 = getTg()
                const url = 'https://t.me/hkmembersonlychat'
                if (tg2?.openTelegramLink) {
                  tg2.openTelegramLink(url)
                } else if (tg2?.openLink) {
                  tg2.openLink(url)
                } else {
                  window.open(url, '_blank')
                }
              }}
              className="gradient-btn px-6 py-3 rounded-xl text-white font-semibold text-sm nav-press mb-4"
            >
              {t(lang, 'openInGroup')}
            </button>
          </div>

          {/* Debug info */}
          <div className="mt-4 flex-1 min-h-0 flex flex-col">
            <p className="text-[#8E8E93] text-[10px] text-center mb-2">
              {t(lang, 'openFromGroup')}
            </p>
            <details className="text-left">
              <summary className="text-[#8E8E93] text-[10px] cursor-pointer select-none text-center">
                {t(lang, 'showDebug')}
              </summary>
              <pre className="mt-2 p-2 bg-[#1A1A1A] rounded-lg text-[9px] text-[#8E8E93] overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {raw}
              </pre>
            </details>
          </div>
        </div>
      </div>
    )
  }

  if (!locationGranted) {
    return (
      <div className="min-h-[100vh] bg-neutral-950 flex justify-center">
        <div className="w-full max-w-[min(520px,100vw)] bg-[#0A0A0A] h-[100vh] relative">
          <LocationGate onGranted={handleLocationGranted} lang={lang} />
        </div>
      </div>
    )
  }

  return (
    <>
      <FlyingMessagesOverlay
        messages={flyingMessages}
        onDone={(id) => setFlyingMessages(prev => prev.filter(m => m.id !== id))}
      />
      <div className="min-h-screen bg-neutral-950 flex justify-center">
        <div className="w-full max-w-[min(520px,100vw)] bg-[#0A0A0A] h-screen relative flex flex-col">
        {view === 'MAIN' ? (
          <MainScreen
            ownProfile={ownProfile}
            users={users}
            onViewOwnProfile={() => setView('OWN_PROFILE')}
            onViewPhoto={(u) => setPhotoOverlay(u)}
            showDbWarning={!hasValidKey}
            isLoadingUsers={isLoadingUsers}
            lang={lang}
            setLang={setLang}
            onRefresh={handleRefresh}
            isAdmin={isAdmin}
            filtersUnlocked={isAdmin || filtersUnlocked}
            onPromptUnlock={promptUnlock}
            onPromptFilterUnlock={promptFilterUnlock}
            gridRowsUnlocked={gridRowsUnlocked}
            channelFollowUnlock={channelFollowUnlock}
            onClaimChannelFollow={handleClaimChannelFollow}
            onToggleInvisible={() => {
              if (isAdmin) {
                // Admin: toggle on/off (free, controls invisible_until directly)
                if (isInvisible) {
                  setInvisibleUntil(null)
                  setInvisibleActive(false)
                  storageSet(CLOUD.invisibleActive, 'false')
                  if (tgUserId.current) updateInvisibleStatus(tgUserId.current, null)
                } else {
                  const until = new Date(Date.now() + 30 * 86400000).toISOString()
                  setInvisibleUntil(until)
                  setInvisibleActive(true)
                  storageSet(CLOUD.invisibleActive, 'true')
                  if (tgUserId.current) updateInvisibleStatus(tgUserId.current, until)
                }
              } else if (hasPurchasedInvisible) {
                // Non-admin + purchased: toggle active state only
                const newActive = !invisibleActive
                setInvisibleActive(newActive)
                storageSet(CLOUD.invisibleActive, String(newActive))
              } else {
                // Non-admin + not purchased: prompt payment
                promptInvisiblePayment()
              }
              handleRefresh()
            }}
            lastRefreshTime={lastRefreshTime}
            setLastRefreshTime={setLastRefreshTime}
            isInvisible={isInvisible}
            invisiblePurchased={hasPurchasedInvisible}
            raffle={raffle}
            onBuyRaffleTicket={handleBuyRaffleTicket}
            onStartNextRaffle={handleStartNextRaffle}
            onPromptUnlockProfile={promptUnlockProfile}
            isPremium={isPremium}
          />
        ) : (
          <OwnProfileScreen
            profile={ownProfile}
            onSave={handleSaveProfile}
            onBack={() => setView('MAIN')}
            lang={lang}
            editProfileUnlocked={isAdmin || editProfileUnlocked}
          />
        )}
        {photoOverlay && (
          <PhotoOverlay user={photoOverlay} onClose={() => setPhotoOverlay(null)} onMessage={handleMessage} lang={lang} />
        )}
        {/* Admin popup — Release own lock only */}
        {adminAction === 'release' && (
          <div className="fixed top-0 left-0 right-0 bottom-0 z-[70] bg-black/70 flex items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }} onClick={() => setAdminAction(null)}>
            <div className="bg-[#1C1C1E] rounded-xl p-5 w-64 space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-white text-center">
                🔓 Release Profile Lock
              </h3>
              <p className="text-xs text-[#8E8E93] text-center">
                Release your own 30-day preference lock:
              </p>
              <button
                onClick={async () => {
                  await storageSet(CLOUD.prefLockedAt, '0')
                  alert('Your profile lock has been released! Refresh to apply.')
                  window.location.reload()
                  setAdminAction(null)
                }}
                className="w-full py-2.5 rounded-lg bg-[#2C2C2E] text-white text-sm font-bold nav-press"
              >
                Release My Lock
              </button>
              <button onClick={() => setAdminAction(null)} className="w-full py-1.5 text-[10px] text-[#8E8E93]">Cancel</button>
            </div>
          </div>
        )}
        {/* Only show BottomNav on MAIN view */}
        {view === 'MAIN' && (
          <BottomNav
            lang={lang}
            cooldownRemaining={Math.max(0, 60000 - (Date.now() - lastFlyingSendRef.current))}
            onSend={(text) => {
              // 1 min cooldown check
              if (Date.now() - lastFlyingSendRef.current < 60000) return
              lastFlyingSendRef.current = Date.now()
              const top = 10 + Math.random() * 80 // 10% - 90% of viewport height
              const prefixed = `@${ownProfile.tgUsername || ownProfile.name || 'User'} said: ${text}`
              // Show locally immediately
              setFlyingMessages(prev => [...prev, { id: Date.now(), text: prefixed, top: `${top}vh` }])
              // Store in Supabase so all users see it
              insertFlyingMessage({
                text,
                username: ownProfile.tgUsername || ownProfile.name || 'User',
                user_id: tgUserId.current || 0,
                top_percent: Math.round(top),
              })
            }}
            groupChatUrl="https://t.me/HKMO_D"
            referShareUrl="https://t.me/share/url?url=https://t.me/HKMO_D_Bot?startapp&text=Check%20out%20HKMOD%20-%20Hong%20Kong%20Men%20On%20Demand!"
            walletUrl="https://t.me/wallet?startattach=transfer_UQD9Irrhhpj2aAa48W-XaL5q9vPD9Zf5UjXhC7aHcYcSnYo4"
          />
        )}
      </div>
    </div>
    </>
  )
}
