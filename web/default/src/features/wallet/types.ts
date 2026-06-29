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
// ============================================================================
// Wallet Type Definitions
// ============================================================================

/**
 * Generic API response
 */
export interface ApiResponse<T = unknown> {
  success?: boolean
  message?: string
  data?: T
}

/**
 * Standard API response types
 */
export type TopupInfoResponse = ApiResponse<TopupInfo>
export type RedemptionResponse = ApiResponse<number>
export type AmountResponse = ApiResponse<string>
export type PaymentResponse = ApiResponse<Record<string, unknown>> & {
  url?: string
}
export type StripePaymentResponse = ApiResponse<{ pay_link: string }>
export type AffiliateCodeResponse = ApiResponse<string>
export type AffiliateTransferResponse = ApiResponse
export type CreemPaymentResponse = ApiResponse<{ checkout_url: string }>
export type WaffoPaymentResponse = ApiResponse<
  { payment_url?: string } | string
>
export type WaffoPancakePaymentResponse = ApiResponse<
  | {
      checkout_url?: string
      session_id?: string
      expires_at?: number | string
      order_id?: string
      // Self-service session token + expiry — surfaced by the backend so
      // future flows (refund / cancel from new-api's own UI) can use them
      // without re-issuing checkout. Not consumed by the current handler.
      token?: string
      token_expires_at?: number | string
    }
  | string
>
export type PaddlePaymentResponse = ApiResponse<
  | {
      checkout_url?: string
      transaction_id?: string
      order_id?: string
      sandbox?: boolean
    }
  | string
>
export type PaddleTopUpStatusResponse = ApiResponse<PaddleTopUpStatus>
export type InvoiceProfileResponse = ApiResponse<InvoiceProfile | null>
export type RequestInvoiceResponse = ApiResponse<PaymentInvoice | null>

export interface PaddleTopUpStatus {
  order_id: string
  transaction_id?: string
  status: TopupStatus
  amount: number
  money: number
  create_time: number
  complete_time?: number
}

export interface InvoiceProfile {
  company_name: string
  billing_email?: string
  tax_id_type?: string
  tax_id?: string
  country: string
  state?: string
  city?: string
  address_line1: string
  address_line2?: string
  postal_code?: string
  phone?: string
}

export interface PaymentInvoice {
  invoice_requested: boolean
  company_name?: string
  billing_email?: string
  tax_id_type?: string
  tax_id?: string
  country?: string
  state?: string
  city?: string
  address_line1?: string
  address_line2?: string
  postal_code?: string
  phone?: string
  stripe_invoice_id?: string
  stripe_invoice_number?: string
  stripe_invoice_url?: string
  stripe_invoice_pdf?: string
  invoice_status?: string
}

/**
 * Creem product configuration
 */
export interface CreemProduct {
  /** Product display name */
  name: string
  /** Creem product ID */
  productId: string
  /** Product price */
  price: number
  /** Quota amount to credit */
  quota: number
  /** Currency (USD or EUR) */
  currency: 'USD' | 'EUR'
}

/**
 * Creem payment request
 */
export interface CreemPaymentRequest {
  /** Creem product ID */
  product_id: string
  /** Payment method identifier */
  payment_method: 'creem'
  /** GA4 client_id captured from browser cookies */
  ga_client_id?: string
  /** GA4 session_id captured from browser cookies */
  ga_session_id?: string
}

/**
 * Payment method configuration
 */
export interface PaymentMethod {
  /** Display name of payment method */
  name: string
  /** Payment method type identifier */
  type: string
  /** Optional color for UI display */
  color?: string
  /** Minimum topup amount for this payment method */
  min_topup?: number
  /** Optional icon URL provided by backend (preferred over built-in icons) */
  icon?: string
}

/**
 * Waffo payment method configuration
 */
export interface WaffoPayMethod {
  /** Display name of payment method */
  name: string
  /** Optional icon path */
  icon?: string
  /** Waffo pay method type */
  payMethodType?: string
  /** Waffo pay method name */
  payMethodName?: string
}

/**
 * Topup configuration information
 */
export interface TopupInfo {
  /** Whether online topup is enabled */
  enable_online_topup: boolean
  /** Whether Stripe topup is enabled */
  enable_stripe_topup: boolean
  /** Available payment methods */
  pay_methods: PaymentMethod[]
  /** Minimum topup amount for online topup */
  min_topup: number
  /** Minimum topup amount for Stripe */
  stripe_min_topup: number
  /** Preset amount options */
  amount_options: number[]
  /** Discount rates by amount */
  discount: Record<number, number>
  /** Bonus amounts by selected recharge amount */
  bonus: Record<number, number>
  /** 当前用户在各档位的剩余可领赠送次数（仅含配置了限次的档位）。缺该档位 key = 不限次 */
  bonus_remaining?: Record<number, number>
  /** Optional topup link for purchasing codes */
  topup_link?: string
  /** Whether Creem topup is enabled */
  enable_creem_topup?: boolean
  /** Available Creem products */
  creem_products?: CreemProduct[]
  /** Whether Waffo topup is enabled */
  enable_waffo_topup?: boolean
  /** Available Waffo payment methods */
  waffo_pay_methods?: WaffoPayMethod[]
  /** Minimum topup amount for Waffo */
  waffo_min_topup?: number
  /** Whether Waffo Pancake topup is enabled */
  enable_waffo_pancake_topup?: boolean
  /** Minimum topup amount for Waffo Pancake */
  waffo_pancake_min_topup?: number
  /** Whether Paddle topup is enabled */
  enable_paddle_topup?: boolean
  /** Minimum topup amount for Paddle */
  paddle_min_topup?: number
  /** Paddle sandbox mode */
  paddle_sandbox?: boolean
  /** Public Paddle.js client-side token */
  paddle_client_token?: string
  /** Whether redemption code usage is enabled */
  enable_redemption?: boolean
  /** Whether compliance confirmation has been completed */
  payment_compliance_confirmed?: boolean
  /** Current compliance terms version */
  payment_compliance_terms_version?: string
}

