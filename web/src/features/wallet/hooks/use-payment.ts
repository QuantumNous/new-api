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
import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'
import { openPaymentWindow } from '@/lib/payment-window'

import { createAntomPayment, quoteAntom } from '../antom'
import {
  calculateAmount,
  calculateAlipayAmount,
  calculateWechatPayAmount,
  requestWechatPayPayment,
  type WechatPayCheckout,
  requestAlipayPayment,
  calculateStripeAmount,
  calculateWaffoAmount,
  calculateWaffoPancakeAmount,
  requestPayment,
  requestStripePayment,
  isApiSuccess,
} from '../api'
import {
  isStripePayment,
  isWaffoPayment,
  isWaffoPancakePayment,
  submitPaymentForm,
} from '../lib'
import { createMixPayPayment, quoteMixPay } from '../mixpay'
import type { AmountRequest, AmountResponse } from '../types'
import { createWebMoneyPayment, quoteWebMoney } from '../webmoney'

// ============================================================================
// Payment Hook
// ============================================================================

type AmountCalculator = (request: AmountRequest) => Promise<AmountResponse>

export interface PaymentAmountCalculators {
  wechatpay?: AmountCalculator
  alipay?: AmountCalculator
  regular: AmountCalculator
  stripe: AmountCalculator
  waffo: AmountCalculator
  waffoPancake: AmountCalculator
}

const defaultPaymentAmountCalculators: PaymentAmountCalculators = {
  alipay: calculateAlipayAmount,
  wechatpay: calculateWechatPayAmount,
  regular: calculateAmount,
  stripe: calculateStripeAmount,
  waffo: calculateWaffoAmount,
  waffoPancake: calculateWaffoPancakeAmount,
}

export async function requestPaymentAmount(
  topupAmount: number,
  paymentType: string,
  calculators: PaymentAmountCalculators = defaultPaymentAmountCalculators
): Promise<number> {
  if (paymentType === 'antom')
    {return Number((await quoteAntom(topupAmount)).data)}
  if (paymentType === 'webmoney') {
    return Number((await quoteWebMoney(topupAmount)).data)
  }
  if (paymentType === 'mixpay') {
    return Number((await quoteMixPay(topupAmount)).data)
  }
  let calculator = calculators.regular
  if (paymentType === 'wechatpay_native') {
    calculator = calculators.wechatpay || calculateWechatPayAmount
  } else if (paymentType === 'alipay_direct') {
    calculator = calculators.alipay || calculateAlipayAmount
  } else if (isStripePayment(paymentType)) {
    calculator = calculators.stripe
  } else if (isWaffoPayment(paymentType)) {
    calculator = calculators.waffo
  } else if (isWaffoPancakePayment(paymentType)) {
    calculator = calculators.waffoPancake
  }

  const response = await calculator({ amount: topupAmount })
  if (!isApiSuccess(response) || !response.data) {
    return 0
  }

  return Number.parseFloat(response.data)
}

export function usePayment() {
  const [antomTradeNo, setAntomTradeNo] = useState<string | null>(null)
  const [webmoneyTradeNo, setWebmoneyTradeNo] = useState<string | null>(null)
  const [mixpayTradeNo, setMixpayTradeNo] = useState<string | null>(null)
  const mixpayRequest = useRef<{ amount: number; key: string } | null>(null)
  const [wechatCheckout, setWechatCheckout] =
    useState<WechatPayCheckout | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [calculating, setCalculating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const latestCalculationRef = useRef(0)

  // Calculate payment amount
  const calculatePaymentAmount = useCallback(
    async (topupAmount: number, paymentType: string) => {
      const calculationId = latestCalculationRef.current + 1
      latestCalculationRef.current = calculationId
      try {
        setCalculating(true)
        const calculatedAmount = await requestPaymentAmount(
          topupAmount,
          paymentType
        )
        if (latestCalculationRef.current === calculationId) {
          setAmount(calculatedAmount)
        }
        return calculatedAmount
      } catch {
        if (latestCalculationRef.current === calculationId) {
          setAmount(0)
        }
        return 0
      } finally {
        if (latestCalculationRef.current === calculationId) {
          setCalculating(false)
        }
      }
    },
    []
  )

  // Process payment
  const processPayment = useCallback(
    async (
      topupAmount: number,
      paymentType: string,
      expectedAmount?: number
    ) => {
      try {
        setProcessing(true)

        if (['mixpay', 'webmoney', 'antom'].includes(paymentType)) {
          if (
            !mixpayRequest.current ||
            mixpayRequest.current.amount !== topupAmount
          ) {
            mixpayRequest.current = {
              amount: topupAmount,
              key: crypto.randomUUID(),
            }
          }
          let createPayment = createMixPayPayment
          if (paymentType === 'antom') { createPayment = createAntomPayment }
          else if (paymentType === 'webmoney') { createPayment = createWebMoneyPayment }
          const checkout = await createPayment(
            Math.floor(topupAmount),
            (expectedAmount ?? amount).toFixed(2),
            mixpayRequest.current.key
          )
          if (paymentType === 'antom') setAntomTradeNo(checkout.trade_no)
          else if (paymentType === 'webmoney')
            {setWebmoneyTradeNo(checkout.trade_no)}
          else setMixpayTradeNo(checkout.trade_no)
          mixpayRequest.current = null
          return true
        }
        const isStripe = isStripePayment(paymentType)
        const quotaAmount = Math.floor(topupAmount)
        if (paymentType === 'wechatpay_native') {
          const response = await requestWechatPayPayment(
            quotaAmount,
            (expectedAmount ?? amount).toFixed(2)
          )
          if (!isApiSuccess(response) || !response.data?.code_url) {
            handleServerError(response, i18next.t('Payment request failed'))
            return false
          }
          setWechatCheckout(response.data)
          return true
        }
        if (paymentType === 'alipay_direct') {
          const response = await requestAlipayPayment(
            quotaAmount,
            (expectedAmount ?? amount).toFixed(2)
          )
          if (!isApiSuccess(response) || !response.data?.pay_link) {
            handleServerError(response, i18next.t('Payment request failed'))
            return false
          }
          // Non-secret order reference; only the authenticated status API can confirm payment.
          try {
            sessionStorage.setItem(
              'alipay-pending-order',
              response.data.trade_no
            )
          } catch {
            /* Storage may be unavailable in private browsing. */
          }
          openPaymentWindow(response.data.pay_link)
          return true
        }

        const response = isStripe
          ? await requestStripePayment({
              amount: quotaAmount,
              payment_method: 'stripe',
            })
          : await requestPayment({
              amount: quotaAmount,
              payment_method: paymentType,
            })

        if (!isApiSuccess(response)) {
          handleServerError(response, i18next.t('Payment request failed'))
          return false
        }

        // Handle Stripe payment
        if (isStripe && response.data?.pay_link) {
          if (openPaymentWindow(response.data.pay_link as string)) {
            toast.success(i18next.t('Redirecting to payment page...'))
          }
          return true
        }

        // Handle non-Stripe payment
        if (!isStripe && response.data) {
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
    [amount]
  )

  return {
    antomTradeNo,
    setAntomTradeNo,
    webmoneyTradeNo,
    setWebmoneyTradeNo,
    mixpayTradeNo,
    setMixpayTradeNo,
    wechatCheckout,
    setWechatCheckout,
    amount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
    setAmount,
  }
}
