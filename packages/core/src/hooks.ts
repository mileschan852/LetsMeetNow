import { useState, useCallback, useMemo, useEffect } from 'react'
import { isUserActive } from './utils'
import type { UserProfile } from './types'

export interface UseRefreshCooldownOptions {
  cooldownMs?: number
  initialOffsetMs?: number
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
