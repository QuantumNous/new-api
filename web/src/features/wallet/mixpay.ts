import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export interface MixPayCheckout {
  payment_provider: 'mixpay' | 'webmoney' | 'antom'
  trade_no: string
  amount: string
  currency: string
  expires_at: number
  status: string
  gateway_status: string
  creation_state: string
  pay_params?: Record<string, string>
  pay_link: string
  review_required: boolean
}

export async function quoteMixPay(amount: number, planId = 0) {
  return requireServerSuccess(
    (await api.post('/api/user/mixpay/amount', { amount, plan_id: planId }))
      .data
  ) as { success: boolean; data: string }
}

export async function createMixPayPayment(
  amount: number,
  expectedAmount: string,
  requestKey: string,
  planId = 0
): Promise<MixPayCheckout> {
  return requireServerSuccess(
    (
      await api.post(
        planId ? '/api/subscription/mixpay/pay' : '/api/user/mixpay/pay',
        {
          amount,
          plan_id: planId,
          expected_amount: expectedAmount,
          request_key: requestKey,
        }
      )
    ).data
  ).data
}

export async function getMixPayPayment(
  tradeNo: string
): Promise<MixPayCheckout> {
  return requireServerSuccess(
    (await api.get(`/api/user/mixpay/order/${encodeURIComponent(tradeNo)}`))
      .data
  ).data
}

export async function recheckMixPayPayment(
  tradeNo: string
): Promise<MixPayCheckout> {
  return requireServerSuccess(
    (
      await api.post(
        `/api/user/mixpay/order/${encodeURIComponent(tradeNo)}/recheck`,
        {}
      )
    ).data
  ).data
}
