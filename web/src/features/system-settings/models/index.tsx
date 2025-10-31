import { Accordion } from '@/components/ui/accordion'
import { useAccordionState } from '../hooks/use-accordion-state'
import { useSystemOptions, getOptionValue } from '../hooks/use-system-options'
import type { ModelSettings } from '../types'
import { ClaudeSettingsCard } from './claude-settings-card'
import { GeminiSettingsCard } from './gemini-settings-card'
import { GlobalSettingsCard } from './global-settings-card'
import { RatioSettingsCard } from './ratio-settings-card'

const defaultModelSettings: ModelSettings = {
  'global.pass_through_request_enabled': false,
  'general_setting.ping_interval_enabled': false,
  'general_setting.ping_interval_seconds': 60,
  'gemini.safety_settings': '',
  'gemini.version_settings': '',
  'gemini.supported_imagine_models': '',
  'gemini.thinking_adapter_enabled': false,
  'gemini.thinking_adapter_budget_tokens_percentage': 0.6,
  'claude.model_headers_settings': '',
  'claude.default_max_tokens': '',
  'claude.thinking_adapter_enabled': true,
  'claude.thinking_adapter_budget_tokens_percentage': 0.8,
  ModelPrice: '',
  ModelRatio: '',
  CacheRatio: '',
  CompletionRatio: '',
  ImageRatio: '',
  AudioRatio: '',
  AudioCompletionRatio: '',
  ExposeRatioEnabled: false,
  TopupGroupRatio: '',
  GroupRatio: '',
  UserUsableGroups: '',
  GroupGroupRatio: '',
  AutoGroups: '',
  DefaultUseAutoGroup: false,
}

export function ModelSettings() {
  const { data, isLoading } = useSystemOptions()
  const { openItems, handleAccordionChange } = useAccordionState('models')

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-muted-foreground'>Loading model settings…</div>
      </div>
    )
  }

  const settings = getOptionValue<ModelSettings>(
    data?.data,
    defaultModelSettings
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
          <GlobalSettingsCard
            defaultValues={{
              global: {
                pass_through_request_enabled:
                  settings['global.pass_through_request_enabled'],
              },
              general_setting: {
                ping_interval_enabled:
                  settings['general_setting.ping_interval_enabled'],
                ping_interval_seconds:
                  settings['general_setting.ping_interval_seconds'],
              },
            }}
          />

          <GeminiSettingsCard
            defaultValues={{
              gemini: {
                safety_settings: settings['gemini.safety_settings'],
                version_settings: settings['gemini.version_settings'],
                supported_imagine_models:
                  settings['gemini.supported_imagine_models'],
                thinking_adapter_enabled:
                  settings['gemini.thinking_adapter_enabled'],
                thinking_adapter_budget_tokens_percentage:
                  settings['gemini.thinking_adapter_budget_tokens_percentage'],
              },
            }}
          />

          <ClaudeSettingsCard
            defaultValues={{
              claude: {
                model_headers_settings:
                  settings['claude.model_headers_settings'],
                default_max_tokens: settings['claude.default_max_tokens'],
                thinking_adapter_enabled:
                  settings['claude.thinking_adapter_enabled'],
                thinking_adapter_budget_tokens_percentage:
                  settings['claude.thinking_adapter_budget_tokens_percentage'],
              },
            }}
          />

          <RatioSettingsCard
            modelDefaults={{
              ModelPrice: settings.ModelPrice,
              ModelRatio: settings.ModelRatio,
              CacheRatio: settings.CacheRatio,
              CompletionRatio: settings.CompletionRatio,
              ImageRatio: settings.ImageRatio,
              AudioRatio: settings.AudioRatio,
              AudioCompletionRatio: settings.AudioCompletionRatio,
              ExposeRatioEnabled: settings.ExposeRatioEnabled,
            }}
            groupDefaults={{
              TopupGroupRatio: settings.TopupGroupRatio,
              GroupRatio: settings.GroupRatio,
              UserUsableGroups: settings.UserUsableGroups,
              GroupGroupRatio: settings.GroupGroupRatio,
              AutoGroups: settings.AutoGroups,
              DefaultUseAutoGroup: settings.DefaultUseAutoGroup,
            }}
          />
        </Accordion>
      </div>
    </div>
  )
}
