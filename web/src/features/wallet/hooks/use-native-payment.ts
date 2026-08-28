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

import { requestNativePayment, isApiSuccess } from '../api'

/**
 * A created native QR order: the gateway pay string to render as a QR code and
 * the local trade number to poll for completion.
 */
export interface NativeQrOrder {
  codeUrl: string
  tradeNo: string
}

/**
 * Hook for creating a native WeChat/Alipay QR order. The returned order is
 * handed to the QR dialog, which renders the code and polls for payment.
 */
export function useNativePayment() {
  const [processing, setProcessing] = useState(false)

  const requestNativeQr = useCallback(
    async (
      topupAmount: number,
      paymentType: string
    ): Promise<NativeQrOrder | null> => {
      setProcessing(true)
      try {
        const response = await requestNativePayment({
          amount: Math.floor(topupAmount),
          payment_method: paymentType,
        })

        if (
          isApiSuccess(response) &&
          response.data?.code_url &&
          response.data?.trade_no
        ) {
          return {
            codeUrl: response.data.code_url,
            tradeNo: response.data.trade_no,
          }
        }

        const detail =
          typeof response.data === 'string' ? response.data : undefined
        toast.error(
          detail || response.message || i18next.t('Payment request failed')
        )
        return null
      } catch {
        toast.error(i18next.t('Payment request failed'))
        return null
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  return { processing, requestNativeQr }
}
