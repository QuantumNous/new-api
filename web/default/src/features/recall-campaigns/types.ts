export type RecallAudienceTemplate =
  | 'first_purchase'
  | 'lapsed_payer'
  | 'expired_subscription'
  | 'registered_only'
  | 'specified_users'

export type RecallExecutionMode = 'manual' | 'scheduled_once' | 'recurring'
export type RecallCouponSource = 'automatic' | 'existing'
export type RecallDiscountType = 'percent' | 'fixed'
export type RecallFixedCurrency = 'USD' | 'INR' | 'BRL' | 'JPY'
export type RecallFrequency = 'daily' | 'weekly'
export type RecallGroupMode = '' | 'allow' | 'block'

export interface RecallAudienceConfig {
  registration_age_days: number
  min_request_count: number
  max_quota: number
  min_paid_amount: number
  last_api_call_age_days: number
  last_payment_age_days: number
  subscription_expired_days: number
  min_subscription_amount: number
  min_subscription_count: number
  payment_providers: string[]
  groups: string[]
  group_mode: RecallGroupMode
  require_verified_email: boolean
  registration_start_at: number
  registration_end_at: number
  specified_user_ids: number[]
  specified_emails: string[]
}

export interface RecallAudienceUserOption {
  id: number
  username: string
  display_name: string
  email: string
  status: number
}

export interface RecallScheduleConfig {
  scheduled_at: number
  timezone: string
  frequency: string
  weekday: number
  hour: number
  minute: number
}

export interface RecallDiscountConfig {
  type: RecallDiscountType
  percent_off: number
  amount_off: number
  currency: string
  currency_options: Record<string, number>
  minimum_amount: number
  minimum_amount_currency: string
  coupon_redeem_by: number
}

export interface RecallProductScope {
  topup_price_ids: string[]
  subscription_price_ids: string[]
}

export interface RecallTopUpProductConfiguration {
  stripe_price_ids?: Record<string, string>
}

export interface RecallSubscriptionProductPlan {
  id: number
  title: string
  price_amount: number
  currency: string
  enabled: boolean
  stripe_price_id?: string
}

export interface RecallSubscriptionProductRecord {
  plan: RecallSubscriptionProductPlan
}

export interface RecallEmailTemplate {
  subject: string
  body_text?: string
  body_html?: string
}

export interface RecallEmailPreviewRequest {
  template: RecallEmailTemplate
}

export interface RecallEmailPreviewResponse {
  subject: string
  body_html: string
}

export interface RecallEmailStage {
  stage_no: number
  delay_seconds: number
  template_version: number
  templates: Record<string, RecallEmailTemplate>
}

export interface RecallCampaignDraft {
  name: string
  audience_template: RecallAudienceTemplate
  audience_config: RecallAudienceConfig
  execution_mode: RecallExecutionMode
  schedule: RecallScheduleConfig
  coupon_source: RecallCouponSource
  existing_coupon_id: string
  discount_config: RecallDiscountConfig
  product_scope: RecallProductScope
  promotion_valid_seconds: number
  enrollment_limit: number
  worker_concurrency: number
  email_sequence: RecallEmailStage[]
}

export type RecallCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'completed'

export type RecallRecipientState =
  | 'queued'
  | 'customer_ready'
  | 'code_ready'
  | 'contacting'
  | 'converted'
  | 'suppressed'
  | 'ineligible'
  | 'expired'
  | 'failed'

export type RecallMessageState =
  | 'scheduled'
  | 'leased'
  | 'sending'
  | 'accepted'
  | 'retry_wait'
  | 'uncertain'
  | 'failed'
  | 'cancelled'

export type RecallConversionKind = 'direct' | 'assisted' | 'no_coupon' | ''

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface RecallPage<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface RecallCampaignSearch {
  p?: number
  ps?: number
  status?: RecallCampaignStatus | ''
}

export interface RecallCampaignSummary {
  id: number
  name: string
  status: RecallCampaignStatus
  audience_template: RecallAudienceTemplate
  execution_mode: RecallExecutionMode
  scheduled_at: number
  next_run_at: number
  coupon_source: RecallCouponSource
  stripe_coupon_id: string
  promotion_valid_seconds: number
  enrollment_limit: number
  worker_concurrency: number
  config_revision: number
  created_by: number
  created_at: number
  updated_at: number
  activated_at: number
  completed_at: number
  recipient_total: number
}

export interface RecallCampaignDetail extends RecallCampaignSummary {
  draft: RecallCampaignDraft
}

export interface RecallMessage {
  id: number
  recipient_id: number
  stage_no: number
  template_version: number
  scheduled_at: number
  state: RecallMessageState
  attempt_count: number
  next_attempt_at: number
  lease_expires_at: number
  provider_message_id: string
  accepted_at: number
  failed_at: number
  last_error_code: string
  last_error_message: string
  created_at: number
  updated_at: number
}

export interface RecallRecipient {
  id: number
  campaign_id: number
  user_id: number
  language_snapshot: string
  state: RecallRecipientState
  stripe_customer_id: string
  promotion_code_masked: string
  promotion_expires_at: number
  first_sent_at: number
  last_sent_at: number
  clicked_at: number
  converted_at: number
  conversion_kind: RecallConversionKind
  conversion_trade_no: string
  conversion_currency: string
  conversion_amount: number
  discount_amount: number
  last_error_code: string
  last_error_message: string
  created_at: number
  updated_at: number
  messages: RecallMessage[]
}

export interface RecallEvent {
  id: number
  campaign_id: number
  recipient_id: number
  event_type: string
  source: string
  source_event_id: string
  event_data: string
  created_at: number
}

export interface RecallCurrencyMetrics {
  currency: string
  direct_count: number
  assisted_count: number
  no_coupon_count: number
  payment_amount: number
  discount_amount: number
}

export interface RecallCampaignMetrics {
  candidate_count: number
  enrolled_count: number
  excluded_count: number
  customer_success_count: number
  customer_failure_count: number
  code_success_count: number
  code_failure_count: number
  messages_scheduled_count: number
  messages_accepted_count: number
  messages_failed_count: number
  messages_cancelled_count: number
  observed_click_count: number
  direct_count: number
  assisted_count: number
  no_coupon_count: number
  currency_metrics: RecallCurrencyMetrics[]
}

export interface RecallAudienceCandidate {
  user_id: number
  email_masked: string
  language: string
}

export interface RecallStripePreview {
  coupon_source: RecallCouponSource
  coupon_id: string
  discount: RecallDiscountConfig
  topup_price_ids: string[]
  subscription_price_ids: string[]
  product_ids: string[]
}

export interface RecallCampaignPreview {
  eligible_total: number
  sample: RecallAudienceCandidate[]
  exclusions: Record<string, number>
  stripe: RecallStripePreview
}

export type RecallCampaignAction =
  | 'activate'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'complete'
