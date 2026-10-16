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
import {
  useMutation,
  useQuery,
  useQueryClient,
  useIsMutating,
} from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import {
  sideDrawerContentClassName,
  sideDrawerHeaderClassName,
  sideDrawerFormClassName,
} from '@/components/drawer-layout'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PaymentMethodLabel } from '@/features/wallet/components/payment-method-label'
import { getPaymentMethodName } from '@/features/wallet/lib/billing'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatTimestampToDate, formatNumber } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  getOrder,
  recheckOrder,
  recheckPersonalOrder,
  type OrderScope,
} from './api'
import { OrderStatus } from './order-status'
import {
  paymentAmount,
  paymentProviderStatusLabel,
  reviewResolutionLabel,
} from './presentation'
import { RecoverOrder } from './recover-order'
import { useOrderPayment } from './use-order-payment'

export function OrderDetail(props: {
  id: number | null
  onClose: () => void
  scope?: OrderScope
}) {
  const { t, i18n } = useTranslation()
  const personal = props.scope === 'personal'
  const userId = useAuthStore((s) => s.auth.user?.id)
  const role = useAuthStore((s) => s.auth.user?.role ?? 0)
  const client = useQueryClient()
  const payment = useOrderPayment(undefined, props.scope ?? 'site')
  const query = useQuery({
    queryKey: [
      'site-orders',
      props.scope ?? 'site',
      userId,
      'detail',
      props.id,
    ],
    queryFn: () => {
      if (props.id === null) throw new Error('Missing order ID')
      return getOrder(props.id, props.scope)
    },
    enabled: props.id !== null,
  })
  const mutation = useMutation({
    mutationFn: async (id: number) => {
      if (personal) await recheckPersonalOrder(id)
      else await recheckOrder(id)
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['site-orders'] }),
  })
  const recovering =
    useIsMutating({ mutationKey: ['site-orders', 'recover', props.id] }) > 0
  const order = query.data
  const canCancelAntom =
    order?.payment_provider === 'antom' &&
    !order.cancel_requested &&
    (order.order_status === 'pending' ||
      (order.order_status === 'expired' &&
        order.close_reason === 'local_expiry'))
  let transactionLabel = t('Payment transaction number')
  if (order?.payment_provider === 'alipay') {
    transactionLabel = t('Alipay transaction number')
  } else if (order?.payment_provider === 'wechatpay') {
    transactionLabel = t('WeChat Pay transaction ID')
  }
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const environment = order?.sandbox ? t('Sandbox') : t('Production')
  const fields = order
    ? [
        [
          t('Type'),
          order.order_type === 'subscription' ? t('Subscription') : t('Top-up'),
        ],
        [t('User'), `${order.username} (#${order.user_id})`],
        [t('Payment Method'), getPaymentMethodName(order.payment_method, t)],
        [
          t('Environment'),
          order.amount_fen === null && order.payment_provider !== 'antom'
            ? t('Not recorded')
            : environment,
        ],
        [t('Order amount'), paymentAmount(order)],
        [
          t('Confirmed payment'),
          (!['mixpay', 'webmoney', 'antom'].includes(order.payment_provider) ||
            ['success', 'SUCCESS'].includes(order.gateway_status || '')) &&
          (order.payment_amount ||
            (order.provider_trade_no && order.amount_fen !== null))
            ? paymentAmount(order)
            : '—',
        ],
        [
          t('Frozen quota'),
          order.frozen_quota === null
            ? t('Not recorded')
            : formatNumber(order.frozen_quota, locale),
        ],
        [
          t('Equivalent at current display rate'),
          order.frozen_quota === null
            ? t('Not recorded')
            : formatQuotaWithCurrency(order.frozen_quota, {
                abbreviate: false,
                digitsLarge: 2,
                digitsSmall: 4,
              }),
        ],
        [t('Created Time'), formatTimestampToDate(order.create_time)],
        [
          t('Completed Time'),
          order.complete_time
            ? formatTimestampToDate(order.complete_time)
            : '—',
        ],
        [
          t('Expires At'),
          order.expires_at ? formatTimestampToDate(order.expires_at) : '—',
        ],
        [
          t('Last manual check'),
          order.last_check_at
            ? formatTimestampToDate(order.last_check_at)
            : '—',
        ],
        [
          t('Check result'),
          order.last_check_success === null
            ? '—'
            : t(order.last_check_success ? 'Success' : 'Failed'),
        ],
      ]
    : []
  if (
    order &&
    !personal &&
    ['alipay', 'wechatpay', 'mixpay', 'webmoney', 'antom'].includes(
      order.payment_provider
    )
  ) {
    const closeReasons: Record<string, string> = {
      user_cancelled: t('Cancelled by user'),
      expired: t('Payment window expired'),
      gateway_closed: t('Closed by payment provider'),
      local_expiry: t(
        'Payment time has ended. Waiting for the final payment result.'
      ),
    }
    if (order.cancellation_state === 'rejected') {
      fields.push([
        t('Cancellation status'),
        `${t('Cancellation rejected')}${order.cancellation_code ? ` (${order.cancellation_code})` : ''}`,
      ])
    }
    const providerStatus = paymentProviderStatusLabel(
      order.payment_provider,
      order.gateway_status,
      t
    )
    fields.push(
      [t('Close reason'), closeReasons[order.close_reason ?? ''] ?? '—'],
      [
        t('Close requested at'),
        order.close_requested_at
          ? formatTimestampToDate(order.close_requested_at)
          : '—',
      ],
      [
        t('Closure confirmed at'),
        order.closed_at ? formatTimestampToDate(order.closed_at) : '—',
      ],
      [t('Payment provider status'), providerStatus],
      [
        t('Last automatic check'),
        order.checked_at ? formatTimestampToDate(order.checked_at) : '—',
      ],
      [
        t('Next retry'),
        order.next_check_at ? formatTimestampToDate(order.next_check_at) : '—',
      ],
      [t('Consecutive failures'), formatNumber(order.retry_count ?? 0, locale)],
      [
        t('Manual review required'),
        t(order.review_required && !order.review_resolution ? 'Yes' : 'No'),
      ]
    )
  }
  return (
    <Sheet
      open={props.id !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <SheetContent className={sideDrawerContentClassName('sm:max-w-xl')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Order details')}</SheetTitle>
        </SheetHeader>
        <div className={sideDrawerFormClassName()}>
          {query.isLoading && <p role='status'>{t('Loading...')}</p>}
          {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
          {order && (
            <>
              <OrderStatus order={order} />
              <dl className='space-y-3'>
                {[
                  [t('Site order number'), order.trade_no],
                  [transactionLabel, order.provider_trade_no],
                ].map(([label, value]) => (
                  <div key={label} className='space-y-1'>
                    <dt className='text-muted-foreground text-sm'>{label}</dt>
                    <dd className='flex items-center gap-2'>
                      {value ? (
                        <>
                          <code className='min-w-0 break-all'>{value}</code>
                          <CopyButton value={value} />
                        </>
                      ) : (
                        <span className='text-muted-foreground'>
                          {t('Not yet available')}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <dl className='space-y-4'>
                {fields
                  .filter(
                    ([label]) =>
                      !personal ||
                      ![
                        t('User'),
                        t('Frozen quota'),
                        t('Equivalent at current display rate'),
                        t('Last manual check'),
                        t('Check result'),
                      ].includes(label)
                  )
                  .map(([label, value]) => (
                    <div key={label} className='grid grid-cols-2 gap-3'>
                      <dt className='text-muted-foreground'>{label}</dt>
                      <dd className='break-all'>
                        {label === t('Payment Method') ? (
                          <PaymentMethodLabel method={order.payment_method} />
                        ) : (
                          value
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>
              {!personal &&
                order.reviews?.map((review) => (
                  <div
                    key={review.id}
                    className='space-y-1 rounded-md border p-3'
                  >
                    <p className='text-muted-foreground text-xs'>
                      {t('Review outcome')} · #{review.actor_id} ·{' '}
                      {formatTimestampToDate(review.created_at)}
                    </p>
                    <p className='break-words whitespace-pre-wrap'>
                      {review.action && (
                        <span>
                          {reviewResolutionLabel(review.action, t)} ·{' '}
                        </span>
                      )}
                      {review.note}
                      {review.reference && (
                        <span>
                          {' '}
                          · {t('Refund reference')}: {review.reference}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              {!personal &&
                role >= ROLE.SUPER_ADMIN &&
                order.review_required &&
                !order.review_resolution && (
                  <RecoverOrder
                    order={order}
                    review
                    disabled={
                      mutation.isPending || query.isFetching || recovering
                    }
                  />
                )}
              {!personal && (
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'Frozen quota is authoritative. Historical exchange rates are not recorded.'
                  )}
                </p>
              )}
              {personal && order.payment_provider === 'antom' && (
                <div className='flex flex-wrap gap-2'>
                  <Button
                    disabled={mutation.isPending || query.isFetching}
                    onClick={() => mutation.mutate(order.id)}
                  >
                    {t('Check payment result')}
                  </Button>
                  {canCancelAntom && (
                    <Button
                      variant='outline'
                      disabled={payment.busy}
                      onClick={() => payment.requestCancel(order)}
                    >
                      {t('Cancel order')}
                    </Button>
                  )}
                  {payment.dialogs}
                </div>
              )}
              {!personal && role >= ROLE.SUPER_ADMIN && canCancelAntom && (
                <>
                  <Button
                    variant='outline'
                    disabled={payment.busy}
                    onClick={() => payment.requestCancel(order)}
                  >
                    {t('Cancel order')}
                  </Button>
                  {payment.dialogs}
                </>
              )}
              {!personal &&
                role >= ROLE.SUPER_ADMIN &&
                ['alipay', 'wechatpay', 'mixpay', 'webmoney', 'antom'].includes(
                  order.payment_provider
                ) && (
                  <Button
                    disabled={
                      mutation.isPending || query.isFetching || recovering
                    }
                    onClick={() => mutation.mutate(order.id)}
                  >
                    {t('Check payment result')}
                  </Button>
                )}
              {!personal &&
                role >= ROLE.SUPER_ADMIN &&
                ['alipay', 'wechatpay', 'mixpay', 'webmoney', 'antom'].includes(
                  order.payment_provider
                ) &&
                !order.review_required &&
                !order.review_resolution && (
                  <RecoverOrder
                    order={order}
                    disabled={
                      mutation.isPending || query.isFetching || recovering
                    }
                  />
                )}
              {!personal &&
                ![
                  'alipay',
                  'wechatpay',
                  'mixpay',
                  'webmoney',
                  'antom',
                ].includes(order.payment_provider) && (
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Payment verification and recovery are not available for this payment channel.'
                    )}
                  </p>
                )}
              {mutation.isSuccess && (
                <p role='status'>
                  {t('Payment check finished. Review the order status.')}
                </p>
              )}
              {mutation.isError && (
                <p role='alert'>
                  {t('Payment check failed. The order was not marked as paid.')}
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
