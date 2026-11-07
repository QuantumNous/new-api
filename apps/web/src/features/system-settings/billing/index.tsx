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
import { BILLING_DEFAULT_SECTION } from './section-registry.tsx'
import { getBillingSectionContent, getBillingSectionMeta } from './sections.tsx'

const defaultBillingSettings: BillingSettings = {
  QuotaForNewUser: 0,
  PreConsumedQuota: 0,
  QuotaForInviter: 0,
  QuotaForInvitee: 0,
  QuotaForNewUser_display: 0,
  PreConsumedQuota_display: 0,
  QuotaForInviter_display: 0,
  QuotaForInvitee_display: 0,
  TopUpLink: '',
  'general_setting.docs_link': '',
  'quota_setting.enable_free_model_pre_consume': true,
  'quota_setting.empty_response_multiplier': 0.1,
  QuotaPerUnit: 500000,
  USDExchangeRate: 7,
  'general_setting.quota_display_type': 'USD',
  'general_setting.custom_currency_symbol': '¤',
  'general_setting.custom_currency_exchange_rate': 1,
  'general_setting.amount_unit': 'usd',
  'general_setting.amount_name': '',
  DisplayInCurrencyEnabled: true,
  DisplayGroupRatioTable: false,
  DisplayTokenStatEnabled: true,
  ModelPrice: '',
  ModelRatio: '',
  CacheRatio: '',
  CreateCacheRatio: '',
  CompletionRatio: '',
  CompletionRatioMeta: '',
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
  MaxTokenAutoGroups: 5,
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
  'payment_setting.compliance_confirmed': false,
  'payment_setting.compliance_terms_version': '',
  'payment_setting.compliance_confirmed_at': 0,
  'payment_setting.compliance_confirmed_by': 0,
  'payment_setting.compliance_confirmed_ip': '',
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
  WaffoPancakeMerchantID: '',
  WaffoPancakePrivateKey: '',
  WaffoPancakeReturnURL: '',
  WaffoPancakeStoreID: '',
  WaffoPancakeProductID: '',
  VmqAddress: '',
  VmqKey: '',
  CodePayAddress: '',
  CodePayId: '',
  CodePayKey: '',
  'checkin_setting.enabled': false,
  'checkin_setting.min_quota': 1000,
  'checkin_setting.max_quota': 10000,
  // display siblings default to the currency equivalent of the raw defaults
  'checkin_setting.min_quota_display': 0.002,
  'checkin_setting.max_quota_display': 0.02,
  'checkin_setting.single_platform_only': true,
  'qq_bot_setting.app_id': '',
  'qq_bot_setting.app_secret': '',
  'qq_bot_setting.qq_checkin_enabled': false,
  'qq_bot_setting.web_checkin_enabled': true,
  'qq_bot_setting.single_platform_only': true,
  'qq_bot_setting.min_quota': 375000,
  'qq_bot_setting.min_quota_display': 0.75,
  'qq_bot_setting.max_quota': 750000,
  'qq_bot_setting.max_quota_display': 1.5,
  'qq_bot_setting.checkin_disabled_groups': '',
  'qq_bot_setting.notify_template': '',
  'qq_bot_setting.auto_approve_enabled': false,
  'qq_bot_setting.auto_approve_keyword': '',
  'qq_bot_setting.drop_enabled': false,
  'qq_bot_setting.drop_groups': '',
  'qq_bot_setting.drop_min_messages': 5,
  'qq_bot_setting.drop_max_messages': 30,
  'qq_bot_setting.drop_min_quota': 150000,
  'qq_bot_setting.drop_max_quota': 1500000,
  'qq_bot_setting.drop_daily_limit': 3,
  'qq_bot_setting.drop_template': '',
  'qq_bot_setting.drop_balance_anchor': 0,
  'qq_bot_setting.drop_daily_guarantee': 0,
  'qq_bot_setting.transfer_enabled': false,
  'qq_bot_setting.transfer_disabled_groups': '',
  'qq_bot_setting.transfer_daily_limit': 2,
  'qq_bot_setting.transfer_min_amount': 50000,
  'qq_bot_setting.transfer_max_amount': 50000000,
  'qq_bot_setting.transfer_fee_brackets': '',
  'qq_bot_setting.red_packet_enabled': false,
  'qq_bot_setting.red_packet_disabled_groups': '',
  'qq_bot_setting.red_packet_daily_limit': 3,
  'qq_bot_setting.red_packet_min_amount': 500000,
  'qq_bot_setting.red_packet_max_amount': 100000000,
  'qq_bot_setting.red_packet_default_count': 5,
  'qq_bot_setting.red_packet_max_count': 50,
  'qq_bot_setting.red_packet_expire_seconds': 86400,
  'qq_bot_setting.red_packet_allow_own_grab': false,
  'qq_bot_setting.steal_enabled': false,
  'qq_bot_setting.steal_success_rate': 50,
  'qq_bot_setting.steal_min_amount': 0.1,
  'qq_bot_setting.steal_max_amount': 0.5,
  'qq_bot_setting.steal_daily_limit': 3,
  'qq_bot_setting.steal_recipient_grace_seconds': 0,
  'qq_bot_setting.bait_keyword': '杰瑞',
  'qq_bot_setting.bait_strict_match': false,
  'qq_bot_setting.bait_window_minutes': 30,
  'qq_bot_setting.bait_victim_extra_rate': 0,
  'qq_bot_setting.bait_global_extra_multiplier': 0,
  'qq_bot_setting.bait_drop_max_deny_rate': 0,
  'qq_bot_setting.bait_spam_threshold': 0,
  'qq_bot_setting.bait_spam_penalty_minutes': 10,
  'qq_bot_setting.bait_spam_stack_step': 0,
  'qq_bot_setting.bait_spam_deny_rate': 0,
  'qq_bot_setting.bait_spam_steal_rate': 0,
  'qq_bot_setting.command_cooldown_seconds': 0,
  'qq_bot_setting.rebind_cooldown_seconds': 0,
  'qq_bot_setting.recall_failed_messages': false,
  'qq_bot_setting.recall_delay_seconds': 10,
  'qq_bot_setting.recall_policies': '',
  'qq_bot_setting.admin_open_ids': '',
  // Number (not undefined) so parseOptionValueSafe takes the number branch and
  // yields a real number; an undefined default falls through to the string
  // branch and hands the form "0.5" instead of 0.5. The QQ check-in amount
  // display keys are gone: check-in amounts moved to checkin_setting.
  'qq_bot_setting.drop_min_quota_display': 0,
  'qq_bot_setting.drop_max_quota_display': 0,
  'qq_bot_setting.drop_balance_anchor_display': 0,
  'qq_bot_setting.drop_daily_guarantee_display': 0,
  'qq_bot_setting.red_packet_min_amount_display': 0,
  'qq_bot_setting.red_packet_max_amount_display': 0,
  'qq_bot_setting.transfer_min_amount_display': 0,
  'qq_bot_setting.transfer_max_amount_display': 0,
}

export function BillingSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/admin/system-settings/billing/$section'
      defaultSettings={defaultBillingSettings}
      defaultSection={BILLING_DEFAULT_SECTION}
      getSectionContent={getBillingSectionContent}
      getSectionMeta={getBillingSectionMeta}
    />
  )
}
