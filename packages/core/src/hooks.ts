import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { isUserActive, dbToProfile } from './utils'
import {
  fetchNearby, setOnlineStatus, fetchFlyingMessages,
  drawRaffleWinner, completeRaffle, updateInvisibleStatus, getActiveRaffle,
  createRaffle, buyRaffleTicket, startRaffleCountdown, setRaffleDrawToNextWednesday,
} from './supabase'
import type { Raffle, FlyingMessage } from './supabase'
import type { UserProfile } from './types'
import { getTg } from './storage'
import { isAdminUser } from './utils'

export interface UseRefreshCooldownOptions {
  cooldownMs?: number
  initialOffsetMs?: number
}

export interface UseRaffleActionsOptions {
  tableName: string
  workerUrl: string
  isAdmin: boolean
  raffle: Raffle | null
  setRaffle: (r: Raffle | null) => void
}

export interface UseAdminRecheckOptions {
  isAdmin: boolean
  setIsAdmin: (v: boolean) => void
  adminIds: number[]
  adminUsernames: string[]
}

export function useAdminRecheck({ isAdmin, setIsAdmin, adminIds, adminUsernames }: UseAdminRecheckOptions) {
  useEffect(() => {
    const interval = setInterval(() => {
      const tg = getTg()
      const user = tg?.initDataUnsafe?.user
      if (user && user.id) {
        const adminCheck = isAdminUser(user, adminIds, adminUsernames)
        if (adminCheck !== isAdmin) {
          console.log(`Admin re-check: id=${user.id}, username=${user.username}, admin=${adminCheck}`)
          setIsAdmin(adminCheck)
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isAdmin, setIsAdmin, adminIds, adminUsernames])
}

export function useRaffleActions({ tableName, workerUrl, isAdmin, raffle, setRaffle }: UseRaffleActionsOptions) {
  const handleBuyRaffleTicket = useCallback(async () => {
    if (!raffle || raffle.status === 'completed') return
    const tg = getTg()
    const userId = tg?.initDataUnsafe?.user?.id
    if (!userId) return

    // Check if raffle has already ended (deadline passed)
    if (raffle.status === 'active' && raffle.ends_at && new Date(raffle.ends_at).getTime() <= Date.now()) {
      const winner = await drawRaffleWinner(raffle.id)
      if (winner) {
        await completeRaffle(raffle.id, winner.user_id, winner.name)
        if (raffle.prize_type === 'invisible') {
          const until = new Date(Date.now() + 30 * 86400000).toISOString()
          await updateInvisibleStatus(tableName, winner.user_id, until)
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
      const res = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount: 100, purpose: 'raffle' }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.ok && data.result && tg?.openInvoice) {
        tg.openInvoice(data.result, async (status: string) => {
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
  }, [raffle, isAdmin, tableName, workerUrl, setRaffle])

  const handleStartNextRaffle = useCallback(async () => {
    if (!isAdmin) return
    const nextType = (!raffle || raffle.prize_type === 'invisible') ? 'filters' : 'invisible'
    const newRaffle = await createRaffle(nextType)
    if (newRaffle) setRaffle(newRaffle)
  }, [isAdmin, raffle, setRaffle])

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
            await updateInvisibleStatus(tableName, winner.user_id, until)
          }
        }
        const final = await getActiveRaffle()
        setRaffle(final || null)
      }
    }
    const interval = setInterval(checkDeadline, 30000)
    return () => clearInterval(interval)
  }, [raffle?.status, raffle?.ends_at, raffle?.id, raffle?.prize_type, tableName, setRaffle])

  return { handleBuyRaffleTicket, handleStartNextRaffle }
}

export function useRefreshCooldown(options: UseRefreshCooldownOptions = {}) {
  const { cooldownMs = 5 * 60 * 1000, initialOffsetMs = 300000 } = options
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now() - initialOffsetMs)
  const [tick, setTick] = useState(0)

  // Tick every second so remaining time updates
  useEffect(() => {
    const id = setInterval(() => setTick((t: number) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const canRefresh = useMemo(() => Date.now() - lastRefreshTime >= cooldownMs, [lastRefreshTime, tick, cooldownMs])
  const remainingMs = useMemo(() => Math.max(0, cooldownMs - (Date.now() - lastRefreshTime)), [lastRefreshTime, tick, cooldownMs])
  const remainingFormatted = useMemo(() => {
    const s = Math.ceil(remainingMs / 1000)
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }, [remainingMs])

  const markRefreshed = useCallback(() => {
    setLastRefreshTime(Date.now())
  }, [])

  return { lastRefreshTime, setLastRefreshTime, canRefresh, remainingMs, remainingFormatted, markRefreshed }
}

export interface UseNearbyRefreshOptions {
  tableName: string
  lat: number | undefined
  lng: number | undefined
  getMyId: () => string | number | null | undefined
  isInvisible?: boolean
  invisibleUntil?: string | null
}

export function useNearbyRefresh({ tableName, lat, lng, getMyId, isInvisible, invisibleUntil }: UseNearbyRefreshOptions) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const getMyIdRef = useRef(getMyId)
  getMyIdRef.current = getMyId

  const invisibleRef = useRef({ isInvisible, invisibleUntil })
  invisibleRef.current = { isInvisible, invisibleUntil }

  const refresh = useCallback(() => {
    if (!lat || !lng) return
    setIsLoading(true)
    fetchNearby(tableName, lat, lng).then(dbUsers => {
      const myId = getMyIdRef.current()
      const { isInvisible: inv, invisibleUntil: invUntil } = invisibleRef.current
      const mapped = dbUsers.filter(u => String(u.id) !== String(myId)).map(u => dbToProfile(u, lat, lng))
      const ownIdx = mapped.findIndex(u => u.isOwn)
      if (ownIdx >= 0) {
        mapped[ownIdx] = { ...mapped[ownIdx], isInvisible: !!inv, invisibleUntil: invUntil || undefined }
      }
      console.log('Nearby refresh:', mapped.length, 'users')
      setUsers(mapped)
      setIsLoading(false)
    }).catch(err => {
      console.error('Refresh error:', String(err).substring(0, 200))
      setIsLoading(false)
    })
  }, [tableName, lat, lng])

  return { users, setUsers, isLoading, setIsLoading, refresh }
}

export interface UseHeartbeatOptions {
  tableName: string
  getUserId: () => number | null | undefined
  locationGranted: boolean
  intervalMs?: number
}

export function useHeartbeat({ tableName, getUserId, locationGranted, intervalMs = 30000 }: UseHeartbeatOptions) {
  useEffect(() => {
    if (!locationGranted) return
    const uid = getUserId()
    if (!uid) return
    const ping = () => setOnlineStatus(tableName, uid, true).catch(console.error)
    ping()
    const heartbeat = setInterval(ping, intervalMs)
    return () => clearInterval(heartbeat)
  }, [tableName, getUserId, locationGranted, intervalMs])
}

export interface UseFlyingMessagesOptions {
  pollIntervalMs?: number
}

export interface FlyingMessageItem {
  id: number
  text: string
  top: string
}

export function useFlyingMessages({ pollIntervalMs = 8000 }: UseFlyingMessagesOptions = {}) {
  const [flyingMessages, setFlyingMessages] = useState<FlyingMessageItem[]>([])
  const lastFlyingSendRef = useRef(0)

  useEffect(() => {
    const poll = () => {
      const oneMinAgo = new Date(Date.now() - 65000).toISOString()
      fetchFlyingMessages(oneMinAgo).then(msgs => {
        if (!msgs.length) return
        setFlyingMessages((prev: FlyingMessageItem[]) => {
          const existingIds = new Set(prev.map((p: FlyingMessageItem) => p.id))
          const newItems = msgs
            .filter((m: FlyingMessage) => !existingIds.has(m.id))
            .map((m: FlyingMessage) => ({
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
    const interval = setInterval(poll, pollIntervalMs)
    return () => clearInterval(interval)
  }, [pollIntervalMs])

  return { flyingMessages, setFlyingMessages, lastFlyingSendRef }
}

export interface UseGridUsersOptions {
  users: UserProfile[]
  ownProfile: UserProfile
  isAdmin: boolean
  isInvisible: boolean
  onlineOnly: boolean
  filterFn: (user: UserProfile) => boolean
}

export function useGridUsers({
  users,
  ownProfile,
  isAdmin,
  isInvisible,
  onlineOnly,
  filterFn,
}: UseGridUsersOptions) {
  const patchedOwnProfile = useMemo(
    () => ({ ...ownProfile, isOwn: true, isInvisible: isInvisible || false }),
    [ownProfile, isInvisible]
  )

  const allGridUsers = useMemo(
    () => [patchedOwnProfile, ...users.filter((u: UserProfile) => u.id !== ownProfile.id)],
    [patchedOwnProfile, users, ownProfile.id]
  )

  const visibleGridUsers = useMemo(
    () => (isAdmin ? allGridUsers : allGridUsers.filter((u: UserProfile) => u.isOwn || !u.isInvisible)),
    [isAdmin, allGridUsers]
  )

  const filteredGrid = useMemo(
    () =>
      visibleGridUsers
        .filter((u: UserProfile) => {
          if (u.isOwn) return true
          if (onlineOnly && !isUserActive(u)) return false
          if (u.tgUsername === '_test_') return false
          return filterFn(u)
        })
        .sort((a: UserProfile, b: UserProfile) => {
          if (a.isOwn) return -1
          if (b.isOwn) return 1
          return (a.distance || Infinity) - (b.distance || Infinity)
        }),
    [visibleGridUsers, onlineOnly, filterFn]
  )

  const matchingIds = useMemo(() => new Set(filteredGrid.map((u: UserProfile) => u.id)), [filteredGrid])

  const nonMatchingGrid = useMemo(
    () =>
      visibleGridUsers
        .filter((u: UserProfile) => !matchingIds.has(u.id))
        .sort((a: UserProfile, b: UserProfile) => {
          if (a.isOwn) return -1
          if (b.isOwn) return 1
          return (a.distance || Infinity) - (b.distance || Infinity)
        }),
    [visibleGridUsers, matchingIds]
  )

  const sortedUsers = useMemo(() => [...filteredGrid, ...nonMatchingGrid], [filteredGrid, nonMatchingGrid])

  return { sortedUsers, filteredGrid, matchingIds, nonMatchingGrid, visibleGridUsers, allGridUsers, patchedOwnProfile }
}
