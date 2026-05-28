// Telegram Stars Payment Integration
// Creates invoice via Cloudflare Worker, handles fulfillment via webhook

import { getTg, getUserId } from './storage'

export async function requestPayment(
  webhookUrl: string,
  userId: number,
  purpose: string,
  price: number,
  onSuccess: () => void | Promise<void>,
  onError: (err: any) => void,
): Promise<void> {
  const tg = getTg()
  if (!tg) { onError(new Error('Not in Telegram')); return }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, purpose }),
    })
    const data = await res.json()
    if (!data.ok || !data.result) {
      onError(new Error(data.error || 'Failed to create invoice'))
      return
    }

    if ((tg as any).openInvoice) {
      (tg as any).openInvoice(data.result, (status: string) => {
        if (status === 'paid') {
          onSuccess()
        } else {
          onError(new Error(`Payment ${status}`))
        }
      })
    } else {
      // Fallback: redirect to invoice URL
      tg.openTelegramLink(data.result)
      onSuccess()
    }
  } catch (err) {
    onError(err)
  }
}

export function openInvoice(tg: any, url: string, callback?: (status: string) => void) {
  if (tg?.openInvoice) {
    tg.openInvoice(url, callback)
  } else if (tg?.openTelegramLink) {
    tg.openTelegramLink(url)
    callback?.('paid')
  }
}
