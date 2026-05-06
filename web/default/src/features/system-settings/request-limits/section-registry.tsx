import type { RequestLimitsSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'
import { RateLimitSection } from './rate-limit-section'
import { SensitiveWordsSection } from './sensitive-words-section'
import { SSRFSection } from './ssrf-section'

const REQUEST_LIMITS_SECTIONS = [
  {
    id: 'rate-limit',
    titleKey: 'Rate Limiting',
    descriptionKey: 'Configure model request rate limiting',
    build: (settings: RequestLimitsSettings) => (
      <RateLimitSection
        defaultValues={{
          ModelRequestRateLimitEnabled: settings.ModelRequestRateLimitEnabled,
          ModelRequestRateLimitCount: settings.ModelRequestRateLimitCount,
          ModelRequestRateLimitSuccessCount:
            settings.ModelRequestRateLimitSuccessCount,
          ModelRequestRateLimitDurationMinutes:
            settings.ModelRequestRateLimitDurationMinutes,
          ModelRequestRateLimitGroup: settings.ModelRequestRateLimitGroup,
        }}
      />
    ),
  },
  {
    id: 'sensitive-words',
    titleKey: 'Sensitive Words',
    descriptionKey: 'Configure sensitive word filtering',
    build: (settings: RequestLimitsSettings) => (
      <SensitiveWordsSection
        defaultValues={{
          CheckSensitiveEnabled: settings.CheckSensitiveEnabled,
          CheckSensitiveOnPromptEnabled: settings.CheckSensitiveOnPromptEnabled,
          SensitiveWords: settings.SensitiveWords,
        }}
      />
    ),
  },
  {
    id: 'ssrf',
    titleKey: 'SSRF Protection',
    descriptionKey: 'Configure SSRF (Server-Side Request Forgery) protection',
    build: (settings: RequestLimitsSettings) => (
      <SSRFSection
        defaultValues={{
          'fetch_setting.enable_ssrf_protection':
            settings['fetch_setting.enable_ssrf_protection'],
          'fetch_setting.allow_private_ip':
            settings['fetch_setting.allow_private_ip'],
          'fetch_setting.domain_filter_mode':
            settings['fetch_setting.domain_filter_mode'],
          'fetch_setting.ip_filter_mode':
            settings['fetch_setting.ip_filter_mode'],
          'fetch_setting.domain_list': settings['fetch_setting.domain_list'],
          'fetch_setting.ip_list': settings['fetch_setting.ip_list'],
          'fetch_setting.allowed_ports':
            settings['fetch_setting.allowed_ports'],
          'fetch_setting.apply_ip_filter_for_domain':
            settings['fetch_setting.apply_ip_filter_for_domain'],
        }}
      />
    ),
  },
] as const

export type RequestLimitsSectionId =
  (typeof REQUEST_LIMITS_SECTIONS)[number]['id']

const requestLimitsRegistry = createSectionRegistry<
  RequestLimitsSectionId,
  RequestLimitsSettings
>({
  sections: REQUEST_LIMITS_SECTIONS,
  defaultSection: 'rate-limit',
  basePath: '/system-settings/request-limits',
  urlStyle: 'path',
})

export const REQUEST_LIMITS_SECTION_IDS = requestLimitsRegistry.sectionIds
export const REQUEST_LIMITS_DEFAULT_SECTION =
  requestLimitsRegistry.defaultSection
export const getRequestLimitsSectionNavItems =
  requestLimitsRegistry.getSectionNavItems
export const getRequestLimitsSectionContent =
  requestLimitsRegistry.getSectionContent
