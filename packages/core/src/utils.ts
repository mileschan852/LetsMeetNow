// Shared utility functions for HKMOD & LMN

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
