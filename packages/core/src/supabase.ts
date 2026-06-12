// Shared Supabase REST Client for HKMOD & LMN
// Supports both app schemas in the same users table

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const hasValidKey = ANON_KEY.startsWith('eyJ') && ANON_KEY.length > 50

const headers = {
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

// ─── DB Types ────────────────────────────────────────────────────────

export interface DbUser {
  id: number
  name: string
  photo_url: string | null
  height: number
  weight: number
  lat: number
  lng: number
  tg_username: string | null
  is_online: boolean
  updated_at: string
  
  // HKMOD fields
  position: number | null
  is_side: boolean | null
  preference1: string | null
  preference2: string | null
  preference3: string | null
  preference4: string | null
  open_to_messages: boolean | null
  
  // LMN fields
  dob: string | null
  gender: string | null
  seeking_gender: string | null
  seeking_today: string | null
  meetup_type: string | null
  
  // Shared premium fields
  invisible_until: string | null
  invisible_purchased_at: string | null
  hide_age_until: string | null
  hide_age_purchased_at: string | null
  grid_rows_unlocked: number | null
  filters_unlocked: boolean | null
  filters_unlocked_expires_at: string | null
  profile_unlocked: boolean | null
}

export interface Raffle {
  id: number
  prize_type: 'filters' | 'invisible'
  ticket_price: number
  target_tickets: number
  current_tickets: number
  status: 'pending' | 'active' | 'completed'
  countdown_started_at: string | null
  ends_at: string | null
  winner_user_id: number | null
  winner_name: string | null
  drawn_at: string | null
}

// ─── Distance ────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Core CRUD ───────────────────────────────────────────────────────

export async function upsertUser(tableName: string, user: Partial<DbUser>): Promise<DbUser | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?on_conflict=id`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(user),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(text)
    const data = JSON.parse(text)
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  } catch (err) {
    console.error('upsertUser error:', String(err).substring(0, 200))
    return null
  }
}

export async function fetchNearby(tableName: string, lat: number, lng: number, limit = 100): Promise<DbUser[]> {
  if (!hasValidKey) return []
  try {
    const cols = Object.keys({} as DbUser).join(',')
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=${cols}&limit=200`, { headers })
    if (!res.ok) {
      const err = await res.text()
      console.error(`fetchNearby failed: ${res.status} ${err.substring(0, 200)}`)
      return []
    }
    const data = (await res.json()) as DbUser[]
    return data
      .filter(u => u.lat && u.lng)
      .map(u => ({ user: u, dist: haversineKm(lat, lng, u.lat, u.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit)
      .map(d => d.user)
  } catch (err) {
    console.error('fetchNearby error:', err)
    return []
  }
}

export async function setOnlineStatus(tableName: string, userId: number, isOnline: boolean): Promise<void> {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_online: isOnline, updated_at: new Date().toISOString() }),
    })
  } catch (err) {
    console.error('setOnlineStatus error:', err)
  }
}

export async function fetchUserUnlockStatus(tableName: string, userId: number): Promise<{
  grid_rows_unlocked: number
  filters_unlocked: boolean
  filters_unlocked_expires_at: string | null
  invisible_until: string | null
  invisible_purchased_at: string | null
  edit_unlocked: boolean | null
  edit_unlocked_expires_at: string | null
  has_real_photo: boolean | null
} | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}&select=grid_rows_unlocked,filters_unlocked,filters_unlocked_expires_at,invisible_until,invisible_purchased_at,edit_unlocked,edit_unlocked_expires_at,has_real_photo`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    return data?.[0] || null
  } catch {
    return null
  }
}

// ─── Flying Messages ───────────────────────────────────────────────────

export interface FlyingMessage {
  id: number
  user_id: number
  user_name: string
  text: string
  created_at: string
}

export interface TravelEntry {
  id: number
  country: 'Hong Kong' | 'Taiwan' | 'Thailand'
  name: string
  cost: string | null
  address: string | null
  contact: string | null
  hours: string | null
  website: string | null
  directions: string | null
  image_url: string | null
  category: 'sauna' | 'accommodation' | 'callboy'
}

export async function fetchTravelEntries(country: string, category: string): Promise<TravelEntry[]> {
  if (!hasValidKey) return []
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/travel_entries?country=eq.${encodeURIComponent(country)}&category=eq.${category}&approved=eq.true&order=name.asc`,
      { headers }
    )
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

