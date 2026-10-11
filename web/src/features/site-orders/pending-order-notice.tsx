import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { PaymentMethodLabel } from '@/features/wallet/components/payment-method-label'
import { formatTimestampToDate } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import { getPendingDirectOrders } from './api'
import { paymentAmount } from './presentation'
import { canPayOrder, useOrderPayment } from './use-order-payment'

export function PendingOrderNotice(props: { onPaid?: () => void }) {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const query = useQuery({
    queryKey: ['site-orders', 'personal', userId, 'pending'],
    queryFn: getPendingDirectOrders,
    enabled: !!userId,
    refetchInterval: 5000,
  })
  const payment = useOrderPayment(props.onPaid)
  const order = query.data?.order
  if (!order || order.cancel_requested || payment.dismissedOrderId === order.id) {
    return payment.dialogs
  }
  return (
    <>
      <div
        className='bg-muted/20 space-y-4 rounded-xl border p-4'
        role='status'
      >
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='min-w-0 space-y-2'>
            <p className='text-sm font-semibold'>
              {t('You have an unpaid order')}
            </p>
            <div className='flex flex-wrap items-center gap-x-3 gap-y-2 text-sm'>
              <PaymentMethodLabel method={order.payment_method} />
              <span className='text-muted-foreground'>
                {order.order_type === 'subscription'
                  ? t('Subscription')
                  : t('Top-up')}
              </span>
            </div>
          </div>
          <span className='shrink-0 text-right text-lg font-semibold tabular-nums'>
            {paymentAmount(order)}
          </span>
        </div>
        <p className='text-muted-foreground text-xs break-all'>
          {t('Order number')}: {order.trade_no}
        </p>
        <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t pt-3'>
          <p className='text-muted-foreground text-xs'>
            {!canPayOrder(order)
              ? t('Closing order. Waiting for payment provider confirmation.')
              : `${t('Expires At')}: ${formatTimestampToDate(order.expires_at)}`}
          </p>
          <div className='ml-auto flex flex-wrap items-center justify-end gap-2'>
            <Link
              to='/my-orders'
              className='text-muted-foreground hover:text-foreground mr-1 text-xs underline underline-offset-4'
            >
              {t('My orders')}
            </Link>
            <Button
              size='sm'
              variant='outline'
              disabled={payment.busy}
              onClick={() => payment.requestCancel(order)}
            >
              {t('Cancel order')}
            </Button>
            {canPayOrder(order) && (
              <Button
                size='sm'
                disabled={payment.busy}
                onClick={() => payment.pay(order)}
              >
                {t('Pay')}
              </Button>
            )}
          </div>
        </div>
      </div>
      {payment.dialogs}
    </>
  )
}
