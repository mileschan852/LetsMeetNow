import { useCallback } from 'react'
import { getTg, getUserId } from './storage'

export interface PaymentUnlockOptions {
  isAdmin: boolean
  workerUrl: string
  amount: number
  purpose: string
  onAdminUnlock: () => void
  onPaymentSuccess: () => void
  onError?: (err: any) => void
}

export function usePaymentUnlock({
  isAdmin,
  workerUrl,
  amount,
  purpose,
  onAdminUnlock,
  onPaymentSuccess,
  onError,
}: PaymentUnlockOptions) {
  return useCallback(async () => {
    if (isAdmin) {
      onAdminUnlock()
      return
    }

    const userId = getUserId()
    if (!userId) {
      onError?.(new Error('Not logged in'))
      return
    }

    const tg = getTg()
    if (!tg) {
      onError?.(new Error('Not in Telegram'))
      return
    }

    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount, purpose }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      const data = await res.json()
      if (data.ok && data.invoice_url && tg.openInvoice) {
        tg.openInvoice(data.invoice_url, async (status: string) => {
          if (status === 'paid') {
            onPaymentSuccess()
          } else {
            onError?.(new Error(`Payment ${status}`))
          }
        })
      } else {
        onError?.(new Error(data.error || 'Failed to create invoice'))
      }
    } catch (err) {
      onError?.(err)
    }
  }, [isAdmin, workerUrl, amount, purpose, onAdminUnlock, onPaymentSuccess, onError])
}

export async function requestPayment(
  webhookUrl: string,
  userId: number,
  purpose: string,
  _price: number,
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