// ─── Raffle ────────────────────────────────────────────────────────────

export async function getActiveRaffle(): Promise<Raffle | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffles?status=in.(waiting,active)&order=created_at.desc&limit=1`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    return data?.[0] || null
  } catch { return null }
}

export async function createRaffle(prizeType: 'filters' | 'invisible'): Promise<Raffle | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffles`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ prize_type: prizeType, status: 'waiting', target_tickets: 10, tickets_sold: 0 }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.[0] || null
  } catch { return null }
}

export async function updateInvisibleStatus(tableName: string, userId: number, until: string | null): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ invisible_until: until }),
    })
    return res.ok
  } catch (err) {
    console.error('updateInvisibleStatus failed:', err)
    return false
  }
}

export async function fetchGlobalUnlock(tableName: string): Promise<number> {
  if (!hasValidKey) return 0
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users_global_unlock?select=unlocked_at&order=unlocked_at.desc&limit=1`, { headers })
    if (!res.ok) return 0
    const data = await res.json() as { unlocked_at: string }[]
    if (data.length === 0) return 0
    return new Date(data[0].unlocked_at).getTime()
  } catch (err) {
    console.error('fetchGlobalUnlock failed:', err)
    return 0
  }
}

export async function startRaffleCountdown(raffleId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffles?id=eq.${raffleId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'countdown', countdown_started_at: new Date().toISOString() }),
    })
    return res.ok
  } catch (err) {
    console.error('startRaffleCountdown failed:', err)
    return false
  }
}

export async function completeRaffle(raffleId: number, winnerUserId: number, winnerName: string): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffles?id=eq.${raffleId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'completed', winner_user_id: winnerUserId, winner_name: winnerName }),
    })
    return res.ok
  } catch (err) {
    console.error('completeRaffle failed:', err)
    return false
  }
}

export async function getRaffleTickets(raffleId: number): Promise<number> {
  if (!hasValidKey) return 0
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffle_tickets?raffle_id=eq.${raffleId}&select=count`, { headers })
    if (!res.ok) return 0
    const data = await res.json() as { count: number }[]
    return data[0]?.count || 0
  } catch (err) {
    console.error('getRaffleTickets failed:', err)
    return 0
  }
}

export function checkRealPhoto(photoUrl: string | null | undefined): boolean {
  if (!photoUrl) return false
  return !photoUrl.includes('default') && !photoUrl.includes('placeholder')
}

export async function updateRealPhotoStatus(tableName: string, userId: number, hasRealPhoto: boolean): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ has_real_photo: hasRealPhoto }),
    })
    return res.ok
  } catch (err) {
    console.error('updateRealPhotoStatus failed:', err)
    return false
  }
}

export async function fetchUserPhotoStatus(tableName: string, userId: number): Promise<{ has_real_photo: boolean } | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}&select=has_real_photo`, { headers })
    if (!res.ok) return null
    const data = await res.json() as { has_real_photo: boolean }[]
    return data[0] || null
  } catch (err) {
    console.error('fetchUserPhotoStatus failed:', err)
    return null
  }
}

export async function relockUserFeatures(tableName: string, userId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ unlock_count: 0, filters_unlocked: false, grid_rows_unlocked: 0 }),
    })
    return res.ok
  } catch (err) {
    console.error('relockUserFeatures failed:', err)
    return false
  }
}

export async function deleteUser(tableName: string, userId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, { method: 'DELETE', headers })
    return res.ok
  } catch (err) {
    console.error('deleteUser failed:', err)
    return false
  }
}

export async function clearAllUsers(tableName: string): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?is_admin=eq.false`, { method: 'DELETE', headers })
    return res.ok
  } catch (err) {
    console.error('clearAllUsers failed:', err)
    return false
  }
}

