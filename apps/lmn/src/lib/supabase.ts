// ─── Supabase REST Client ────────────────────────────────────────────
// The ANON_KEY is safe to expose in client-side code (it's a public key)
// Get it from: Supabase Dashboard → Project Settings → API → anon/public
// Set it as VITE_SUPABASE_ANON_KEY env var when deploying

const SUPABASE_URL = 'https://fngcjkclxxodjaiqkfkm.supabase.co'
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZ2Nqa2NseHhvZGphaXFrZmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTE4NzUsImV4cCI6MjA5MjU2Nzg3NX0.dpoNP8EO7iZCFP7dzjD33mCdiJ0gxl5lTl6-hPY0HH4'

export const hasValidKey = ANON_KEY.startsWith('eyJ') && ANON_KEY.length > 50

const headers = {
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

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
  
  // LMN fields
  dob: string | null
  gender: string | null
  seeking_gender: string | null
  seeking_today: string | null
  meetup_type: string | null
  hide_age: boolean | null
  
  // HKMOD fields (for compatibility)
  position: number
  is_side: boolean
  preference1: string | null
  preference2: string | null
  preference3: string | null
  preference4: string | null
  open_to_messages: boolean
  
  // Shared premium fields
  invisible_until: string | null
  invisible_purchased_at: string | null
  hide_age_until: string | null
  hide_age_purchased_at: string | null
  grid_rows_unlocked: number | null
  filters_unlocked: boolean | null
  filters_unlocked_expires_at: string | null
  profile_unlocked: boolean | null
  has_real_photo: boolean | null
}

// Upsert own profile + location
export async function upsertUser(user: Partial<DbUser>): Promise<DbUser | null> {
  if (!hasValidKey) { console.log('upsertUser: no valid key'); return null }
  try {
    const body = JSON.stringify(user)
    console.log('upsertUser POST body:', body.substring(0, 200))
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?on_conflict=id`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body,
    })
    const resText = await res.text()
    console.log('upsertUser HTTP', res.status, 'response:', resText.substring(0, 300))
    if (!res.ok) throw new Error(resText)
    const data = JSON.parse(resText)
    if (Array.isArray(data) && data.length > 0) return data[0]
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as DbUser
    return null
  } catch (err) {
    console.error('upsertUser catch error:', String(err).substring(0, 300))
    return null
  }
}

// Fetch all users
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function fetchNearby(lat: number, lng: number, _radiusDegrees = 0.1): Promise<DbUser[]> {
  if (!hasValidKey) return []
  try {
    const fullCols = 'id,name,photo_url,height,weight,position,is_side,preference1,preference2,preference3,preference4,lat,lng,tg_username,is_online,updated_at,unlock_count,filters_unlocked,filters_unlocked_expires_at,edit_unlocked,edit_unlocked_expires_at,grid_rows_unlocked,has_real_photo,invisible_until,invisible_purchased_at'
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?select=${fullCols}&limit=200`, { headers })
    if (res.ok) {
      const data = await res.json() as DbUser[]
      const sorted = data.filter(u => u.lat && u.lng).map(u => ({ user: u, dist: haversineKm(lat, lng, u.lat!, u.lng!) })).sort((a, b) => a.dist - b.dist).slice(0, 100)
      console.log(`[fetchNearby] ${data.length} raw → ${sorted.length} closest`)
      return sorted.map(d => d.user)
    }
    const basicCols = 'id,name,photo_url,height,weight,position,is_side,preference1,preference2,preference3,preference4,lat,lng,tg_username,is_online,updated_at,unlock_count'
    const fallbackRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?select=${basicCols},invisible_until,invisible_purchased_at&limit=200`, { headers })
    if (fallbackRes.ok) {
      const data = await fallbackRes.json() as DbUser[]
      return data.filter(u => u.lat && u.lng).map(u => ({ user: u, dist: haversineKm(lat, lng, u.lat!, u.lng!) })).sort((a, b) => a.dist - b.dist).slice(0, 100).map(d => d.user)
    }
    const bareRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?select=${basicCols}&limit=200`, { headers })
    if (!bareRes.ok) { console.error('Bare minimum fetch also failed:', (await bareRes.text()).substring(0, 300)); return [] }
    const data = await bareRes.json() as DbUser[]
    return data.filter(u => u.lat && u.lng).map(u => ({ user: u, dist: haversineKm(lat, lng, u.lat!, u.lng!) })).sort((a, b) => a.dist - b.dist).slice(0, 100).map(d => d.user)
  } catch (err) {
    console.error('fetchNearby failed:', err)
    return []
  }
}

