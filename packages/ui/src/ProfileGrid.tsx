import React, { useState, useEffect } from 'react'

// ─── Types ───────────────────────────────────────────────────────────

export interface GridUser {
  id: string
  name: string
  tgPhotoUrl?: string
  isOwn?: boolean
  isInvisible?: boolean
  isOnline?: boolean
  isSide?: boolean
  position?: number
  updatedAt?: string
  distance: number
  openToMessages?: boolean
  // App-specific fields (passed through)
  [key: string]: any
}

export interface ProfileGridProps {
  users: GridUser[]
  ownProfile: GridUser
  unlockedSlots: number
  totalRealUsers: number
  hasMoreUsers: boolean
  onPromptUnlock: () => void
  onViewOwnProfile: () => void
  onViewPhoto: (user: GridUser) => void
  isAdmin: boolean
  isLoading: boolean
  // Render props for app-specific tile bottom content
  renderTileBottom: (user: GridUser) => React.ReactNode
  renderTileLabel?: (user: GridUser) => string // e.g. role label, gender label
  // Optional: extra top-left badge (e.g. gender icon, role icon)
  renderTileTopLeft?: (user: GridUser) => React.ReactNode
  // Optional: custom tile className
  tileClassName?: string
}

// ─── Profile Tile ────────────────────────────────────────────────────

function GridTile({
  user,
  onClick,
  renderBottom,
  renderTopLeft,
  tileClassName,
}: {
  user: GridUser
  onClick?: () => void
  renderBottom: (user: GridUser) => React.ReactNode
  renderTopLeft?: (user: GridUser) => React.ReactNode
  tileClassName?: string
}) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const photo = user.tgPhotoUrl

  useEffect(() => {
    setImgLoaded(false)
    setImgFailed(false)
  }, [photo])

  const isActive = user.isOnline && user.updatedAt
    ? Date.now() - new Date(user.updatedAt).getTime() < 60 * 60 * 1000
    : false

  return (
    <button
      onClick={onClick}
      className={`card-enter tile-aspect rounded-lg overflow-hidden nav-press text-left relative ${tileClassName || ''}`}
      style={{ minHeight: '68px' }}
    >
      {/* Invisible eye icon */}
      {user.isInvisible && (
        <div
          className="absolute top-0.5 left-0.5 z-40 w-3 h-3 flex items-center justify-center rounded-full bg-purple-500/40 border border-purple-400/30 text-[7px]"
          title="Invisible"
        >
          👁️‍🗨️
        </div>
      )}

      {/* Photo */}
      {photo && !imgFailed && (
        <img
          src={photo}
          alt={user.name}
          className={`absolute inset-0 w-full h-full object-cover z-10 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ transition: 'opacity 0.3s' }}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
          loading="eager"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      )}

      {/* Placeholder */}
      {(!photo || imgFailed || !imgLoaded) && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#2C2C2E] to-[#1A1A1A] flex items-center justify-center z-10">
          <span className="text-lg font-bold text-[#8E8E93]">{user.name.charAt(0)}</span>
        </div>
      )}

      <div className="absolute inset-0 profile-photo-gradient pointer-events-none z-20" />

      {/* Online indicator */}
      {isActive && (
        <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#00D4AA] rounded-full online-pulse z-30" />
      )}

      {/* Open to messages indicator */}
      {user.openToMessages && (
        <div className="absolute top-0.5 left-0.5 z-30 text-[8px] bg-black/50 rounded-full w-4 h-4 flex items-center justify-center">⭐</div>
      )}

      {/* App-specific top-left badge */}
      {renderTopLeft?.(user)}

      {/* Own profile border */}
      {user.isOwn && (
        <div className="absolute inset-0 border-2 border-[#FF6B35] rounded-lg pointer-events-none z-30" />
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 px-[3px] pb-[1px] pointer-events-none z-30 flex flex-col justify-end">
        <p
          className={`font-semibold text-[8px] leading-tight truncate ${
            user.isOwn ? 'text-[#FF6B35]' : 'text-white'
          }`}
        >
          {user.isOwn ? 'You' : user.name}
        </p>
        {renderBottom(user)}
      </div>
    </button>
  )
}

// ─── Profile Grid ────────────────────────────────────────────────────

export function ProfileGrid({
  users,
  ownProfile,
  unlockedSlots,
  totalRealUsers,
  hasMoreUsers,
  onPromptUnlock,
  onViewOwnProfile,
  onViewPhoto,
  isAdmin,
  isLoading,
  renderTileBottom,
  renderTileLabel,
  renderTileTopLeft,
  tileClassName,
}: ProfileGridProps) {
  // Build display list: own profile first, then other users, then blank tiles to fill
  const displayUsers: GridUser[] = [ownProfile, ...users.filter((u) => u.id !== ownProfile.id)]

  // Pad to 100 slots
  while (displayUsers.length < 100) {
    displayUsers.push({
      id: `blank_${displayUsers.length}`,
      name: '',
      distance: 0,
      isBlank: true,
    } as GridUser)
  }

  if (isLoading && users.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-[#8E8E93] text-xs">Loading...</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {displayUsers.map((user, idx) => {
        const isAboveDivider = idx < unlockedSlots
        const isBlank = !!(user as any).isBlank

        if (isBlank) {
          return (
            <div
              key={user.id}
              className="relative aspect-square rounded-lg bg-[#2C2C2E]/60 border border-[#3A3A3C]/40 flex items-center justify-center"
              style={{ pointerEvents: 'none' }}
            >
              <svg className="w-4 h-4 text-[#48484A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          )
        }

        return (
          <React.Fragment key={user.id}>
            {/* Divider row — tap to unlock +1 row */}
            {idx === unlockedSlots && hasMoreUsers && (
              <div
                className="col-span-full flex items-center justify-center py-2 my-1 cursor-pointer select-none active:opacity-60 transition-opacity rounded-lg bg-gradient-to-r from-[#FF6B35]/10 to-purple-600/10 border border-[#FF6B35]/30"
                onClick={onPromptUnlock}
              >
                <span className="text-[10px] text-[#FF6B35] font-bold mr-2">🔒</span>
                <span className="text-[10px] text-[#FF6B35] font-semibold">
                  {isAdmin ? 'Tap to unlock row (admin)' : 'Tap to unlock — 1000 ⭐'}
                </span>
                <span className="text-[9px] text-[#8E8E93] ml-2">
                  ({totalRealUsers - unlockedSlots} more)
                </span>
                <span className="mx-2 text-[10px] text-[#FF6B35] font-bold">🔒</span>
              </div>
            )}

            <div
              className="relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200"
              style={{
                borderColor: user.id === ownProfile.id ? '#FF6B35' : 'transparent',
                opacity: !isAboveDivider ? 0.3 : 1,
                pointerEvents: !isAboveDivider ? 'none' : undefined,
              }}
            >
              <GridTile
                user={user}
                onClick={
                  !isAboveDivider
                    ? undefined
                    : () => (user.isOwn ? onViewOwnProfile() : onViewPhoto(user))
                }
                renderBottom={renderTileBottom}
                renderTopLeft={renderTileTopLeft}
                tileClassName={tileClassName}
              />
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
