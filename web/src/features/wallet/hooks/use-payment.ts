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

import {
  calculateAmount,
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
}

export interface PaymentQuote {
  paymentType: string
  topupAmount: number
  amount?: number
  currency?: string
  status: 'loading' | 'ready' | 'error'
}

export interface PaymentAmountResult {
  amount: number
  currency?: string
}

function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value)
}

const defaultPaymentAmountCalculators: PaymentAmountCalculators = {
  regular: calculateAmount,
  stripe: calculateStripeAmount,
  waffo: calculateWaffoAmount,
  waffoPancake: calculateWaffoPancakeAmount,
}

export function getPaymentQuoteKey(paymentType: string, topupAmount: number) {
  return `${paymentType}:${topupAmount}`
}

export async function requestPaymentAmount(
  topupAmount: number,
  paymentType: string,
  calculators: PaymentAmountCalculators = defaultPaymentAmountCalculators
): Promise<PaymentAmountResult> {
  let calculator = calculators.regular
  const isStripe = isStripePayment(paymentType)
  const isWaffoPancake = isWaffoPancakePayment(paymentType)
  const requiresProviderCurrency = isStripe || isWaffoPancake
  if (isStripe) {
    calculator = calculators.stripe
  } else if (isWaffoPayment(paymentType)) {
    calculator = calculators.waffo
  } else if (isWaffoPancake) {
    calculator = calculators.waffoPancake
  }

  const response = await calculator({ amount: topupAmount })
  const amount = Number(response.data)
  const currency = requiresProviderCurrency ? response.currency : undefined
  if (
    !isApiSuccess(response) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    (requiresProviderCurrency && !isCurrencyCode(currency))
  ) {
    throw new Error(response.message || 'Payment amount calculation failed')
  }

  return { amount, currency }
}

export interface PaymentQuoteController {
  getQuote: (
    topupAmount: number,
    paymentType: string
  ) => PaymentQuote | undefined
  calculate: (topupAmount: number, paymentType: string) => Promise<PaymentQuote>
}

export function createPaymentQuoteController(
  calculators: PaymentAmountCalculators = defaultPaymentAmountCalculators
): PaymentQuoteController {
  const quotes: Record<string, PaymentQuote> = {}
  const requestIds: Record<string, number> = {}
  const inFlightRequests: Record<string, Promise<PaymentQuote>> = {}

  const getQuote = (topupAmount: number, paymentType: string) =>
    quotes[getPaymentQuoteKey(paymentType, topupAmount)]

  const calculate = (topupAmount: number, paymentType: string) => {
    const key = getPaymentQuoteKey(paymentType, topupAmount)
    const cachedQuote = quotes[key]
    if (cachedQuote?.status === 'ready') {
      return Promise.resolve(cachedQuote)
    }

    const inFlightRequest = inFlightRequests[key]
    if (inFlightRequest) {
      return inFlightRequest
    }

    const requestId = (requestIds[key] || 0) + 1
    requestIds[key] = requestId
    quotes[key] = { paymentType, topupAmount, status: 'loading' }

    const request = requestPaymentAmount(topupAmount, paymentType, calculators)
      .then(({ amount, currency }) => {
        const quote: PaymentQuote = {
          paymentType,
          topupAmount,
          amount,
          ...(currency ? { currency } : {}),
          status: 'ready',
        }
        if (requestIds[key] === requestId) {
          quotes[key] = quote
        }
        return quote
      })
      .catch(() => {
        const quote: PaymentQuote = {
          paymentType,
          topupAmount,
          status: 'error',
        }
        if (requestIds[key] === requestId) {
          quotes[key] = quote
        }
        return quote
      })
      .finally(() => {
        if (requestIds[key] === requestId) {
          delete inFlightRequests[key]
        }
      })

    inFlightRequests[key] = request
    return request
  }

  return { getQuote, calculate }
}

export function canConfirmPayment(
  paymentMethod: { type: string } | undefined,
  topupAmount: number,
  minimumTopup: number,
  quote: PaymentQuote | undefined
): boolean {
  return (
    !!paymentMethod &&
    topupAmount >= minimumTopup &&
    quote?.status === 'ready' &&
    quote.paymentType === paymentMethod.type &&
    quote.topupAmount === topupAmount
  )
}

export function usePayment(
  calculators: PaymentAmountCalculators = defaultPaymentAmountCalculators
) {
  const controllerRef = useRef<PaymentQuoteController | null>(null)
  const calculatorsRef = useRef(calculators)
  if (!controllerRef.current || calculatorsRef.current !== calculators) {
    calculatorsRef.current = calculators
    controllerRef.current = createPaymentQuoteController(calculators)
  }
  const controller = controllerRef.current
  const [quotes, setQuotes] = useState<Record<string, PaymentQuote>>({})
  const [processing, setProcessing] = useState(false)

  const calculatePaymentAmount = useCallback(
    async (topupAmount: number, paymentType: string) => {
      const request = controller.calculate(topupAmount, paymentType)
      const loadingQuote = controller.getQuote(topupAmount, paymentType)
      if (loadingQuote) {
        setQuotes((currentQuotes) => ({
          ...currentQuotes,
          [getPaymentQuoteKey(paymentType, topupAmount)]: loadingQuote,
        }))
      }
      const quote = await request
      setQuotes((currentQuotes) => ({
        ...currentQuotes,
        [getPaymentQuoteKey(paymentType, topupAmount)]: quote,
      }))
      return quote
    },
    [controller]
  )

  const getPaymentQuote = useCallback(
    (topupAmount: number, paymentType: string) => {
      const key = getPaymentQuoteKey(paymentType, topupAmount)
      return quotes[key] ?? controller.getQuote(topupAmount, paymentType)
    },
    [controller, quotes]
  )

  // Process payment
  const processPayment = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setProcessing(true)

        const isStripe = isStripePayment(paymentType)
        const amount = Math.floor(topupAmount)

        const response = isStripe
          ? await requestStripePayment({
              amount,
              payment_method: 'stripe',
            })
          : await requestPayment({
              amount,
              payment_method: paymentType,
            })

        if (!isApiSuccess(response)) {
          toast.error(response.message || i18next.t('Payment request failed'))
          return false
        }

        if (isStripe && response.data?.pay_link) {
          window.open(response.data.pay_link as string, '_blank')
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        if (!isStripe && response.data) {
          const url = (response as unknown as { url?: string }).url
          if (url) {
            submitPaymentForm(url, response.data)
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        return false
      } catch {
        toast.error(i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  return {
    quotes,
    processing,
    calculatePaymentAmount,
    getPaymentQuote,
    processPayment,
  }
}
