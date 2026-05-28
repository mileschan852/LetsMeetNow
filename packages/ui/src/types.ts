// ─── UI Component Types ─────────────────────────────────────────────

import type { UserProfile, Lang, FilterConfig, Raffle, DbUser } from 'dating-core/types'

export interface GridViewProps {
  users: DbUser[]
  lang: Lang
  gridRows: number
  filtersUnlocked: boolean
  isAdmin: boolean
  onUnlockFilters: () => void
  onRefresh: () => void
  onSelectUser: (user: DbUser) => void
  onSendMessage?: (user: DbUser) => void
  onToggleFollow?: (user: DbUser) => void
  onToggleBlock?: (user: DbUser) => void
  onReport?: (user: DbUser) => void
  filterComponent?: React.ReactNode
  headerComponent?: React.ReactNode
  footerComponent?: React.ReactNode
}

export interface ProfileCardProps {
  user: DbUser
  lang: Lang
  onSelect: (user: DbUser) => void
  onSendMessage?: (user: DbUser) => void
  compact?: boolean
  showDistance?: boolean
  myLat?: number
  myLng?: number
}

export interface ProfileModalProps {
  user: DbUser | null
  lang: Lang
  isMe?: boolean
  isAdmin?: boolean
  onClose: () => void
  onEdit?: () => void
  onSendMessage?: () => void
  onBlock?: () => void
  onReport?: () => void
}

export interface FilterBarProps {
  lang: Lang
  filtersUnlocked: boolean
  configs: FilterConfig[]
  values: Record<string, string | string[]>
  onChange: (key: string, value: string | string[]) => void
  onReset: () => void
  onClose: () => void
}

export interface RafflePanelProps {
  raffle: Raffle | null
  lang: Lang
  isAdmin: boolean
  ticketCount: number
  onBuyTicket: () => void
  onStartNext: () => void
}