// Mark user online/offline
export async function setOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_online: isOnline, updated_at: new Date().toISOString() }),
    })
  } catch (err) {
    console.error('setOnlineStatus failed:', err)
  }
}

// Delete a specific user by ID
export async function deleteUser(userId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'DELETE',
      headers,
    })
    return res.ok
  } catch (err) {
    console.error('deleteUser failed:', err)
    return false
  }
}

// Update unlock count (increment/decrement)
export async function updateUnlockCount(userId: number, delta: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    // First fetch current value
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}&select=unlock_count`, { headers })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    const current = (data[0]?.unlock_count || 0) as number
    const newVal = Math.max(0, current + delta)

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ unlock_count: newVal }),
    })
    return patchRes.ok
  } catch (err) {
    console.error('updateUnlockCount failed:', err)
    return false
  }
}

// Set unlock count directly (used for boosts that can be removed)
export async function setUnlockCount(userId: number, value: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ unlock_count: Math.max(0, value) }),
    })
    return patchRes.ok
  } catch (err) {
    console.error('setUnlockCount failed:', err)
    return false
  }
}

// Clear all users from database
export async function clearAllUsers(): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=not.is.null`, {
      method: 'DELETE',
      headers,
    })
    return res.ok
  } catch (err) {
    console.error('clearAllUsers failed:', err)
    return false
  }
}

// ─── Global Lock Release (Config stored in user id=0) ────────────────

export async function fetchGlobalUnlock(): Promise<number> {
  if (!hasValidKey) return 0
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.0&select=name`, { headers })
    if (!res.ok) return 0
    const data = await res.json()
    const nameVal = data[0]?.name
    if (!nameVal) return 0
    const ts = parseInt(nameVal)
    return isNaN(ts) ? 0 : ts
  } catch {
    return 0
  }
}

export async function setGlobalUnlock(timestamp: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    // Try PATCH first (user id=0 might exist)
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.0`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: String(timestamp) }),
    })
    if (patchRes.ok) return true
    // If not found, insert config row (only id + name, rest are defaults)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: 0,
        name: String(timestamp),
        height: 0, weight: 0, position: 0, is_side: false,
        preference1: '', preference2: '', preference3: '', preference4: '',
        lat: 0, lng: 0, is_online: false,
        updated_at: new Date().toISOString(),
      }),
    })
    return insertRes.ok
  } catch (err) {
    console.error('setGlobalUnlock failed:', err)
    return false
  }
}

// ─── Fetch user unlock status ────────────────────────────────────────

export interface UnlockStatus {
  filters_unlocked: boolean
  filters_unlocked_expires_at: string | null
  edit_unlocked: boolean
  edit_unlocked_expires_at: string | null
  grid_rows_unlocked: number
  invisible_until: string | null
  hide_age_until: string | null
  unlock_count: number
  has_real_photo: boolean | null
}

export async function fetchUserUnlockStatus(userId: number): Promise<UnlockStatus | null> {
  if (!hasValidKey) return null
  try {
    // Try full columns first
    const fullCols = 'filters_unlocked,filters_unlocked_expires_at,edit_unlocked,edit_unlocked_expires_at,grid_rows_unlocked,invisible_until,hide_age_until,unlock_count,has_real_photo'
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}&select=${fullCols}`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (!data || data.length === 0) return null
      const row = data[0]
      return {
        filters_unlocked: !!row.filters_unlocked,
        filters_unlocked_expires_at: row.filters_unlocked_expires_at || null,
        edit_unlocked: !!row.edit_unlocked,
        edit_unlocked_expires_at: row.edit_unlocked_expires_at || null,
        grid_rows_unlocked: row.grid_rows_unlocked || 0,
        invisible_until: row.invisible_until || null,
        hide_age_until: row.hide_age_until || null,
        unlock_count: row.unlock_count || 0,
        has_real_photo: row.has_real_photo || false,
      }
    }
    // Fallback: try basic columns
    const basicCols = 'filters_unlocked,filters_unlocked_expires_at'
    const fallbackRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}&select=${basicCols}`, { headers })
    if (!fallbackRes.ok) return null
    const data = await fallbackRes.json()
    if (!data || data.length === 0) return null
    const row = data[0]
    return {
      filters_unlocked: !!row.filters_unlocked,
      filters_unlocked_expires_at: row.filters_unlocked_expires_at || null,
      edit_unlocked: false,
      edit_unlocked_expires_at: null,
      grid_rows_unlocked: 0,
      invisible_until: row.invisible_until || null,
      hide_age_until: row.hide_age_until || null,
      unlock_count: 0,
      has_real_photo: false,
    }
  } catch (err) {
    console.error('fetchUserUnlockStatus failed:', err)
    return null
  }
}