/**
 * Preset amount option with optional discount
 */
export interface PresetAmount {
  /** Preset amount value */
  value: number
  /** Optional discount rate (0-1) */
  discount?: number
  /** Optional bonus amount credited in addition to value */
  bonus?: number
}

/**
 * Redemption code request
 */
export interface RedemptionRequest {
  /** Redemption code key */
  key: string
}

/**
 * Payment request parameters
 */
export interface PaymentRequest {
  /** Topup amount */
  amount: number
  /** Payment method identifier */
  payment_method: string
  /** Stripe checkout package currency selected from the current locale */
  stripe_currency?: 'USD' | 'JPY' | 'BRL'
  /** Save the card during payment (setup_future_usage) for later off-session auto-charge */
  save_card?: boolean
  /** Optional redirect URL after successful hosted checkout */
  success_url?: string
  /** Optional redirect URL after cancelled hosted checkout */
  cancel_url?: string
  /** Whether Stripe should create a company invoice */
  invoice_requested?: boolean
  /** Company invoice profile snapshot */
  invoice_profile?: InvoiceProfile
  /** GA4 client_id captured from browser cookies */
  ga_client_id?: string
  /** GA4 session_id captured from browser cookies */
  ga_session_id?: string
}

export interface PaymentOptions {
  invoiceRequested?: boolean
  invoiceProfile?: InvoiceProfile
}

/**
 * Waffo payment request parameters
 */
export interface WaffoPaymentRequest {
  /** Topup amount */
  amount: number
  /** Optional server-side Waffo payment method index */
  pay_method_index?: number
  /** GA4 client_id captured from browser cookies */
  ga_client_id?: string
  /** GA4 session_id captured from browser cookies */
  ga_session_id?: string
}

/**
 * Waffo Pancake payment request parameters
 */
export interface WaffoPancakePaymentRequest {
  /** Topup amount */
  amount: number
  /** GA4 client_id captured from browser cookies */
  ga_client_id?: string
  /** GA4 session_id captured from browser cookies */
  ga_session_id?: string
}

/**
 * Paddle payment request parameters
 */
export interface PaddlePaymentRequest {
  /** Topup amount */
  amount: number
  /** GA4 client_id captured from browser cookies */
  ga_client_id?: string
  /** GA4 session_id captured from browser cookies */
  ga_session_id?: string
}

/**
 * Amount calculation request
 */
export interface AmountRequest {
  /** Topup amount to calculate */
  amount: number
}

/**
 * Affiliate quota transfer request
 */
export interface AffiliateTransferRequest {
  /** Quota amount to transfer */
  quota: number
}

/**
 * User wallet data
 */
export interface UserWalletData {
  /** User ID */
  id: number
  /** Username */
  username: string
  /** Current quota balance */
  quota: number
  /** Total used quota */
  used_quota: number
  /** Total request count */
  request_count: number
  /** Affiliate quota (pending rewards) */
  aff_quota: number
  /** Total affiliate quota earned (historical) */
  aff_history_quota: number
  /** Number of successful affiliate invites */
  aff_count: number
  /** User group */
  group: string
}

/**
 * Topup record status
 */
export type TopupStatus = 'success' | 'pending' | 'failed' | 'expired'

/**
 * Topup billing record
 */
export interface TopupRecord {
  /** Record ID */
  id: number
  /** User ID */
  user_id: number
  /** Topup amount (quota) */
  amount: number
  /** Payment amount (actual money paid) */
  money: number
  /** Bonus amount included in amount */
  bonus_amount?: number
  /** Trade/order number */
  trade_no: string
  /** Payment method type */
  payment_method: string
  /** Upstream payment provider */
  payment_provider?: string
  /** Upstream payment gateway transaction/order number */
  gateway_trade_no?: string
  /** Upstream payment currency */
  payment_currency?: string
  /** Creation timestamp */
  create_time: number
  /** Completion timestamp */
  complete_time?: number
  /** Payment status */
  status: TopupStatus
  /** Optional invoice snapshot for this order */
  invoice?: PaymentInvoice
}

/**
 * Billing history response
 */
export interface BillingHistoryResponse {
  items: TopupRecord[]
  total: number
}

/**
 * Complete order request (admin only)
 */
export interface CompleteOrderRequest {
  trade_no: string
}
