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

import type {
  HwApiEnvelope,
  HwCreditPackages,
  HwOrderSummary,
  HwPriceComparison,
  HwQualityLatest,
  HwStatusAnswer,
  HwTopUpOrder,
  HwTopUpRequest,
} from './types'

export async function fetchHwCreditPackages(): Promise<HwCreditPackages> {
  const response = await api.get('/api/user/hw/packages')
  return requireServerSuccess(response.data).data as HwCreditPackages
}

/** Paid and refunded orders, newest first, with the bonus each one earned. */
export async function fetchHwOrderHistory(): Promise<HwOrderSummary[]> {
  const response = await api.get('/api/user/hw/orders')
  const data = requireServerSuccess(response.data).data as {
    orders?: HwOrderSummary[]
  }
  return data?.orders ?? []
}

export async function createHwTopUpOrder(
  request: HwTopUpRequest
): Promise<HwTopUpOrder> {
  const response = await api.post('/api/user/hw/orders', request)
  return requireServerSuccess(response.data).data as HwTopUpOrder
}

export type HwCompareRequest = {
  model: string
  input_tokens: number
  output_tokens: number
}

/** Public price comparison; unknown or unsold models answer 404. */
export async function compareHwPrices(
  request: HwCompareRequest
): Promise<HwApiEnvelope<HwPriceComparison>> {
  const res = await api.get('/api/hw/pricing/compare', { params: request })
  return requireServerSuccess(res.data as HwApiEnvelope<HwPriceComparison>)
}

/** Public quality summary of the newest measurement. */
export async function getHwQualityLatest(): Promise<
  HwApiEnvelope<HwQualityLatest>
> {
  const res = await api.get('/api/hw/quality/latest')
  return requireServerSuccess(res.data as HwApiEnvelope<HwQualityLatest>)
}

/** Public service status; needs no login. */
export async function getHwStatus(): Promise<HwApiEnvelope<HwStatusAnswer>> {
  const res = await api.get('/api/hw/status')
  return requireServerSuccess(res.data as HwApiEnvelope<HwStatusAnswer>)
}

export type HwPricingFeedbackRequest = {
  kind: 'price_wrong' | 'model_missing' | 'other'
  model: string
  message: string
  source_url: string
  email: string
  lang: 'tr' | 'en'
  /** Honeypot: hidden from people, filled by bots, never stored. */
  website: string
}

/** Public report from /pricing: a wrong price or a missing model. */
export async function sendHwPricingFeedback(
  request: HwPricingFeedbackRequest
): Promise<void> {
  const response = await api.post('/api/hw/pricing/feedback', request)
  requireServerSuccess(response.data)
}
