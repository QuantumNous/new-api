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
import type {
  PaymentRequest,
  AmountRequest,
  ApiResponse,
  TopupInfoResponse,
  AmountResponse,
  PaymentResponse,
  StripePaymentResponse,
  BillingHistoryResponse,
  CompleteOrderRequest,
  CreemPaymentRequest,
  CreemPaymentResponse,
  WaffoPaymentRequest,
  WaffoPaymentResponse,
  WaffoPancakePaymentRequest,
  WaffoPancakePaymentResponse,
  PaddlePaymentRequest,
  PaddlePaymentResponse,
  PaddleTopUpStatusResponse,
  InvoiceProfile,
  InvoiceProfileResponse,
  RequestInvoiceResponse,
  RefundableSubscriptionTermsResponse,
  RefundSubscriptionTermResponse,
} from './types'

// ============================================================================
// Wallet API Functions
// ============================================================================

/**
 * Check if API response is successful
 */
export function isApiSuccess(response: ApiResponse): boolean {
  return response.success === true || response.message === 'success'
}

/**
 * Get topup configuration info
 */
export async function getTopupInfo(): Promise<TopupInfoResponse> {
  const res = await api.get('/api/user/topup/info')
  return res.data
}

/**
 * Calculate payment amount for regular payment
 */
export async function calculateAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Stripe payment
 */
export async function calculateStripeAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/stripe/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request regular payment
 */
export async function requestPayment(
  request: PaymentRequest
): Promise<PaymentResponse> {
  const res = await api.post('/api/user/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return {
    ...res.data,
    url: res.data.url || (res as unknown as { url?: string }).url,
  }
}

/**
 * Request Stripe payment
 */
export async function requestStripePayment(
  request: PaymentRequest
): Promise<StripePaymentResponse> {
  const res = await api.post('/api/user/stripe/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/** Reopen the existing Stripe session for a pending top-up. */
export async function resumeStripeTopup(
  tradeNo: string
): Promise<StripePaymentResponse> {
  const res = await api.post(
    `/api/user/topup/${encodeURIComponent(tradeNo)}/resume`,
    {},
    { skipBusinessError: true } as Record<string, unknown>
  )
  return res.data
}

/**
 * Get current user's default invoice profile
 */
export async function getInvoiceProfile(): Promise<InvoiceProfileResponse> {
  const res = await api.get('/api/user/invoice-profile')
  return res.data
}

/**
 * Save current user's default invoice profile
 */
export async function updateInvoiceProfile(
  request: InvoiceProfile
): Promise<InvoiceProfileResponse> {
  const res = await api.put('/api/user/invoice-profile', request)
  return res.data
}

/**
 * Request a Stripe invoice for a paid top-up order.
 */
export async function requestTopupInvoice(
  tradeNo: string,
  request: InvoiceProfile
): Promise<RequestInvoiceResponse> {
  const res = await api.post(
    `/api/user/topup/${encodeURIComponent(tradeNo)}/invoice`,
    request,
    {
      skipBusinessError: true,
    } as Record<string, unknown>
  )
  return res.data
}

/**
 * Request Creem payment
 */
export async function requestCreemPayment(
  request: CreemPaymentRequest
): Promise<CreemPaymentResponse> {
  const res = await api.post('/api/user/creem/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Waffo payment
 */
export async function requestWaffoPayment(
  request: WaffoPaymentRequest
): Promise<WaffoPaymentResponse> {
  const res = await api.post('/api/user/waffo/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Waffo Pancake payment
 */
export async function calculateWaffoPancakeAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/waffo-pancake/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Waffo Pancake payment
 */
export async function requestWaffoPancakePayment(
  request: WaffoPancakePaymentRequest
): Promise<WaffoPancakePaymentResponse> {
  const res = await api.post('/api/user/waffo-pancake/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Paddle payment
 */
export async function calculatePaddleAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/paddle/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Paddle payment
 */
export async function requestPaddlePayment(
  request: PaddlePaymentRequest
): Promise<PaddlePaymentResponse> {
  const res = await api.post('/api/user/paddle/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get Paddle wallet top-up status for a returned transaction.
 */
export async function getPaddleTopUpStatus(params: {
  transactionId?: string
  orderId?: string
}): Promise<PaddleTopUpStatusResponse> {
  const searchParams = new URLSearchParams()
  if (params.transactionId) {
    searchParams.set('transaction_id', params.transactionId)
  }
  if (params.orderId) {
    searchParams.set('order_id', params.orderId)
  }
  const res = await api.get(`/api/user/paddle/status?${searchParams}`, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get billing history for current user
 */
export async function getUserBillingHistory(
  page: number,
  pageSize: number,
  keyword?: string
): Promise<ApiResponse<BillingHistoryResponse>> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
  if (keyword) {
    params.append('keyword', keyword)
  }
  const res = await api.get(`/api/user/topup/self?${params.toString()}`)
  return res.data
}

/** Get prepaid plan terms that have not started and can be refunded. */
export async function getRefundableSubscriptionTerms(): Promise<RefundableSubscriptionTermsResponse> {
  const res = await api.get('/api/subscription/self/refundable-terms', {
    skipBusinessError: true,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/** Return one not-started prepaid plan term to the current user's wallet. */
export async function refundSubscriptionTerm(
  termSegmentId: number
): Promise<RefundSubscriptionTermResponse> {
  const res = await api.post(
    `/api/subscription/self/refundable-terms/${encodeURIComponent(String(termSegmentId))}/refund`,
    {},
    {
      skipBusinessError: true,
      skipErrorHandler: true,
    } as Record<string, unknown>
  )
  return res.data
}

/**
 * Get billing history for all users (admin only)
 */
export async function getAllBillingHistory(
  page: number,
  pageSize: number,
  keyword?: string
): Promise<ApiResponse<BillingHistoryResponse>> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
  if (keyword) {
    params.append('keyword', keyword)
  }
  const res = await api.get(`/api/user/topup?${params.toString()}`)
  return res.data
}

/**
 * Complete a pending order (admin only)
 */
export async function completeOrder(
  request: CompleteOrderRequest
): Promise<ApiResponse> {
  const res = await api.post('/api/user/topup/complete', request)
  return res.data
}
