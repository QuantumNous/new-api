import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getWechatPayOrderStatus, type WechatPayCheckout } from '../../api'
import { formatCurrency } from '../../lib/format'

export function WechatPayDialog(props: {
  description?: string
  checkout: WechatPayCheckout | null
  onClose: () => void
  onPaid: () => void
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const checkout = props.checkout
  const onPaid = props.onPaid
  const expired = !!checkout && now >= checkout.expires_at * 1000
  const query = useQuery({
    queryKey: ['wechatpay-order', checkout?.trade_no],
    enabled: !!checkout,
    queryFn: async () => {
      try {
        return requireServerSuccess(
          await getWechatPayOrderStatus(checkout?.trade_no || '')
        ).data
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) {
          return { status: 'expired' }
        }
        throw error
      }
    },
    retry: false,
    refetchInterval: (q) =>
      q.state.error ||
      ['success', 'expired'].includes(q.state.data?.status || '')
        ? false
        : 5000,
  })
  const paid = query.data?.status === 'success'
  useEffect(() => {
    if (!checkout) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [checkout])
  useEffect(() => {
    if (paid) onPaid()
  }, [paid, onPaid])
  return (
    <Dialog
      open={!!checkout}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={
        <span className='inline-flex rounded-lg bg-white p-2 dark:px-3'>
          <img
            src='/wechat-pay.png'
            alt={t('WeChat Pay')}
            width={149}
            height={32}
            className='h-8 w-auto max-w-full object-contain'
          />
        </span>
      }
      description={
        props.description ||
        t(
          'Scan with WeChat to pay. Your balance updates after payment is verified.'
        )
      }
      contentClassName='gap-5 rounded-2xl sm:max-w-sm'
      headerClassName='gap-3 pr-6'
      titleClassName='-ml-2 leading-none'
      descriptionClassName='text-sm leading-relaxed'
    >
      <div className='flex flex-col items-center gap-5 pb-1'>
        <p className='max-w-full text-center text-3xl leading-tight font-semibold tracking-tight break-all tabular-nums'>
          CNY {formatCurrency(checkout?.amount || 0)}
        </p>
        {paid && (
          <p
            className='text-center text-sm text-green-700 dark:text-green-400'
            role='status'
          >
            {t('Payment successful')}
          </p>
        )}
        {!paid && (expired || query.data?.status === 'expired') && (
          <p
            className='bg-muted text-muted-foreground w-full rounded-xl p-5 text-center text-sm leading-relaxed'
            role='status'
          >
            {t('Payment QR code expired. Please create a new order.')}
          </p>
        )}
        {checkout && !paid && !expired && query.data?.status !== 'expired' && (
          <div className='w-full max-w-64 rounded-2xl border border-black/5 bg-white p-4 shadow-sm ring-4 ring-green-500/5'>
            <QRCodeSVG
              value={checkout.code_url}
              size={224}
              className='h-auto w-full'
              marginSize={2}
              title={t('WeChat Pay QR code')}
            />
          </div>
        )}
        {query.isError && (
          <p
            className='text-destructive text-center text-sm leading-relaxed'
            role='alert'
          >
            {t(
              'Unable to check payment status. Please retry or check order history.'
            )}
          </p>
        )}
        {!paid && (
          <Button
            type='button'
            variant='outline'
            className='h-10 w-full max-w-64 gap-2 rounded-lg'
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw aria-hidden='true' className='size-4' />
            {t('Check payment status')}
          </Button>
        )}
      </div>
    </Dialog>
  )
}
