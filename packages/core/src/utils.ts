// Shared utility functions for HKMOD & LMN

import type { UserProfile } from './types'

export function isAdminUser(
  user: { id?: number; username?: string } | null | undefined,
  adminIds: number[],
  adminUsernames: string[],
): boolean {
  if (!user) return false
  if (user.id && adminIds.includes(user.id)) return true
  if (user.username && adminUsernames.includes(user.username)) return true
  return false
}

export function getTimeAgo(updatedAt?: string): string {
  if (!updatedAt) return ''
  const diff = Date.now() - new Date(updatedAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDist(d: number): string {
  if (d < 1) return `${Math.round(d * 1000)}m`
  return `${d.toFixed(1)}km`
}

export function isUserActive(user: { isOwn?: boolean; updatedAt?: string }): boolean {
  if (user.isOwn) return true
  if (!user.updatedAt) return false
  return Date.now() - new Date(user.updatedAt).getTime() < 60 * 60 * 1000
}

export function isPrefLocked(lastSavedAt: number, globalUnlockAt: number): boolean {
  if (lastSavedAt === 0) return false
  if (globalUnlockAt >= lastSavedAt) return false
  return Date.now() - lastSavedAt < 30 * 24 * 60 * 60 * 1000
}

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

export function isMonthlyEditUnlocked(): boolean {
  return new Date().getDate() === 1
}

export async function detectRealPhoto(imageUrl: string): Promise<boolean> {
  if (!imageUrl) return false
  const lower = imageUrl.toLowerCase()
  if (lower.endsWith('.svg')) return false
  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) return true
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(imageUrl, { method: 'HEAD', signal: ctrl.signal })
    clearTimeout(timer)
    const ct = res.headers.get('Content-Type') || ''
    return ct.includes('image/jpeg') || ct.includes('image/png') || ct.includes('image/webp') || ct.includes('image/gif')
  } catch {
    return true
  }
}

export function dbToProfile(u: any, myLat: number, myLng: number): UserProfile {
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
    preference1: u.preference1 || undefined,
    preference2: u.preference2 || undefined,
    preference3: u.preference3 || undefined,
    preference4: u.preference4 === 'Off' ? 'Travel' : u.preference4 || undefined,
    openToMessages: u.open_to_messages || false,
    tgUsername: u.tg_username || undefined,
    tgPhotoUrl: u.photo_url?.startsWith('http') ? u.photo_url : undefined,
    tgPhotos: u.photo_url?.startsWith('http') ? [u.photo_url] : [],
    updatedAt: u.updated_at,
    hasPhoto: !!(u.photo_url && u.photo_url.startsWith('http')),
    hasRealPhoto: u.has_real_photo ?? undefined,
    invisibleUntil: u.invisible_until ?? undefined,
    isInvisible: !!u.invisible_until && new Date(u.invisible_until).getTime() > Date.now(),
    // LMN fields
    gender: u.gender || undefined,
    seekingGender: u.seeking_gender || undefined,
    dob: u.dob ? u.dob : undefined,
    seekingToday: u.seeking_today || undefined,
    meetupType: u.meetup_type ? u.meetup_type : undefined,
    hideAge: !!u.hide_age,
  }
}

// ─── Role Helpers (HKMOD) ───────────────────────────────────────────

export type RoleFilterMode = 'All' | 'B' | 'VB' | 'V' | 'VT' | 'T' | 'Side'

export function formatRole(value: number, isSide: boolean): string {
  if (isSide) return 'Side'
  return value === 0 ? '0' : value === 1 ? '1' : String(value)
}

export function getGridRoleLabel(value: number, isSide: boolean): string {
  if (isSide) return 'Side'
  return value === 0 ? '0 (Bottom)' : value === 1 ? '1 (Top)' : String(value)
}

export function getFilterColor(mode: RoleFilterMode): string {
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
