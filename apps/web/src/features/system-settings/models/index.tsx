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
import type { ModelSettings } from '../types'
import { MODELS_DEFAULT_SECTION } from './section-registry.tsx'
import { getModelsSectionContent, getModelsSectionMeta } from './sections.tsx'
import { RoutingTabProvider, RoutingTabs } from './routing-section'

const defaultModelSettings: ModelSettings = {
  'global.pass_through_request_enabled': false,
  'global.thinking_model_blacklist': '[]',
  'global.chat_completions_to_responses_policy': '{}',
  'general_setting.ping_interval_enabled': true,
  'general_setting.ping_interval_seconds': 10,
  'gemini.safety_settings': '',
  'gemini.version_settings': '',
  'gemini.supported_imagine_models': '',
  'gemini.thinking_adapter_enabled': false,
  'gemini.thinking_adapter_budget_tokens_percentage': 0.6,
  'gemini.function_call_thought_signature_enabled': true,
  'gemini.remove_function_response_id_enabled': true,
  'claude.model_headers_settings': '',
  'claude.default_max_tokens': '',
  'claude.thinking_adapter_enabled': true,
  'claude.thinking_adapter_budget_tokens_percentage': 0.8,
  'grok.violation_deduction_enabled': true,
  'grok.violation_deduction_amount': 0.05,
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
  MaxTokenAutoGroups: 5,
  DefaultUseAutoGroup: false,
  'group_ratio_setting.group_special_usable_group': '{}',
  RetryTimes: 0,
  ChannelDisableThreshold: '',
  GatewayDispatchCooldownBaseMs: 300,
  GatewayDispatchCooldownMaxMs: 10000,
  GatewayDispatchCooldownRampSteps: 12,
  GatewayDispatchThrottleBaseMs: 200,
  GatewayDispatchThrottleMaxMs: 1000,
  GatewayDispatchScoreDecayTauMs: 900000,
  GatewayDispatchHealthAlpha: 0.3,
  GatewayDispatchHealthMinRequests: 5,
  GatewayDispatchHealthMinScoreFloor: 0.05,
  GatewayRetryTotalBudgetMs: 30000,
  GatewayForwardMaxConcurrency: 0,
  GatewayChannelMaxConcurrency: 0,
  LocalFailureThreshold: 1,
  UpstreamFailureThreshold: 1,
  EmergencyThreshold: 20,
  WarningThreshold: 50,
  KeyProbeEnabled: true,
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: '',
  AutomaticDisableStatusCodes: '401',
  AutomaticRetryStatusCodes:
    '100-199,300-399,401-407,409-499,500-503,505-523,525-599',
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 10,
  'monitor_setting.channel_test_mode': 'scheduled_all',
  'channel_affinity_setting.enabled': false,
  'channel_affinity_setting.switch_on_success': true,
  'channel_affinity_setting.keep_on_channel_disabled': false,
  'channel_affinity_setting.max_entries': 100000,
  'channel_affinity_setting.default_ttl_seconds': 3600,
  'channel_affinity_setting.rules': '[]',
}

export function ModelSettings() {
  return (
    <RoutingTabProvider>
      <SettingsPage
        routePath='/_authenticated/admin/system-settings/models/$section'
        defaultSettings={defaultModelSettings}
        defaultSection={MODELS_DEFAULT_SECTION}
        getSectionContent={getModelsSectionContent}
        getSectionMeta={getModelsSectionMeta}
        titleExtras={(_t, activeSection) => {
          if (activeSection !== 'routing') return null
          return <RoutingTabs />
        }}
      />
    </RoutingTabProvider>
  )
}
