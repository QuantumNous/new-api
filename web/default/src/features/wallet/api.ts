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
  RedemptionRequest,
  PaymentRequest,
  AmountRequest,
  AffiliateTransferRequest,
  ApiResponse,
  TopupInfoResponse,
  RedemptionResponse,
  AmountResponse,
  PaymentResponse,
  StripePaymentResponse,
  PayPalPaymentResponse,
  AffiliateCodeResponse,
  AffiliateTransferResponse,
  BillingHistoryResponse,
  CompleteOrderRequest,
  CreemPaymentRequest,
  CreemPaymentResponse,
  WaffoPaymentRequest,
  WaffoPaymentResponse,
  WaffoPancakePaymentRequest,
  WaffoPancakePaymentResponse,
  PlategaPaymentRequest,
  PlategaPaymentResponse,
  ClinkPaymentRequest,
  ClinkPaymentResponse,
  ClinkConfirmRequest,
  ClinkConfirmResponse,
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
 * Redeem a topup code
 */
export async function redeemTopupCode(
  request: RedemptionRequest
): Promise<RedemptionResponse> {
  const res = await api.post('/api/user/topup', request)
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

/**
 * Calculate payment amount for PayPal payment
 */
export async function calculatePayPalAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/paypal/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request PayPal payment
 */
export async function requestPayPalPayment(
  request: PaymentRequest
): Promise<PayPalPaymentResponse> {
  const res = await api.post('/api/user/paypal/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
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
 * Calculate RUB amount for Platega SBP QR payment
 */
export async function calculatePlategaAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/platega/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Platega SBP QR payment
 */
export async function requestPlategaPayment(
  request: PlategaPaymentRequest
): Promise<PlategaPaymentResponse> {
  const res = await api.post('/api/user/platega/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Clink hosted checkout payment
 */
export async function requestClinkPayment(
  request: ClinkPaymentRequest
): Promise<ClinkPaymentResponse> {
  const res = await api.post('/api/user/clink/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Confirm Clink payment after hosted checkout redirect (sessionId in return URL).
 */
export async function confirmClinkPayment(
  request: ClinkConfirmRequest
): Promise<ClinkConfirmResponse> {
  const res = await api.post('/api/user/clink/confirm', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get affiliate code (apimaster referral_code, for the /register?ref= link).
 * Tries /api/auth/me (apimaster session) first — works for all users including admin.
 * Falls back to /api/user/referral_code (new-api, UUID-prefix lookup) if unavailable.
 */
export async function getAffiliateCode(): Promise<AffiliateCodeResponse> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (res.ok) {
      const json = await res.json()
      if (json?.success && json?.data?.referral_code) {
        return { success: true, message: '', data: json.data.referral_code }
      }
    }
  } catch {
    // fall through
  }
  const res = await api.get('/api/user/referral_code')
  return res.data
}

/**
 * Transfer affiliate quota to balance
 */
export async function transferAffiliateQuota(
  request: AffiliateTransferRequest
): Promise<AffiliateTransferResponse> {
  const res = await api.post('/api/user/aff_transfer', request)
  return res.data
}

/**
 * Get billing history for current user
 */
export async function getUserBillingHistory(
  page: number,
  pageSize: number,
  keyword?: string,
  status?: string
): Promise<ApiResponse<BillingHistoryResponse>> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
  if (keyword) {
    params.append('keyword', keyword)
  }
  if (status) {
    params.append('status', status)
  }
  const res = await api.get(`/api/user/topup/self?${params.toString()}`)
  return res.data
}

/**
 * Get billing history for all users (admin only)
 */
export async function getAllBillingHistory(
  page: number,
  pageSize: number,
  keyword?: string,
  status?: string,
  paymentMethod?: string
): Promise<ApiResponse<BillingHistoryResponse>> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
  if (keyword) {
    params.append('keyword', keyword)
  }
  if (status) {
    params.append('status', status)
  }
  if (paymentMethod) {
    params.append('payment_method', paymentMethod)
  }
  const res = await api.get(`/api/user/topup?${params.toString()}`)
  return res.data
}

export async function downloadAllBillingHistory(
  keyword?: string,
  status?: string,
  paymentMethod?: string
): Promise<void> {
  const params = new URLSearchParams()
  if (keyword) params.append('keyword', keyword)
  if (status) params.append('status', status)
  if (paymentMethod) params.append('payment_method', paymentMethod)
  const res = await api.get(`/api/user/topup/export?${params.toString()}`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
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

/**
 * Submit a crypto on-chain transaction hash for verification
 */
export async function submitCryptoDeposit(
  txHash: string,
  chain: string
): Promise<{ success: boolean; depositId?: string; error?: string }> {
  try {
    const res = await api.post(
      '/api/user/crypto/submit',
      { tx_hash: txHash, chain },
      { skipBusinessError: true } as Record<string, unknown>
    )
    return res.data
  } catch {
    return { success: false, error: 'Request failed' }
  }
}

/**
 * Poll crypto deposit status
 */
export async function getCryptoDepositStatus(
  depositId: string
): Promise<{ status: 'pending' | 'confirmed' | 'failed'; usdAdded?: number }> {
  const res = await api.get(`/api/user/crypto/deposit/${depositId}`)
  return res.data
}

export interface FirstTopupPromoInfo {
  enabled: boolean
  eligible: boolean
  never_recharged: boolean
  discount: number
  amount: number
  pay_amount: number
  expires_at: number
}

export interface SignupGiftInfo {
  enabled: boolean
  benefit_type: 'wallet_credit' | 'trial_subscription' | 'none'
  trial_credit_usd?: number
}

export async function getSignupGift(): Promise<SignupGiftInfo | null> {
  try {
    const res = await api.get('/api/user/signup_gift')
    if (res.data?.success && res.data?.data)
      return res.data.data as SignupGiftInfo
  } catch {
    // Keep sharing available when the campaign configuration is temporarily unavailable.
  }
  return null
}

export async function getFirstTopupPromo(): Promise<FirstTopupPromoInfo | null> {
  try {
    const res = await api.get('/api/user/first_topup_promo')
    if (res.data?.success && res.data?.data)
      return res.data.data as FirstTopupPromoInfo
  } catch {
    /* ignore */
  }
  return null
}

export type InvitePromoTrackEvent =
  | 'invite_popup_impression'
  | 'invite_popup_copy'

export async function trackInvitePromoEvent(
  event: InvitePromoTrackEvent
): Promise<void> {
  try {
    await api.post('/api/user/invite_promo_event', { event })
  } catch {
    // ignore tracking failures
  }
}
