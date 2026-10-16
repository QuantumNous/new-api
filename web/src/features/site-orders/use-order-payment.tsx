import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { getAntomCheckoutURL } from '@/features/wallet/antom'
import type { WechatPayCheckout } from '@/features/wallet/api'
import { MixPayDialog } from '@/features/wallet/components/dialogs/mixpay-dialog'
import { WechatPayDialog } from '@/features/wallet/components/dialogs/wechatpay-dialog'
import { handleServerError } from '@/lib/handle-server-error'
import { openPaymentWindow } from '@/lib/payment-window'
import { getServerErrorStatus } from '@/lib/server-error-message'

import {
  cancelOrder,
  getOrder,
  resumeOrder,
  type SiteOrder,
  type OrderScope,
} from './api'

export function canPayOrder(order: SiteOrder) {
  return (
    ['antom', 'webmoney', 'mixpay', 'alipay', 'wechatpay'].includes(
      order.payment_provider
    ) &&
    order.order_status === 'pending' &&
    !order.cancel_requested &&
    !order.close_requested_at &&
    !order.review_required &&
    order.expires_at * 1000 > Date.now()
  )
}

function paymentObservationFinished(order?: SiteOrder) {
  if (!order) return false
  if (
    order.order_status === 'expired' &&
    ['alipay', 'wechatpay', 'webmoney', 'antom'].includes(
      order.payment_provider
    )
  ) {
    // A local timeout is not proof that the provider has stopped accepting payment.
    return !!order.closed_at
  }
  return ['success', 'failed', 'expired', 'paid_review'].includes(
    order.order_status
  )
}

