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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export type OrderScope = 'site' | 'personal'

export interface SiteOrder {
  id: number
  order_type?: 'topup' | 'subscription'
  currency?: string
  payment_amount?: string
  user_id?: number
  username?: string
  trade_no: string
  provider_trade_no: string
  payment_provider: string
  payment_method: string
  order_status: string
  amount_fen: number | null
  frozen_quota: number | null
  money: number
  create_time: number
  complete_time: number
  expires_at: number
  close_requested_at?: number
  closed_at?: number
  close_reason?: string
  gateway_status?: string
  checked_at?: number
  next_check_at?: number
  retry_count?: number
  review_required?: boolean
  cancel_requested?: boolean
  sandbox: boolean
  cache_pending?: boolean
  last_error?: string
  last_check_at?: number
  last_check_success?: boolean | null
}
export interface OrderFilters {
  actionable?: boolean
  keyword: string
  user: string
  provider: string
  status: string
  start: string
  end: string
}
export async function getOrders(
  filters: OrderFilters,
  page: number,
  pageSize: number,
  scope: OrderScope = 'site'
) {
  const params = {
    ...filters,
    p: page,
    page_size: pageSize,
    start: filters.start
      ? Math.floor(new Date(filters.start).getTime() / 1000)
      : 0,
    end: filters.end ? Math.floor(new Date(filters.end).getTime() / 1000) : 0,
  }
  const response = await api.get<{
    success: boolean
    data: { items: SiteOrder[]; total: number }
  }>(scope === 'personal' ? '/api/user/self/orders' : '/api/user/orders', {
    params,
  })
  return requireServerSuccess(response.data).data
}
export async function getOrder(id: number, scope: OrderScope = 'site') {
  const response = await api.get<{ success: boolean; data: SiteOrder }>(
    scope === 'personal'
      ? `/api/user/self/orders/${id}`
      : `/api/user/orders/${id}`
  )
  return requireServerSuccess(response.data).data
}
export async function recheckOrder(id: number) {
  const response = await api.post(`/api/user/orders/${id}/recheck`)
  requireServerSuccess(response.data)
}

export async function recoverOrder(id: number, reason: string) {
  const response = await api.post<{
    success: boolean
    data: { result: string }
  }>(`/api/user/orders/${id}/recover`, { reason })
  return requireServerSuccess(response.data).data
}

export interface DirectOrderCheckout {
  payment_provider: 'alipay' | 'wechatpay'
  trade_no: string
  amount: string
  currency: 'CNY'
  expires_at: number
  pay_link?: string
  code_url?: string
}

export async function resumeOrder(id: number) {
  const response = await api.post<{
    success: boolean
    data: DirectOrderCheckout
  }>(`/api/user/self/orders/${id}/pay`, {
    mobile: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
  })
  return requireServerSuccess(response.data).data
}

export async function cancelOrder(id: number) {
  const response = await api.post<{
    success: boolean
    data: { status: 'closed' | 'closing' | 'paid' }
  }>(`/api/user/self/orders/${id}/cancel`, {})
  return requireServerSuccess(response.data).data
}

export async function getPendingDirectOrders() {
  const lists = await Promise.all(
    ['alipay', 'wechatpay'].map((provider) =>
      getOrders(
        {
          actionable: true,
          keyword: '',
          user: '',
          provider,
          status: 'pending',
          start: '',
          end: '',
        },
        1,
        1,
        'personal'
      )
    )
  )
  return {
    total: lists.reduce((sum, list) => sum + list.total, 0),
    order: lists
      .flatMap((list) => list.items)
      .sort((a, b) => b.create_time - a.create_time)[0],
  }
}
