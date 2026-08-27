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
import { Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'

import { queryNativeOrder } from '../../api'
import { PAYMENT_TYPES } from '../../constants'
import { formatCurrency, getPaymentIcon } from '../../lib'
import type { NativeQrOrder } from '../../hooks/use-native-payment'
import type { PaymentMethod } from '../../types'

// Poll the order status this often while the QR dialog is open.
const POLL_INTERVAL_MS = 2000

interface NativeQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: NativeQrOrder | null
  paymentMethod: PaymentMethod | undefined
  paymentAmount: number
  /** Called after the order is confirmed paid (e.g. to refresh the balance). */
  onSuccess: () => void
}

export function NativeQrDialog({
  open,
  onOpenChange,
  order,
  paymentMethod,
  paymentAmount,
  onSuccess,
}: NativeQrDialogProps) {
  const { t } = useTranslation()

  const isWechat = paymentMethod?.type === PAYMENT_TYPES.WECHAT_NATIVE
  const scanHint = isWechat
    ? t('Scan the QR code with WeChat to pay')
    : t('Scan the QR code with Alipay to pay')

  const tradeNo = order?.tradeNo

  useEffect(() => {
    if (!open || !tradeNo) {
      return
    }
    let cancelled = false

    const poll = async () => {
      try {
        const res = await queryNativeOrder(tradeNo)
        if (cancelled) {
          return
        }
        const status = res.data?.status
        if (status === 'success') {
          toast.success(t('Payment successful'))
          onSuccess()
          onOpenChange(false)
        } else if (status === 'expired' || status === 'failed') {
          toast.error(t('QR code expired, please try again'))
          onOpenChange(false)
        }
      } catch {
        // Ignore transient polling errors and keep trying until closed.
      }
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [open, tradeNo, onSuccess, onOpenChange, t])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Scan to Pay')}
      description={scanHint}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-[360px]'
      contentHeight='auto'
    >
      <div className='flex flex-col items-center gap-4 py-2'>
        <div className='flex items-center gap-2'>
          {getPaymentIcon(paymentMethod?.type, 'h-5 w-5', paymentMethod?.icon)}
          <span className='font-medium'>{paymentMethod?.name}</span>
        </div>

        <div className='rounded-lg bg-white p-3'>
          {order?.codeUrl ? (
            <QRCodeSVG value={order.codeUrl} size={220} level='M' marginSize={1} />
          ) : (
            <div className='flex h-[220px] w-[220px] items-center justify-center'>
              <Loader2 className='h-6 w-6 animate-spin text-neutral-400' />
            </div>
          )}
        </div>

        {paymentAmount > 0 && (
          <div className='text-2xl font-semibold'>
            {formatCurrency(paymentAmount)}
          </div>
        )}

        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
          {t('Waiting for payment...')}
        </div>
      </div>
    </Dialog>
  )
}
