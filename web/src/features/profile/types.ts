// ============================================================================
// Profile Type Definitions
// ============================================================================

/**
 * Generic API response
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

/**
 * User profile data
 */
export interface UserProfile {
  /** User ID */
  id: number
  /** Username */
  username: string
  /** Display name */
  display_name: string
  /** User role (1=普通用户, 10=管理员, 100=超级管理员) */
  role: number
  /** Email address */
  email?: string
  /** User group */
  group: string
  /** Current quota balance */
  quota: number
  /** Total used quota */
  used_quota: number
  /** Total request count */
  request_count: number
  /** Account status (1=启用, 2=禁用, 3=待审核, 4=已删除) */
  status: number
  /** Access token (system token) */
  access_token?: string
  /** Affiliate code */
  aff_code?: string
  /** Number of successful affiliate invites */
  aff_count: number
  /** Affiliate quota (pending rewards) */
  aff_quota: number
  /** Total affiliate quota earned (historical) */
  aff_history_quota: number
  /** Invite user ID */
  invite_user_id?: number
  /** Account creation timestamp */
  created_time: number
  /** User settings (JSON string) */
  setting?: string
  /** WeChat ID (OAuth) */
  wechat_id?: string
  /** GitHub ID (OAuth) */
  github_id?: string
  /** OIDC ID (OAuth) */
  oidc_id?: string
  /** Telegram ID (OAuth) */
  telegram_id?: string
  /** LinuxDO ID (OAuth) */
  linux_do_id?: string
}

/**
 * Notification type
 */
export type NotifyType = 'email' | 'webhook' | 'bark'

/**
 * Parsed user settings
 */
export interface UserSettings {
  /** Notification type */
  notify_type?: NotifyType
  /** Quota warning threshold */
  quota_warning_threshold?: number
  /** Webhook URL */
  webhook_url?: string
  /** Webhook secret */
  webhook_secret?: string
  /** Notification email */
  notification_email?: string
  /** Bark URL */
  bark_url?: string
  /** Accept unset model ratio model */
  accept_unset_model_ratio_model?: boolean
  /** Record IP log */
  record_ip_log?: boolean
}

/**
 * User update request
 */
export interface UpdateUserRequest {
  display_name?: string
  password?: string
  original_password?: string
}

/**
 * User settings update request
 */
export interface UpdateUserSettingsRequest {
  notify_type?: string
  quota_warning_threshold?: number
  webhook_url?: string
  webhook_secret?: string
  notification_email?: string
  bark_url?: string
  accept_unset_model_ratio_model?: boolean
  record_ip_log?: boolean
}

/**
 * Account deletion request
 */
export interface DeleteAccountRequest {
  password?: string
}

/**
 * Account binding item
 */
export interface BindingItem {
  id: string
  label: string
  icon: React.ElementType
  value?: string
  isBound: boolean
  isEnabled: boolean
  onBind: () => void
}

/**
 * Two-Factor Authentication Status
 */
export interface TwoFAStatus {
  enabled: boolean
  locked: boolean
  backup_codes_remaining: number
}

/**
 * Two-Factor Authentication Setup Data
 */
export interface TwoFASetupData {
  secret: string
  qr_code_data: string
  backup_codes: string[]
}
