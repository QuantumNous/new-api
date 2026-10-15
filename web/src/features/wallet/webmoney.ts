import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type { MixPayCheckout } from './mixpay'

export async function quoteWebMoney(amount: number, planID = 0) {
  return requireServerSuccess(
    (await api.post('/api/user/webmoney/amount', { amount, plan_id: planID })).data
  ) as { data: string }
}
export async function createWebMoneyPayment(
  amount: number,
  expectedAmount: string,
  requestKey: string,
  planID = 0
): Promise<MixPayCheckout> {
  return requireServerSuccess(
    (
      await api.post(planID ? '/api/subscription/webmoney/pay' : '/api/user/webmoney/pay', {
        plan_id: planID,
        amount,
        expected_amount: expectedAmount,
        request_key: requestKey,
      })
    ).data
  ).data
}
export async function getWebMoneyPayment(
  tradeNo: string
): Promise<MixPayCheckout> {
  return requireServerSuccess(
    (await api.get(`/api/user/webmoney/order/${encodeURIComponent(tradeNo)}`))
      .data
  ).data
}
