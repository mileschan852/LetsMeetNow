import { useState } from 'react'
import type { Lang, PaymentPurpose } from 'dating-core/types'
import { requestPayment } from 'dating-core/payments'

export interface PaymentButtonProps {
  webhookUrl: string
  userId: number
  purpose: PaymentPurpose
  amount: number
  lang: Lang
  title: string
  description?: string
  disabled?: boolean
  onSuccess?: () => void | Promise<void>
  onError?: (err: string) => void
  children?: React.ReactNode
  className?: string
}

export function PaymentButton({
  webhookUrl,
  userId,
  purpose,
  amount,
  title,
  disabled,
  onSuccess,
  onError,
  children,
  className,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading || disabled) return
    setLoading(true)
    await requestPayment(webhookUrl, userId, purpose, amount, onSuccess, onError)
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50 ${className || ''}`}
    >
      {loading ? (
        <span className="animate-pulse">Processing...</span>
      ) : (
        children || (
          <>
            <span>⭐</span>
            <span>{title}</span>
            <span className="opacity-60">({amount})</span>
          </>
        )
      )}
    </button>
  )
}
