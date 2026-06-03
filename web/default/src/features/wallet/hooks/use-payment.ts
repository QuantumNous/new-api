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
  calculateAlipayAmount,
  calculateStripeAmount,
  calculateWechatAmount,
  calculateWaffoPancakeAmount,
  requestAlipayPayment,
  requestPayment,
  requestStripePayment,
  requestWechatPayment,
  isApiSuccess,
} from '../api'
import {
  isAlipayPayment,
  isStripePayment,
  isWechatPayment,
  isWaffoPancakePayment,
  submitPaymentForm,
} from '../lib'

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
        const isAlipay = isAlipayPayment(paymentType)
        const isWechat = isWechatPayment(paymentType)
        const response = isStripe
          ? await calculateStripeAmount({ amount: topupAmount })
          : isPancake
            ? await calculateWaffoPancakeAmount({ amount: topupAmount })
            : isAlipay
              ? await calculateAlipayAmount({ amount: topupAmount })
              : isWechat
                ? await calculateWechatAmount({ amount: topupAmount })
                : await calculateAmount({ amount: topupAmount })

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
        const isAlipay = isAlipayPayment(paymentType)
        const isWechat = isWechatPayment(paymentType)
        const amount = Math.floor(topupAmount)

        const response = isStripe
          ? await requestStripePayment({
              amount,
              payment_method: 'stripe',
            })
          : isAlipay
            ? await requestAlipayPayment({ amount, payment_method: paymentType })
            : isWechat
              ? await requestWechatPayment({ amount, payment_method: paymentType })
              : await requestPayment({
                  amount,
                  payment_method: paymentType,
                })

        if (!isApiSuccess(response)) {
          toast.error(response.message || i18next.t('Payment request failed'))
          return false
        }

        // Handle Stripe payment
        if (isStripe) {
          const data = response.data as { pay_link?: string } | undefined
          if (data?.pay_link) {
            window.open(data.pay_link, '_blank')
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        if (isAlipay) {
          const data = response.data as { pay_url?: string } | undefined
          if (data?.pay_url) {
            window.open(data.pay_url, '_blank')
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        if (isWechat && response.data) {
          const h5Url = (response.data as { h5_url?: string }).h5_url
          const codeUrl = (response.data as { code_url?: string }).code_url
          if (h5Url) {
            window.open(h5Url, '_blank')
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
          if (codeUrl) {
            window.open(codeUrl, '_blank')
            toast.success(i18next.t('WeChat payment QR code opened'))
            return true
          }
        }

        // Handle non-Stripe payment
        if (!isStripe && !isAlipay && !isWechat && response.data) {
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
