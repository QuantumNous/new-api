/** Raw key-value pair returned by GET /api/option/ */
export interface SystemOption {
  key: string
  value: string
}

export interface SystemOptionsResponse {
  success: boolean
  message: string
  data: SystemOption[]
}

export interface UpdateOptionRequest {
  key: string
  value: string | boolean | number
}

// ─── Parsed setting groups ─────────────────────────────────────────────────

export interface SiteSettings {
  SystemName: string
  Logo: string
  Footer: string
  About: string
  HomePageContent: string
  ServerAddress: string
  Notice: string
  HeaderNavModules: string
  SidebarModulesAdmin: string
  'legal.user_agreement': string
  'legal.privacy_policy': string
}

export interface AuthSettings {
  PasswordLoginEnabled: boolean
  PasswordRegisterEnabled: boolean
  EmailVerificationEnabled: boolean
  RegisterEnabled: boolean
  EmailDomainRestrictionEnabled: boolean
  EmailAliasRestrictionEnabled: boolean
  EmailDomainWhitelist: string
  GitHubOAuthEnabled: boolean
  GitHubClientId: string
  GitHubClientSecret: string
  'discord.enabled': boolean
  'discord.client_id': string
  'discord.client_secret': string
  'oidc.enabled': boolean
  'oidc.display_name': string
  'oidc.client_id': string
  'oidc.client_secret': string
  'oidc.well_known': string
  'oidc.authorization_endpoint': string
  'oidc.token_endpoint': string
  'oidc.user_info_endpoint': string
  TelegramOAuthEnabled: boolean
  TelegramBotToken: string
  TelegramBotName: string
  LinuxDOOAuthEnabled: boolean
  LinuxDOClientId: string
  LinuxDOClientSecret: string
  WeChatAuthEnabled: boolean
  WeChatServerAddress: string
  WeChatServerToken: string
  TurnstileCheckEnabled: boolean
  TurnstileSiteKey: string
  TurnstileSecretKey: string
  'passkey.enabled': boolean
  'passkey.rp_display_name': string
  'passkey.rp_id': string
  'passkey.origins': string
}

export interface BillingSettings {
  QuotaForNewUser: number
  PreConsumedQuota: number
  QuotaForInviter: number
  QuotaForInvitee: number
  AffiliateEnabled: boolean
  AffiliateRegistrationRequired: boolean
  AffiliateRebateRateBps: number
  AffiliateFreezeHours: number
  AffiliateDurationDays: number
  AffiliatePerInviteeCap: number
  AffiliateActivatedAt: number
  TopUpLink: string
  QuotaPerUnit: number
  USDExchangeRate: number
  DisplayInCurrencyEnabled: boolean
  DisplayTokenStatEnabled: boolean
  'general_setting.docs_link': string
  'general_setting.quota_display_type': string
  'general_setting.custom_currency_symbol': string
  'general_setting.custom_currency_exchange_rate': number
  'quota_setting.enable_free_model_pre_consume': boolean
  'checkin_setting.enabled': boolean
  'checkin_setting.min_quota': number
  'checkin_setting.max_quota': number
  Price: number
  MinTopUp: number
}

export interface ModelSettings {
  RetryTimes: number
  ChannelDisableThreshold: number
  AutomaticDisableChannelEnabled: boolean
  AutomaticEnableChannelEnabled: boolean
  'global.pass_through_request_enabled': boolean
  'general_setting.ping_interval_enabled': boolean
  'general_setting.ping_interval_seconds': number
  'monitor_setting.auto_test_channel_enabled': boolean
  'monitor_setting.auto_test_channel_minutes': number
  'gemini.safety_settings': string
  'claude.default_max_tokens': number
  'claude.thinking_adapter_enabled': boolean
  'channel_affinity_setting.enabled': boolean
  'channel_affinity_setting.switch_on_success': boolean
  'channel_affinity_setting.default_ttl_seconds': number
}