// ─── Update has_real_photo ───────────────────────────────────────────

export async function updateUserRealPhoto(userId: number, hasRealPhoto: boolean): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ has_real_photo: hasRealPhoto }),
    })
    return res.ok
  } catch (err) {
    console.error('updateUserRealPhoto failed:', err)
    return false
  }
}

// ─── Update invisible status ─────────────────────────────────────────

export async function setGridRowsUnlocked(userId: number, value: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ grid_rows_unlocked: value }),
    })
    return res.ok
  } catch (err) {
    console.error('setGridRowsUnlocked failed:', err)
    return false
  }
}

export async function setFiltersUnlocked(userId: number, unlocked: boolean, expiresAt: string | null): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ filters_unlocked: unlocked, filters_unlocked_expires_at: expiresAt }),
    })
    return res.ok
  } catch (err) {
    console.error('setFiltersUnlocked failed:', err)
    return false
  }
}

export async function updateInvisibleStatus(userId: number, until: string | null): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        invisible_until: until,
        invisible_purchased_at: until ? new Date().toISOString() : null,
      }),
    })
    return res.ok
  } catch (err) {
    console.error('updateInvisibleStatus failed:', err)
    return false
  }
}

// ─── Update hide-age status ───────────────────────────────────────────

export async function updateHideAgeStatus(userId: number, until: string | null): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        hide_age_until: until,
        hide_age_purchased_at: until ? new Date().toISOString() : null,
      }),
    })
    return res.ok
  } catch (err) {
    console.error('updateHideAgeStatus failed:', err)
    return false
  }
}

// ─── Flying Messages ─────────────────────────────────────────────────

export interface FlyingMessage {
  id: number
  text: string
  username: string
  user_id: number
  top_percent: number
  created_at: string
}

export async function insertFlyingMessage(msg: { text: string; username: string; user_id: number; top_percent: number }): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_flying_messages`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(msg),
    })
    return res.ok
  } catch (err) {
    console.error('insertFlyingMessage failed:', err)
    return false
  }
}

export async function fetchFlyingMessages(since: string): Promise<FlyingMessage[]> {
  if (!hasValidKey) return []
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/lmn_flying_messages?created_at=gte.${since}&order=created_at.desc&limit=50`,
      { headers }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return data || []
  } catch (err) {
    console.error('fetchFlyingMessages failed:', err)
    return []
  }
}

// ─── Set raffle draw to next Wednesday at 20:00 ───────────────────────

export async function setRaffleDrawToNextWednesday(raffleId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const now = new Date()
    const day = now.getDay() // 0=Sun, 1=Mon, ..., 3=Wed
    const daysUntilWed = (3 - day + 7) % 7 || 7 // If today is Wed, go to next Wed
    const nextWed = new Date(now)
    nextWed.setDate(now.getDate() + daysUntilWed)
    nextWed.setHours(20, 0, 0, 0)
    const endsAt = nextWed.toISOString()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_raffles?id=eq.${raffleId}`, {
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

// ─── Raffles ─────────────────────────────────────────────────────────

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

export async function getActiveRaffle(): Promise<Raffle | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/lmn_get_active_raffle`, {
      headers
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    if (!data || data.length === 0) return null
    return data[0] as Raffle
  } catch (err) {
    console.error('getActiveRaffle failed:', err)
    return null
  }
}

