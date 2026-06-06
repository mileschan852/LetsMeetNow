import { createStorage, getTg, isInTelegram, getUserId, getTimeAgo, getDistance, formatDist, isUserActive, isPrefLocked, getDefaultLang, isAdminUser, detectRealPhoto, dbToProfile, getZodiac, getZodiacEmoji, getAge, isMonthlyEditUnlocked, useRefreshCooldown, useGridUsers } from 'dating-core'
import { PhotoOverlay as PhotoOverlayBase, RaffleStatusDisplay, RaffleButton, BottomNav, ProfileGrid, LocationGate, FlyingMessagesOverlay, UnlockTipCycle, UnlockTip } from 'dating-ui'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'
import logoImg from './assets/lmn-logo.svg'
import logoAnim from './assets/lmn-logo-animated.mp4'
import { t, tPref, type Lang, getLangLabel } from './lib/i18n'
import {
  Grid3X3,
  Users,
  ArrowLeft,
  Check,
  MapPin,
  X,
  MessageCircle,
  LocateFixed,
  AlertTriangle,
  Lock,
  Gift,
  Wallet,
  RefreshCw,
  Send,
} from 'lucide-react'
import {
  upsertUser, fetchNearby, setOnlineStatus, fetchGlobalUnlock, hasValidKey, fetchUserUnlockStatus, insertFlyingMessage, fetchFlyingMessages, updateInvisibleStatus, getActiveRaffle, createRaffle, buyRaffleTicket, startRaffleCountdown, drawRaffleWinner, completeRaffle, checkRealPhoto, updateRealPhotoStatus, fetchUserPhotoStatus, relockUserFeatures, setRaffleDrawToNextWednesday, ensureFilterUnlock, setGridRowsUnlocked as saveGridRowsUnlocked, setFiltersUnlocked as saveFiltersUnlocked, type Raffle
} from 'dating-core'

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
  hasPhoto: boolean
  hasRealPhoto?: boolean
  // Invisible mode
  invisibleUntil?: string
  isInvisible: boolean
  // LMN fields (mapped from DB)
  gender?: string
  seekingGender?: string
  dob?: string | null
  seekingToday?: string
  meetupType?: string | null
  hideAge?: boolean
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

// ─── Admin Config ────────────────────────────────────────────────────

// Only these Telegram usernames / IDs are admins. Bot owner is always included.
// Add more here when requested.
const ADMIN_IDS = [5202742795, 725368127, 7735683983]
const ADMIN_USERNAMES = ['mileschan852', 'MilesChan852', 'HKMembersOnly', 'hkmembersonly']


// ─── Storage Keys ────────────────────────────────────────────────────

const CLOUD = {
  age: 'lmn_age',
  height: 'lmn_height',
  weight: 'lmn_weight',
  position: 'lmn_position',
  isSide: 'lmn_isSide',
  pref1: 'lmn_pref1',
  pref2: 'lmn_pref2',
  pref3: 'lmn_pref3',
  pref4: 'lmn_pref4',
  openMsg: 'lmn_open_msg',
  lat: 'lmn_lat',
  lng: 'lmn_lng',
  photoUrl: 'lmn_photo_url',
  name: 'lmn_name',
  lang: 'lmn_lang',
  prefChangedAt: 'lmn_pref_changed_at',
  prefLockedAt: 'lmn_pref_locked_at',
  filtersUnlocked: 'lmn_filters_unlocked',
  filtersUnlockedAt: 'lmn_filters_unlocked_at',
  gridRowsUnlocked: 'lmn_grid_rows_unlocked',
  gridRowsUnlockedAt: 'lmn_grid_rows_unlocked_at',
  invisibleActive: 'lmn_invisible_active',
  channelFollowed: 'lmn_channel_followed',
  hideAge: 'lmn_hide_age',
  seekingTodayChangedAt: 'lmn_seek_today_at',
  dob: 'lmn_dob',
}

// Unified storage instance (replaces makeStorage / local wrappers)
const storage = createStorage({ prefix: 'lmn' })

// ─── Role Helpers ────────────────────────────────────────────────────

// ─── Filter Logic ────────────────────────────────────────────────────

// ─── Distance Helpers ─────────────────────────────────────────────────
// ─── Photo Overlay ────────────────────────────────────────────────────

function PhotoOverlay({ user, onClose, onMessage, lang, ownProfile }: { user: UserProfile; onClose: () => void; onMessage: (u: UserProfile) => void; lang: Lang; ownProfile: UserProfile }) {
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
            {!u.isOwn && ownProfile.seekingToday !== 'Just Browsing' && u.seekingToday !== 'Just Browsing' && (
              <button onClick={() => onMessage(u as UserProfile)} className="h-10 gradient-btn rounded-xl text-white font-semibold text-sm nav-press flex items-center gap-2 px-5">
                <MessageCircle className="w-4 h-4" />
                {u.openToMessages ? '⭐ ' + t(lang, 'message') : t(lang, 'message')}
              </button>
            )}
          </div>
          <div className="flex gap-3 mt-3 text-xs">
            <span className="text-[#8E8E93]">{u.height}cm</span>
            <span className="text-[#8E8E93]">{u.weight}kg</span>
            <span className={`font-bold ${u.gender === 'Male' ? 'text-blue-400' : 'text-pink-400'}`}>{u.gender}</span>
            <span className="text-[#8E8E93]">→ {u.seekingGender}</span>
            {u.dob && <span className="text-purple-400 font-bold">{getZodiacEmoji(getZodiac(u.dob))} {getZodiac(u.dob)}</span>}
            {u.seekingToday && <span className="text-green-400 font-bold">{u.seekingToday}</span>}
            {u.meetupType && <span className="text-cyan-400 font-bold">{u.meetupType}</span>}
            {u.openToMessages && <span className="font-bold text-yellow-400">⭐ {t(lang, 'message')}</span>}
          </div>
        </div>
      )}
    />
  )
}

