import { useState } from 'react'
import type { DbUser, Lang } from 'dating-core/types'
import { getAge, getZodiacEmoji } from 'dating-core/i18n'

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

export function ProfileModal({ user, lang, isMe, isAdmin, onClose, onEdit, onSendMessage, onBlock, onReport }: ProfileModalProps) {
  const [imgError, setImgError] = useState(false)
  if (!user) return null

  const age = user.age || (user.zodiac ? getAge(user.zodiac) : null)
  const zodiacEmoji = user.zodiac ? getZodiacEmoji(user.zodiac) : ''

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-[#1A1A1A] rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Photo */}
        <div className="relative aspect-[4/5]">
          {user.tgPhotoUrl && !imgError ? (
            <img src={user.tgPhotoUrl} alt={user.name} className="w-full h-full object-cover rounded-t-2xl"
              onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#8E8E93] text-6xl bg-[#2C2C2E] rounded-t-2xl">
              {user.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg">
            ✕
          </button>
          {user.online && (
            <div className="absolute top-4 left-4 w-3 h-3 bg-[#00D4AA] rounded-full border-2 border-black" />
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{user.name} {zodiacEmoji}</h2>
              <div className="text-[#8E8E93] text-sm flex gap-3 mt-1">
                {age && <span>{age} years</span>}
                {user.height && <span>{user.height}cm</span>}
                {user.weight && <span>{user.weight}kg</span>}
              </div>
            </div>
            {isMe && onEdit && (
              <button onClick={onEdit} className="px-4 py-2 rounded-lg bg-[#2C2C2E] text-white text-sm font-medium">
                Edit
              </button>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {user.role && <span className="px-2.5 py-1 rounded-full bg-[#FF6B35]/20 text-[#FF6B35] text-xs">{user.role}</span>}
            {user.bodyType && <span className="px-2.5 py-1 rounded-full bg-[#00D4AA]/20 text-[#00D4AA] text-xs">{user.bodyType}</span>}
            {user.skin && <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">{user.skin}</span>}
            {user.lookingFor && <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs">{user.lookingFor}</span>}
            {user.into?.map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-full bg-[#8E8E93]/20 text-[#8E8E93] text-xs">{tag}</span>
            ))}
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="bg-[#2C2C2E] rounded-xl p-3">
              <p className="text-white text-sm whitespace-pre-wrap">{user.bio}</p>
            </div>
          )}

          {/* Actions */}
          {!isMe && (
            <div className="flex gap-2 pt-2">
              {onSendMessage && (
                <button onClick={onSendMessage} className="flex-1 py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm active:scale-[0.98] transition-transform">
                  💬 Message
                </button>
              )}
              {onBlock && (
                <button onClick={onBlock} className="px-4 py-3 rounded-xl bg-[#2C2C2E] text-[#8E8E93] text-sm">
                  🚫 Block
                </button>
              )}
              {onReport && (
                <button onClick={onReport} className="px-4 py-3 rounded-xl bg-[#2C2C2E] text-[#8E8E93] text-sm">
                  ⚠️ Report
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
