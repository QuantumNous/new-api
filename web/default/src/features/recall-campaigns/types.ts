export type RecallAudienceTemplate =
  | 'first_purchase'
  | 'lapsed_payer'
  | 'expired_subscription'
  | 'registered_only'
  | 'registration_time_range'
  | 'specified_users'

export type RecallCampaignType = 'promotion' | 'content_only'
export type RecallExecutionMode = 'manual' | 'scheduled_once' | 'recurring'
export type RecallCouponSource = 'automatic' | 'existing'
export type RecallDiscountType = 'percent' | 'fixed'
export type RecallPromotionExpiryMode = 'relative' | 'fixed'
export type RecallFixedCurrency = 'USD' | 'INR' | 'BRL' | 'JPY'
export type RecallMinimumSpendCurrency = 'usd' | 'inr' | 'brl' | 'jpy'
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
  minimum_spend?: RecallMinimumSpendConfig
}

export interface RecallMinimumSpendConfig {
  enabled: boolean
  amounts: Partial<Record<RecallMinimumSpendCurrency, number>>
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
  campaign_type?: RecallCampaignType
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
  source_revision?: number
  translated_source_revision?: number
  manual_locales?: string[]
  templates: Record<string, RecallEmailTemplate>
}

export type RecallEmailLocaleStatus = 'ready' | 'stale' | 'manual' | 'missing'

export interface RecallCampaignDraft {
  campaign_type: RecallCampaignType
  name: string
  audience_template: RecallAudienceTemplate
  audience_config: RecallAudienceConfig
  execution_mode: RecallExecutionMode
  schedule: RecallScheduleConfig
  coupon_source: RecallCouponSource
  existing_coupon_id: string
  discount_config: RecallDiscountConfig
  product_scope: RecallProductScope
  promotion_expiry_mode: RecallPromotionExpiryMode
  promotion_expires_at: number
  promotion_valid_seconds: number
  enrollment_limit: number
  worker_concurrency: number
  email_sequence: RecallEmailStage[]
  defer_localization: boolean
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
export type RecallPaymentCategory =
  | 'direct_topup'
  | 'balance_subscription'
  | 'online_subscription'
  | 'unclassified'
  | ''

export type RecallMetricKey =
  | 'candidates'
  | 'enrolled'
  | 'excluded'
  | 'opened_recipients'
  | 'observed_clicks'
  | 'messages_accepted'
  | 'messages_failed'
  | 'direct_conversions'
  | 'assisted_conversions'
  | 'no_coupon_conversions'
  | 'attributed_spend'
  | 'new_external_cash'
  | 'direct_topup'
  | 'balance_subscription'
  | 'online_subscription'

export type RecallTranslationTaskStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'superseded'

export interface RecallMetricFilters {
  q?: string
  stage_no?: number
  state?: string
  conversion_kind?: RecallConversionKind
  payment_category?: RecallPaymentCategory
  currency?: string
  snapshot?: string
  cursor?: string
  limit?: number
}

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
  campaign_type: RecallCampaignType
  name: string
  status: RecallCampaignStatus
  audience_template: RecallAudienceTemplate
  execution_mode: RecallExecutionMode
  scheduled_at: number
  next_run_at: number
  coupon_source: RecallCouponSource
  stripe_coupon_id: string
  promotion_expiry_mode: RecallPromotionExpiryMode
  promotion_expires_at: number
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

export interface RecallEmailGenerationRequest {
  config_revision: number
  name: string
  email_sequence: RecallEmailStage[]
}

export interface RecallEmailQuotaStatus {
  limit: number
  used: number
  remaining: number
  window_started_at: number
  resets_at: number
  exhausted: boolean
}

export interface RecallActivitySMTPStatus {
  server: string
  port: number
  account: string
  email_from: string
  ssl_enabled: boolean
  force_auth_login: boolean
  token_configured: boolean
  configured: boolean
  reply_to: string
  unsubscribe_mailto: string
}

export interface RecallActivitySMTPInput {
  server: string
  port: number
  account: string
  email_from: string
  token: string
  ssl_enabled: boolean
  force_auth_login: boolean
  reply_to: string
  unsubscribe_mailto: string
}

export type RecallEmailLocalizationBlockerReason =
  | 'missing'
  | 'stale'
  | 'invalid'

export interface RecallEmailLocalizationBlocker {
  stage_no: number
  locale: string
  reason: RecallEmailLocalizationBlockerReason
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
  opened_recipient_count: number
  observed_click_count: number
  direct_count: number
  assisted_count: number
  no_coupon_count: number
  currency_metrics: RecallCurrencyMetrics[]
  metric_cards?: Record<string, RecallMetricCard>
}

export interface RecallMetricAmount {
  currency: string
  amount_minor: number
  user_count: number
}

export interface RecallMetricCard {
  key: RecallMetricKey
  total: number
  amounts: RecallMetricAmount[]
  row_grain: 'identity' | 'message' | 'conversion' | string
  snapshot: string
  legacy_unidentified_count: number
  drilldown_complete: boolean
  supported_filters: Record<string, boolean>
}

export interface RecallMetricRow {
  row_id: number
  recipient_id: number
  message_id: number
  user_id: number
  email: string
  occurred_at: number
  stage_no: number
  state: string
  conversion_kind: RecallConversionKind
  trade_no: string
  payment_category: RecallPaymentCategory
  currency: string
  amount_minor: number
  failure_code: string
}

export interface RecallMetricResult {
  items: RecallMetricRow[]
  total: number
  amounts: RecallMetricAmount[]
  snapshot: string
  next_cursor?: string
  legacy_unidentified_count: number
  drilldown_complete: boolean
}

export interface RecallTranslationTask {
  id: number
  campaign_id: number
  requested_config_revision: number
  result_config_revision?: number
  status: RecallTranslationTaskStatus
  attempt_count: number
  error_code?: string
  error_copy_key?: string
  created_at: number
  started_at?: number
  finished_at?: number
}

export interface RecallExclusionProblem {
  row: number
  code: string
  message: string
}

export interface RecallExclusionPreview {
  batch_id: number
  total_rows: number
  resolved_users: number
  duplicate_rows: number
  unresolved_rows: number
  conflict_rows: number
  blocking_errors: RecallExclusionProblem[]
  warnings: RecallExclusionProblem[]
  cancelable_work: number
  confirmable: boolean
}

export function isRecallTranslationTaskActive(
  status: RecallTranslationTaskStatus
): boolean {
  return status === 'queued' || status === 'running'
}

export function isRecallTranslationTaskTerminal(
  status: RecallTranslationTaskStatus
): boolean {
  return !isRecallTranslationTaskActive(status)
}

export interface RecallAudienceCandidate {
  user_id: number
  email_masked: string
  language: string
}

export interface RecallStripePreview {
  coupon_source: RecallCouponSource
  coupon_id: string
  discount: Omit<RecallDiscountConfig, 'currency_options'> & {
    currency_options: Record<string, number> | null
  }
  topup_price_ids: string[]
  subscription_price_ids: string[]
  product_ids: string[]
}

export interface RecallCampaignPreview {
  eligible_total: number
  sample: RecallAudienceCandidate[]
  exclusions: Record<string, number>
  stripe: RecallStripePreview | null
}

export type RecallCampaignAction =
  | 'activate'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'complete'
