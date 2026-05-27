/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
*/
import { useCallback, useRef, useState } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { isApiSuccess, requestAirwallexPayment } from '../api'
import type { AirwallexMethod } from '../types'

type AirwallexPaymentsClient = {
  redirectToCheckout: (params: Record<string, unknown>) => Promise<void>
}

type AirwallexSdkModule = {
  init?: (params: Record<string, unknown>) => Promise<{
    payments?: AirwallexPaymentsClient
    payment?: AirwallexPaymentsClient
  }>
  default?: AirwallexSdkModule
}

const HOSTED_CHECKOUT_METHODS = new Set([
  'card',
  'cards',
  'googlepay',
  'google_pay',
  'alipaycn',
  'alipayhk',
])

function toHostedCheckoutMethod(type: string) {
  switch (type.trim().toLowerCase()) {
    case 'google_pay':
      return 'googlepay'
    default:
      return type.trim().toLowerCase()
  }
}

function resolveAirwallexEnv() {
  const raw = String(import.meta.env.VITE_AIRWALLEX_ENV || '')
    .trim()
    .toLowerCase()
  if (['demo', 'staging', 'sandbox', 'test'].includes(raw)) {
    return 'demo'
  }
  return 'prod'
}

function shouldUseHostedCheckout(method: AirwallexMethod) {
  const type = method.type.trim().toLowerCase()
  return (
    method.flow === 'card' ||
    method.flow === 'wallet' ||
    HOSTED_CHECKOUT_METHODS.has(type)
  )
}

export function useAirwallexPayment() {
  const [processing, setProcessing] = useState(false)
  const paymentsRef = useRef<AirwallexPaymentsClient | null>(null)
  const initializingRef = useRef<Promise<AirwallexPaymentsClient> | null>(null)

  const getPaymentsClient = useCallback(async () => {
    if (paymentsRef.current) {
      return paymentsRef.current
    }
    if (initializingRef.current) {
      return initializingRef.current
    }

    initializingRef.current = (async () => {
      const sdk =
        (await import('@airwallex/components-sdk')) as AirwallexSdkModule
      const init = sdk.init || sdk.default?.init
      if (typeof init !== 'function') {
        throw new Error('airwallex init not found')
      }
      const initialized = await init({
        env: resolveAirwallexEnv(),
        enabledElements: ['payments'],
      })
      const payments = initialized.payments || initialized.payment
      if (!payments || typeof payments.redirectToCheckout !== 'function') {
        throw new Error('airwallex payments client unavailable')
      }
      paymentsRef.current = payments
      return payments
    })()

    try {
      return await initializingRef.current
    } finally {
      initializingRef.current = null
    }
  }, [])

  const processAirwallexPayment = useCallback(
    async (params: {
      amount: number
      biz: string
      currency: string
      countryCode: string
      method: AirwallexMethod
    }) => {
      setProcessing(true)
      try {
        const response = await requestAirwallexPayment({
          biz: params.biz,
          currency: params.currency,
          country_code: params.countryCode,
          payment_method_type: params.method.type,
          amount: Math.floor(params.amount),
        })
        if (!isApiSuccess(response) || !response.data) {
          toast.error(response.message || i18next.t('Payment request failed'))
          return false
        }

        const result = response.data
        if (result.next_action?.url) {
          window.open(result.next_action.url, '_blank')
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }
        if (
          shouldUseHostedCheckout(params.method) &&
          result.client_secret &&
          result.payment_intent_id
        ) {
          const payments = await getPaymentsClient()
          await payments.redirectToCheckout({
            intent_id: result.payment_intent_id,
            client_secret: result.client_secret,
            methods: [toHostedCheckoutMethod(params.method.type)],
            currency: params.currency,
            country_code: params.countryCode,
            successUrl: `${window.location.origin}/console/topup?airwallex=success`,
            failUrl: `${window.location.origin}/console/topup?airwallex=fail`,
            cancelUrl: `${window.location.origin}/console/topup?airwallex=cancel`,
          })
          return true
        }

        toast.error(i18next.t('Payment request failed'))
        return false
      } catch (error) {
        console.error('Airwallex payment failed:', error)
        toast.error(i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(false)
      }
    },
    [getPaymentsClient]
  )

  return { processing, processAirwallexPayment }
}
