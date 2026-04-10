import { SettingsPage } from '../components/settings-page'
import type { RequestLimitsSettings } from '../types'
import {
  REQUEST_LIMITS_DEFAULT_SECTION,
  getRequestLimitsSectionContent,
} from './section-registry.tsx'

const defaultRequestLimitsSettings: RequestLimitsSettings = {
  ModelRequestRateLimitEnabled: false,
  ModelRequestRateLimitCount: 0,
  ModelRequestRateLimitSuccessCount: 1000,
  ModelRequestRateLimitDurationMinutes: 1,
  ModelRequestRateLimitGroup: '',
  CheckSensitiveEnabled: false,
  CheckSensitiveOnPromptEnabled: false,
  SensitiveWords: '',
  'fetch_setting.enable_ssrf_protection': true,
  'fetch_setting.allow_private_ip': false,
  'fetch_setting.domain_filter_mode': false,
  'fetch_setting.ip_filter_mode': false,
  'fetch_setting.domain_list': [],
  'fetch_setting.ip_list': [],
  'fetch_setting.allowed_ports': [],
  'fetch_setting.apply_ip_filter_for_domain': false,
}

export function RequestLimitsSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/request-limits/$section'
      defaultSettings={defaultRequestLimitsSettings}
      defaultSection={REQUEST_LIMITS_DEFAULT_SECTION}
      getSectionContent={getRequestLimitsSectionContent}
    />
  )
}
