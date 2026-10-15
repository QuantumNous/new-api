import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { openPaymentWindow } from '@/lib/payment-window'
import { getServerErrorStatus } from '@/lib/server-error-message'

import { getAntomPayment, getAntomCheckoutURL } from '../../antom'
import { getMixPayPayment } from '../../mixpay'
import { getWebMoneyPayment } from '../../webmoney'
import { PaymentMethodLabel } from '../payment-method-label'

// Unlike the WeChat QR dialog, expiry stops new payments but never ends polling.
export function MixPayDialog(props: {
  provider?: 'mixpay' | 'webmoney' | 'antom'
  tradeNo: string | null
  onClose: () => void
  onPaid: () => void
}) {
  const { t } = useTranslation()
  const provider = props.provider || 'mixpay'
  const notified = useRef<string | null>(null)
  const opened = useRef<string | null>(null)
  const [now, setNow] = useState(Date.now)
  const query = useQuery({
    queryKey: [`${provider}-order`, props.tradeNo],
    enabled: !!props.tradeNo,
    queryFn: () =>
      ({
        antom: getAntomPayment,
        webmoney: getWebMoneyPayment,
        mixpay: getMixPayPayment,
      })[provider](props.tradeNo || ''),
    refetchInterval: (q) =>
      ['success', 'failed', 'expired'].includes(q.state.data?.status || '') ||
      [401, 403, 404].includes(getServerErrorStatus(q.state.error) || 0)
        ? false
        : 5000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    meta: { errorToast: false },
  })
  const order = query.data
  const onPaid = props.onPaid
  const tradeNo = props.tradeNo
  const paid = order?.status === 'success'
  const failed = ['failed', 'expired'].includes(order?.status || '')
  const expiresAt = order?.expires_at
  const expired = !!expiresAt && Math.max(now, Date.now()) >= expiresAt * 1000
  useEffect(() => {
    if (!tradeNo || !expiresAt || paid || failed) return
    const delay = expiresAt * 1000 - Date.now()
    if (delay <= 0) return
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(delay, 2147483647)
    )
    return () => window.clearTimeout(timer)
  }, [tradeNo, expiresAt, paid, failed, now])
  useEffect(() => {
    if (paid && tradeNo && notified.current !== tradeNo) {
      notified.current = tradeNo
      onPaid()
    }
  }, [paid, tradeNo, onPaid])
  let message = t(
    'Payment processing. You can leave this page and check My orders later.'
  )
  if (paid) message = t('Payment successful')
  else if (order?.status === 'expired') message = t('Closed')
  else if (failed) message = t('Payment failed')
  else if (order?.review_required) {
    message = t('Payment requires review. Please contact support.')
  } else if (order?.gateway_status === 'paid_less') {
    message = t(
      'Payment amount is insufficient. Complete payment using the original checkout.'
    )
  } else if (order?.status === 'paid') {
    message = t('Payment received. Your order is being fulfilled.')
  } else if (expired) {
    message = t('Payment time has ended. Waiting for the final payment result.')
  }

  let safeLink = false
  if (provider === 'antom') {
    safeLink = order?.pay_link === `/payment/antom/${tradeNo}`
  } else if (provider === 'webmoney') {
    safeLink =
      order?.pay_link ===
        'https://merchant.wmtransfer.com/lmi/payment_utf.asp' &&
      !!order.pay_params
  } else {
    safeLink =
      !!order?.pay_link &&
      /^https:\/\/mixpay\.me\/code\/[A-Za-z0-9_-]+$/.test(order.pay_link)
  }
  const canOpen =
    !query.isError &&
    order?.status === 'pending' &&
    !expired &&
    !order.review_required &&
    safeLink
  useEffect(() => {
    if (!tradeNo) {
      opened.current = null
      return
    }
    if (
      canOpen &&
      order?.trade_no === tradeNo &&
      Date.now() < order.expires_at * 1000 &&
      opened.current !== tradeNo
    ) {
      // Record the attempt even if blocked: polling must not spawn windows or
      // repeated prompts. The explicit button remains available for a retry.
      opened.current = tradeNo
      openPaymentWindow(
        provider === 'antom'
          ? () => getAntomCheckoutURL(order.trade_no)
          : new URL(order.pay_link, window.location.origin).href,
        order.pay_params
      )
    }
  }, [tradeNo, canOpen, order, provider])
  return (
    <Dialog
      open={!!props.tradeNo}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={
        provider === 'antom' ? (
          <PaymentMethodLabel method='antom' />
        ) : (
          { webmoney: 'WebMoney', mixpay: 'MixPay' }[provider]
        )
      }
      description={t(
        'Your order updates after payment is verified. Closing this window does not cancel payment.'
      )}
    >
      <div className='space-y-4'>
        {order && (
          <p className='text-xl font-semibold tabular-nums'>
            {order.currency} {order.amount}
          </p>
        )}
        <div className='flex items-center gap-2 break-all'>
          <span>{props.tradeNo}</span>
          <CopyButton value={props.tradeNo || ''} />
        </div>
        <p role='status'>{message}</p>
        {query.isError && (
          <p role='alert'>
            {t(
              'Unable to check payment status. Please retry or check order history.'
            )}
          </p>
        )}
        <div className='flex flex-wrap gap-3'>
          {canOpen && (
            <Button
              className='w-full sm:w-auto'
              onClick={() => {
                if (order) {
                  openPaymentWindow(
                    provider === 'antom'
                      ? () => getAntomCheckoutURL(order.trade_no)
                      : new URL(order.pay_link, window.location.origin).href,
                    order.pay_params
                  )
                }
              }}
            >
              {t('Open payment page')}
            </Button>
          )}
          {!paid && !failed && (
            <Button
              className='w-full sm:w-auto'
              variant='outline'
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t('Check payment status')}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
