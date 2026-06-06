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
  id: string
  name: string
  age: number
  height: number
  weight: number
  position: number
  isSide: boolean
  isOnline: boolean
  distance: number
  lat?: number
  lng?: number
  isOwn?: boolean
  preference1?: 'Safe' | 'Raw'
  preference2?: 'Clean' | 'Party' | 'Party✓'
  preference3?: '1on1' | 'Group'
  preference4?: 'Host' | 'Travel' | 'Outdoor' | 'Sauna'
  openToMessages?: boolean
  tgUsername?: string
  tgPhotoUrl?: string
  tgPhotos?: string[]
  updatedAt?: string
  hasPhoto: boolean
  hasRealPhoto?: boolean
  invisibleUntil?: string
  isInvisible: boolean
  hideAge?: boolean
  // LMN fields
  gender?: string
  seekingGender?: string
  dob?: string | null
  seekingToday?: string
  meetupType?: string | null
  // Compatibility fields
  tg_username?: string | null
  is_visible?: boolean
  grid_rows_unlocked?: number
  filters_unlocked?: boolean
  filters_unlocked_expires_at?: string | null
  invisible_until?: string | null
  profile_unlocked?: boolean
  hideAgeUntil?: string | null
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
