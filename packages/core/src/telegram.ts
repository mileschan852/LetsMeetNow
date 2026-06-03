// Shared Telegram WebApp helpers for HKMOD & LMN

export interface TgWebApp {
  ready: () => void
  expand: () => void
  setHeaderColor: (color: string) => void
  openTelegramLink: (url: string) => void
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      photo_url?: string
      is_premium?: boolean
    }
    chat?: {
      id: number
      type: 'private' | 'group' | 'supergroup' | 'channel'
      title?: string
      username?: string
    }
    chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel'
    chat_instance?: string
    start_param?: string
  }
  version: string
  platform: string
  openInvoice: (url: string, callback?: (status: string) => void) => void
  requestLocation: (callback: (location: { latitude: number; longitude: number } | null) => void) => void
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text: string }> }, callback?: (buttonId: string) => void) => void
  CloudStorage: {
    setItem: (key: string, value: string, cb?: (err: string | null, done: boolean) => void) => void
    getItems: (keys: string[], cb: (err: string | null, result: Record<string, string>) => void) => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

export function getTg(): TgWebApp | undefined {
  try { return window.Telegram?.WebApp } catch { return undefined }
}

export function isInTelegram(): boolean {
  return !!getTg()?.initData
}

export function getUserId(): number | null {
  return getTg()?.initDataUnsafe?.user?.id || null
}

export function getUsername(): string | undefined {
  return getTg()?.initDataUnsafe?.user?.username
}

// Admin check with configurable lists
export function isAdminUser(
  user: { id?: number; username?: string } | null | undefined,
  adminIds: number[] = [],
  adminUsernames: string[] = []
): boolean {
  if (!user) return false
  if (user.id && adminIds.includes(user.id)) return true
  if (user.username && adminUsernames.includes(user.username)) return true
  return false
}

// Telegram CloudStorage
export function cloudSet(key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tg = getTg()
    if (!tg?.CloudStorage) { resolve(false); return }
    tg.CloudStorage.setItem(key, value, (err, done) => {
      if (err) console.error('CloudStorage set error:', key, err)
      resolve(!err && done)
    })
  })
}

export function cloudGetAll(keys: string[]): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const tg = getTg()
    if (!tg?.CloudStorage) { resolve(null); return }
    tg.CloudStorage.getItems(keys, (err, result) => {
      if (err) { console.error('CloudStorage get error:', err); resolve(null); return }
      resolve(result || {})
    })
  })
}

// localStorage helpers with user ID prefix
export function userKey(key: string): string {
  const uid = getUserId()
  return uid ? `${key}_${uid}` : key
}

export function lsSet(key: string, value: string) {
  try { localStorage.setItem(userKey(key), value) } catch {}
}

export function lsGet(key: string): string | null {
  try { return localStorage.getItem(userKey(key)) } catch { return null }
}

export function lsGetAll(): Record<string, string> {
  try {
    const prefix = userKey('')
    const result: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) result[k] = localStorage.getItem(k) || ''
    }
    return result
  } catch { return {} }
}
