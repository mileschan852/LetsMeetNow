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

// ─── Zodiac ──────────────────────────────────────────────────────────

export function getZodiac(dob: string): string {
  const d = new Date(dob)
  const m = d.getMonth() + 1
  const day = d.getDate()
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return 'Aquarius'
  if ((m === 2 && day >= 19) || (m === 3 && day <= 20)) return 'Pisces'
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return 'Aries'
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return 'Taurus'
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return 'Gemini'
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return 'Cancer'
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return 'Leo'
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return 'Virgo'
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return 'Libra'
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return 'Scorpio'
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return 'Sagittarius'
  return 'Capricorn'
}

export function getZodiacEmoji(sign: string): string {
  const map: Record<string, string> = {
    Aries: '\u2648', Taurus: '\u2649', Gemini: '\u264A', Cancer: '\u264B',
    Leo: '\u264C', Virgo: '\u264D', Libra: '\u264E', Scorpio: '\u264F',
    Sagittarius: '\u2650', Capricorn: '\u2651', Aquarius: '\u2652', Pisces: '\u2653',
  }
  return map[sign] || '\u2B50'
}

export function getAge(dob: string): number {
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

// ─── Edit Lock Helpers ─────────────────────────────────────────────

export function isMonthlyEditUnlocked(): boolean {
  return new Date().getDate() === 1
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
  hide_age_until: string | null
  hide_age_purchased_at: string | null
  grid_rows_unlocked: number | null
  filters_unlocked: boolean | null
  filters_unlocked_expires_at: string | null
}

export interface Raffle {
  id: number
  prize_type: 'filters' | 'invisible'
  status: 'waiting' | 'active' | 'complete'
  target_tickets: number
  tickets_sold: number
  winner_id: number | null
  winner_name: string | null
  created_at: string
  completed_at: string | null
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

export async function upsertUser(user: Partial<DbUser>): Promise<DbUser | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?on_conflict=id`, {
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

export async function fetchNearby(lat: number, lng: number, limit = 100): Promise<DbUser[]> {
  if (!hasValidKey) return []
  try {
    const cols = Object.keys({} as DbUser).join(',')
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=${cols}&limit=200`, { headers })
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

export async function setOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
  if (!hasValidKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_online: isOnline, updated_at: new Date().toISOString() }),
    })
  } catch (err) {
    console.error('setOnlineStatus error:', err)
  }
}

export async function fetchUserUnlockStatus(userId: number): Promise<{
  grid_rows_unlocked: number
  filters_unlocked: boolean
  invisible_until: string | null
} | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=grid_rows_unlocked,filters_unlocked,invisible_until`, { headers })
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

export async function insertFlyingMessage(userId: number, userName: string, text: string): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/flying_messages`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: userId, user_name: userName, text }),
    })
    return res.ok
  } catch { return false }
}

export async function fetchFlyingMessages(since?: string): Promise<FlyingMessage[]> {
  if (!hasValidKey) return []
  try {
    let url = `${SUPABASE_URL}/rest/v1/flying_messages?order=created_at.desc&limit=50`
    if (since) url += `&created_at=gte.${since}`
    const res = await fetch(url, { headers })
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

// ─── Travel Directory ────────────────────────────────────────────────

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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffles?status=eq.active&limit=1`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    return data?.[0] || null
  } catch { return null }
}

export async function buyRaffleTicket(userId: number, userName: string): Promise<boolean> {
  if (!hasValidKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/buy_raffle_ticket`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ p_user_id: userId, p_user_name: userName }),
    })
    return res.ok
  } catch { return false }
}

export async function createRaffle(prizeType: 'filters' | 'invisible'): Promise<Raffle | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/raffles`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ prize_type: prizeType, status: 'active', target_tickets: 20, tickets_sold: 0 }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.[0] || null
  } catch { return null }
}

export async function drawRaffleWinner(raffleId: number): Promise<Raffle | null> {
  if (!hasValidKey) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/draw_raffle_winner`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_raffle_id: raffleId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.[0] || null
  } catch { return null }
}
