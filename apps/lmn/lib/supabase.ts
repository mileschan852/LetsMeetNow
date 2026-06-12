
// Shared Supabase REST Client for HKMOD & LMN
// Supports both app schemas in the same users table

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://fngcjkclxxodjaiqkfkm.supabase.co'
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

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
  
  // HKMOD fields
  position: number | null
  is_side: boolean | null
  preference1: string | null  // Safe | Raw
  preference2: string | null  // Clean | Party | Party✓
  preference3: string | null  // 1on1 | Group
  preference4: string | null  // Host | Travel | Outdoor | Sauna
  open_to_messages: boolean | null
  
  // LMN fields
  dob: string | null
  gender: string | null       // Male | Female
  seeking_gender: string | null // Men | Women
  seeking_today: string | null // Just Browsing | Chat | Meetup | Webcam
  meetup_type: string | null   // Coffee | Meals | Outdoor | Charity | Bar & Parties | Bed
  
  // Shared premium fields
  invisible_until: string | null
  invisible_purchased_at: string | null
  
  // Real photo verification
  has_real_photo: boolean | null
  real_photo_checked_at: string | null
  
  // Filter unlock fields
  filters_unlocked: boolean | null
  filters_unlocked_expires_at: string | null
  edit_unlocked: boolean | null
  edit_unlocked_expires_at: string | null
  
  // Grid unlock
  grid_rows_unlocked: number | null
  
  // Unlock count
  unlock_count: number | null
}

export type UserProfile = {
  id: number
  name: string
  age: number | null
  height: number
  weight: number
  position: number | null
  isSide: boolean | null
  preference1: string | null
  preference2: string | null
  preference3: string | null
  preference4: string | null
  openToMessages: boolean
  gender: string | null
  seekingGender: string | null
  seekingToday: string | null
  meetupType: string | null
  lat: number | null
  lng: number | null
  distance?: number | null
  tgUsername: string
  tgPhotoUrl: string
  tgPhotos: string[]
  isOnline: boolean
  isOwn: boolean
  hasRealPhoto: boolean | null
  isInvisible: boolean
  invisibleUntil?: string
  filtersUnlocked?: boolean
  filtersUnlockedExpiresAt?: string
  editUnlocked?: boolean
  editUnlockedExpiresAt?: string
  gridRowsUnlocked?: number
  dob: string | null
  hideAge: boolean
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function dbToProfile(u: DbUser, lat: number, lng: number): UserProfile {
  return {
    id: u.id,
    name: u.name,
    age: getAge(u.dob),
    height: u.height,
    weight: u.weight,
    position: u.position,
    isSide: u.is_side,
    preference1: u.preference1,
    preference2: u.preference2,
    preference3: u.preference3,
    preference4: u.preference4,
    openToMessages: u.open_to_messages || false,
    gender: u.gender,
    seekingGender: u.seeking_gender,
    seekingToday: u.seeking_today,
    meetupType: u.meetup_type,
    lat: u.lat,
    lng: u.lng,
    distance: haversineKm(lat, lng, u.lat!, u.lng!),
    tgUsername: u.tg_username || '',
    tgPhotoUrl: u.photo_url?.startsWith('http') ? u.photo_url : '',
    tgPhotos: u.photo_url?.startsWith('http') ? [u.photo_url] : [],
    isOnline: !!u.is_online,
    isOwn: false,
    hasRealPhoto: u.has_real_photo,
    isInvisible: !!u.invisible_until && new Date(u.invisible_until).getTime() > Date.now(),
    invisibleUntil: u.invisible_until || undefined,
    dob: u.dob,
    hideAge: false,
  }
}

export function getAge(dob: string | null): number | null {
  if (!dob) return null
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

export function getZodiac(dob: string | null): string {
  if (!dob) return ''
  const date = new Date(dob)
  const day = date.getDate()
  const month = date.getMonth() + 1
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries'
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus'
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini'
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer'
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo'
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo'
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra'
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio'
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius'
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn'
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius'
  return 'Pisces'
}

export function getZodiacEmoji(sign: string): string {
  const map: Record<string, string> = {
    Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋',
    Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏',
    Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓'
  }
  return map[sign] || ''
}

// ─── fetchNearby — now accepts tableName to support multiple apps ──────────

export async function fetchNearby( lat: number, lng: number, limit = 100): Promise<DbUser[]> {
  if (!hasValidKey) return []
  try {
    const cols = Object.keys({} as DbUser).join(',')
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?select=${cols}&limit=200`, { headers })
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

export async function setOnlineStatus( userId: number, online: boolean) {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_online: online, updated_at: new Date().toISOString() })
    })
  } catch (err) {
    console.error('setOnlineStatus error:', err)
  }
}

export async function upsertUser( profile: Partial<DbUser>) {
  if (!hasValidKey) return
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(profile)
    })
    return await res.json()
  } catch (err) {
    console.error('upsertUser error:', err)
  }
}

// ─── Global Unlock Status ─────────────────────────────────────────────────

export async function fetchGlobalUnlock(tableName: string) {
  if (!hasValidKey) return 0
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?select=pref_changed_at&order=pref_changed_at.desc&limit=1`, { headers })
    const data = await res.json()
    return data[0]?.pref_changed_at ? new Date(data[0].pref_changed_at).getTime() : 0
  } catch { return 0 }
}

export async function fetchUserUnlockStatus( userId: number) {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}&select=edit_unlocked,edit_unlocked_expires_at,filters_unlocked,filters_unlocked_expires_at,grid_rows_unlocked`, { headers })
    const data = await res.json()
    return data[0] || null
  } catch { return null }
}

export async function setGridRowsUnlocked( userId: number, rows: number) {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ grid_rows_unlocked: rows })
    })
  } catch (err) {
    console.error('setGridRowsUnlocked error:', err)
  }
}

export async function setFiltersUnlocked(tableName: string, userId: number, unlocked: boolean, expiresAt?: string) {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ filters_unlocked: unlocked, filters_unlocked_expires_at: expiresAt || null })
    })
  } catch (err) {
    console.error('setFiltersUnlocked error:', err)
  }
}

export async function ensureFilterUnlock( userId: number) {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ filters_unlocked: true })
    })
  } catch (err) {
    console.error('ensureFilterUnlock error:', err)
  }
}

export async function updateInvisibleStatus( userId: number, until: string | null) {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ invisible_until: until, invisible_purchased_at: until ? new Date().toISOString() : null })
    })
  } catch (err) {
    console.error('updateInvisibleStatus error:', err)
  }
}

// ─── Flying Messages ──────────────────────────────────────────────────────

export interface FlyingMessageItem {
  id: number
  from_name: string
  from_photo: string | null
  message: string
  created_at: string
  is_read: boolean
}

export async function insertFlyingMessage(message: Omit<FlyingMessageItem, 'id' | 'created_at'>) {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/flying_messages`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(message)
    })
    return await res.json()
  } catch (err) {
    console.error('insertFlyingMessage error:', err)
    return null
  }
}

