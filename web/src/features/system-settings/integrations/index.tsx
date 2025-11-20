import { useTranslation } from 'react-i18next'
import { Accordion } from '@/components/ui/accordion'
import { useAccordionState } from '../hooks/use-accordion-state'
import { useSystemOptions, getOptionValue } from '../hooks/use-system-options'
import type { IntegrationSettings as IntegrationSettingsType } from '../types'
import { EmailSettingsSection } from './email-settings-section'
import { MonitoringSettingsSection } from './monitoring-settings-section'
import { PaymentSettingsSection } from './payment-settings-section'
import { WorkerSettingsSection } from './worker-settings-section'

const defaultIntegrationSettings: IntegrationSettingsType = {
  SMTPServer: '',
  SMTPPort: '',
  SMTPAccount: '',
  SMTPFrom: '',
  SMTPToken: '',
  SMTPSSLEnabled: false,
  WorkerUrl: '',
  WorkerValidKey: '',
  WorkerAllowHttpImageRequestEnabled: false,
  ChannelDisableThreshold: '',
  QuotaRemindThreshold: '',
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: '',
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 10,
  PayAddress: '',
  EpayId: '',
  EpayKey: '',
  Price: 7.3,
  MinTopUp: 1,
  CustomCallbackAddress: '',
  PayMethods: '',
  'payment_setting.amount_options': '',
  'payment_setting.amount_discount': '',
  StripeApiSecret: '',
  StripeWebhookSecret: '',
  StripePriceId: '',
  StripeUnitPrice: 8.0,
  StripeMinTopUp: 1,
  StripePromotionCodesEnabled: false,
}

export function IntegrationSettings() {
  const { t } = useTranslation()
  const { data, isLoading } = useSystemOptions()
  const { openItems, handleAccordionChange } = useAccordionState('integrations')

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground'>{t('Loading settings...')}</div>
      </div>
    )
  }

  const settings = getOptionValue(data?.data, defaultIntegrationSettings)

  return (
    <div className='flex h-full w-full flex-1 flex-col'>
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <Accordion
          type='multiple'
          value={openItems}
          onValueChange={handleAccordionChange}
          className='space-y-2'
        >
          <PaymentSettingsSection
            defaultValues={{
              PayAddress: settings.PayAddress,
              EpayId: settings.EpayId,
              EpayKey: settings.EpayKey,
              Price: settings.Price,
              MinTopUp: settings.MinTopUp,
              CustomCallbackAddress: settings.CustomCallbackAddress,
              PayMethods: settings.PayMethods,
              AmountOptions: settings['payment_setting.amount_options'],
              AmountDiscount: settings['payment_setting.amount_discount'],
              StripeApiSecret: settings.StripeApiSecret,
              StripeWebhookSecret: settings.StripeWebhookSecret,
              StripePriceId: settings.StripePriceId,
              StripeUnitPrice: settings.StripeUnitPrice,
              StripeMinTopUp: settings.StripeMinTopUp,
              StripePromotionCodesEnabled: settings.StripePromotionCodesEnabled,
            }}
          />

          <EmailSettingsSection
            defaultValues={{
              SMTPServer: settings.SMTPServer,
              SMTPPort: settings.SMTPPort,
              SMTPAccount: settings.SMTPAccount,
              SMTPFrom: settings.SMTPFrom,
              SMTPToken: settings.SMTPToken,
              SMTPSSLEnabled: settings.SMTPSSLEnabled,
            }}
          />

          <WorkerSettingsSection
            defaultValues={{
              WorkerUrl: settings.WorkerUrl,
              WorkerValidKey: settings.WorkerValidKey,
              WorkerAllowHttpImageRequestEnabled:
                settings.WorkerAllowHttpImageRequestEnabled,
            }}
          />

          <MonitoringSettingsSection
            defaultValues={{
              ChannelDisableThreshold: settings.ChannelDisableThreshold,
              QuotaRemindThreshold: settings.QuotaRemindThreshold,
              AutomaticDisableChannelEnabled:
                settings.AutomaticDisableChannelEnabled,
              AutomaticEnableChannelEnabled:
                settings.AutomaticEnableChannelEnabled,
              AutomaticDisableKeywords: settings.AutomaticDisableKeywords,
              'monitor_setting.auto_test_channel_enabled':
                settings['monitor_setting.auto_test_channel_enabled'],
              'monitor_setting.auto_test_channel_minutes':
                settings['monitor_setting.auto_test_channel_minutes'],
            }}
          />
        </Accordion>
      </div>
    </div>
  )
}
