import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import type { WechatPayCheckout } from '@/features/wallet/api'
import { WechatPayDialog } from '@/features/wallet/components/dialogs/wechatpay-dialog'
import { handleServerError } from '@/lib/handle-server-error'

import { cancelOrder, resumeOrder, type SiteOrder } from './api'

export function canPayOrder(order: SiteOrder) {
  return (
    ['alipay', 'wechatpay'].includes(order.payment_provider) &&
    order.order_status === 'pending' &&
    !order.cancel_requested &&
    !order.close_requested_at &&
    !order.review_required &&
    order.expires_at * 1000 > Date.now()
  )
}

// Shared payment interactions for the wallet notice and personal order list.
export function useOrderPayment(onPaid?: () => void) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [checkout, setCheckout] = useState<WechatPayCheckout | null>(null)
  const [dismissedOrderId, setDismissedOrderId] = useState<number | null>(null)
  const [subscription, setSubscription] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<SiteOrder | null>(null)
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['site-orders'] })
    void client.invalidateQueries({ queryKey: ['subscriptions'] })
  }, [client])
  const paid = useCallback(() => {
    setCheckout(null)
    refresh()
    onPaid?.()
    toast.success(t('Payment successful'))
  }, [refresh, onPaid, t])
  const pay = useMutation({
    mutationFn: (order: SiteOrder) => resumeOrder(order.id),
    onSuccess: (result, order) => {
      if (result.payment_provider === 'alipay' && result.pay_link) {
        try {
          sessionStorage.setItem('alipay-pending-order', result.trade_no)
        } catch {
          /* Storage may be disabled. */
        }
        window.location.assign(result.pay_link)
      } else if (result.payment_provider === 'wechatpay' && result.code_url) {
        setSubscription(order.order_type === 'subscription')
        setCheckout({ ...result, code_url: result.code_url })
      }
    },
    onError: (error) => {
      handleServerError(error)
      refresh()
    },
  })
  const cancel = useMutation({
    mutationFn: (order: SiteOrder) => cancelOrder(order.id),
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
