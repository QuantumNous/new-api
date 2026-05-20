/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useCallback, useState } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { isApiSuccess, requestAirwallexPayment } from '../api'

// Hooked from /wallet → "Pay with Airwallex". Mirrors useStripe in shape: ask
// the backend for a hosted-checkout URL, then open it in a new tab. Stays
// stupid on purpose — currency + amount come straight from the caller.
export function useAirwallexPayment() {
  const [processing, setProcessing] = useState(false)

  const processAirwallexPayment = useCallback(
    async (amount: number, currency: string) => {
      try {
        setProcessing(true)
        const response = await requestAirwallexPayment({
          amount: Math.floor(amount),
          currency,
          payment_method: 'airwallex',
        })

        if (!isApiSuccess(response)) {
          toast.error(response.message || i18next.t('Payment request failed'))
          return false
        }

        const payLink = response.data?.pay_link
        if (!payLink) {
          toast.error(i18next.t('Payment request failed'))
          return false
        }

        window.open(payLink, '_blank')
        toast.success(i18next.t('Redirecting to payment page...'))
        return true
      } catch (_error) {
        toast.error(i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  return { processing, processAirwallexPayment }
}
