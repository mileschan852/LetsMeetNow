import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import {
  MapPin, X, MessageCircle, LocateFixed, RefreshCw,
  Eye, EyeOff, ArrowLeft, Lock, Gift, Send,
} from 'lucide-react'
import {
  upsertUser, fetchNearby, setOnlineStatus, fetchUserUnlockStatus,
  getActiveRaffle, buyRaffleTicket, createRaffle, drawRaffleWinner, setRaffleDrawToNextWednesday,
  getZodiac, getZodiacEmoji, getAge, ensureFilterUnlock, type DbUser, type Raffle,
} from 'dating-core/supabase'
import { getTg, getUserId, makeStorage } from 'dating-core/storage'
import { t, type Lang } from 'dating-core/i18n'
import { requestPayment } from 'dating-core/payments'
import {
  GridView, ProfileModal, FilterBar, RafflePanel,
  SplashScreen, UnlockTip, FlyingMessageBanner,
} from 'dating-ui/components'
import { APP_CONFIG } from './config'
import { LMN_FILTERS } from './filters'

const storage = makeStorage(APP_CONFIG.appKey)

export default function App() {
  const [view, setView] = useState<'MAIN' | 'OWN_PROFILE' | 'AGE_GATE' | 'GENDER_SETUP' | 'DISCLAIMER'>('MAIN')
  const [lang, setLang] = useState<Lang>('en')
  const [users, setUsers] = useState<DbUser[]>([])
  const [selectedUser, setSelectedUser] = useState<DbUser | null>(null)
  const [gridRows, setGridRows] = useState(2)
  const [filtersUnlocked, setFiltersUnlocked] = useState(false)
  const [channelFollowUnlock, setChannelFollowUnlock] = useState(0)
  const [isInvisible, setIsInvisible] = useState(false)
  const [invisiblePurchased, setInvisiblePurchased] = useState(false)
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [ticketCount, setTicketCount] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [filterValues, setFilterValues] = useState<Record<string, string | string[]>>({})
  const [flyingMessages, setFlyingMessages] = useState<any[]>([])
  const [splashDone, setSplashDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tgUserRef = useRef(getTg()?.initDataUnsafe?.user)
  const isAdmin = APP_CONFIG.adminIds.includes(tgUserRef.current?.id || 0)

  useEffect(() => {
    const init = async () => {
      const tg = getTg()
      if (!tg) { setError('Open in Telegram'); return }
      const user = tg.initDataUnsafe?.user
      if (!user?.id) { setError('No Telegram user'); return }
      
      tgUserRef.current = user
      
      const savedRows = storage.get('gridRows')
      if (savedRows) setGridRows(parseInt(savedRows))
      setFiltersUnlocked(storage.get('filtersUnlocked') === 'true')
      setChannelFollowUnlock(parseInt(storage.get('channelFollowUnlock') || '0'))
      setInvisiblePurchased(storage.get('invisiblePurchased') === 'true')

      try {
        const status = await fetchUserUnlockStatus(user.id)
        setGridRows(status.grid_rows_unlocked)
        setFiltersUnlocked(status.filters_unlocked)
        setChannelFollowUnlock(status.channel_follow_unlock ? 1 : 0)
        if (status.invisible_until && new Date(status.invisible_until) > new Date()) {
          setIsInvisible(true)
        }
      } catch (e) { console.error('Failed to load unlock status:', e) }

      try {
        const active = await getActiveRaffle()
        if (active) setRaffle(active)
      } catch (e) { console.error('Failed to load raffle:', e) }

      setOnlineStatus(user.id, true)
      window.addEventListener('beforeunload', () => setOnlineStatus(user.id, false))
      await refreshNearby()
    }
    init()
  }, [splashDone])

  const refreshNearby = useCallback(async () => {
    setLoading(true)
    try {
      const tg = getTg()
      const user = tg?.initDataUnsafe?.user
      if (!user?.id) return
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      })
      const { latitude, longitude } = pos.coords
      await upsertUser({
        id: user.id, name: user.first_name, tgPhotoUrl: user.photo_url || '',
        latitude, longitude, updatedAt: new Date().toISOString(), online: true,
      })
      const nearby = await fetchNearby(latitude, longitude, 50, 100)
      setUsers(nearby.filter(u => u.id !== user.id && (u.is_visible !== false)))
    } catch (e) {
      console.error('Refresh failed:', e)
      setError('Location access required')
    } finally { setLoading(false) }
  }, [])

  const handleFilterChange = useCallback((key: string, value: string | string[]) => {
    setFilterValues(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleFilterReset = useCallback(() => setFilterValues({}), [])

  const handleUnlockFilters = useCallback(async () => {
    const uid = tgUserRef.current?.id
    if (!uid) return
    if (isAdmin) {
      const newRows = gridRows + 1
      setGridRows(newRows)
      storage.set('gridRows', String(newRows))
      return
    }
    await requestPayment(
      APP_CONFIG.webhookUrl, uid, 'grid', 100,
      async () => {
        const newRows = gridRows + 1
        await upsertUser({ id: uid, grid_rows_unlocked: newRows })
        setGridRows(newRows)
      },
      (err) => console.error('Payment failed:', err)
    )
  }, [isAdmin, gridRows])

  const handleToggleInvisible = useCallback(async () => {
    const uid = tgUserRef.current?.id
    if (!uid) return
    if (isAdmin) { setIsInvisible(!isInvisible); return }
    if (isInvisible) { setIsInvisible(false); return }
    await requestPayment(
      APP_CONFIG.webhookUrl, uid, 'invisible', 2000,
      () => { setIsInvisible(true); setInvisiblePurchased(true); storage.set('invisiblePurchased', 'true') },
      (err) => console.error('Invisible purchase failed:', err)
    )
  }, [isInvisible, isAdmin])

  const handleBuyTicket = useCallback(async () => {
    const uid = tgUserRef.current?.id
    const name = tgUserRef.current?.first_name
    if (!uid || !name || !raffle) return
    if (isAdmin) {
      const ok = await buyRaffleTicket(uid, name, raffle.id)
      if (ok) { const updated = await getActiveRaffle(); if (updated) setRaffle(updated) }
      return
    }
    await requestPayment(
      APP_CONFIG.webhookUrl, uid, 'raffle', 50,
      async () => {
        const ok = await buyRaffleTicket(uid, name, raffle.id)
        if (ok) { const updated = await getActiveRaffle(); if (updated) setRaffle(updated) }
      },
      (err) => console.error('Raffle ticket failed:', err)
    )
  }, [raffle, isAdmin])

  const handleStartNextRaffle = useCallback(async () => {
    if (!isAdmin) return
    try {
      const nextType = (!raffle || raffle.prize_type === 'invisible') ? 'filters' : 'invisible'
      await createRaffle(nextType, 20)
      const updated = await getActiveRaffle()
      if (updated) setRaffle(updated)
    } catch (e) { console.error('Failed to start raffle:', e) }
  }, [raffle, isAdmin])

  if (!splashDone) return <SplashScreen onComplete={() => setSplashDone(true)} duration={2500} />

  if (error) return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center">
      <div className="text-[#FF6B35] text-4xl mb-4">⚠️</div>
      <h2 className="text-white text-lg font-semibold mb-2">{error}</h2>
      <p className="text-[#8E8E93] text-sm">Please open this app inside Telegram</p>
    </div>
  )

  if (view === 'MAIN') {
    return (
      <div className="h-screen flex flex-col bg-[#0A0A0A] text-white">
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#2C2C2E]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00D4AA] flex items-center justify-center text-white font-bold text-sm">
              {APP_CONFIG.appName[0]}
            </div>
            <span className="font-semibold">{APP_CONFIG.appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleToggleInvisible} className="text-[#8E8E93] active:text-white transition-colors">
              {isInvisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            <button onClick={() => setView('OWN_PROFILE')} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center overflow-hidden">
              {tgUserRef.current?.photo_url ? (
                <img src={tgUserRef.current.photo_url} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs">{tgUserRef.current?.first_name?.[0]}</span>
              )}
            </button>
          </div>
        </div>

        {flyingMessages.length > 0 && (
          <FlyingMessageBanner
            messages={flyingMessages}
            lang={lang}
            onDismiss={(id) => setFlyingMessages(prev => prev.filter(m => m.id !== id))}
          />
        )}

        {raffle && (
          <RafflePanel
            raffle={raffle} lang={lang} isAdmin={isAdmin} ticketCount={ticketCount}
            onBuyTicket={handleBuyTicket} onStartNext={handleStartNextRaffle}
          />
        )}

        <div className="px-3 py-1">
          <button onClick={() => setShowFilters(!showFilters)} className="text-xs text-[#8E8E93] flex items-center gap-1">
            <span>{showFilters ? '▼' : '▶'}</span>
            <span>Filters</span>
            {Object.keys(filterValues).length > 0 && (
              <span className="text-[#00D4AA]">({Object.keys(filterValues).length})</span>
            )}
          </button>
        </div>

        {showFilters && (
          <FilterBar
            lang={lang} filtersUnlocked={filtersUnlocked}
            configs={LMN_FILTERS}
            values={filterValues}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
            onClose={() => setShowFilters(false)}
          />
        )}

        <div className="flex-1 overflow-hidden">
          <GridView
            users={users} lang={lang} gridRows={gridRows}
            filtersUnlocked={filtersUnlocked} isAdmin={isAdmin}
            onUnlockFilters={handleUnlockFilters}
            onRefresh={refreshNearby}
            onSelectUser={setSelectedUser}
          />
        </div>

        {loading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-40">
            <div className="w-8 h-8 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    )
  }

  if (selectedUser) {
    return (
      <ProfileModal
        user={selectedUser} lang={lang} isAdmin={isAdmin}
        onClose={() => setSelectedUser(null)}
        onSendMessage={() => {
          const tg = getTg()
          if (tg?.openTelegramLink) {
            tg.openTelegramLink(`https://t.me/${selectedUser.tg_username || 'user' + selectedUser.id}`)
          }
        }}
      />
    )
  }

  return null
}