export async function updateUnlockCount(tableName: string, userId: number, delta: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}&select=unlock_count`, { headers })
    if (!userRes.ok) return false
    const data = await userRes.json() as { unlock_count: number }[]
    const current = data[0]?.unlock_count || 0
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ unlock_count: Math.max(0, current + delta) }),
    })
    return res.ok
  } catch (err) {
    console.error('updateUnlockCount failed:', err)
    return false
  }
}

export async function setUnlockCount(tableName: string, userId: number, value: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ unlock_count: value }),
    })
    return res.ok
  } catch (err) {
    console.error('setUnlockCount failed:', err)
    return false
  }
}

export async function setGlobalUnlock(timestamp: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users_global_unlock`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ unlocked_at: new Date(timestamp).toISOString() }),
    })
    return res.ok
  } catch (err) {
    console.error('setGlobalUnlock failed:', err)
    return false
  }
}

export async function updateHideAgeStatus(tableName: string, userId: number, until: string | null): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ hide_age_until: until }),
    })
    return res.ok
  } catch (err) {
    console.error('updateHideAgeStatus failed:', err)
    return false
  }
}

export async function updateUserRealPhoto(tableName: string, userId: number, hasRealPhoto: boolean): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ has_real_photo: hasRealPhoto }),
    })
    return res.ok
  } catch (err) {
    console.error('updateUserRealPhoto failed:', err)
    return false
  }
}

export interface DbTopic {
  id: number
  name: string
  description: string
  created_at: string
}

export async function fetchTopics(): Promise<DbTopic[]> {
  if (!hasValidKey) return []
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/topics?select=*&order=created_at.desc`, { headers })
    if (!res.ok) return []
    return await res.json() as DbTopic[]
  } catch (err) {
    console.error('fetchTopics failed:', err)
    return []
  }
}

export async function insertFlyingMessage(userId: number, userName: string, text: string): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/flying_messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: userId, username: userName, text, top_percent: Math.random() * 80 + 10 }),
    })
    return res.ok
  } catch (err) {
    console.error('insertFlyingMessage failed:', err)
    return false
  }
}

export async function fetchFlyingMessages(since?: string): Promise<FlyingMessage[]> {
  if (!hasValidKey) return []
  try {
    const sinceParam = since ? `&created_at=gte.${encodeURIComponent(since)}` : ''
    const res = await fetch(`${SUPABASE_URL}/rest/v1/flying_messages?select=*&order=created_at.desc&limit=50${sinceParam}`, { headers })
    if (!res.ok) return []
    return await res.json() as FlyingMessage[]
  } catch (err) {
    console.error('fetchFlyingMessages failed:', err)
    return []
  }
}

export async function buyRaffleTicket(raffleId: number, userId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffle_tickets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ raffle_id: raffleId, user_id: userId }),
    })
    return res.ok
  } catch (err) {
    console.error('buyRaffleTicket failed:', err)
    return false
  }
}

export async function drawRaffleWinner(raffleId: number): Promise<{ user_id: number; name: string } | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/draw_raffle_winner`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_raffle_id: raffleId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !data.id) return null
    return { user_id: data.id, name: data.name || 'Unknown' }
  } catch { return null }
}

export async function setGridRowsUnlocked(tableName: string, userId: number, rows: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ grid_rows_unlocked: rows }),
    })
    return res.ok
  } catch (err) {
    console.error('setGridRowsUnlocked failed:', err)
    return false
  }
}

export async function setRaffleDrawToNextWednesday(raffleId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const now = new Date()
    const day = now.getDay()
    const daysUntilWed = (3 - day + 7) % 7 || 7
    const nextWed = new Date(now)
    nextWed.setDate(now.getDate() + daysUntilWed)
    nextWed.setHours(20, 0, 0, 0)
    const endsAt = nextWed.toISOString()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffles?id=eq.${raffleId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ ends_at: endsAt }),
    })
    return res.ok
  } catch (err) {
    console.error('setRaffleDrawToNextWednesday failed:', err)
    return false
  }
}

export async function ensureFilterUnlock(tableName: string, userId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}&select=filters_unlocked_expires_at`, { headers })
    if (!res.ok) return false
    const data = await res.json()
    if (!data || data.length === 0) return false
    const current = data[0]?.filters_unlocked_expires_at
    if (current) return true

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ filters_unlocked_expires_at: expiresAt }),
    })
    return patchRes.ok
  } catch (err) {
    console.error('ensureFilterUnlock failed:', err)
    return false
  }
}
