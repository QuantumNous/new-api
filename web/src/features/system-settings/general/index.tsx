import { Accordion } from '@/components/ui/accordion'
import { useAccordionState } from '../hooks/use-accordion-state'
import { useSystemOptions, getOptionValue } from '../hooks/use-system-options'
import type { GeneralSettings } from '../types'
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
  QuotaForNewUser: 0,
  PreConsumedQuota: 0,
  QuotaForInviter: 0,
  QuotaForInvitee: 0,
  TopUpLink: '',
  'general_setting.docs_link': '',
  QuotaPerUnit: 500000,
  USDExchangeRate: 7,
  RetryTimes: 0,
  DisplayInCurrencyEnabled: true,
  DisplayTokenStatEnabled: true,
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
}

export function GeneralSettings() {
  const { data, isLoading } = useSystemOptions()
  const { openItems, handleAccordionChange } = useAccordionState('general')

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground'>Loading settings...</div>
      </div>
    )
  }

  const settings = getOptionValue(data?.data, defaultGeneralSettings)

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
            }}
          />

          <PricingSection
            defaultValues={{
              QuotaPerUnit: settings.QuotaPerUnit,
              USDExchangeRate: settings.USDExchangeRate,
              DisplayInCurrencyEnabled: settings.DisplayInCurrencyEnabled,
              DisplayTokenStatEnabled: settings.DisplayTokenStatEnabled,
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
