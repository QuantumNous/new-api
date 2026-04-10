import { useState, useCallback } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { requestCreemPayment, isApiSuccess } from '../api'

/**
 * Hook for handling Creem payment processing
 */
export function useCreemPayment() {
  const [processing, setProcessing] = useState(false)

  const processCreemPayment = useCallback(async (productId: string) => {
    setProcessing(true)
    try {
      const response = await requestCreemPayment({
        product_id: productId,
        payment_method: 'creem',
      })

      if (isApiSuccess(response) && response.data?.checkout_url) {
        window.open(response.data.checkout_url, '_blank')
        toast.success(i18next.t('Redirecting to Creem checkout...'))
        return true
      }

      toast.error(response.message || i18next.t('Payment request failed'))
      return false
    } catch (_error) {
      toast.error(i18next.t('Payment request failed'))
      return false
    } finally {
      setProcessing(false)
    }
  }, [])

  return { processing, processCreemPayment }
}
