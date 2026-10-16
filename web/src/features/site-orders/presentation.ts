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
import type { TFunction } from 'i18next'

import { formatLocalCurrencyAmount } from '@/lib/currency'

import type { SiteOrder } from './api'

export function paymentAmount(order: SiteOrder): string {
  let amount = order.amount_fen === null ? order.money : order.amount_fen / 100
  if (order.payment_amount) amount = Number(order.payment_amount)
  // Other legacy providers do not persist a reliable currency snapshot.
  let currency = order.amount_fen === null ? '' : 'CNY '
  if (order.currency) currency = `${order.currency} `
  return (
    currency +
    formatLocalCurrencyAmount(amount, {
      showSymbol: false,
      digitsLarge: 2,
      digitsSmall: 2,
      abbreviate: false,
    })
  )
}

export function reviewResolutionLabel(action: string, t: TFunction): string {
  switch (action) {
    case 'fulfill':
      return t('Review resolved: fulfilled')
    case 'refunded':
      return t('External refund recorded')
    case 'acknowledged':
      return t('Resolved without adjustment')
    default:
      return t('Record review outcome')
  }
}

// Provider states are presentation only; never use these labels for settlement.
export function paymentProviderStatusLabel(
  provider: string,
  status: string | null | undefined,
  t: TFunction
): string {
  if (!status) return t('Not recorded')
  let labels: Record<string, string>
  switch (provider) {
    case 'antom':
      labels = {
        SUCCESS: t('Payment successful'),
        FAIL: t('Payment failed'),
        CANCELLED: t('Cancelled'),
        PROCESSING: t('Payment processing'),
        PENDING: t('Payment pending confirmation'),
        ORDER_NOT_EXIST: t('No payment record at provider'),
        CAPTURE_PENDING: t('Capture not completed'),
        REFUNDED: t('Refund transaction confirmed'),
        QUERY_FAILED: t('Payment query failed'),
        CANCEL_REQUESTED: t('Cancellation requested'),
        CANCEL_REJECTED: t('Cancellation rejected'),
      }
      break
    case 'webmoney':
      labels = {
        success: t('Payment successful'),
        'x18:-100': t('Invalid query parameters'),
        'x18:-2': t('Invalid query parameters'),
        'x18:-3': t('Invalid query parameters'),
        'x18:-6': t('Query authentication failed'),
        'x18:-7': t('Query authentication failed'),
        'x18:-8': t('Provider internal query error'),
        'x18:1': t('Merchant purse not found'),
        'x18:2': t('Query authentication configuration required'),
        'x18:3': t('Query authentication configuration required'),
        'x18:4': t('Merchant identity or purse authorization missing'),
        'x18:6': t('Merchant identity or purse authorization missing'),
        'x18:7': t('Payment not found'),
        'x18:10': t('Payment not found'),
        'x18:11': t('Awaiting payment'),
        'x18:12': t('Payment not found'),
        'x18:14': t('Payment rejected'),
        'x18:8': t('Payment not found'),
        'x18:9': t('Awaiting payment'),
        'x18:13': t('Payment rejected'),
        'hold:4': t('Payment held'),
        'hold:12': t('Payment refunded'),
        query_failed: t('Payment query failed'),
      }
      break
    case 'mixpay':
      labels = {
        success: t('Payment successful'),
        failed: t('Payment failed'),
        unpaid: t('Awaiting payment'),
        confirming: t('Awaiting blockchain confirmations'),
        paid_less: t('Underpaid; awaiting additional payment'),
        pending: t('Payment processing'),
        auditing: t('Payment under review'),
      }
      break
    case 'alipay':
      labels = {
        WAIT_BUYER_PAY: t('Awaiting payment'),
        TRADE_SUCCESS: t('Payment successful'),
        TRADE_FINISHED: t('Trade finished; no further refunds'),
        TRADE_CLOSED: t('Unpaid trade closed or fully refunded'),
        REFUNDED: t('Payment refunded'),
        NOT_FOUND: t('No payment record at provider'),
      }
      break
    case 'wechatpay':
      labels = {
        SUCCESS: t('Payment successful'),
        CLOSED: t('Closed by payment provider'),
        REFUND: t('Refund in progress'),
        REVOKED: t('Payment revoked'),
        NOTPAY: t('Awaiting payment'),
        USERPAYING: t('Buyer is paying'),
        PAYERROR: t('Payment failed'),
        ACCEPT: t('Payment accepted'),
        NOT_FOUND: t('No payment record at provider'),
      }
      break
    default:
      labels = {}
  }
  if (Object.hasOwn(labels, status)) return labels[status]
  if (provider === 'antom' && status.startsWith('API_')) {
    return t('Payment query error ({{code}})', { code: status.slice(4) })
  }
  return t('Unrecognized provider status ({{code}})', { code: status })
}