// Shared payment interactions for the wallet notice and personal order list.
export function useOrderPayment(
  onPaid?: () => void,
  scope: OrderScope = 'personal'
) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [observedOrders, setObservedOrders] = useState<SiteOrder[]>([])
  const [mixpayTradeNo, setMixpayTradeNo] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<WechatPayCheckout | null>(null)
  const [dismissedOrderId, setDismissedOrderId] = useState<number | null>(null)
  const [subscription, setSubscription] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<SiteOrder | null>(null)
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['site-orders'] })
    void client.invalidateQueries({ queryKey: ['subscriptions'] })
  }, [client])
  const paymentCompleted = useCallback(() => {
    refresh()
    onPaid?.()
    toast.success(t('Payment successful'))
  }, [refresh, onPaid, t])
  const paid = useCallback(() => {
    setMixpayTradeNo(null)
    setCheckout(null)
    paymentCompleted()
  }, [paymentCompleted])
  const observations = useQueries({
    queries: observedOrders.map((order) => ({
      queryKey: ['site-orders', 'payment', order.id],
      queryFn: () => getOrder(order.id, 'personal'),
      refetchInterval: (query: {
        state: { data?: SiteOrder; error: unknown }
      }) =>
        paymentObservationFinished(query.state.data) ||
        [401, 403, 404].includes(getServerErrorStatus(query.state.error) || 0)
          ? false
          : 5000,
      retry: false,
      meta: { errorToast: false },
    })),
  })
  useEffect(() => {
    const finished = observations.filter(
      (query) =>
        paymentObservationFinished(query.data) ||
        [401, 403, 404].includes(getServerErrorStatus(query.error) || 0)
    )
    if (!finished.length) return
    const finishedIds = new Set(
      finished.flatMap((query) => (query.data ? [query.data.id] : []))
    )
    // Remove denied/missing orders too; they cannot be observed by this session.
    observations.forEach((query, index) => {
      if ([401, 403, 404].includes(getServerErrorStatus(query.error) || 0)) {
        finishedIds.add(observedOrders[index].id)
      }
    })
    setObservedOrders((orders) =>
      orders.filter((order) => !finishedIds.has(order.id))
    )
    if (
      finished.some(
        (query) =>
          query.data?.order_status === 'success' && !query.data.review_required
      )
    ) {
      paymentCompleted()
    } else refresh()
  }, [observations, observedOrders, paymentCompleted, refresh])
  const pay = useMutation({
    mutationFn: (order: SiteOrder) => resumeOrder(order.id),
    onSuccess: (result, order) => {
      if (
        result.trade_no === order.trade_no &&
        ['antom', 'webmoney', 'mixpay', 'alipay'].includes(
          result.payment_provider
        )
      ) {
        setObservedOrders((orders) =>
          orders.some((item) => item.id === order.id)
            ? orders
            : [...orders, order]
        )
      }
      if (result.payment_provider === 'antom') {
        if (
          result.trade_no === order.trade_no &&
          result.status === 'pending' &&
          result.expires_at * 1000 > Date.now() &&
          result.pay_link === `/payment/antom/${order.trade_no}`
        ) {
          openPaymentWindow(() => getAntomCheckoutURL(order.trade_no))
        }
        refresh()
      } else if (result.payment_provider === 'webmoney') {
        if (
          result.trade_no === order.trade_no &&
          result.status === 'pending' &&
          result.expires_at * 1000 > Date.now() &&
          result.pay_link ===
            'https://merchant.wmtransfer.com/lmi/payment_utf.asp' &&
          result.pay_params
        ) {
          openPaymentWindow(result.pay_link, result.pay_params)
        }
        refresh()
      } else if (result.payment_provider === 'mixpay') {
        if (
          result.trade_no === order.trade_no &&
          result.status === 'pending' &&
          !result.review_required &&
          result.expires_at * 1000 > Date.now() &&
          result.pay_link &&
          /^https:\/\/mixpay\.me\/code\/[A-Za-z0-9_-]+$/.test(result.pay_link)
        ) {
          openPaymentWindow(result.pay_link)
          return
        }
        refresh()
        setObservedOrders((orders) =>
          orders.filter((item) => item.id !== order.id)
        )
        setMixpayTradeNo(result.trade_no)
      } else if (result.payment_provider === 'alipay' && result.pay_link) {
        try {
          sessionStorage.setItem('alipay-pending-order', result.trade_no)
        } catch {
          /* Storage may be disabled. */
        }
        openPaymentWindow(result.pay_link)
      } else if (result.payment_provider === 'wechatpay' && result.code_url) {
        setSubscription(order.order_type === 'subscription')
        setCheckout({ ...result, currency: 'CNY', code_url: result.code_url })
      }
    },
    onError: (error) => {
      handleServerError(error)
      refresh()
    },
  })
  const cancel = useMutation({
    mutationFn: (order: SiteOrder) => cancelOrder(order.id, scope),
    onSuccess: (result, order) => {
      setDismissedOrderId(order.id)
      setCancelTarget(null)
      refresh()
      if (result.status === 'paid') paid()
      else if (result.status === 'closed') toast.success(t('Order cancelled'))
      else {
        toast.info(
          t('Cancellation requested. You can view its status in My orders.')
        )
      }
    },
    onError: (error) => {
      handleServerError(error)
      refresh()
    },
  })
  return {
    dismissedOrderId,
    pay: pay.mutate,
    requestCancel: setCancelTarget,
    busy: pay.isPending || cancel.isPending,
    dialogs: (
      <>
        <MixPayDialog
          tradeNo={mixpayTradeNo}
          onClose={() => setMixpayTradeNo(null)}
          onPaid={paid}
        />
        <WechatPayDialog
          checkout={checkout}
          onClose={() => setCheckout(null)}
          onPaid={paid}
          description={
            subscription
              ? t(
                  'Scan with WeChat to pay. Your subscription activates after payment is verified.'
                )
              : undefined
          }
        />
        <ConfirmDialog
          open={!!cancelTarget}
          onOpenChange={(open) => {
            if (!open && !cancel.isPending) setCancelTarget(null)
          }}
          title={t('Cancel order')}
          desc={t(
            'Cancel this unpaid order? Payment will be disabled and the record retained for reconciliation.'
          )}
          confirmText={t('Cancel order')}
          destructive
          isLoading={cancel.isPending}
          handleConfirm={() => {
            if (cancelTarget) cancel.mutate(cancelTarget)
          }}
        />
      </>
    ),
  }
}
