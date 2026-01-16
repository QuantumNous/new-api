import type { GeneralSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'
import { CheckinSettingsSection } from './checkin-settings-section'
import { PricingSection } from './pricing-section'
import { QuotaSettingsSection } from './quota-settings-section'
import { SystemBehaviorSection } from './system-behavior-section'
import { SystemInfoSection } from './system-info-section'

const GENERAL_SECTIONS = [
  {
    id: 'system-info',
    titleKey: 'System Information',
    descriptionKey: 'Configure basic system information and branding',
    build: (settings: GeneralSettings) => (
      <SystemInfoSection
        defaultValues={{
          Notice: settings.Notice,
          SystemName: settings.SystemName,
          Logo: settings.Logo,
          Footer: settings.Footer,
          About: settings.About,
          HomePageContent: settings.HomePageContent,
          legal: {
            user_agreement: settings['legal.user_agreement'],
            privacy_policy: settings['legal.privacy_policy'],
          },
        }}
      />
    ),
  },
  {
    id: 'quota',
    titleKey: 'Quota Settings',
    descriptionKey: 'Configure user quota allocation and rewards',
    build: (settings: GeneralSettings) => (
      <QuotaSettingsSection
        defaultValues={{
          QuotaForNewUser: settings.QuotaForNewUser,
          PreConsumedQuota: settings.PreConsumedQuota,
          QuotaForInviter: settings.QuotaForInviter,
          QuotaForInvitee: settings.QuotaForInvitee,
          TopUpLink: settings.TopUpLink,
          'general_setting.docs_link': settings['general_setting.docs_link'],
          'quota_setting.enable_free_model_pre_consume':
            settings['quota_setting.enable_free_model_pre_consume'],
        }}
      />
    ),
  },
  {
    id: 'pricing',
    titleKey: 'Pricing & Display',
    descriptionKey: 'Configure pricing model and display options',
    build: (
      settings: GeneralSettings,
      quotaDisplayType: 'USD' | 'CNY' | 'TOKENS' | 'CUSTOM'
    ) => (
      <PricingSection
        defaultValues={{
          QuotaPerUnit: settings.QuotaPerUnit,
          USDExchangeRate: settings.USDExchangeRate,
          DisplayInCurrencyEnabled: settings.DisplayInCurrencyEnabled,
          DisplayTokenStatEnabled: settings.DisplayTokenStatEnabled,
          general_setting: {
            quota_display_type: quotaDisplayType,
            custom_currency_symbol:
              settings['general_setting.custom_currency_symbol'] ?? '¤',
            custom_currency_exchange_rate:
              settings['general_setting.custom_currency_exchange_rate'] ?? 1,
          },
        }}
      />
    ),
  },
  {
    id: 'checkin',
    titleKey: 'Check-in Settings',
    descriptionKey: 'Configure daily check-in rewards for users',
    build: (settings: GeneralSettings) => (
      <CheckinSettingsSection
        defaultValues={{
          enabled: settings['checkin_setting.enabled'],
          minQuota: settings['checkin_setting.min_quota'],
          maxQuota: settings['checkin_setting.max_quota'],
        }}
      />
    ),
  },
  {
    id: 'behavior',
    titleKey: 'System Behavior',
    descriptionKey: 'Configure system-wide behavior and defaults',
    build: (settings: GeneralSettings) => (
      <SystemBehaviorSection
        defaultValues={{
          RetryTimes: settings.RetryTimes,
          DefaultCollapseSidebar: settings.DefaultCollapseSidebar,
          DemoSiteEnabled: settings.DemoSiteEnabled,
          SelfUseModeEnabled: settings.SelfUseModeEnabled,
        }}
      />
    ),
  },
] as const

export type GeneralSectionId = (typeof GENERAL_SECTIONS)[number]['id']

const generalRegistry = createSectionRegistry<
  GeneralSectionId,
  GeneralSettings,
  ['USD' | 'CNY' | 'TOKENS' | 'CUSTOM']
>({
  sections: GENERAL_SECTIONS,
  defaultSection: 'system-info',
  basePath: '/system-settings/general',
})

export const GENERAL_SECTION_IDS = generalRegistry.sectionIds
export const GENERAL_DEFAULT_SECTION = generalRegistry.defaultSection
export const getGeneralSectionNavItems = generalRegistry.getSectionNavItems
export const getGeneralSectionContent = generalRegistry.getSectionContent
