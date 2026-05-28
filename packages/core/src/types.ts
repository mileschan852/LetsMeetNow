// ─── Core Types ─────────────────────────────────────────────────────

export type Lang = 'en' | 'tc' | 'sc' | 'ru' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'th' | 'vi'

export interface UserProfile {
  id: number
  name: string
  tgPhotoUrl: string
  height: number
  weight: number
  age: number
  role: string
  bodyType: string
  skin: string
  into: string[]
  lookingFor: string
  bio: string
  zodiac: string
  latitude: number
  longitude: number
  updatedAt: string
  online: boolean
  tg_id?: number
  tg_username?: string
  tg_first_name?: string
  tg_last_name?: string
  is_visible?: boolean
  invisible_until?: string
  grid_rows_unlocked?: number
  filters_unlocked?: boolean
  filters_unlocked_expires_at?: string
  channel_follow_unlock?: boolean
  raffle_tickets?: number
}

export interface DbUser extends UserProfile {
  created_at?: string
  last_seen?: string
}

export interface Raffle {
  id: string
  prize_type: 'filters' | 'invisible' | 'grid'
  status: 'active' | 'waiting' | 'completed'
  target_tickets: number
  current_tickets: number
  winner_id?: number
  winner_name?: string
  created_at: string
  draw_date?: string
}

export interface FlyingMessage {
  id: string
  from_user_id: number
  from_user_name: string
  to_user_id: number
  content: string
  created_at: string
}

export interface FilterConfig {
  key: string
  label: Record<Lang, string>
  options: { value: string; label: Record<Lang, string> }[]
  multi?: boolean
}

export type PaymentPurpose = 'raffle' | 'filters' | 'invisible' | 'grid' | 'boost'

export interface PaymentItem {
  title: string
  description: string
  price: number        // Stars amount
  purpose: PaymentPurpose
  duration?: number    // days, if applicable
}

export interface TgUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

export interface WebAppInitData {
  user?: TgUser
  query_id?: string
  auth_date?: number
  hash?: string
}