export interface SecuritySettings {
  ModelRequestRateLimitEnabled: boolean
  ModelRequestRateLimitCount: number
  ModelRequestRateLimitDurationMinutes: number
  CheckSensitiveEnabled: boolean
  CheckSensitiveOnPromptEnabled: boolean
  SensitiveWords: string
  'fetch_setting.enable_ssrf_protection': boolean
  'fetch_setting.allow_private_ip': boolean
  'token_setting.max_user_tokens': number
}

export interface ContentSettings {
  DataExportEnabled: boolean
  DataExportInterval: number
  DrawingEnabled: boolean
  MjNotifyEnabled: boolean
  MjAccountFilterEnabled: boolean
  MjForwardUrlEnabled: boolean
  MjModeClearEnabled: boolean
  MjActionCheckSuccessEnabled: boolean
  'console_setting.announcements_enabled': boolean
  'console_setting.announcements': string
  'console_setting.api_info_enabled': boolean
  'console_setting.api_info': string
  'console_setting.faq_enabled': boolean
  'console_setting.faq': string
}

export interface OperationsSettings {
  DefaultCollapseSidebar: boolean
  DemoSiteEnabled: boolean
  SelfUseModeEnabled: boolean
  LogConsumeEnabled: boolean
  QuotaRemindThreshold: number
  SMTPServer: string
  SMTPPort: string
  SMTPAccount: string
  SMTPFrom: string
  SMTPToken: string
  SMTPSSLEnabled: boolean
  SMTPStartTLSEnabled: boolean
  SMTPInsecureSkipVerify: boolean
  SMTPForceAuthLogin: boolean
  WorkerUrl: string
  WorkerValidKey: string
  'performance_setting.disk_cache_enabled': boolean
  'performance_setting.disk_cache_threshold_mb': number
  'performance_setting.disk_cache_max_size_mb': number
  'performance_setting.disk_cache_path': string
  'performance_setting.monitor_enabled': boolean
  'performance_setting.monitor_cpu_threshold': number
  'performance_setting.monitor_memory_threshold': number
  'performance_setting.monitor_disk_threshold': number
}

// Merged type used by the composable
export type AllSystemSettings = SiteSettings &
  AuthSettings &
  BillingSettings &
  ModelSettings &
  SecuritySettings &
  ContentSettings &
  OperationsSettings