export async function createRaffle(prizeType: 'filters' | 'invisible'): Promise<Raffle | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_raffles`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        prize_type: prizeType,
        ticket_price: 100,
        target_tickets: 10,
        current_tickets: 0,
        status: 'pending',
      }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return data[0] as Raffle
  } catch (err) {
    console.error('createRaffle failed:', err)
    return null
  }
}

export async function buyRaffleTicket(raffleId: number, userId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    // Fetch current ticket count first
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_raffles?id=eq.${raffleId}&select=current_tickets`, { headers })
    if (!getRes.ok) throw new Error(await getRes.text())
    const rows = await getRes.json()
    const current = rows?.[0]?.current_tickets || 0

    // Insert ticket
    const ticketRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_raffle_tickets`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ raffle_id: raffleId, user_id: userId }),
    })
    if (!ticketRes.ok) throw new Error(await ticketRes.text())

    // Increment ticket count
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_raffles?id=eq.${raffleId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ current_tickets: current + 1 }),
    })
    return updateRes.ok
  } catch (err) {
    console.error('buyRaffleTicket failed:', err)
    return false
  }
}

export async function startRaffleCountdown(raffleId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    // Set draw time to 8pm (20:00) tomorrow in Hong Kong timezone
    const now = new Date()
    const tomorrow8pm = new Date(now)
    tomorrow8pm.setDate(tomorrow8pm.getDate() + 1)
    tomorrow8pm.setHours(20, 0, 0, 0)
    // If it's already past 8pm today, tomorrow8pm is correct
    // If it's before 8pm today, we still draw tomorrow (gives time for more tickets)

    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_raffles?id=eq.${raffleId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status: 'active',
        countdown_started_at: now.toISOString(),
        ends_at: tomorrow8pm.toISOString(),
      }),
    })
    return res.ok
  } catch (err) {
    console.error('startRaffleCountdown failed:', err)
    return false
  }
}



export async function drawRaffleWinner(raffleId: number): Promise<{ user_id: number; name: string } | null> {
  if (!hasValidKey) return null
  try {
    // Use RPC to pick a random ticket holder
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/lmn_draw_raffle_winner`, {
      method: 'POST',
      headers: { ...headers },
      body: JSON.stringify({ raffle_id: raffleId }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    if (!data || !data.user_id) return null
    return { user_id: data.user_id, name: data.name || 'Unknown' }
  } catch (err) {
    console.error('drawRaffleWinner failed:', err)
    return null
  }
}

export async function completeRaffle(raffleId: number, winnerUserId: number, winnerName: string): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_raffles?id=eq.${raffleId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status: 'completed',
        winner_user_id: winnerUserId,
        winner_name: winnerName,
        drawn_at: new Date().toISOString(),
      }),
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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_raffle_tickets?raffle_id=eq.${raffleId}&select=*`, { headers })
    if (!res.ok) return 0
    const data = await res.json()
    return data.length || 0
  } catch (err) {
    console.error('getRaffleTickets failed:', err)
    return 0
  }
}

// ─── Topics ──────────────────────────────────────────────────────────

export interface DbTopic {
  id: number
  name: string
  description: string | null
  icon: string
  topic_url: string
  sort_order: number
  updated_at: string
}

export async function fetchTopics(): Promise<DbTopic[]> {
  if (!hasValidKey) return []
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_topics?select=*&order=sort_order.asc`, { headers })
    if (!res.ok) throw new Error(await res.text())
    return await res.json()
  } catch (err) {
    console.error('fetchTopics failed:', err)
    return []
  }
}

// ─── Photo Gate: Real Photo Check ────────────────────────────────────

export function checkRealPhoto(photoUrl: string | null | undefined): boolean {
  if (!photoUrl || photoUrl.trim() === '') return false
  if (photoUrl.includes('placehold')) return false
  if (photoUrl.includes('default')) return false
  if (photoUrl.endsWith('.svg')) return false
  if (photoUrl.includes('avatar-default')) return false
  if (photoUrl.includes('cdn4.telegram')) return true
  if (photoUrl.includes('cdn-telegram')) return true
  if (photoUrl.includes('telegg')) return true
  if (photoUrl.includes('cdn.')) return true
  if (photoUrl.includes('tg.dev')) return true
  if (photoUrl.includes('userpic')) return true
  if (photoUrl.length > 40) return true
  return false
}

export async function updateRealPhotoStatus(userId: number, hasRealPhoto: boolean): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ has_real_photo: hasRealPhoto, photo_checked_at: new Date().toISOString() }),
    })
    return res.ok
  } catch (err) {
    console.error('updateRealPhotoStatus failed:', err)
    return false
  }
}

export async function fetchUserPhotoStatus(userId: number): Promise<{ has_real_photo: boolean } | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?select=has_real_photo,photo_url&id=eq.${userId}&limit=1`, { headers })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return data?.[0] || null
  } catch (err) {
    console.error('fetchUserPhotoStatus failed:', err)
    return null
  }
}

export async function relockUserFeatures(userId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/lmn_relock_user_features`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ p_user_id: userId }),
    })
    return res.ok
  } catch (err) {
    console.error('relockUserFeatures failed:', err)
    return false
  }
}

// Auto 7-day filter unlock for new users (only if not already set)
export async function ensureFilterUnlock(userId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}&select=filters_unlocked_expires_at`, { headers })
    if (!res.ok) return false
    const data = await res.json()
    if (!data || data.length === 0) return false
    const current = data[0]?.filters_unlocked_expires_at
    if (current) return true // already has unlock, nothing to do

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
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