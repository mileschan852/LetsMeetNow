// Unified Storage: Telegram CloudStorage + localStorage fallback
// All keys are namespaced by Telegram user ID to prevent cross-user leakage

interface TgWebApp {
  ready: () => void
  expand: () => void
  setHeaderColor: (color: string) => void
  initData: string
  initDataUnsafe: {
    user?: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string }
  }
  CloudStorage: {
    setItem: (key: string, value: string, cb?: (err: string | null, done: boolean) => void) => void
    getItems: (keys: string[], cb: (err: string | null, result: Record<string, string>) => void) => void
  }
  openTelegramLink: (url: string) => void
  openLink: (url: string) => void
  close: () => void
  showPopup: (params: { title?: string; message: string }, cb?: () => void) => void
  requestLocation?: (callback: (location: { latitude: number; longitude: number } | null) => void) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void
  }
}

export function getTg(): TgWebApp | undefined {
  try { return (window as any).Telegram?.WebApp } catch { return undefined }
}

export function isInTelegram(): boolean {
  const tg = getTg()
  return !!(tg?.initData && tg.initData.length > 0)
}

export function getUserId(): number | null {
  return getTg()?.initDataUnsafe?.user?.id || null
}

export function getTgUser() {
  return getTg()?.initDataUnsafe?.user
}

// ─── CloudStorage ────────────────────────────────────────────────────

function cloudSet(key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tg = getTg()
    if (!tg?.CloudStorage) { resolve(false); return }
    tg.CloudStorage.setItem(key, value, (err, done) => resolve(!err && done))
  })
}

function cloudGetAll(keys: string[]): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const tg = getTg()
    if (!tg?.CloudStorage) { resolve(null); return }
    tg.CloudStorage.getItems(keys, (err, result) => {
      if (err) { console.error('CloudStorage get error:', err); resolve(null); return }
      resolve(result || {})
    })
  })
}

// ─── localStorage (namespaced by user ID) ────────────────────────────

function userKey(key: string, prefix: string): string {
  const uid = getUserId()
  return uid ? `${prefix}_${uid}_${key}` : `${prefix}_${key}`
}

export function lsSet(key: string, value: string, prefix: string) {
  const k = userKey(key, prefix)
  try { localStorage.setItem(k, value) } catch {}
}

export function lsGet(key: string, prefix: string): string | null {
  const k = userKey(key, prefix)
  try { return localStorage.getItem(k) } catch { return null }
}

export function lsGetAll(prefix: string): Record<string, string> {
  const r: Record<string, string> = {}
  const uid = getUserId()
  const pfx = uid ? `${prefix}_${uid}_` : `${prefix}_`
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(pfx)) {
        const shortKey = k.replace(pfx, '')
        r[shortKey] = localStorage.getItem(k) || ''
      }
    })
  } catch {}
  return r
}

// ─── Unified Storage ─────────────────────────────────────────────────
// Writes to BOTH CloudStorage and localStorage. Reads from CloudStorage first.

export function makeStorage(prefix: string) {
  return {
    async set(key: string, value: string): Promise<void> {
      lsSet(key, value, prefix)
      const k = userKey(key, prefix)
      await cloudSet(k, value)
    },
    async get(key: string): Promise<string | null> {
      const k = userKey(key, prefix)
      const cloud = await cloudGetAll([k])
      if (cloud && cloud[k]) return cloud[k]
      return lsGet(key, prefix)
    },
    async getAll(keys: string[]): Promise<Record<string, string>> {
      const prefixed = keys.map(k => userKey(k, prefix))
      const cloud = await cloudGetAll(prefixed)
      const ls = lsGetAll(prefix)
      const uid = getUserId()
      const unPrefixed: Record<string, string> = {}
      if (cloud && uid) {
        Object.entries(cloud).forEach(([k, v]) => {
          const shortKey = k.replace(`${prefix}_${uid}_`, '')
          unPrefixed[shortKey] = v
        })
      }
      return { ...ls, ...unPrefixed }
    },
    remove(key: string) {
      const k = userKey(key, prefix)
      try { localStorage.removeItem(k) } catch {}
    },
  }
}

