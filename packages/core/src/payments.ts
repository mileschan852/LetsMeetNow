// ─── Payments ───────────────────────────────────────────────────────
// Telegram Stars payment handlers

import { getTg } from './storage'
import type { PaymentPurpose } from './types'

export interface InvoiceResult {
  ok: boolean
  result?: string      // invoice_url
  error?: string
}

export async function createInvoice(
  webhookUrl: string,
  userId: number,
  purpose: PaymentPurpose,
  amount: number
): Promise<InvoiceResult> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, purpose, amount }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    return { ok: data.ok, result: data.result || data.invoice_url, error: data.error }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export function openInvoice(url: string, onPaid?: () => void, onFailed?: () => void): void {
  const tg = getTg() as any
  if (!tg?.openInvoice) {
    onFailed?.()
    return
  }
  tg.openInvoice(url, (status: string) => {
    if (status === 'paid') {
      onPaid?.()
    } else {
      onFailed?.()
    }
  })
}

export async function requestPayment(
  webhookUrl: string,
  userId: number,
  purpose: PaymentPurpose,
  amount: number,
  onSuccess?: () => void | Promise<void>,
  onError?: (err: string) => void
): Promise<void> {
  const invoice = await createInvoice(webhookUrl, userId, purpose, amount)
  if (!invoice.ok || !invoice.result) {
    onError?.(invoice.error || 'Failed to create invoice')
    return
  }
  openInvoice(invoice.result, onSuccess, () => onError?.('Payment cancelled or failed'))
}

// ─── Payment Item Catalog ───────────────────────────────────────────

export interface CatalogItem {
  purpose: PaymentPurpose
  amount: number
  title: Record<string, string>
  description: Record<string, string>
  durationDays?: number
}

export const PAYMENT_CATALOG: CatalogItem[] = [
  {
    purpose: 'grid',
    amount: 100,
    title: { en: 'Grid Row Unlock', tc: '解鎖行數', sc: '解锁行数' },
    description: { en: 'Unlock 5 more grid rows', tc: '解鎖多5行', sc: '解锁多5行' },
  },
  {
    purpose: 'filters',
    amount: 300,
    title: { en: 'Filter Unlock', tc: '解鎖篩選', sc: '解锁筛选' },
    description: { en: 'Unlock advanced filters for 30 days', tc: '解鎖進階篩選30天', sc: '解锁进阶筛选30天' },
    durationDays: 30,
  },
  {
    purpose: 'invisible',
    amount: 2000,
    title: { en: 'Invisible Mode', tc: '隱形模式', sc: '隐形模式' },
    description: { en: 'Browse invisibly for 30 days', tc: '隱形瀏覽30天', sc: '隐形浏览30天' },
    durationDays: 30,
  },
  {
    purpose: 'raffle',
    amount: 50,
    title: { en: 'Raffle Ticket', tc: '抽獎券', sc: '抽奖券' },
    description: { en: 'Enter the raffle draw', tc: '參加抽獎', sc: '参加抽奖' },
  },
  {
    purpose: 'boost',
    amount: 500,
    title: { en: 'Profile Boost', tc: '提升曝光', sc: '提升曝光' },
    description: { en: 'Boost your profile for 7 days', tc: '提升曝光7天', sc: '提升曝光7天' },
    durationDays: 7,
  },
]
