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
import { getGAMeasurementIdentifiers } from '@/lib/analytics/gtag'
import {
  calculateAmount,
  calculatePaddleAmount,
  calculateStripeAmount,
  calculateWaffoPancakeAmount,
  requestPayment,
  requestPaddlePayment,
  requestStripePayment,
  isApiSuccess,
} from '../api'
import {
  isStripePayment,
  isPaddlePayment,
  isWaffoPancakePayment,
  submitPaymentForm,
  buildPaddleWalletCheckoutUrlWithOrder,
  rememberPaddleCheckoutUrlFallback,
  buildStripePaymentRequest,
} from '../lib'
import type {
  ApiResponse,
  PaddlePaymentResponse,
  PaymentOptions,
} from '../types'
import type { StripeEmbeddedCheckoutSession } from '../components/dialogs/stripe-embedded-checkout-dialog'

// ============================================================================
// Payment Hook
// ============================================================================

function getPaymentErrorMessage(response: ApiResponse): string {
  if (typeof response.data === 'string' && response.data.trim()) {
    return i18next.t(response.data)
  }

  if (response.message && response.message !== 'error') {
    return i18next.t(response.message)
  }

  return i18next.t('Payment request failed')
}

function getObjectData(data: unknown): Record<string, unknown> | null {
  return data && typeof data === 'object'
    ? (data as Record<string, unknown>)
    : null
}

function getStringField(
  data: Record<string, unknown> | null,
  key: string
): string | undefined {
  const value = data?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function navigateToPaymentPage(url: string): void {
  window.location.assign(url)
  toast.success(i18next.t('Redirecting to payment page...'))
}

function getStripeRedirectUrls(): { success_url: string; cancel_url: string } {
  return {
    success_url: new URL('/wallet?show_history=true', window.location.origin)
      .href,
    cancel_url: new URL('/wallet', window.location.origin).href,
  }
}

function normalizeCheckoutUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined
  }

  const normalizedUrl = url.trim()
  const isAbsoluteHttpUrl = /^https?:\/\//i.test(normalizedUrl)
  const isRootRelativeUrl =
    normalizedUrl.startsWith('/') && !normalizedUrl.startsWith('//')
  if (!isAbsoluteHttpUrl && !isRootRelativeUrl) {
    return undefined
  }

  try {
    const parsedUrl = new URL(normalizedUrl, window.location.origin)
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return parsedUrl.href
    }
  } catch (_error) {
    return undefined
  }

  return undefined
}

function getPaddleCheckoutUrl(response: PaddlePaymentResponse): string | null {
  const paddleData = getObjectData(response.data)
  const responseData = getObjectData(response)
  const checkoutUrl = normalizeCheckoutUrl(
    typeof response.data === 'string'
      ? response.data.trim()
      : getStringField(paddleData, 'checkout_url') ||
          getStringField(responseData, 'checkout_url')
  )
  const transactionId =
    getStringField(paddleData, 'transaction_id') ||
    getStringField(responseData, 'transaction_id')
  const orderId =
    getStringField(paddleData, 'order_id') ||
    getStringField(responseData, 'order_id')

  if (transactionId) {
    if (checkoutUrl) {
      rememberPaddleCheckoutUrlFallback(transactionId, checkoutUrl)
    }

    return buildPaddleWalletCheckoutUrlWithOrder(transactionId, orderId)
  }

  if (checkoutUrl) {
    return checkoutUrl
  }

  return null
}

export function usePayment() {
  const [amount, setAmount] = useState<number>(0)
  const [calculating, setCalculating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [embeddedCheckout, setEmbeddedCheckout] =
    useState<StripeEmbeddedCheckoutSession | null>(null)

  const closeEmbeddedCheckout = useCallback(() => {
    setEmbeddedCheckout(null)
  }, [])

  // Calculate payment amount
  const calculatePaymentAmount = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setCalculating(true)

        let response: ApiResponse<string>
        if (isStripePayment(paymentType)) {
          response = await calculateStripeAmount({ amount: topupAmount })
        } else if (isWaffoPancakePayment(paymentType)) {
          response = await calculateWaffoPancakeAmount({ amount: topupAmount })
        } else if (isPaddlePayment(paymentType)) {
          response = await calculatePaddleAmount({ amount: topupAmount })
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
    async (
      topupAmount: number,
      paymentType: string,
      options?: PaymentOptions
    ) => {
      let keepProcessing = false

      try {
        setProcessing(true)

        const isStripe = isStripePayment(paymentType)
        const isPaddle = isPaddlePayment(paymentType)
        const amount = Math.floor(topupAmount)
        const gaIdentifiers = getGAMeasurementIdentifiers()

        const stripeRequest = buildStripePaymentRequest({
          amount,
          stripeCurrency: options?.stripeCurrency,
          gaIdentifiers,
          redirectUrls: getStripeRedirectUrls(),
          invoiceRequested: options?.invoiceRequested,
          invoiceProfile: options?.invoiceProfile,
          preferEmbeddedCheckout: options?.preferEmbeddedCheckout,
        })

        const response = isStripe
          ? await requestStripePayment(stripeRequest)
          : isPaddle
            ? await requestPaddlePayment({ amount, ...gaIdentifiers })
            : await requestPayment({
                amount,
                payment_method: paymentType,
                ...gaIdentifiers,
              })

        if (!isApiSuccess(response)) {
          toast.error(getPaymentErrorMessage(response))
          return false
        }

        // Handle Stripe payment
        if (isStripe) {
          const stripeData = response.data as
            | {
                pay_link?: string
                client_secret?: string
                publishable_key?: string
              }
            | undefined
          // Embedded session: mount Checkout in-console. The server only returns a
          // client_secret when the publishable key is configured, so a missing secret
          // falls through to the hosted pay_link redirect.
          if (stripeData?.client_secret && stripeData?.publishable_key) {
            setEmbeddedCheckout({
              clientSecret: stripeData.client_secret,
              publishableKey: stripeData.publishable_key,
            })
            return true
          }
          if (stripeData?.pay_link) {
            keepProcessing = true
            navigateToPaymentPage(stripeData.pay_link)
            return true
          }
        }

        if (isPaddle) {
          const paddleCheckoutUrl = getPaddleCheckoutUrl(
            response as PaddlePaymentResponse
          )
          if (paddleCheckoutUrl) {
            navigateToPaymentPage(paddleCheckoutUrl)
            return true
          }

          toast.error(
            i18next.t(
              'Paddle checkout response is missing a checkout URL or transaction ID'
            )
          )
          return false
        }

        const genericData = getObjectData(response.data)

        // Handle non-hosted payment form
        if (!isStripe && !isPaddle && genericData) {
          const url = (response as unknown as { url?: string }).url
          if (url) {
            submitPaymentForm(url, genericData)
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        return false
      } catch (_error) {
        toast.error(i18next.t('Payment request failed'))
        return false
      } finally {
        if (!keepProcessing) {
          setProcessing(false)
        }
      }
    },
    []
  )

  return {
    amount,
    calculating,
    processing,
    embeddedCheckout,
    closeEmbeddedCheckout,
    calculatePaymentAmount,
    processPayment,
    setAmount,
  }
}