export async function fetchFlyingMessages(): Promise<FlyingMessageItem[]> {
  if (!hasValidKey) return []
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/flying_messages?select=*&order=created_at.desc&limit=50`, { headers })
    return await res.json()
  } catch (err) {
    console.error('fetchFlyingMessages error:', err)
    return []
  }
}

// ─── Raffle ───────────────────────────────────────────────────────────────

export interface Raffle {
  id: number
  status: 'active' | 'drawing' | 'completed'
  ticket_price: number
  prize_description: string
  end_time: string
  winner_id: number | null
  participant_count: number
  created_at: string
}

export async function getActiveRaffle(): Promise<Raffle | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffles?select=*&status=eq.active&order=created_at.desc&limit=1`, { headers })
    const data = await res.json()
    return data[0] || null
  } catch { return null }
}

export async function createRaffle(ticketPrice: number, prizeDescription: string, durationMinutes: number = 60): Promise<Raffle | null> {
  if (!hasValidKey) return null
  try {
    const endTime = new Date(Date.now() + durationMinutes * 60000).toISOString()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffles`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ ticket_price: ticketPrice, prize_description: prizeDescription, end_time: endTime, status: 'active' })
    })
    return (await res.json())[0] || null
  } catch { return null }
}

export async function buyRaffleTicket(raffleId: number, userId: number): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffle_tickets`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ raffle_id: raffleId, user_id: userId })
    })
    return res.ok
  } catch { return false }
}

export async function startRaffleCountdown(raffleId: number) {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/raffles?id=eq.${raffleId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'drawing' })
    })
  } catch { /* ignore */ }
}

export async function drawRaffleWinner(raffleId: number): Promise<number | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffle_tickets?raffle_id=eq.${raffleId}&select=user_id`, { headers })
    const tickets = await res.json()
    if (!tickets.length) return null
    const winner = tickets[Math.floor(Math.random() * tickets.length)]
    return winner.user_id
  } catch { return null }
}

export async function completeRaffle(raffleId: number, winnerId: number) {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/raffles?id=eq.${raffleId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'completed', winner_id: winnerId })
    })
  } catch { /* ignore */ }
}

// ─── Real Photo Check ─────────────────────────────────────────────────────

export async function checkRealPhoto( userId: number): Promise<boolean | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}&select=has_real_photo`, { headers })
    const data = await res.json()
    return data[0]?.has_real_photo ?? null
  } catch { return null }
}

export async function updateRealPhotoStatus( userId: number, status: boolean) {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ has_real_photo: status, real_photo_checked_at: new Date().toISOString() })
    })
  } catch (err) {
    console.error('updateRealPhotoStatus error:', err)
  }
}

export async function fetchUserPhotoStatus( userId: number): Promise<{ has_real_photo: boolean | null; real_photo_checked_at: string | null } | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}&select=has_real_photo,real_photo_checked_at`, { headers })
    const data = await res.json()
    return data[0] || null
  } catch { return null }
}

export async function relockUserFeatures( userId: number) {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/lmn_users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ edit_unlocked: false, filters_unlocked: false, grid_rows_unlocked: 0 })
    })
  } catch (err) {
    console.error('relockUserFeatures error:', err)
  }
}
