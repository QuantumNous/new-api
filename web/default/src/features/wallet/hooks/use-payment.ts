/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState, useCallback } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import {
  calculateAmount,
  calculateStripeAmount,
  calculateWaffoPancakeAmount,
  calculateYooKassaAmount,
  requestPayment,
  requestStripePayment,
  requestYooKassaPayment,
  isApiSuccess,
} from '../api'
import {
  isStripePayment,
  isWaffoPancakePayment,
  isYooKassaPayment,
  submitPaymentForm,
} from '../lib'

function getStringField(data: unknown, field: string): string | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const value = (data as Record<string, unknown>)[field]
  return typeof value === 'string' && value.trim() ? value : null
}

function isSafeHttpRedirectUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// ============================================================================
// Payment Hook
// ============================================================================

export function usePayment() {
  const [amount, setAmount] = useState<number>(0)
  const [calculating, setCalculating] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Calculate payment amount
  const calculatePaymentAmount = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setCalculating(true)

        const isStripe = isStripePayment(paymentType)
        const isPancake = isWaffoPancakePayment(paymentType)
        const isYooKassa = isYooKassaPayment(paymentType)
        let response
        if (isStripe) {
          response = await calculateStripeAmount({ amount: topupAmount })
        } else if (isPancake) {
          response = await calculateWaffoPancakeAmount({ amount: topupAmount })
        } else if (isYooKassa) {
          response = await calculateYooKassaAmount({ amount: topupAmount })
        } else {
          response = await calculateAmount({ amount: topupAmount })
        }

        if (isApiSuccess(response) && response.data) {
          const calculatedAmount = parseFloat(response.data)
          setAmount(calculatedAmount)
          return calculatedAmount
        }

        // Don't show error for calculation, just set to 0
        setAmount(0)
        return 0
      } catch (_error) {
        setAmount(0)
        return 0
      } finally {
        setCalculating(false)
      }
    },
    []
  )

  // Process payment
  const processPayment = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setProcessing(true)

        const isStripe = isStripePayment(paymentType)
        const isYooKassa = isYooKassaPayment(paymentType)
        let response
        if (isStripe) {
          response = await requestStripePayment({
            amount: topupAmount,
            payment_method: 'stripe',
          })
        } else if (isYooKassa) {
          response = await requestYooKassaPayment({
            amount: Math.floor(topupAmount),
            payment_method: 'yookassa_sbp',
          })
        } else {
          response = await requestPayment({
            amount: topupAmount,
            payment_method: paymentType,
          })
        }

        if (!isApiSuccess(response)) {
          toast.error(response.message || i18next.t('Payment request failed'))
          return false
        }

        // Handle Stripe payment
        const payLink = getStringField(response.data, 'pay_link')
        if (isStripe && payLink) {
          window.open(payLink, '_blank')
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        const confirmationUrl = getStringField(
          response.data,
          'confirmation_url'
        )
        if (isYooKassa && confirmationUrl) {
          if (!isSafeHttpRedirectUrl(confirmationUrl)) {
            toast.error(i18next.t('Invalid payment redirect URL'))
            return false
          }
          window.location.href = confirmationUrl
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        // Handle non-Stripe payment
        if (!isStripe && !isYooKassa && response.data) {
          const url = (response as unknown as { url?: string }).url
          if (url) {
            submitPaymentForm(url, response.data)
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

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

  return {
    amount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
    setAmount,
  }
}
