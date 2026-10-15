import i18next from 'i18next'

import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type { MixPayCheckout } from './mixpay'

export async function quoteAntom(amount: number, planID = 0) {
  return requireServerSuccess(
    (await api.post('/api/user/antom/amount', { amount, plan_id: planID })).data
  ) as { data: string }
}
export async function createAntomPayment(
  amount: number,
  expectedAmount: string,
  requestKey: string,
  planID = 0
): Promise<MixPayCheckout> {
  return requireServerSuccess(
    (
      await api.post(
        planID ? '/api/subscription/antom/pay' : '/api/user/antom/pay',
        {
          plan_id: planID,
          amount,
          expected_amount: expectedAmount,
          request_key: requestKey,
        }
      )
    ).data
  ).data
}
export async function getAntomPayment(
  tradeNo: string
): Promise<MixPayCheckout> {
  return requireServerSuccess(
    (await api.get(`/api/user/antom/order/${encodeURIComponent(tradeNo)}`)).data
  ).data
}

export async function getAntomCheckoutURL(tradeNo: string): Promise<string> {
  const response = await api.post(
    `/api/user/antom/order/${encodeURIComponent(tradeNo)}/session`,
    {}
  )
  const data = requireServerSuccess(response.data).data as {
    checkout_url: string
  }
  const target = new URL(data.checkout_url)
  if (
    target.protocol !== 'https:' ||
    target.host !== 'checkout.antom.com' ||
    target.username ||
    target.password
  ) {
    throw new Error(i18next.t('Invalid payment redirect URL'))
  }
  return target.href
}

export async function recheckAntomPayment(
  tradeNo: string
): Promise<MixPayCheckout> {
  return requireServerSuccess(
    (
      await api.post(
        `/api/user/antom/order/${encodeURIComponent(tradeNo)}/recheck`,
        {}
      )
    ).data
  ).data
}
