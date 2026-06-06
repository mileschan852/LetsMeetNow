import React, { useRef, useState, useEffect } from 'react'
import { X } from 'lucide-react'

export interface PhotoOverlayUser {
  id: string
  name: string
  age?: number
  distance?: number
  height?: number
  weight?: number
  tgPhotoUrl?: string
  tgPhotos?: string[]
  isOwn?: boolean
  isOnline?: boolean
  updatedAt?: string
  [key: string]: any
}

export interface PhotoOverlayProps {
  user: PhotoOverlayUser
  onClose: () => void
  renderFooter?: (user: PhotoOverlayUser) => React.ReactNode
}

export function PhotoOverlay({ user, onClose, renderFooter }: PhotoOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [imgStates, setImgStates] = useState<{ loaded: boolean; failed: boolean }[]>([])
  const photos = user.tgPhotos?.length ? user.tgPhotos : (user.tgPhotoUrl ? [user.tgPhotoUrl] : [])

  // Initialize image states when photos change
  useEffect(() => {
    setImgStates(photos.map(() => ({ loaded: false, failed: false })))
  }, [photos.join(',')])

  const handleScroll = () => {
    if (!scrollRef.current) return
    setActiveIdx(Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth))
  }

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-[60] bg-black/95 flex flex-col animate-in fade-in duration-200" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#1A1A1A]/80 flex items-center justify-center z-20 nav-press">
        <X className="w-5 h-5 text-white" />
      </button>

      <div className="flex-1 flex items-center relative">
        {photos.length > 0 ? (
          <>
            <div ref={scrollRef} onScroll={handleScroll} className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
              {photos.map((photo, i) => (
                <div key={i} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center relative">
                  {!imgStates[i]?.failed && (
                    <img
                      src={photo}
                      alt={`${user.name} ${i + 1}`}
                      className={`max-w-full max-h-[65vh] object-contain transition-opacity duration-300 ${imgStates[i]?.loaded ? 'opacity-100' : 'opacity-0'}`}
                      draggable={false}
                      referrerPolicy="no-referrer"
                      onLoad={() => setImgStates(prev => {
                        const next = [...prev]
                        next[i] = { ...next[i], loaded: true }
                        return next
                      })}
                      onError={() => setImgStates(prev => {
                        const next = [...prev]
                        next[i] = { ...next[i], failed: true }
                        return next
                      })}
                    />
                  )}
                  {(!imgStates[i]?.loaded || imgStates[i]?.failed) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full bg-[#1A1A1A] flex items-center justify-center">
                        <span className="text-4xl font-bold text-[#8E8E93]">{user.name.charAt(0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {photos.length > 1 && (
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <span className="text-white text-xs font-medium">{activeIdx + 1} / {photos.length}</span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <span className="text-4xl font-bold text-[#8E8E93]">{user.name.charAt(0)}</span>
            </div>
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-3">
          {photos.map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all duration-200 ${i === activeIdx ? 'w-4 bg-[#FF6B35]' : 'w-1.5 bg-[#8E8E93]/40'}`} />)}
        </div>
      )}

      {renderFooter && (
        <div className="w-full px-4 pb-4 pt-2">
          {renderFooter(user)}
        </div>
      )}
    </div>
  )
}