// ─── Location Gate ────────────────────────────────────────────────────

// ─── Unlock Tip Cycle — cycles through ways to unlock more rows ──────

function UnlockTipCycleLMN({ lang, isPremium, gridRowsUnlocked, channelFollowUnlock, onClaimChannelFollow }: { lang: Lang; isPremium: boolean; gridRowsUnlocked: number; channelFollowUnlock: number; onClaimChannelFollow: () => void }) {
  const tips: UnlockTip[] = ({
    en: [
      { text: `Base: 2 rows free` },
      { text: isPremium ? `Premium: +1 row` : `Premium: +1 row (not active)` },
      { text: `Purchased: ${gridRowsUnlocked} rows` },
      { text: `Add a Telegram photo +1` },
      { text: `Boost LMN Channel +1~4` },
      { text: `⭐ = charge stars per message` },
      { text: channelFollowUnlock ? `Group: +1 row ✅` : `Join LMN Channel +1`, isAction: true, actionId: 'channel' },
      { text: `Buy rows with ⭐ Stars` },
    ],
    tc: [
      { text: `基礎: 2 行免費` },
      { text: isPremium ? `Premium: +1 行` : `Premium: +1 行 (未激活)` },
      { text: `已購: ${gridRowsUnlocked} 行` },
      { text: `加入 Telegram 頭像 +1` },
      { text: `Boost LMN Channel +1~4` },
      { text: `⭐ = 按訊息收費` },
      { text: channelFollowUnlock ? `群組: +1 行 ✅` : `加入 LMN Channel +1`, isAction: true, actionId: 'channel' },
      { text: `用 ⭐ 星星購買行數` },
    ],
    sc: [
      { text: `基础: 2 行免费` },
      { text: isPremium ? `Premium: +1 行` : `Premium: +1 行 (未激活)` },
      { text: `已购: ${gridRowsUnlocked} 行` },
      { text: `加入 Telegram 头像 +1` },
      { text: `Boost LMN Channel +1~4` },
      { text: `⭐ = 按消息收费` },
      { text: channelFollowUnlock ? `群组: +1 行 ✅` : `加入 LMN Channel +1`, isAction: true, actionId: 'channel' },
      { text: `用 ⭐ 星星购买行数` },
    ],
    ru: [
      { text: `База: 2 строки бесплатно` },
      { text: isPremium ? `Premium: +1 строка` : `Premium: +1 строка (не активен)` },
      { text: `Куплено: ${gridRowsUnlocked} строк` },
      { text: `Добавь фото в Telegram +1` },
      { text: `Boost LMN Channel +1~4` },
      { text: `⭐ = плата за сообщение` },
      { text: channelFollowUnlock ? `Группа: +1 строка ✅` : `Вступи в LMN Channel +1`, isAction: true, actionId: 'channel' },
      { text: `Купить строки за ⭐` },
    ],
  })[lang] || []

  return (
    <UnlockTipCycle
      tips={tips}
      intervalMs={5000}
      onActionTip={(tip) => {
        if (tip.actionId === 'channel') onClaimChannelFollow()
      }}
      className="ml-auto flex items-center gap-1 text-[9px] text-[#8E8E93] nav-press"
    />
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

function MainScreen({ ownProfile, users, onViewOwnProfile, onViewPhoto, showDbWarning, isLoadingUsers, lang, setLang, onRefresh, isAdmin, filtersUnlocked, onPromptUnlock, onPromptFilterUnlock, onToggleInvisible, gridRowsUnlocked, canRefresh, remainingFormatted, markRefreshed, isInvisible, invisiblePurchased, raffle, onBuyRaffleTicket, onStartNextRaffle, onPromptUnlockProfile, isPremium, channelFollowUnlock, onClaimChannelFollow }: {
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
  canRefresh: boolean
  remainingFormatted: string
  markRefreshed: () => void
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
  // LMN filters: Status, Age, Zodiac
  const [statusFilter, setStatusFilter] = useState<'All' | 'Browsing' | 'Chatting' | 'Webcam' | 'Meetup'>('All')
  const [ageFilter, setAgeFilter] = useState<'All' | 'Older' | 'Younger'>('All')
  const [zodiacFilter, setZodiacFilter] = useState<'All' | string>('All')
  // Admin: hidden test users removed
  // const [showTestUsers, setShowTestUsers] = useState(false)

  const LANG_CYCLE: Lang[] = ['en', 'tc', 'sc', 'ru']
  const cycleLang = () => {
    const idx = LANG_CYCLE.indexOf(lang)
    const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length]
    setLang(next)
    storage.set(CLOUD.lang, next)
  }

  const cycleStatusFilter = () => {
    const order: Array<'All' | 'Browsing' | 'Chatting' | 'Webcam' | 'Meetup'> = ['All', 'Browsing', 'Chatting', 'Webcam', 'Meetup']
    setStatusFilter(order[(order.indexOf(statusFilter) + 1) % order.length])
  }
  const cycleAgeFilter = () => {
    const order: Array<'All' | 'Older' | 'Younger'> = ['All', 'Older', 'Younger']
    setAgeFilter(order[(order.indexOf(ageFilter) + 1) % order.length])
  }
  const cycleZodiacFilter = () => {
    const signs = ['All', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
    const idx = signs.indexOf(zodiacFilter)
    setZodiacFilter(signs[(idx + 1) % signs.length])
  }

  // Grid filtering via shared hook
  const { sortedUsers, filteredGrid, matchingIds } = useGridUsers({
    users,
    ownProfile,
    isAdmin,
    isInvisible,
    onlineOnly,
    filterFn: useCallback((u: UserProfile) => {
      if (statusFilter !== 'All') {
        if (statusFilter === 'Browsing' && u.seekingToday !== 'Just Browsing') return false
        if (statusFilter === 'Chatting' && u.seekingToday !== 'Chat') return false
        if (statusFilter === 'Webcam' && u.seekingToday !== 'Webcam') return false
        if (statusFilter === 'Meetup' && !u.meetupType) return false
      }
      if (ageFilter !== 'All' && ownProfile.age) {
        if (ageFilter === 'Older' && (u.age || 0) <= ownProfile.age) return false
        if (ageFilter === 'Younger' && (u.age || 0) >= ownProfile.age) return false
      }
      if (zodiacFilter !== 'All' && u.dob) {
        if (getZodiac(u.dob) !== zodiacFilter) return false
      }
      return true
    }, [statusFilter, ageFilter, zodiacFilter, ownProfile.age]),
  })

  return (
    <div className="flex-1 overflow-y-auto min-h-0 pb-20">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#2C2C2E] px-3 py-2 flex items-center justify-between">
        {/* LEFT: Logo + LMN + Raffle + Dot Matrix Timer */}
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="LMN" className="w-8 h-8 rounded-full object-cover" />
          <h1 className="text-xl font-bold gradient-text tracking-tight">LMN</h1>
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
              if (!canRefresh) return
              markRefreshed()
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
        <span className="text-[#5AC8FA]">v17.3L</span>
        <span className="text-[#2C2C2E]">|</span>
        <UnlockTipCycleLMN lang={lang} isPremium={isPremium} gridRowsUnlocked={gridRowsUnlocked} channelFollowUnlock={channelFollowUnlock} onClaimChannelFollow={onClaimChannelFollow} />
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

      {/* Filter bar: 3 buttons — 1.online 2.status 3.age 4.zodiac */}
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

          {/* 2. Status filter */}
          <button
            onClick={cycleStatusFilter}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all nav-press flex-shrink-0 ${statusFilter === 'All' ? 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]' : 'bg-[#FF6B35]/20 text-[#FF6B35] border border-[#FF6B35]/30'}`}
          >
            {statusFilter === 'All' ? 'Status' : statusFilter}
          </button>

          {/* 3. Age filter */}
          <button onClick={cycleAgeFilter}
            className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${ageFilter === 'All' ? 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]' : ageFilter === 'Older' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'}`}
          >
            {ageFilter === 'All' ? 'Age' : ageFilter}
          </button>

          {/* 4. Zodiac filter */}
          <button onClick={cycleZodiacFilter}
            className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 nav-press ${zodiacFilter === 'All' ? 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]' : 'bg-indigo-500/20 text-indigo-400'}`}
          >
            {zodiacFilter === 'All' ? 'Zodiac' : zodiacFilter}
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
                renderTileBottom={(user) => (
                  <div className="flex items-center justify-between">
                    <p className="text-[#FF6B35] text-[7px] font-medium">{user.age} &bull; {formatDist(user.distance)}</p>
                    {!user.isOwn && <p className="text-[#8E8E93] text-[6px]">{getTimeAgo(user.updatedAt)}</p>}
                    <p className={"text-[6px] font-bold " + (user.gender === 'Male' ? 'text-blue-400' : 'text-pink-400')}>{user.gender?.charAt(0) || '?'}</p>
                  </div>
                )}
              />
              {!hasMoreUsers && (
                <div className="mt-1.5 mx-0.5 select-none">
                  <button
                    className={"w-full rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all " + (
                      canRefresh
                        ? "bg-[#1A1A1A] border border-[#5AC8FA] text-[#5AC8FA] cursor-pointer active:scale-[0.98]"
                        : "bg-[#1A1A1A]/60 border border-[#2C2C2E] text-[#8E8E93] cursor-not-allowed"
                    )}
                    onClick={() => {
                      if (canRefresh) {
                        markRefreshed();
                        onRefresh();
                      }
                    }}
                    disabled={!canRefresh}
                  >
                    {canRefresh ? (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span className="text-[11px] font-medium">{lang === 'tc' ? '刷新' : lang === 'sc' ? '刷新' : 'Refresh'}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px]">{'\u{1F551}'}</span>
                        <span className="text-[11px] font-medium">{remainingFormatted}</span>
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

  useEffect(() => { setDraft({ ...profile }) }, [profile.id])

  // Sync photo updates from profile without resetting entire draft
  useEffect(() => {
    setDraft(prev => ({ ...prev, tgPhotoUrl: profile.tgPhotoUrl, tgPhotos: profile.tgPhotos }))
  }, [profile.tgPhotoUrl, profile.tgPhotos])

  useEffect(() => {
    setPhotoLoaded(false)
    setPhotoIndex(0)
  }, [draft.tgPhotoUrl])

  const updateDraft = (field: keyof UserProfile, value: unknown) => {
    setDraft(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  // Profile is considered "saved" when DOB, height, and weight are all set
  const hasSavedProfile = !!profile.dob && profile.height > 0 && profile.weight > 0

  // Helper to render a field label with lock indicator
  const FieldLabel = ({ label, locked }: { label: string, locked?: boolean }) => (
    <span className="text-xs text-[#8E8E93] font-medium uppercase block mb-1.5 flex items-center gap-1">
      {label}
      {locked && <Lock className="w-3 h-3 text-[#FF6B35]" />}
    </span>
  )

  const handleSave = async () => {
    if (!draft.height || draft.height <= 0 || !draft.weight || draft.weight <= 0) {
      alert('Please enter height and weight')
      return
    }
    if (!draft.dob) {
      alert('Please enter date of birth')
      return
    }

    // Build confirmation message
    const changes: string[] = []
    if (draft.gender !== profile.gender) changes.push('Gender: ' + draft.gender)
    if (draft.seekingGender !== profile.seekingGender) changes.push('Seeking: ' + draft.seekingGender)
    if (draft.dob !== profile.dob) changes.push('Date of Birth: ' + draft.dob)
    if (draft.height !== profile.height) changes.push('Height: ' + draft.height + 'cm')
    if (draft.weight !== profile.weight) changes.push('Weight: ' + draft.weight + 'kg')
    if (draft.hideAge !== profile.hideAge) changes.push('Hide Age: ' + (draft.hideAge ? 'On' : 'Off'))
    if (draft.seekingToday !== profile.seekingToday) changes.push('Seeking Today: ' + draft.seekingToday)

    const hasPermanent = changes.some(c => !c.startsWith('Seeking Today:'))
    const justBrowsingWarning = draft.seekingToday === 'Just Browsing' ? '\n\n⚠️ Just Browsing: You will NOT be able to send or receive messages while in this status.' : ''
    if (changes.length > 0) {
      const msg = changes.join('\\n') + '\\n\\n' + (hasPermanent ? '⚠️ Personal info is PERMANENT and cannot be changed later.\\n\\n' : '') + justBrowsingWarning + 'Save these changes?'
      if (!window.confirm(msg)) return
    } else {
      onBack()
      return
    }

    // 12-hour cooldown for seekingToday
    if (draft.seekingToday !== profile.seekingToday) {
      const lastStr = await storage.get(CLOUD.seekingTodayChangedAt)
      const lastTs = lastStr ? parseInt(lastStr) : 0
      const hoursSince = (Date.now() - lastTs) / (1000 * 60 * 60)
      if (lastTs > 0 && hoursSince < 12) {
        const minsLeft = Math.ceil((12 * 60 * 60 * 1000 - (Date.now() - lastTs)) / (1000 * 60))
        alert('Seeking Today can only be changed every 12 hours. ' + Math.floor(minsLeft / 60) + 'h ' + (minsLeft % 60) + 'm remaining.')
        return
      }
      await storage.set(CLOUD.seekingTodayChangedAt, String(Date.now()))
    }

    await storage.set(CLOUD.dob, draft.dob || '')
    await storage.set(CLOUD.height, String(draft.height))
    await storage.set(CLOUD.weight, String(draft.weight))
    await storage.set(CLOUD.pref1, draft.gender || 'Male')
    await storage.set(CLOUD.pref2, draft.seekingGender || 'Women')
    await storage.set(CLOUD.pref3, draft.seekingToday || 'Just Browsing')
    await storage.set(CLOUD.hideAge, String(!!draft.hideAge))
    onSave(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const photos = draft.tgPhotos?.length ? draft.tgPhotos : (draft.tgPhotoUrl ? [draft.tgPhotoUrl] : [])
  const currentPhoto = photos[photoIndex % photos.length]
  const hasMultiplePhotos = photos.length > 1

  return (
    <div className="view-enter h-full flex flex-col">
      <div className="shrink-0 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#2C2C2E] px-3 py-2.5 flex items-center justify-between z-10">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center nav-press">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h2 className="text-base font-semibold text-white">{t(lang, 'editProfile')}</h2>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        {/* Photo + Name */}
        <div className="flex gap-3 mb-3">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-b from-[#2C2C2E] to-[#1A1A1A]">
            <div className="absolute inset-0 flex items-center justify-center z-0">
              <span className="text-2xl font-bold text-[#8E8E93]">{draft.name.charAt(0)}</span>
            </div>
            {currentPhoto && (
              <img
                src={currentPhoto} alt="You"
                className={`absolute inset-0 w-full h-full object-cover z-10 ${photoLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 active:opacity-70`}
                referrerPolicy="no-referrer" draggable={false} loading="eager" decoding="async"
                onLoad={() => setPhotoLoaded(true)} onError={() => setPhotoLoaded(false)}
                onClick={() => hasMultiplePhotos && setPhotoIndex((prev) => (prev + 1) % photos.length)}
              />
            )}
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
            <span className="text-white font-bold text-base">{draft.name}</span>
            <div className="flex items-center gap-2 text-xs text-[#8E8E93]">
              <span>{draft.height}cm</span><span className="text-[#2C2C2E]">|</span><span>{draft.weight}kg</span>
            </div>
            {draft.dob && (
              <span className="text-purple-400 text-xs font-bold">
                {getZodiacEmoji(getZodiac(draft.dob))} {getZodiac(draft.dob)} · {new Date().getFullYear() - new Date(draft.dob).getFullYear()}yo
              </span>
            )}
          </div>
        </div>

        <div className="h-px bg-[#2C2C2E] mb-3" />

        {/* Gender */}
        <div className={`mb-3 ${hasSavedProfile ? 'opacity-60' : ''}`}>
          <FieldLabel label="Gender" locked={hasSavedProfile} />
          <div className="flex gap-2">
            <button disabled={hasSavedProfile} onClick={() => updateDraft('gender', 'Male')} className={`flex-1 h-10 rounded-lg text-xs font-bold transition-all nav-press ${draft.gender === 'Male' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'} ${hasSavedProfile ? 'cursor-not-allowed' : ''}`}>Male</button>
            <button disabled={hasSavedProfile} onClick={() => updateDraft('gender', 'Female')} className={`flex-1 h-10 rounded-lg text-xs font-bold transition-all nav-press ${draft.gender === 'Female' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'} ${hasSavedProfile ? 'cursor-not-allowed' : ''}`}>Female</button>
          </div>
        </div>

        {/* Seeking Gender */}
        <div className={`mb-3 ${hasSavedProfile ? 'opacity-60' : ''}`}>
          <FieldLabel label="Seeking" locked={hasSavedProfile} />
          <div className="flex gap-2">
            {(['Men','Women','Both'] as const).map(g => (
              <button key={g} disabled={hasSavedProfile} onClick={() => updateDraft('seekingGender', g)} className={`flex-1 h-10 rounded-lg text-xs font-bold transition-all nav-press ${draft.seekingGender === g ? 'gradient-btn text-white' : 'bg-[#1A1A1A] text-[#8E8E93] border border-[#2C2C2E]'} ${hasSavedProfile ? 'cursor-not-allowed' : ''}`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Date of Birth + Hide Age */}
        <div className={`mb-3 ${hasSavedProfile ? 'opacity-60' : ''}`}>
          <FieldLabel label="Date of Birth" locked={hasSavedProfile} />
          <input
            type="date"
            value={draft.dob || ''}
            readOnly={hasSavedProfile}
            onChange={(e) => !hasSavedProfile && updateDraft('dob', e.target.value)}
            className={`w-full h-10 px-3 bg-[#1A1A1A] rounded-lg text-white text-sm outline-none border border-[#2C2C2E] focus:border-[#FF6B35]/50 ${hasSavedProfile ? 'cursor-not-allowed' : ''}`}
          />
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input type="checkbox" checked={!!draft.hideAge}
              onChange={(e) => updateDraft('hideAge', e.target.checked)}
              className="w-4 h-4 accent-[#FF6B35]"
            />
            <span className="text-sm text-white">🙈 Hide my age on profile</span>
          </label>
        </div>

        {/* Height & Weight */}
        <div className={`mb-3 ${hasSavedProfile ? 'opacity-60' : ''}`}>
          <FieldLabel label="Height / Weight" locked={hasSavedProfile} />
          <div className="flex gap-2">
            <div className="flex-1 flex items-center justify-between px-3 py-2.5 bg-[#1A1A1A] rounded-lg">
              <span className="text-xs text-[#8E8E93] font-medium uppercase">Height</span>
              <input type="number" value={draft.height || ''} placeholder="0"
                readOnly={hasSavedProfile}
                onChange={(e) => !hasSavedProfile && updateDraft('height', parseInt(e.target.value) || 0)}
                className={`bg-transparent text-white text-sm font-medium text-right outline-none w-16 ${hasSavedProfile ? 'cursor-not-allowed' : ''}`} />
            </div>
            <div className="flex-1 flex items-center justify-between px-3 py-2.5 bg-[#1A1A1A] rounded-lg">
              <span className="text-xs text-[#8E8E93] font-medium uppercase">Weight</span>
              <input type="number" value={draft.weight || ''} placeholder="0"
                readOnly={hasSavedProfile}
                onChange={(e) => !hasSavedProfile && updateDraft('weight', parseInt(e.target.value) || 0)}
                className={`bg-transparent text-white text-sm font-medium text-right outline-none w-16 ${hasSavedProfile ? 'cursor-not-allowed' : ''}`} />
            </div>
          </div>
        </div>

        {/* Seeking Today — dropdown, 12h cooldown */}
        <div className="mb-3">
          <span className="text-xs text-[#8E8E93] font-medium uppercase block mb-1.5">Seeking Today</span>
          <select
            value={draft.seekingToday || 'Just Browsing'}
            onChange={(e) => updateDraft('seekingToday', e.target.value)}
            className="w-full h-10 px-3 bg-[#1A1A1A] rounded-lg text-white text-sm outline-none border border-[#2C2C2E] focus:border-[#FF6B35]/50 appearance-none"
          >
            {['Just Browsing', 'Chat Only', 'Video Call', 'Meet Up'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="text-[10px] text-[#8E8E93] mt-1">Can only be changed every 12 hours</p>
        </div>
      </div>

      {/* Save Bar */}
      <div className="shrink-0 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#2C2C2E] px-3 pt-3 pb-5 z-20">
        {saved && (
          <div className="text-center text-[#00D4AA] text-xs font-semibold mb-2 animate-pulse">Saved!</div>
        )}
        <button onClick={handleSave} className="w-full h-14 gradient-btn rounded-xl text-white font-bold text-lg nav-press flex items-center justify-center gap-2">
          <Check className="w-6 h-6" />Save Profile
        </button>
      </div>
    </div>
  )
}

// ─── Flying Messages Overlay ─────────────────────────────────────────

// ─── Flying Messages — handled by dating-ui —────────────────────────

// ─── Bottom Nav ──────────────────────────────────────────────────────

// ─── Bottom Nav ─────────────────────────────────────────────────────-

// ─── App Component ───────────────────────────────────────────────────

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
    // LMN defaults
    gender: 'Male', seekingGender: 'Women', seekingToday: 'Just Browsing', hideAge: false,
  })
  const [users, setUsers] = useState<UserProfile[]>([])
  const [photoOverlay, setPhotoOverlay] = useState<UserProfile | null>(null)
  const [locationGranted, setLocationGranted] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [groupCheck, setGroupCheck] = useState<'checking' | 'member' | 'not_member'>('checking')
  // Default language from Telegram, fallback to English

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

  // ─── Filter unlock: purchase 30-day filter access ──────────────────
  const promptFilterUnlock = async () => {
    const tg = getTg()
    const userId = tg?.initDataUnsafe?.user?.id
    // Admin bypass: skip Stars payment, unlock directly
    if (isAdmin) {
      setFiltersUnlocked(true)
      const now = Date.now()
      const expiresAt = new Date(now + 30 * 86400000).toISOString()
      storage.set(CLOUD.filtersUnlocked, 'true')
      storage.set(CLOUD.filtersUnlockedAt, String(now))
      if (userId) {
        saveFiltersUnlocked('lmn_users', userId, true, expiresAt)
      }
      return
    }
    if (!userId) return
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch('https://lmn-d.mileschan852.workers.dev/createinvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount: 500, purpose: 'filters' }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.ok && data.result && tg?.openInvoice) {
        tg.openInvoice(data.result, async (status) => {
          if (status === 'paid') {
            setFiltersUnlocked(true)
            const now = Date.now()
            const expiresAt = new Date(now + 30 * 86400000).toISOString()
            storage.set(CLOUD.filtersUnlocked, 'true')
            storage.set(CLOUD.filtersUnlockedAt, String(now))
            saveFiltersUnlocked('lmn_users', userId, true, expiresAt)
          }
        })
      }
    } catch { /* Worker failed, silently ignore */ }
  }

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


  const promptUnlockProfile = useCallback(async () => {
    if (isAdmin) {
      setAdminAction('release')
      return
    }
    const tg = getTg()
    const userId = tg?.initDataUnsafe?.user?.id
    if (!userId) return
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch('https://lmn-d.mileschan852.workers.dev/createinvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount: 100, purpose: 'edit' }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.ok && data.result && tg?.openInvoice) {
        tg.openInvoice(data.result, async (status) => {
          if (status === 'paid') {
            await storage.set(CLOUD.prefLockedAt, '0')
            alert('Profile lock released! Refresh to apply.')
            window.location.reload()
          }
        })
      }
    } catch { /* Worker failed */ }
  }, [isAdmin])

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
          await updateInvisibleStatus('lmn_users', winner.user_id, until)
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
      const res = await fetch('https://lmn-d.mileschan852.workers.dev/createinvoice', {
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
            await updateInvisibleStatus('lmn_users', winner.user_id, until)
          }
        }
        const final = await getActiveRaffle()
        setRaffle(final || null)
      }
    }
    const interval = setInterval(checkDeadline, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [raffle?.status, raffle?.ends_at, raffle?.id, raffle?.prize_type])

  const promptUnlock = async () => {
    const tg = getTg()
    const userId = tg?.initDataUnsafe?.user?.id
    // Admin bypass: skip Stars payment, unlock directly
    if (isAdmin) {
      const newRows = gridRowsUnlocked + 1
      setGridRowsUnlocked(newRows)
      storage.set(CLOUD.gridRowsUnlocked, String(newRows))
      storage.set(CLOUD.gridRowsUnlockedAt, String(Date.now()))
      if (userId) {
        await saveGridRowsUnlocked('lmn_users', userId, newRows)
      }
      return
    }
    if (!userId) return
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch('https://lmn-d.mileschan852.workers.dev/createinvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount: 1000, purpose: 'grid' }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.ok && data.result && tg?.openInvoice) {
        tg.openInvoice(data.result, async (status) => {
          if (status === 'paid') {
            const newRows = gridRowsUnlocked + 1
            setGridRowsUnlocked(newRows)
            storage.set(CLOUD.gridRowsUnlocked, String(newRows))
            storage.set(CLOUD.gridRowsUnlockedAt, String(Date.now()))
            await saveGridRowsUnlocked('lmn_users', userId, newRows)
          }
        })
      }
    } catch { /* Worker failed, silently ignore */ }
  }

  // ─── Channel Follow Unlock — +1 row for following @LetsMsetNow_Bot ─────────
  const handleClaimChannelFollow = useCallback(async () => {
    if (channelFollowUnlock) return
    // Open the channel
    const url = 'https://t.me/LetsMsetNow_Bot'
    try {
      const tg = getTg()
      if (tg?.openTelegramLink) { tg.openTelegramLink(url) }
      else if (tg?.openLink) { tg.openLink(url, { try_instant_view: false }) }
      else { window.open(url, '_blank') }
    } catch {}
    // Give the unlock immediately (we trust the user - it's a one-time thing)
    setChannelFollowUnlock(1)
    storage.set(CLOUD.channelFollowed, '1')
  }, [channelFollowUnlock])

  // Invisible mode payment — 2000 Stars for 30 days
  // Admin gets it free
  const promptInvisiblePayment = async () => {
    const tg = getTg()
    const userId = tg?.initDataUnsafe?.user?.id
    if (!userId) return
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch('https://lmn-d.mileschan852.workers.dev/createinvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount: 2000, purpose: 'invisible' }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.ok && data.result && tg?.openInvoice) {
        tg.openInvoice(data.result, (status) => {
          if (status === 'paid') {
            const until = new Date(Date.now() + 30 * 86400000).toISOString()
            setInvisibleUntil(until)
            setInvisibleActive(true)
            storage.set(CLOUD.invisibleActive, 'true')
            updateInvisibleStatus('lmn_users', userId, until)
          }
        })
      }
    } catch { /* Worker failed, silently ignore */ }
  }

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

    console.log('=== LMN Check === inTelegram:', inTg)

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
    console.log('=== LMN Init === inTelegram:', inTg, 'WebApp:', !!tg)

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
          storage.set(CLOUD.photoUrl, photoUrl)
        }
        // Photo gate: check if user has a real photo on every login
        const runPhotoCheck = async () => {
          const uid = tgUserId.current
          if (!uid) return
          const isRealNow = checkRealPhoto(photoUrl)
          const dbStatus = await fetchUserPhotoStatus('lmn_users', uid)
          if (dbStatus) {
            // If photo was real before but not now -> relock (background, no UI block)
            if (dbStatus.has_real_photo && !isRealNow) {
              console.log('[PhotoGate] Photo removed, relocking features')
              await relockUserFeatures('lmn_users', uid)
              await updateRealPhotoStatus('lmn_users', uid, false)
            } else if (!dbStatus.has_real_photo && isRealNow) {
              // New real photo detected
              await updateRealPhotoStatus('lmn_users', uid, true)
            }
            // If was real and still real -> no change
          } else {
            // No DB record -> first time
            await updateRealPhotoStatus('lmn_users', uid, isRealNow)
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
          storage.set(CLOUD.name, user.first_name)
        }
      }
    }

    // Load saved data (including backup photo_url)
    storage.getAll().then(result => {
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
      // LMN fields
      if (result[CLOUD.pref1]) loaded.gender = result[CLOUD.pref1]
      if (result[CLOUD.pref2]) loaded.seekingGender = result[CLOUD.pref2]
      if (result[CLOUD.pref3]) loaded.seekingToday = result[CLOUD.pref3]
      if (result[CLOUD.dob]) loaded.dob = result[CLOUD.dob]
      loaded.hideAge = result[CLOUD.hideAge] === 'true'
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
          storage.set(CLOUD.filtersUnlocked, 'true')
          storage.set(CLOUD.filtersUnlockedAt, String(now))
        }
      } else if (isExpired) {
        // Expired — clear unlock
        storage.set(CLOUD.filtersUnlocked, '')
        storage.set(CLOUD.filtersUnlockedAt, '')
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
        fetchUserUnlockStatus('lmn_users', syncUserId).then(status => {
          if (!status) return
          const now = Date.now()
          // Sync filters_unlocked
          const filtersExpired = status.filters_unlocked_expires_at
            ? new Date(status.filters_unlocked_expires_at).getTime() < now
            : !status.filters_unlocked
          if (!filtersExpired && status.filters_unlocked) {
            setFiltersUnlocked(true)
            storage.set(CLOUD.filtersUnlocked, 'true')
            storage.set(CLOUD.filtersUnlockedAt, String(now))
          } else if (filtersExpired || !status.filters_unlocked) {
            setFiltersUnlocked(false)
            storage.set(CLOUD.filtersUnlocked, '')
            storage.set(CLOUD.filtersUnlockedAt, '')
          }
          // Sync grid_rows_unlocked
          const dbRows = status.grid_rows_unlocked || 0
          if (dbRows >= 0) {
            setGridRowsUnlocked(dbRows)
            storage.set(CLOUD.gridRowsUnlocked, String(dbRows))
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
              storage.get(CLOUD.invisibleActive).then(saved => {
                setInvisibleActive(saved === 'false' ? false : true)
              }).catch(() => setInvisibleActive(true))
            } else {
              // Timer expired — make user visible (clear DB + local state)
              setInvisibleUntil(null)
              setInvisibleActive(false)
              storage.set(CLOUD.invisibleActive, 'false')
              updateInvisibleStatus('lmn_users', syncUserId, null)
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
    upsertUser('lmn_users', {
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
      // LMN fields
      dob: ownProfile.dob || null,
      gender: ownProfile.gender || 'Male',
      seeking_gender: ownProfile.seekingGender || 'Women',
      seeking_today: ownProfile.seekingToday || 'Just Browsing',
      hide_age: ownProfile.hideAge || false,
    }).then(result => {
      console.log('Upsert result:', result ? `success id=${result.id}` : 'null')
      // Auto 7-day filter unlock for new users
      if (result && !result.filters_unlocked_expires_at) {
        ensureFilterUnlock('lmn_users', result.id).then(ok => {
          console.log('Auto filter unlock:', ok ? 'set 7 days' : 'failed')
        })
      }
    }).catch(err => {
      console.error('Upsert error:', String(err).substring(0, 200))
    })
  }, [ownProfile.lat, ownProfile.lng, ownProfile.name, ownProfile.tgPhotoUrl, ownProfile.height, ownProfile.weight, ownProfile.position, ownProfile.isSide, ownProfile.preference1, ownProfile.preference2, ownProfile.preference3, ownProfile.preference4, ownProfile.openToMessages, ownProfile.tgUsername, ownProfile.dob, ownProfile.gender, ownProfile.seekingGender, ownProfile.seekingToday, ownProfile.hideAge])

  // ─── Heartbeat: update timestamp every 30s ────────────────────────
  useEffect(() => {
    if (!locationGranted) return
    const uid = tgUserId.current
    if (!uid) return

    const ping = () => {
      setOnlineStatus('lmn_users', uid, true).catch(console.error)
    }
    ping()
    const heartbeat = setInterval(ping, 30000)
    return () => clearInterval(heartbeat)
  }, [locationGranted])

  // ─── Refresh nearby users (manual + auto) ─────────────────────────
  // Initialize to -120s so first refresh is allowed immediately
  // Shared 5-min cooldown between top refresh and bottom button
  const { lastRefreshTime, setLastRefreshTime, canRefresh, remainingFormatted, markRefreshed } = useRefreshCooldown()

  const handleRefresh = useCallback(() => {
    const lat = ownProfile.lat
    const lng = ownProfile.lng
    if (!lat || !lng) return
    setIsLoadingUsers(true)
    fetchNearby('lmn_users', lat, lng).then(dbUsers => {
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
    storage.set(CLOUD.lat, String(lat))
    storage.set(CLOUD.lng, String(lng))
  }, [])

  // ─── Save profile handler ──────────────────────────────────────────
  const handleSaveProfile = useCallback((updated: UserProfile) => {
    console.log('Saving profile:', { age: updated.age, height: updated.height, weight: updated.weight, position: updated.position, isSide: updated.isSide })
    setOwnProfile(updated)
    // Sync to Supabase
    const uid = tgUserId.current
    if (uid && updated.lat && updated.lng) {
      upsertUser('lmn_users', {
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
        // LMN fields
        dob: updated.dob || null,
        gender: updated.gender || 'Male',
        seeking_gender: updated.seekingGender || 'Women',
        seeking_today: updated.seekingToday || 'Just Browsing',
        hide_age: updated.hideAge || false,
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
    // Just Browsing gate: neither user can send/receive
    if (ownProfile.seekingToday === 'Just Browsing') {
      alert('You are in Just Browsing mode. Change your status to send messages.')
      return
    }
    if (user.seekingToday === 'Just Browsing') {
      alert('This user is in Just Browsing mode and not accepting messages.')
      return
    }

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
    const tgUrl = `https://t.me/${user.tgUsername || 'LetsMsetNow'}`
    const tg = getTg()
    if (tg?.openTelegramLink) { tg.openTelegramLink(tgUrl); return }
    if (tg?.openLink) { tg.openLink(tgUrl, { try_instant_view: false }); return }
    window.open(tgUrl, '_blank')
  }, [starsPaidFor, ownProfile.hasRealPhoto, lang, ownProfile.seekingToday])

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
            <h1 className="text-2xl font-bold gradient-text tracking-tight">LMN</h1>
            <p className="text-[#8E8E93] text-xs mt-1">Let's Meet Now — Dating App</p>
          </div>
          <p className="text-[#8E8E93]/60 text-[9px] text-center leading-relaxed max-w-[320px]">
            By using this app, you confirm you are 18+. LMN only connects users via Telegram.
            We do not store messages. All chat happens in Telegram. You are responsible for your own safety when meeting others.
            We collect: Telegram profile, preferences, and approximate location (to show nearby users only).
            We do not share data with third parties.
          </p>
          <p className="text-[#8E8E93]/50 text-[8px] text-center leading-relaxed max-w-[320px] mt-2">
            Features: Gender matching, Seeking preferences, Zodiac filters, Photo filters, Location-based discovery,
            Profile editing, Stars payments for unlocks, Admin tools.
          </p>
        </div>
      </div>
    )
  }

  // Debug overlay removed — now inline in JSX below

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
            <p className="text-[#FF6B35] font-semibold text-sm mb-4">@LetsMsetNow</p>
            <button
              onClick={() => {
                const tg2 = getTg()
                const url = 'https://t.me/LetsMsetNow'
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
                  storage.set(CLOUD.invisibleActive, 'false')
                  if (tgUserId.current) updateInvisibleStatus('lmn_users', tgUserId.current, null)
                } else {
                  const until = new Date(Date.now() + 30 * 86400000).toISOString()
                  setInvisibleUntil(until)
                  setInvisibleActive(true)
                  storage.set(CLOUD.invisibleActive, 'true')
                  if (tgUserId.current) updateInvisibleStatus('lmn_users', tgUserId.current, until)
                }
              } else if (hasPurchasedInvisible) {
                // Non-admin + purchased: toggle active state only
                const newActive = !invisibleActive
                setInvisibleActive(newActive)
                storage.set(CLOUD.invisibleActive, String(newActive))
              } else {
                // Non-admin + not purchased: prompt payment
                promptInvisiblePayment()
              }
              handleRefresh()
            }}
            canRefresh={canRefresh}
            remainingFormatted={remainingFormatted}
            markRefreshed={markRefreshed}
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
          <PhotoOverlay user={photoOverlay} onClose={() => setPhotoOverlay(null)} onMessage={handleMessage} lang={lang} ownProfile={ownProfile} />
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
                  await storage.set(CLOUD.prefLockedAt, '0')
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
            groupChatUrl="https://t.me/LetsMeetNow"
            referShareUrl="https://t.me/share/url?url=https://t.me/LetsMsetNow_Bot?startapp&text=Check%20out%20LMN%20-%20Let%27s%20Meet%20Now%20Dating!"
            walletUrl="https://t.me/wallet?startattach=transfer_UQD9Irrhhpj2aAa48W-XaL5q9vPD9Zf5UjXhC7aHcYcSnYo4"
          />
        )}
      </div>
    </div>
  </>
  )
}
