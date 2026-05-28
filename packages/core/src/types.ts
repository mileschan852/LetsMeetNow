export type Lang = 'en' | 'tc' | 'sc' | 'ru' | 'ja' | 'ko'

export interface FilterOption {
  value: string
  label: Record<string, string>
}

export interface FilterConfig {
  key: string
  label: Record<string, string>
  options: FilterOption[]
}

export interface UserProfile {
  id: number
  name: string
  tgPhotoUrl: string
  height?: number
  weight?: number
  lat: number
  lng: number
  gender?: string
  seekingGender?: string
  dob?: string | null
  seekingToday?: string | null
  meetupType?: string | null
  isOnline: boolean
  isOwn?: boolean
  updatedAt: string
  distance?: number
  isInvisible?: boolean
  openToMessages?: boolean
  hideAgeUntil?: string | null
  tg_username?: string | null
  is_visible?: boolean
  grid_rows_unlocked?: number
  filters_unlocked?: boolean
  filters_unlocked_expires_at?: string | null
  invisible_until?: string | null
  profile_unlocked?: boolean
  // HKMOD fields
  position?: number | null
  is_side?: boolean | null
  preference1?: string | null
  preference2?: string | null
  preference3?: string | null
  preference4?: string | null
}

export interface DbUser extends UserProfile {}

export interface Raffle {
  id: string
  prize_type: 'filters' | 'invisible'
  status: 'active' | 'completed'
  target_tickets: number
  current_tickets: number
  winner_id?: number | null
  winner_name?: string | null
  winner_notified?: boolean
}

export interface FlyingMessage {
  id: string
  text: string
  sender: string
  createdAt: string
}

export interface PaymentItem {
  purpose: string
  title: string
  description: string
  price: number
}
