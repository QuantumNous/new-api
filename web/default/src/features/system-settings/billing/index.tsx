/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { SettingsPage } from '../components/settings-page'
import type { BillingSettings } from '../types'
import {
  BILLING_DEFAULT_SECTION,
  getBillingSectionContent,
} from './section-registry.tsx'

const defaultBillingSettings: BillingSettings = {
  QuotaForNewUser: 0,
  PreConsumedQuota: 0,
  QuotaForInviter: 0,
  QuotaForInvitee: 0,
  AffRatio: 0,
  FirstTopupPromoEnabled: false,
  FirstTopupPromoDiscount: 0.75,
  FirstTopupPromoAmount: 10,
  FirstTopupPromoWindowDays: 3,
  GptImage2RaceFallbackEnabled: true,
  GptImage2RaceTimeout1K: 45,
  GptImage2RaceTimeout2K: 90,
  GptImage2RaceTimeout4K: 135,
  NewAPIShadowBenchmarkEnabled: false,
  TopUpLink: '',
  'general_setting.docs_link': '',
  'quota_setting.enable_free_model_pre_consume': true,
  QuotaPerUnit: 500000,
  USDExchangeRate: 7,
  'general_setting.quota_display_type': 'USD',
  'general_setting.custom_currency_symbol': '¤',
  'general_setting.custom_currency_exchange_rate': 1,
  DisplayInCurrencyEnabled: true,
  DisplayTokenStatEnabled: true,
  ModelPrice: '',
  ModelRatio: '',
  CacheRatio: '',
  CreateCacheRatio: '',
  CompletionRatio: '',
  ImageRatio: '',
  AudioRatio: '',
  AudioCompletionRatio: '',
  ExposeRatioEnabled: false,
  'billing_setting.billing_mode': '{}',
  'billing_setting.billing_expr': '{}',
  'tool_price_setting.prices': '{}',
  TopupGroupRatio: '',
  GroupRatio: '',
  UserUsableGroups: '',
  GroupGroupRatio: '',
  AutoGroups: '',
  DefaultUseAutoGroup: false,
  'group_ratio_setting.group_special_usable_group': '{}',
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
  PayPalClientID: '',
  PayPalClientSecret: '',
  PayPalWebhookID: '',
  PayPalSandbox: true,
  PayPalMinTopUp: 1,
  CreemApiKey: '',
  CreemWebhookSecret: '',
  CreemTestMode: false,
  CreemProducts: '[]',
  WaffoEnabled: false,
  WaffoApiKey: '',
  WaffoPrivateKey: '',
  WaffoPublicCert: '',
  WaffoSandboxPublicCert: '',
  WaffoSandboxApiKey: '',
  WaffoSandboxPrivateKey: '',
  WaffoSandbox: false,
  WaffoMerchantId: '',
  WaffoCurrency: 'USD',
  WaffoUnitPrice: 1,
  WaffoMinTopUp: 1,
  WaffoNotifyUrl: '',
  WaffoReturnUrl: '',
  WaffoPayMethods: '[]',
  WaffoPancakeEnabled: false,
  WaffoPancakeSandbox: false,
  WaffoPancakeMerchantID: '',
  WaffoPancakePrivateKey: '',
  WaffoPancakeWebhookPublicKey: '',
  WaffoPancakeWebhookTestKey: '',
  WaffoPancakeStoreID: '',
  WaffoPancakeProductID: '',
  WaffoPancakeReturnURL: '',
  WaffoPancakeCurrency: 'USD',
  WaffoPancakeUnitPrice: 1,
  WaffoPancakeMinTopUp: 1,
  PlategaEnabled: false,
  PlategaMinTopUp: 1,
  PlategaUSDRate: 90,
  PlategaReturnURL: 'https://apimaster.ai/console/wallet?show_history=true',
  PlategaFailedURL: 'https://apimaster.ai/console/wallet?show_history=true',
  PlategaFeePercent: 8.5,
  ClinkEnabled: false,
  ClinkSandbox: true,
  ClinkMinTopUp: 1,
  ClinkCurrency: 'USD',
  ClinkSuccessURL: 'https://apimaster.ai/console/wallet?show_history=true',
  ClinkCancelURL: 'https://apimaster.ai/console/wallet',
  'checkin_setting.enabled': false,
  'checkin_setting.min_quota': 1000,
  'checkin_setting.max_quota': 10000,
}

export function BillingSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/billing/$section'
      defaultSettings={defaultBillingSettings}
      defaultSection={BILLING_DEFAULT_SECTION}
      getSectionContent={getBillingSectionContent}
    />
  )
}
