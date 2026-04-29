import { useState, useCallback } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { requestWaffoPayment, isApiSuccess } from '../api'

function getPaymentUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  if ('payment_url' in data && typeof data.payment_url === 'string') {
    return data.payment_url
  }

  return null
}

function getErrorMessage(message: string | undefined, data: unknown): string {
  if (typeof data === 'string' && data.trim()) {
    return data
  }

  return message || i18next.t('Payment request failed')
}

/**
 * Hook for handling Waffo payment processing
 */
export function useWaffoPayment() {
  const [processing, setProcessing] = useState(false)

  const processWaffoPayment = useCallback(
    async (topupAmount: number, payMethodIndex?: number) => {
      setProcessing(true)

      try {
        const response = await requestWaffoPayment({
          amount: Math.floor(topupAmount),
          pay_method_index: payMethodIndex,
        })

        if (isApiSuccess(response)) {
          const paymentUrl = getPaymentUrl(response.data)

          if (paymentUrl) {
            window.open(paymentUrl, '_blank')
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

  return { processing, processWaffoPayment }
}
