import { useState, useCallback } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { requestWaffoPancakePayment, isApiSuccess } from '../api'

function getCheckoutUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  if ('checkout_url' in data && typeof data.checkout_url === 'string') {
    return data.checkout_url
  }

  return null
}

/**
 * Reject non-navigable schemes (e.g. javascript:, data:) and relative URLs.
 * Only http/https are allowed for backend-provided redirect targets.
 */
function isSafeHttpCheckoutUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  try {
    const u = new URL(trimmed)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function getErrorMessage(message: string | undefined, data: unknown): string {
  if (typeof data === 'string' && data.trim()) {
    return data
  }

  return message || i18next.t('Payment request failed')
}

/**
 * Hook for handling Waffo Pancake payment processing
 *
 * Pancake uses a hosted checkout URL flow rather than the generic epay form
 * submission, so we open the returned URL in a new tab once the backend
 * returns a successful response.
 */
export function useWaffoPancakePayment() {
  const [processing, setProcessing] = useState(false)

  const processWaffoPancakePayment = useCallback(
    async (topupAmount: number) => {
      setProcessing(true)

      try {
        const response = await requestWaffoPancakePayment({
          amount: Math.floor(topupAmount),
        })

        if (isApiSuccess(response)) {
          const checkoutUrl = getCheckoutUrl(response.data)

          if (checkoutUrl) {
            if (!isSafeHttpCheckoutUrl(checkoutUrl)) {
              toast.error(i18next.t('Invalid payment redirect URL'))
              return false
            }
            window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        toast.error(getErrorMessage(response.message, response.data))
        return false
      } catch (_error) {
        toast.error(i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  return { processing, processWaffoPancakePayment }
}
