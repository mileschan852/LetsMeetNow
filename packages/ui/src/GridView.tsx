import { useState, useCallback, useRef, useEffect } from 'react'
import type { DbUser, Lang, FilterConfig } from 'dating-core/types'
import { ProfileCard } from './ProfileCard'

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
  filterComponent?: React.ReactNode
  headerComponent?: React.ReactNode
  footerComponent?: React.ReactNode
}

export function GridView({
  users,
  lang,
  gridRows,
  filtersUnlocked,
  isAdmin,
  onUnlockFilters,
  onRefresh,
  onSelectUser,
  onSendMessage,
  filterComponent,
  headerComponent,
  footerComponent,
}: GridViewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const maxVisible = gridRows * 3 // 3 columns per row
  const visible = users.slice(0, maxVisible)
  const hasMore = users.length > maxVisible

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await onRefresh()
    setTimeout(() => setIsRefreshing(false), 500)
  }, [onRefresh])

  return (
    <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto bg-[#0A0A0A]">
      {/* Header */}
      {headerComponent}

      {/* Stats bar */}
      <div className="px-3 pt-1 flex items-center gap-2 text-[10px] text-[#8E8E93]">
        <span>Nearby: {users.length}</span>
        <span className="text-[#00D4AA]">Active 1h: {users.filter(u => isRecentlyActive(u.updatedAt)).length + 1}</span>
        <span className="text-[#2C2C2E]">|</span>
        <span className="text-[#FF6B35] font-bold">Rows: {gridRows}</span>
        {filtersUnlocked && <span className="text-[#00D4AA]">Filters ✅</span>}
      </div>

      {/* Filter bar */}
      {filterComponent}

      {/* Grid */}
      <div className="flex-1 p-2">
        <div className="grid grid-cols-3 gap-1.5">
          {visible.map(user => (
            <ProfileCard
              key={user.id}
              user={user}
              lang={lang}
              onSelect={onSelectUser}
              onSendMessage={onSendMessage}
              compact
            />
          ))}
        </div>

        {/* Unlock / Refresh button */}
        {hasMore && (
          <div className="mt-2 mx-0.5 select-none">
            <button
              onClick={onUnlockFilters}
              className="w-full bg-gradient-to-r from-[#FF6B35]/20 to-purple-600/20 rounded-lg py-2 px-3 flex items-center justify-center gap-1.5 cursor-pointer border border-[#FF6B35]/30 active:scale-[0.98] active:opacity-80 transition-all"
            >
              <span>🔓</span>
              <span className="text-xs font-bold text-[#FF6B35]">{isAdmin ? 'Unlock (Admin)' : '100 ⭐'}</span>
              <span className="text-[10px] text-[#8E8E93]">({users.length - maxVisible} more)</span>
            </button>
          </div>
        )}
        {!hasMore && (
          <div className="mt-2 mx-0.5 select-none">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full rounded-xl py-3 px-4 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2C2C2E] text-[#8E8E93] text-xs font-medium active:scale-[0.98] transition-all"
            >
              <RefreshCwIcon spinning={isRefreshing} />
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {footerComponent}
    </div>
  )
}

function isRecentlyActive(updatedAt: string): boolean {
  if (!updatedAt) return false
  const lastUpdate = new Date(updatedAt).getTime()
  return Date.now() - lastUpdate < 60 * 60 * 1000
}

function RefreshCwIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
