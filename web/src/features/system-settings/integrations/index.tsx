import type { IntegrationSettings as IntegrationSettingsType } from '../types'
import { SettingsPage } from '../components/settings-page'
import {
  INTEGRATIONS_DEFAULT_SECTION,
  getIntegrationsSectionContent,
} from './section-registry.tsx'

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
  'model_deployment.ionet.api_key': '',
  'model_deployment.ionet.enabled': false,
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
  CreemApiKey: '',
  CreemWebhookSecret: '',
  CreemTestMode: false,
  CreemProducts: '[]',
}

export function IntegrationSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/integrations'
      defaultSettings={defaultIntegrationSettings}
      defaultSection={INTEGRATIONS_DEFAULT_SECTION}
      getSectionContent={getIntegrationsSectionContent}
    />
  )
}
