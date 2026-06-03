import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { t, type Lang } from 'dating-core/i18n'
import { getTg } from 'dating-core/telegram'

export function LocationGate({ onGranted, lang }: { onGranted: (lat: number, lng: number) => void; lang: Lang }) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'denied' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleRequest = () => {
    setStatus('requesting')
    const tg = getTg()
    if (tg?.requestLocation) {
      tg.requestLocation((loc) => {
        if (loc) {
          setStatus('idle')
          onGranted(loc.latitude, loc.longitude)
        } else {
          setStatus('denied')
        }
      })
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setStatus('idle')
          onGranted(pos.coords.latitude, pos.coords.longitude)
        },
        (err) => {
          setStatus('denied')
          setErrorMsg(err.message)
        }
      )
    } else {
      setStatus('error')
      setErrorMsg('Geolocation not supported')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-0 bg-black text-white p-6">
      <div className="w-20 h-20 rounded-full bg-[#1C1C1E] flex items-center justify-center mb-4">
        <MapPin className="w-10 h-10 text-[#FF6B35]" />
      </div>
      <h2 className="text-xl font-bold mb-2">{t(lang, 'locationRequired')}</h2>
      <p className="text-center text-[#8E8E93] mb-6 text-sm">{t(lang, 'locationDesc')}</p>
      {status === 'requesting' && (
        <p className="text-[#FF6B35] mb-4">{t(lang, 'checkingLoc')}</p>
      )}
      {status === 'denied' && (
        <div className="text-center mb-4">
          <p className="text-red-400 font-bold mb-2">{t(lang, 'permissionDenied')}</p>
          <p className="text-[#8E8E93] text-xs mb-4">{t(lang, 'enableLocation')}</p>
          {errorMsg && <p className="text-red-500 text-xs mb-2">{errorMsg}</p>}
          <button
            onClick={handleRequest}
            className="px-4 py-2 bg-[#FF6B35] text-white rounded-lg font-bold text-sm"
          >
            {t(lang, 'tapToRetry')}
          </button>
        </div>
      )}
      {status !== 'denied' && (
        <button
          onClick={handleRequest}
          className="px-6 py-3 bg-[#FF6B35] text-white rounded-full font-bold"
        >
          {t(lang, 'tapToRetry')}
        </button>
      )}
    </div>
  )
}
