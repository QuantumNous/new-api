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
import { useState, useCallback, useEffect, useRef } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { requestXunhuPayment, syncXunhuPayment, isApiSuccess } from '../api'

const SYNC_INTERVAL_MS = 5000
const SYNC_MAX_ATTEMPTS = 120 // ~10 minutes

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

function getErrorMessage(message: string | undefined, data: unknown): string {
  if (typeof data === 'string' && data.trim()) {
    return data
  }
  return message || i18next.t('Payment request failed')
}

function isPaidSyncData(data: unknown): boolean {
  return (
    !!data &&
    typeof data === 'object' &&
    'paid' in data &&
    (data as { paid?: boolean }).paid === true
  )
}

export function useXunhuPayment(options?: {
  onPaid?: () => void | Promise<void>
}) {
  const [processing, setProcessing] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [pendingTradeNo, setPendingTradeNo] = useState<string | null>(null)
  const onPaidRef = useRef(options?.onPaid)
  onPaidRef.current = options?.onPaid

  const stopPolling = useCallback(() => {
    setPendingTradeNo(null)
  }, [])

  const closeQrDialog = useCallback(() => {
    setQrCodeUrl(null)
    stopPolling()
  }, [stopPolling])

  const trySyncOnce = useCallback(async (tradeNo: string): Promise<boolean> => {
    try {
      const response = await syncXunhuPayment(tradeNo)
      if (!isApiSuccess(response)) {
        return false
      }
      return isPaidSyncData(response.data)
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (!pendingTradeNo) {
      return
    }

    let cancelled = false
    let attempts = 0

    const tick = async () => {
      if (cancelled) return
      attempts += 1
      const paid = await trySyncOnce(pendingTradeNo)
      if (cancelled) return
      if (paid) {
        toast.success(i18next.t('Payment successful'))
        setQrCodeUrl(null)
        setPendingTradeNo(null)
        await onPaidRef.current?.()
        return
      }
      if (attempts >= SYNC_MAX_ATTEMPTS) {
        setPendingTradeNo(null)
      }
    }

    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, SYNC_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pendingTradeNo, trySyncOnce])

  const syncTradeNo = useCallback(
    async (tradeNo: string) => {
      const paid = await trySyncOnce(tradeNo)
      if (paid) {
        toast.success(i18next.t('Payment successful'))
        await onPaidRef.current?.()
        return true
      }
      setPendingTradeNo(tradeNo)
      return false
    },
    [trySyncOnce]
  )

  const processXunhuPayment = useCallback(
    async (topupAmount: number, paymentMethod: string) => {
      setProcessing(true)

      try {
        const response = await requestXunhuPayment({
          amount: Math.floor(topupAmount),
          payment_method: paymentMethod,
        })

        if (!isApiSuccess(response)) {
          toast.error(getErrorMessage(response.message, response.data))
          return false
        }

        const data = response.data
        if (!data || typeof data !== 'object') {
          toast.error(i18next.t('Payment request failed'))
          return false
        }

        const url = 'url' in data && typeof data.url === 'string' ? data.url : ''
        const urlQrcode =
          'url_qrcode' in data && typeof data.url_qrcode === 'string'
            ? data.url_qrcode
            : ''
        const tradeNo =
          'trade_no' in data && typeof data.trade_no === 'string'
            ? data.trade_no
            : ''

        if (tradeNo) {
          setPendingTradeNo(tradeNo)
        }

        if (isMobileDevice()) {
          if (!url) {
            toast.error(i18next.t('Payment request failed'))
            return false
          }
          window.location.href = url
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        if (urlQrcode) {
          setQrCodeUrl(urlQrcode)
          return true
        }

        if (url) {
          window.location.href = url
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        toast.error(i18next.t('Payment request failed'))
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
    processing,
    processXunhuPayment,
    qrCodeUrl,
    closeQrDialog,
    syncTradeNo,
  }
}