export const SYSTEM_SETTINGS_DEFAULTS: AllSystemSettings = {
  // Site
  SystemName: '',
  Logo: '',
  Footer: '',
  About: '',
  HomePageContent: '',
  ServerAddress: '',
  Notice: '',
  HeaderNavModules: '',
  SidebarModulesAdmin: '',
  'legal.user_agreement': '',
  'legal.privacy_policy': '',
  // Auth
  PasswordLoginEnabled: true,
  PasswordRegisterEnabled: true,
  EmailVerificationEnabled: false,
  RegisterEnabled: true,
  EmailDomainRestrictionEnabled: false,
  EmailAliasRestrictionEnabled: false,
  EmailDomainWhitelist: '',
  GitHubOAuthEnabled: false,
  GitHubClientId: '',
  GitHubClientSecret: '',
  'discord.enabled': false,
  'discord.client_id': '',
  'discord.client_secret': '',
  'oidc.enabled': false,
  'oidc.display_name': '',
  'oidc.client_id': '',
  'oidc.client_secret': '',
  'oidc.well_known': '',
  'oidc.authorization_endpoint': '',
  'oidc.token_endpoint': '',
  'oidc.user_info_endpoint': '',
  TelegramOAuthEnabled: false,
  TelegramBotToken: '',
  TelegramBotName: '',
  LinuxDOOAuthEnabled: false,
  LinuxDOClientId: '',
  LinuxDOClientSecret: '',
  WeChatAuthEnabled: false,
  WeChatServerAddress: '',
  WeChatServerToken: '',
  TurnstileCheckEnabled: false,
  TurnstileSiteKey: '',
  TurnstileSecretKey: '',
  'passkey.enabled': false,
  'passkey.rp_display_name': '',
  'passkey.rp_id': '',
  'passkey.origins': '',
  // Billing
  QuotaForNewUser: 0,
  PreConsumedQuota: 500000,
  QuotaForInviter: 0,
  QuotaForInvitee: 0,
  AffiliateEnabled: false,
  AffiliateRegistrationRequired: false,
  AffiliateRebateRateBps: 1000,
  AffiliateFreezeHours: 168,
  AffiliateDurationDays: 0,
  AffiliatePerInviteeCap: 100,
  AffiliateActivatedAt: 0,
  TopUpLink: '',
  QuotaPerUnit: 500000,
  USDExchangeRate: 1,
  DisplayInCurrencyEnabled: false,
  DisplayTokenStatEnabled: false,
  'general_setting.docs_link': '',
  'general_setting.quota_display_type': 'quota',
  'general_setting.custom_currency_symbol': '¤',
  'general_setting.custom_currency_exchange_rate': 1,
  'quota_setting.enable_free_model_pre_consume': false,
  'checkin_setting.enabled': false,
  'checkin_setting.min_quota': 100,
  'checkin_setting.max_quota': 500,
  Price: 7.3,
  MinTopUp: 1,
  // Models
  RetryTimes: 0,
  ChannelDisableThreshold: 5,
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  'global.pass_through_request_enabled': false,
  'general_setting.ping_interval_enabled': false,
  'general_setting.ping_interval_seconds': 60,
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 60,
  'gemini.safety_settings': '',
  'claude.default_max_tokens': 0,
  'claude.thinking_adapter_enabled': false,
  'channel_affinity_setting.enabled': false,
  'channel_affinity_setting.switch_on_success': false,
  'channel_affinity_setting.default_ttl_seconds': 3600,
  // Security
  ModelRequestRateLimitEnabled: false,
  ModelRequestRateLimitCount: 60,
  ModelRequestRateLimitDurationMinutes: 1,
  CheckSensitiveEnabled: false,
  CheckSensitiveOnPromptEnabled: false,
  SensitiveWords: '',
  'fetch_setting.enable_ssrf_protection': false,
  'fetch_setting.allow_private_ip': false,
  'token_setting.max_user_tokens': 0,
  // Content
  DataExportEnabled: true,
  DataExportInterval: 5,
  DrawingEnabled: false,
  MjNotifyEnabled: false,
  MjAccountFilterEnabled: false,
  MjForwardUrlEnabled: false,
  MjModeClearEnabled: false,
  MjActionCheckSuccessEnabled: false,
  'console_setting.announcements_enabled': false,
  'console_setting.announcements': '',
  'console_setting.api_info_enabled': false,
  'console_setting.api_info': '',
  'console_setting.faq_enabled': false,
  'console_setting.faq': '',
  // Operations
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
  LogConsumeEnabled: true,
  QuotaRemindThreshold: 1000,
  SMTPServer: '',
  SMTPPort: '',
  SMTPAccount: '',
  SMTPFrom: '',
  SMTPToken: '',
  SMTPSSLEnabled: false,
  SMTPStartTLSEnabled: false,
  SMTPInsecureSkipVerify: false,
  SMTPForceAuthLogin: false,
  WorkerUrl: '',
  WorkerValidKey: '',
  'performance_setting.disk_cache_enabled': false,
  'performance_setting.disk_cache_threshold_mb': 10,
  'performance_setting.disk_cache_max_size_mb': 1024,
  'performance_setting.disk_cache_path': '',
  'performance_setting.monitor_enabled': false,
  'performance_setting.monitor_cpu_threshold': 90,
  'performance_setting.monitor_memory_threshold': 90,
  'performance_setting.monitor_disk_threshold': 95,
}
