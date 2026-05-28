import { useState, useCallback } from 'react'
import type { DbUser, Lang } from 'dating-core/types'
import { getAge, getZodiacEmoji } from 'dating-core/i18n'

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

function formatDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const R = 6371 // km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const d = R * c
  return d < 1 ? `${Math.round(d * 1000)}m` : `${Math.round(d)}km`
}

export function ProfileCard({ user, lang, onSelect, onSendMessage, compact, showDistance, myLat, myLng }: ProfileCardProps) {
  const [imgError, setImgError] = useState(false)
  const age = user.age || (user.zodiac ? getAge(user.zodiac) : null)
  const zodiacEmoji = user.zodiac ? getZodiacEmoji(user.zodiac) : ''
  const dist = (showDistance && myLat && myLng && user.latitude && user.longitude)
    ? formatDistance(myLat, myLng, user.latitude, user.longitude)
    : null

  if (compact) {
    return (
      <div
        onClick={() => onSelect(user)}
        className="relative aspect-square rounded-xl overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
      >
        {user.tgPhotoUrl && !imgError ? (
          <img
            src={user.tgPhotoUrl}
            alt={user.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center text-[#8E8E93] text-2xl">
            {user.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <div className="text-white text-sm font-semibold truncate">{user.name}</div>
          <div className="text-white/70 text-xs">
            {age ? `${age}` : ''} {zodiacEmoji} {dist ? `· ${dist}` : ''}
          </div>
        </div>
        {user.online && (
          <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#00D4AA] rounded-full border-2 border-black" />
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => onSelect(user)}
      className="relative rounded-xl overflow-hidden cursor-pointer active:scale-[0.97] transition-transform bg-[#1A1A1A] border border-[#2C2C2E]"
    >
      <div className="aspect-[3/4] relative">
        {user.tgPhotoUrl && !imgError ? (
          <img
            src={user.tgPhotoUrl}
            alt={user.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#8E8E93] text-4xl">
            {user.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        {user.online && (
          <div className="absolute top-3 right-3 w-3 h-3 bg-[#00D4AA] rounded-full border-2 border-black" />
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold truncate">{user.name}</span>
          <span className="text-[#8E8E93] text-sm">{zodiacEmoji}</span>
        </div>
        <div className="text-[#8E8E93] text-xs mt-1 flex items-center gap-2">
          {age && <span>{age} y</span>}
          {user.height && <span>{user.height}cm</span>}
          {user.weight && <span>{user.weight}kg</span>}
          {dist && <span className="text-[#00D4AA]">{dist}</span>}
        </div>
        {user.bio && (
          <div className="text-[#8E8E93] text-xs mt-1.5 line-clamp-2">{user.bio}</div>
        )}
      </div>
    </div>
  )
}
