// ─── Storage ────────────────────────────────────────────────────────
// Unified localStorage wrapper with namespacing

export function makeStorage(appKey: string) {
  const prefix = `dating_${appKey}_`

  return {
    get(key: string): string | null {
      return localStorage.getItem(`${prefix}${key}`)
    },
    set(key: string, value: string): void {
      localStorage.setItem(`${prefix}${key}`, value)
    },
    remove(key: string): void {
      localStorage.removeItem(`${prefix}${key}`)
    },
    clear(): void {
      Object.keys(localStorage)
        .filter(k => k.startsWith(prefix))
        .forEach(k => localStorage.removeItem(k))
    },
  }
}

// ─── Telegram WebApp Bridge ─────────────────────────────────────────

export interface TgWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      photo_url?: string
    }
    query_id?: string
    start_param?: string
  }
  openInvoice: (url: string, callback?: (status: string) => void) => void
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    setText: (text: string) => void
    onClick: (fn: () => void) => void
    show: () => void
    hide: () => void
  }
  BackButton: {
    onClick: (fn: () => void) => void
    show: () => void
    hide: () => void
  }
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
  isVersionAtLeast: (version: string) => boolean
  platform: string
  version: string
  colorScheme: 'light' | 'dark'
}

let _tg: TgWebApp | null = null

export function getTg(): TgWebApp | null {
  if (!_tg) {
    const tg = (window as any).Telegram?.WebApp
    if (tg) {
      tg.ready?.()
      tg.expand?.()
      _tg = tg as TgWebApp
    }
  }
  return _tg
}

export function getUserId(): number | null {
  return getTg()?.initDataUnsafe?.user?.id ?? null
}

export function getTgUser(): TgWebApp['initDataUnsafe']['user'] | null {
  return getTg()?.initDataUnsafe?.user ?? null
}
