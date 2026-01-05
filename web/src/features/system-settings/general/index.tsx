import { useTranslation } from 'react-i18next'
import { parseCurrencyDisplayType } from '@/lib/currency'
import { Accordion } from '@/components/ui/accordion'
import { useAccordionState } from '../hooks/use-accordion-state'
import { useSystemOptions, getOptionValue } from '../hooks/use-system-options'
import type { GeneralSettings } from '../types'
import { CheckinSettingsSection } from './checkin-settings-section'
import { PricingSection } from './pricing-section'
import { QuotaSettingsSection } from './quota-settings-section'
import { SystemBehaviorSection } from './system-behavior-section'
import { SystemInfoSection } from './system-info-section'

const defaultGeneralSettings: GeneralSettings = {
  Notice: '',
  SystemName: 'New API',
  Logo: '',
  Footer: '',
  About: '',
  HomePageContent: '',
  'legal.user_agreement': '',
  'legal.privacy_policy': '',
  QuotaForNewUser: 0,
  PreConsumedQuota: 0,
  QuotaForInviter: 0,
  QuotaForInvitee: 0,
  TopUpLink: '',
  'general_setting.docs_link': '',
  'quota_setting.enable_free_model_pre_consume': true,
  QuotaPerUnit: 500000,
  USDExchangeRate: 7,
  'general_setting.quota_display_type': 'USD',
  'general_setting.custom_currency_symbol': '¤',
  'general_setting.custom_currency_exchange_rate': 1,
  RetryTimes: 0,
  DisplayInCurrencyEnabled: true,
  DisplayTokenStatEnabled: true,
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
  'checkin_setting.enabled': false,
  'checkin_setting.min_quota': 1000,
  'checkin_setting.max_quota': 10000,
}

export function GeneralSettings() {
  const { t } = useTranslation()
  const { data, isLoading } = useSystemOptions()
  const { openItems, handleAccordionChange } = useAccordionState('general')

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground'>{t('Loading settings...')}</div>
      </div>
    )
  }

  const settings = getOptionValue(data?.data, defaultGeneralSettings)
  const quotaDisplayType = parseCurrencyDisplayType(
    settings['general_setting.quota_display_type']
  )

  return (
    <div className='flex h-full w-full flex-1 flex-col'>
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <Accordion
          type='multiple'
          value={openItems}
          onValueChange={handleAccordionChange}
          className='space-y-2'
        >
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

          <QuotaSettingsSection
            defaultValues={{
              QuotaForNewUser: settings.QuotaForNewUser,
              PreConsumedQuota: settings.PreConsumedQuota,
              QuotaForInviter: settings.QuotaForInviter,
              QuotaForInvitee: settings.QuotaForInvitee,
              TopUpLink: settings.TopUpLink,
              'general_setting.docs_link':
                settings['general_setting.docs_link'],
              'quota_setting.enable_free_model_pre_consume':
                settings['quota_setting.enable_free_model_pre_consume'],
            }}
          />

          <PricingSection
            defaultValues={{
              QuotaPerUnit: settings.QuotaPerUnit,
              USDExchangeRate: settings.USDExchangeRate,
              DisplayInCurrencyEnabled: settings.DisplayInCurrencyEnabled,
              DisplayTokenStatEnabled: settings.DisplayTokenStatEnabled,
              general_setting: {
                quota_display_type: quotaDisplayType as
                  | 'USD'
                  | 'CNY'
                  | 'TOKENS'
                  | 'CUSTOM',
                custom_currency_symbol:
                  settings['general_setting.custom_currency_symbol'] ?? '¤',
                custom_currency_exchange_rate:
                  settings['general_setting.custom_currency_exchange_rate'] ??
                  1,
              },
            }}
          />

          <CheckinSettingsSection
            defaultValues={{
              enabled: settings['checkin_setting.enabled'],
              minQuota: settings['checkin_setting.min_quota'],
              maxQuota: settings['checkin_setting.max_quota'],
            }}
          />

          <SystemBehaviorSection
            defaultValues={{
              RetryTimes: settings.RetryTimes,
              DefaultCollapseSidebar: settings.DefaultCollapseSidebar,
              DemoSiteEnabled: settings.DemoSiteEnabled,
              SelfUseModeEnabled: settings.SelfUseModeEnabled,
            }}
          />
        </Accordion>
      </div>
    </div>
  )
}
