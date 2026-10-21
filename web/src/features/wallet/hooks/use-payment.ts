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
import i18next from 'i18next'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'

import {
  calculateAmount,
  calculateAlipayAmount,
  calculateStripeAmount,
  calculateWaffoAmount,
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
  isWaffoPayment,
  isWechatPayment,
  isWaffoPancakePayment,
  submitPaymentForm,
} from '../lib'
import type { AmountRequest, AmountResponse } from '../types'

// ============================================================================
// Payment Hook
// ============================================================================

type AmountCalculator = (request: AmountRequest) => Promise<AmountResponse>

export interface PaymentAmountCalculators {
  regular: AmountCalculator
  stripe: AmountCalculator
  waffo: AmountCalculator
  waffoPancake: AmountCalculator
  alipay: AmountCalculator
  wechat: AmountCalculator
}

const defaultPaymentAmountCalculators: PaymentAmountCalculators = {
  regular: calculateAmount,
  stripe: calculateStripeAmount,
  waffo: calculateWaffoAmount,
  waffoPancake: calculateWaffoPancakeAmount,
  alipay: calculateAlipayAmount,
  wechat: calculateWechatAmount,
}

export async function requestPaymentAmount(
  topupAmount: number,
  paymentType: string,
  calculators: PaymentAmountCalculators = defaultPaymentAmountCalculators
): Promise<number> {
  let calculator = calculators.regular
  if (isStripePayment(paymentType)) {
    calculator = calculators.stripe
  } else if (isWaffoPayment(paymentType)) {
    calculator = calculators.waffo
  } else if (isWaffoPancakePayment(paymentType)) {
    calculator = calculators.waffoPancake
  } else if (isAlipayPayment(paymentType)) {
    calculator = calculators.alipay
  } else if (isWechatPayment(paymentType)) {
    calculator = calculators.wechat
  }

  const response = await calculator({ amount: topupAmount })
  if (!isApiSuccess(response) || !response.data) {
    return 0
  }

  return Number.parseFloat(response.data)
}

export function usePayment() {
  const [amount, setAmount] = useState<number>(0)
  const [calculating, setCalculating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [wechatCodeUrl, setWechatCodeUrl] = useState('')

  // Calculate payment amount
  const calculatePaymentAmount = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setCalculating(true)

        const calculatedAmount = await requestPaymentAmount(
          topupAmount,
          paymentType
        )
        setAmount(calculatedAmount)
        return calculatedAmount
      } catch {
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
            ? await requestAlipayPayment({
                amount,
                payment_method: paymentType,
              })
            : isWechat
              ? await requestWechatPayment({
                  amount,
                  payment_method: paymentType,
                })
              : await requestPayment({
                  amount,
                  payment_method: paymentType,
                })

        if (!isApiSuccess(response)) {
          handleServerError(response, i18next.t('Payment request failed'))
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
            setWechatCodeUrl(codeUrl)
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
      } catch (error) {
        handleServerError(error, i18next.t('Payment request failed'))
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
    wechatCodeUrl,
    setWechatCodeUrl,
  }
}
