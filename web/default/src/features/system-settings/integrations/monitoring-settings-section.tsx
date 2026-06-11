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
import { useMemo, useRef, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { parseHttpStatusCodeRules } from '@/lib/http-status-code-rules'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { CHANNEL_TYPE_OPTIONS } from '@/features/channels/constants'
import { testCodexModelGovernanceRule } from '../api'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'
import {
  areAllKnownChannelTypesSelected,
  getUnknownChannelTypeIds,
  normalizeChannelTypeIds,
  selectAllKnownChannelTypeIds,
  shouldShowChannelTypeSelectAllShortcut,
} from './monitoring-channel-types'
import {
  codexGovernanceLinesToArray,
  codexGovernanceLinesToJsonArray,
  codexGovernanceStringArrayToLines,
} from './codex-governance-settings-utils'

const numericString = z.string().refine((value) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  return !Number.isNaN(Number(trimmed)) && Number(trimmed) >= 0
}, 'Enter a non-negative number or leave empty')

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const monitoringSchema = z
  .object({
    ChannelDisableThreshold: numericString,
    QuotaRemindThreshold: numericString,
    AutomaticDisableChannelEnabled: z.boolean(),
    AutomaticEnableChannelEnabled: z.boolean(),
    AutomaticDisableKeywords: z.string(),
    AutomaticDisableStatusCodes: z.string(),
    AutomaticRetryStatusCodes: z.string(),
    monitor_setting: z.object({
      auto_test_channel_enabled: z.boolean(),
      auto_test_channel_minutes: z.coerce
        .number()
        .int()
        .min(1, 'Interval must be at least 1 minute'),
      auto_test_channel_allowed_types: z.array(z.number().int()),
      auto_test_channel_ignored_types: z.array(z.number().int()),
      dingtalk_alert_enabled: z.boolean(),
      dingtalk_alert_webhook_url: z.string(),
      dingtalk_alert_secret: z.string(),
      dingtalk_alert_cooldown_minutes: z.coerce
        .number()
        .int()
        .min(1, 'Cooldown must be at least 1 minute'),
      ai_analysis_api_key: z.string(),
      ai_analysis_base_url: z.string(),
      ai_analysis_model: z.string(),
    }),
    codex_model_governance_setting: z.object({
      enabled: z.boolean(),
      probe_enabled: z.boolean(),
      probe_interval_minutes: z.coerce
        .number()
        .int()
        .min(60, 'Interval must be at least 60 minutes'),
      unsupported_message_patterns: z.string(),
      official_source_urls: z.string(),
      official_lifecycle_terms: z.string(),
      alert_cooldown_minutes: z.coerce
        .number()
        .int()
        .min(1, 'Cooldown must be at least 1 minute'),
    }),
  })
  .superRefine((values, ctx) => {
    const disableParsed = parseHttpStatusCodeRules(
      values.AutomaticDisableStatusCodes
    )
    if (!disableParsed.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['AutomaticDisableStatusCodes'],
        message: `Invalid status code rules: ${disableParsed.invalidTokens.join(
          ', '
        )}`,
      })
    }

    const retryParsed = parseHttpStatusCodeRules(
      values.AutomaticRetryStatusCodes
    )
    if (!retryParsed.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['AutomaticRetryStatusCodes'],
        message: `Invalid status code rules: ${retryParsed.invalidTokens.join(
          ', '
        )}`,
      })
    }

    const dingTalkWebhook =
      values.monitor_setting.dingtalk_alert_webhook_url.trim()
    if (
      values.monitor_setting.dingtalk_alert_enabled &&
      dingTalkWebhook === ''
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['monitor_setting', 'dingtalk_alert_webhook_url'],
        message: 'DingTalk webhook URL is required when alerts are enabled',
      })
    }
    if (dingTalkWebhook !== '' && !isValidHttpUrl(dingTalkWebhook)) {
      ctx.addIssue({
        code: 'custom',
        path: ['monitor_setting', 'dingtalk_alert_webhook_url'],
        message: 'Enter a valid http or https URL',
      })
    }

    const aiAnalysisBaseURL =
      values.monitor_setting.ai_analysis_base_url.trim()
    if (aiAnalysisBaseURL !== '' && !isValidHttpUrl(aiAnalysisBaseURL)) {
      ctx.addIssue({
        code: 'custom',
        path: ['monitor_setting', 'ai_analysis_base_url'],
        message: 'Enter a valid http or https URL',
      })
    }
  })

type MonitoringFormValues = z.output<typeof monitoringSchema>
type MonitoringFormInput = z.input<typeof monitoringSchema>

type MonitoringSettingsSectionProps = {
  defaultValues: {
    ChannelDisableThreshold: string
    QuotaRemindThreshold: string
    AutomaticDisableChannelEnabled: boolean
    AutomaticEnableChannelEnabled: boolean
    AutomaticDisableKeywords: string
    AutomaticDisableStatusCodes: string
    AutomaticRetryStatusCodes: string
    'monitor_setting.auto_test_channel_enabled': boolean
    'monitor_setting.auto_test_channel_minutes': number
    'monitor_setting.auto_test_channel_allowed_types': number[]
    'monitor_setting.auto_test_channel_ignored_types': number[]
    'monitor_setting.dingtalk_alert_enabled': boolean
    'monitor_setting.dingtalk_alert_webhook_url': string
    'monitor_setting.dingtalk_alert_secret': string
    'monitor_setting.dingtalk_alert_cooldown_minutes': number
    'monitor_setting.ai_analysis_api_key': string
    'monitor_setting.ai_analysis_base_url': string
    'monitor_setting.ai_analysis_model': string
    'codex_model_governance_setting.enabled': boolean
    'codex_model_governance_setting.probe_enabled': boolean
    'codex_model_governance_setting.probe_interval_minutes': number
    'codex_model_governance_setting.unsupported_message_patterns': string[]
    'codex_model_governance_setting.official_source_urls': string[]
    'codex_model_governance_setting.official_lifecycle_terms': string[]
    'codex_model_governance_setting.alert_cooldown_minutes': number
  }
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, '\n')
}

type NormalizedMonitoringValues = {
  ChannelDisableThreshold: string
  QuotaRemindThreshold: string
  AutomaticDisableChannelEnabled: boolean
  AutomaticEnableChannelEnabled: boolean
  AutomaticDisableKeywords: string
  AutomaticDisableStatusCodes: string
  AutomaticRetryStatusCodes: string
  'monitor_setting.auto_test_channel_enabled': boolean
  'monitor_setting.auto_test_channel_minutes': number
  'monitor_setting.auto_test_channel_allowed_types': number[]
  'monitor_setting.auto_test_channel_ignored_types': number[]
  'monitor_setting.dingtalk_alert_enabled': boolean
  'monitor_setting.dingtalk_alert_webhook_url': string
  'monitor_setting.dingtalk_alert_secret': string
  'monitor_setting.dingtalk_alert_cooldown_minutes': number
  'monitor_setting.ai_analysis_api_key': string
  'monitor_setting.ai_analysis_base_url': string
  'monitor_setting.ai_analysis_model': string
  'codex_model_governance_setting.enabled': boolean
  'codex_model_governance_setting.probe_enabled': boolean
  'codex_model_governance_setting.probe_interval_minutes': number
  'codex_model_governance_setting.unsupported_message_patterns': string
  'codex_model_governance_setting.official_source_urls': string
  'codex_model_governance_setting.official_lifecycle_terms': string
  'codex_model_governance_setting.alert_cooldown_minutes': number
}

function serializeOptionValue(
  key: keyof NormalizedMonitoringValues,
  value: NormalizedMonitoringValues[keyof NormalizedMonitoringValues]
): string | boolean | number {
  if (
    key === 'monitor_setting.auto_test_channel_allowed_types' ||
    key === 'monitor_setting.auto_test_channel_ignored_types'
  ) {
    return JSON.stringify(value)
  }
  if (
    key === 'codex_model_governance_setting.unsupported_message_patterns' ||
    key === 'codex_model_governance_setting.official_source_urls' ||
    key === 'codex_model_governance_setting.official_lifecycle_terms'
  ) {
    return codexGovernanceLinesToJsonArray(value as string)
  }
  return value as string | boolean | number
}

function areMonitoringValuesEqual(
  key: keyof NormalizedMonitoringValues,
  next: NormalizedMonitoringValues[keyof NormalizedMonitoringValues],
  previous: NormalizedMonitoringValues[keyof NormalizedMonitoringValues]
) {
  if (
    key === 'monitor_setting.auto_test_channel_allowed_types' ||
    key === 'monitor_setting.auto_test_channel_ignored_types'
  ) {
    return JSON.stringify(next) === JSON.stringify(previous)
  }
  return next === previous
}

type ChannelTypePickerProps = {
  title: string
  description: string
  emptySummary: string
  showSelectAllShortcut?: boolean
  value: number[]
  onChange: (value: number[]) => void
}

function ChannelTypePicker(props: ChannelTypePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = new Set(props.value)
  const allSelected = areAllKnownChannelTypesSelected(props.value)
  const showSelectAll = shouldShowChannelTypeSelectAllShortcut(
    props.showSelectAllShortcut
  )
  const selectedLabels = props.value
    .map((id) => CHANNEL_TYPE_OPTIONS.find((option) => option.value === id))
    .filter((option): option is (typeof CHANNEL_TYPE_OPTIONS)[number] =>
      Boolean(option)
    )
  const unknownIds = getUnknownChannelTypeIds(props.value)
  const hasVisibleSelection = selectedLabels.length > 0 || unknownIds.length > 0

  const toggleChannelType = (id: number) => {
    const next = new Set(props.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    props.onChange(normalizeChannelTypeIds(Array.from(next)))
  }

  const selectAllChannelTypes = () => {
    props.onChange(selectAllKnownChannelTypeIds(props.value))
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-col gap-2 sm:flex-row'>
        <Button
          type='button'
          variant='outline'
          className='min-w-0 flex-1 justify-between'
          onClick={() => setOpen(true)}
        >
          <span>{t('Select channel types')}</span>
          <span className='text-muted-foreground text-xs'>
            {props.value.length === 0 && t(props.emptySummary)}
            {props.value.length > 0 &&
              !allSelected &&
              t('{{count}} selected', { count: props.value.length })}
            {allSelected && t('All channel types selected')}
          </span>
        </Button>
        {showSelectAll && (
          <Button
            type='button'
            variant={allSelected ? 'secondary' : 'outline'}
            className='shrink-0'
            onClick={selectAllChannelTypes}
            disabled={allSelected}
          >
            {t('Select all')}
          </Button>
        )}
      </div>

      {allSelected && unknownIds.length === 0 ? (
        <Badge variant='outline'>{t('All channel types selected')}</Badge>
      ) : !hasVisibleSelection ? (
        <p className='text-muted-foreground text-sm'>{t(props.emptySummary)}</p>
      ) : (
        <div className='flex flex-wrap gap-2'>
          {allSelected && (
            <Badge variant='outline'>{t('All channel types selected')}</Badge>
          )}
          {selectedLabels.map((option) => (
            <Badge key={option.value} variant='outline'>
              {t(option.label)}
            </Badge>
          ))}
          {unknownIds.map((id) => (
            <Badge key={id} variant='outline'>
              {t('Unknown channel type #{{id}}', { id })}
            </Badge>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
            <DialogDescription>{props.description}</DialogDescription>
          </DialogHeader>
          {showSelectAll && (
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                variant={allSelected ? 'default' : 'outline'}
                size='sm'
                className='rounded-full'
                onClick={selectAllChannelTypes}
              >
                {t('Select all')}
              </Button>
            </div>
          )}
          <div className='grid max-h-[50vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2'>
            {CHANNEL_TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className='hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm'
              >
                <Checkbox
                  checked={selected.has(option.value)}
                  onCheckedChange={() => toggleChannelType(option.value)}
                />
                <span>{t(option.label)}</span>
              </label>
            ))}
          </div>
          {unknownIds.length > 0 && (
            <div className='space-y-2'>
              <p className='text-muted-foreground text-sm'>
                {t('Unknown channel types are preserved from saved settings.')}
              </p>
              <div className='flex flex-wrap gap-2'>
                {unknownIds.map((id) => (
                  <Badge key={id} variant='outline'>
                    {t('Unknown channel type #{{id}}', { id })}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => props.onChange([])}
            >
              {t('Clear')}
            </Button>
            <Button type='button' onClick={() => setOpen(false)}>
              {t('Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const buildFormDefaults = (
  defaults: MonitoringSettingsSectionProps['defaultValues']
): MonitoringFormInput => ({
  ChannelDisableThreshold: defaults.ChannelDisableThreshold ?? '',
  QuotaRemindThreshold: defaults.QuotaRemindThreshold ?? '',
  AutomaticDisableChannelEnabled: defaults.AutomaticDisableChannelEnabled,
  AutomaticEnableChannelEnabled: defaults.AutomaticEnableChannelEnabled,
  AutomaticDisableKeywords: normalizeLineEndings(
    defaults.AutomaticDisableKeywords ?? ''
  ),
  AutomaticDisableStatusCodes: defaults.AutomaticDisableStatusCodes ?? '',
  AutomaticRetryStatusCodes: defaults.AutomaticRetryStatusCodes ?? '',
  monitor_setting: {
    auto_test_channel_enabled:
      defaults['monitor_setting.auto_test_channel_enabled'],
    auto_test_channel_minutes:
      defaults['monitor_setting.auto_test_channel_minutes'],
    auto_test_channel_allowed_types: normalizeChannelTypeIds(
      defaults['monitor_setting.auto_test_channel_allowed_types']
    ),
    auto_test_channel_ignored_types: normalizeChannelTypeIds(
      defaults['monitor_setting.auto_test_channel_ignored_types']
    ),
    dingtalk_alert_enabled:
      defaults['monitor_setting.dingtalk_alert_enabled'] ?? false,
    dingtalk_alert_webhook_url:
      defaults['monitor_setting.dingtalk_alert_webhook_url'] ?? '',
    dingtalk_alert_secret:
      defaults['monitor_setting.dingtalk_alert_secret'] ?? '',
    dingtalk_alert_cooldown_minutes:
      defaults['monitor_setting.dingtalk_alert_cooldown_minutes'] ?? 60,
    ai_analysis_api_key:
      defaults['monitor_setting.ai_analysis_api_key'] ?? '',
    ai_analysis_base_url:
      defaults['monitor_setting.ai_analysis_base_url'] ?? '',
    ai_analysis_model: defaults['monitor_setting.ai_analysis_model'] ?? '',
  },
  codex_model_governance_setting: {
    enabled: defaults['codex_model_governance_setting.enabled'] ?? false,
    probe_enabled:
      defaults['codex_model_governance_setting.probe_enabled'] ?? false,
    probe_interval_minutes:
      defaults['codex_model_governance_setting.probe_interval_minutes'] ??
      1440,
    unsupported_message_patterns: codexGovernanceStringArrayToLines(
      defaults[
        'codex_model_governance_setting.unsupported_message_patterns'
      ] ?? []
    ),
    official_source_urls: codexGovernanceStringArrayToLines(
      defaults['codex_model_governance_setting.official_source_urls'] ?? []
    ),
    official_lifecycle_terms: codexGovernanceStringArrayToLines(
      defaults[
        'codex_model_governance_setting.official_lifecycle_terms'
      ] ?? []
    ),
    alert_cooldown_minutes:
      defaults['codex_model_governance_setting.alert_cooldown_minutes'] ?? 60,
  },
})

const normalizeDefaults = (
  defaults: MonitoringSettingsSectionProps['defaultValues']
): NormalizedMonitoringValues => ({
  ChannelDisableThreshold: (defaults.ChannelDisableThreshold ?? '').trim(),
  QuotaRemindThreshold: (defaults.QuotaRemindThreshold ?? '').trim(),
  AutomaticDisableChannelEnabled: defaults.AutomaticDisableChannelEnabled,
  AutomaticEnableChannelEnabled: defaults.AutomaticEnableChannelEnabled,
  AutomaticDisableKeywords: normalizeLineEndings(
    defaults.AutomaticDisableKeywords ?? ''
  ),
  AutomaticDisableStatusCodes: parseHttpStatusCodeRules(
    defaults.AutomaticDisableStatusCodes ?? ''
  ).normalized,
  AutomaticRetryStatusCodes: parseHttpStatusCodeRules(
    defaults.AutomaticRetryStatusCodes ?? ''
  ).normalized,
  'monitor_setting.auto_test_channel_enabled':
    defaults['monitor_setting.auto_test_channel_enabled'],
  'monitor_setting.auto_test_channel_minutes':
    defaults['monitor_setting.auto_test_channel_minutes'],
  'monitor_setting.auto_test_channel_allowed_types': normalizeChannelTypeIds(
    defaults['monitor_setting.auto_test_channel_allowed_types']
  ),
  'monitor_setting.auto_test_channel_ignored_types': normalizeChannelTypeIds(
    defaults['monitor_setting.auto_test_channel_ignored_types']
  ),
  'monitor_setting.dingtalk_alert_enabled':
    defaults['monitor_setting.dingtalk_alert_enabled'] ?? false,
  'monitor_setting.dingtalk_alert_webhook_url': (
    defaults['monitor_setting.dingtalk_alert_webhook_url'] ?? ''
  ).trim(),
  'monitor_setting.dingtalk_alert_secret': (
    defaults['monitor_setting.dingtalk_alert_secret'] ?? ''
  ).trim(),
  'monitor_setting.dingtalk_alert_cooldown_minutes':
    defaults['monitor_setting.dingtalk_alert_cooldown_minutes'] ?? 60,
  'monitor_setting.ai_analysis_api_key': (
    defaults['monitor_setting.ai_analysis_api_key'] ?? ''
  ).trim(),
  'monitor_setting.ai_analysis_base_url': (
    defaults['monitor_setting.ai_analysis_base_url'] ?? ''
  ).trim(),
  'monitor_setting.ai_analysis_model': (
    defaults['monitor_setting.ai_analysis_model'] ?? ''
  ).trim(),
  'codex_model_governance_setting.enabled':
    defaults['codex_model_governance_setting.enabled'] ?? false,
  'codex_model_governance_setting.probe_enabled':
    defaults['codex_model_governance_setting.probe_enabled'] ?? false,
  'codex_model_governance_setting.probe_interval_minutes':
    defaults['codex_model_governance_setting.probe_interval_minutes'] ?? 1440,
  'codex_model_governance_setting.unsupported_message_patterns':
    normalizeLineEndings(
      codexGovernanceStringArrayToLines(
        defaults[
          'codex_model_governance_setting.unsupported_message_patterns'
        ] ?? []
      )
    ),
  'codex_model_governance_setting.official_source_urls': normalizeLineEndings(
    codexGovernanceStringArrayToLines(
      defaults['codex_model_governance_setting.official_source_urls'] ?? []
    )
  ),
  'codex_model_governance_setting.official_lifecycle_terms':
    normalizeLineEndings(
      codexGovernanceStringArrayToLines(
        defaults[
          'codex_model_governance_setting.official_lifecycle_terms'
        ] ?? []
      )
    ),
  'codex_model_governance_setting.alert_cooldown_minutes':
    defaults['codex_model_governance_setting.alert_cooldown_minutes'] ?? 60,
})

const normalizeFormValues = (
  values: MonitoringFormValues
): NormalizedMonitoringValues => ({
  ChannelDisableThreshold: values.ChannelDisableThreshold.trim(),
  QuotaRemindThreshold: values.QuotaRemindThreshold.trim(),
  AutomaticDisableChannelEnabled: values.AutomaticDisableChannelEnabled,
  AutomaticEnableChannelEnabled: values.AutomaticEnableChannelEnabled,
  AutomaticDisableKeywords: normalizeLineEndings(
    values.AutomaticDisableKeywords
  ),
  AutomaticDisableStatusCodes: parseHttpStatusCodeRules(
    values.AutomaticDisableStatusCodes
  ).normalized,
  AutomaticRetryStatusCodes: parseHttpStatusCodeRules(
    values.AutomaticRetryStatusCodes
  ).normalized,
  'monitor_setting.auto_test_channel_enabled':
    values.monitor_setting.auto_test_channel_enabled,
  'monitor_setting.auto_test_channel_minutes':
    values.monitor_setting.auto_test_channel_minutes,
  'monitor_setting.auto_test_channel_allowed_types': normalizeChannelTypeIds(
    values.monitor_setting.auto_test_channel_allowed_types
  ),
  'monitor_setting.auto_test_channel_ignored_types': normalizeChannelTypeIds(
    values.monitor_setting.auto_test_channel_ignored_types
  ),
  'monitor_setting.dingtalk_alert_enabled':
    values.monitor_setting.dingtalk_alert_enabled,
  'monitor_setting.dingtalk_alert_webhook_url':
    values.monitor_setting.dingtalk_alert_webhook_url.trim(),
  'monitor_setting.dingtalk_alert_secret':
    values.monitor_setting.dingtalk_alert_secret.trim(),
  'monitor_setting.dingtalk_alert_cooldown_minutes':
    values.monitor_setting.dingtalk_alert_cooldown_minutes,
  'monitor_setting.ai_analysis_api_key':
    values.monitor_setting.ai_analysis_api_key.trim(),
  'monitor_setting.ai_analysis_base_url':
    values.monitor_setting.ai_analysis_base_url.trim(),
  'monitor_setting.ai_analysis_model':
    values.monitor_setting.ai_analysis_model.trim(),
  'codex_model_governance_setting.enabled':
    values.codex_model_governance_setting.enabled,
  'codex_model_governance_setting.probe_enabled':
    values.codex_model_governance_setting.probe_enabled,
  'codex_model_governance_setting.probe_interval_minutes':
    values.codex_model_governance_setting.probe_interval_minutes,
  'codex_model_governance_setting.unsupported_message_patterns':
    codexGovernanceStringArrayToLines(
      codexGovernanceLinesToArray(
        values.codex_model_governance_setting.unsupported_message_patterns
      )
    ),
  'codex_model_governance_setting.official_source_urls':
    codexGovernanceStringArrayToLines(
      codexGovernanceLinesToArray(
        values.codex_model_governance_setting.official_source_urls
      )
    ),
  'codex_model_governance_setting.official_lifecycle_terms':
    codexGovernanceStringArrayToLines(
      codexGovernanceLinesToArray(
        values.codex_model_governance_setting.official_lifecycle_terms
      )
    ),
  'codex_model_governance_setting.alert_cooldown_minutes':
    values.codex_model_governance_setting.alert_cooldown_minutes,
})

export function MonitoringSettingsSection({
  defaultValues,
}: MonitoringSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [codexRuleTestMessage, setCodexRuleTestMessage] = useState('')
  const [codexRuleTestResult, setCodexRuleTestResult] = useState<{
    matched: boolean
    model_name: string
    matched_rule: string
  } | null>(null)
  const [isCodexRuleTesting, setIsCodexRuleTesting] = useState(false)
  const baselineRef = useRef<NormalizedMonitoringValues>(
    normalizeDefaults(defaultValues)
  )

  const formDefaults = useMemo(
    () => buildFormDefaults(defaultValues),
    [defaultValues]
  )

  const form = useForm<MonitoringFormInput, unknown, MonitoringFormValues>({
    resolver: zodResolver(monitoringSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const autoDisableStatusCodes = form.watch('AutomaticDisableStatusCodes')
  const autoRetryStatusCodes = form.watch('AutomaticRetryStatusCodes')
  const autoDisableParsed = useMemo(
    () => parseHttpStatusCodeRules(autoDisableStatusCodes),
    [autoDisableStatusCodes]
  )
  const autoRetryParsed = useMemo(
    () => parseHttpStatusCodeRules(autoRetryStatusCodes),
    [autoRetryStatusCodes]
  )

  const handleCodexRuleTest = async () => {
    setIsCodexRuleTesting(true)
    try {
      const res = await testCodexModelGovernanceRule({
        message: codexRuleTestMessage,
        patterns: codexGovernanceLinesToArray(
          form.getValues(
            'codex_model_governance_setting.unsupported_message_patterns'
          )
        ),
      })
      setCodexRuleTestResult(res.data)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to test Codex rule')
      )
    } finally {
      setIsCodexRuleTesting(false)
    }
  }

  const onSubmit = async (values: MonitoringFormValues) => {
    const normalized = normalizeFormValues(values)
    const updates = (
      Object.keys(normalized) as Array<keyof NormalizedMonitoringValues>
    ).filter((key) => {
      if (
        key === 'monitor_setting.dingtalk_alert_secret' ||
        key === 'monitor_setting.ai_analysis_api_key'
      ) {
        return normalized[key] !== ''
      }
      return !areMonitoringValuesEqual(
        key,
        normalized[key],
        baselineRef.current[key]
      )
    })

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of updates) {
      const value = normalized[key]
      await updateOption.mutateAsync({
        key,
        value: serializeOptionValue(key, value),
      })
    }

    baselineRef.current = {
      ...normalized,
      'monitor_setting.dingtalk_alert_secret': '',
      'monitor_setting.ai_analysis_api_key': '',
    }
    form.setValue('monitor_setting.dingtalk_alert_secret', '')
    form.setValue('monitor_setting.ai_analysis_api_key', '')
  }

  return (
    <SettingsSection title={t('Monitoring & Alerts')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save monitoring rules'
          />
          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='monitor_setting.auto_test_channel_enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Scheduled channel tests')}</FormLabel>
                    <FormDescription>
                      {t('Automatically probe all channels in the background')}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name='monitor_setting.auto_test_channel_minutes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Test interval (minutes)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('How frequently the system tests all channels')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='monitor_setting.auto_test_channel_allowed_types'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Required test channel types')}</FormLabel>
                  <FormControl>
                    <ChannelTypePicker
                      title={t('Required test channel types')}
                      description={t(
                        'When selected, scheduled tests only include these channel types unless they are excluded.'
                      )}
                      emptySummary='All channel types'
                      showSelectAllShortcut
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Leave empty to test all channel types.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='monitor_setting.auto_test_channel_ignored_types'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Excluded test channel types')}</FormLabel>
                  <FormControl>
                    <ChannelTypePicker
                      title={t('Excluded test channel types')}
                      description={t(
                        'Excluded channel types are skipped before required channel types are applied.'
                      )}
                      emptySummary='No channel types excluded'
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Excluded channel types have higher priority than required channel types.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='monitor_setting.dingtalk_alert_enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>
                      {t('DingTalk channel failure alerts')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Send a DingTalk group robot alert when a scheduled channel test fails'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name='monitor_setting.dingtalk_alert_cooldown_minutes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('DingTalk cooldown (minutes)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Suppress repeated alerts for the same channel during this window'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='monitor_setting.dingtalk_alert_webhook_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('DingTalk robot webhook URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://oapi.dingtalk.com/robot/send?access_token=...'
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='monitor_setting.dingtalk_alert_secret'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('DingTalk robot secret')}</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      autoComplete='new-password'
                      placeholder={t(
                        'Enter a new signing secret, or leave blank to keep current'
                      )}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Saved DingTalk secrets are not shown. Enter a new signing secret to update it, or leave blank to keep the current one.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='monitor_setting.ai_analysis_api_key'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Monitoring AI analysis API key')}</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      autoComplete='new-password'
                      placeholder={t(
                        'Enter a new API key, or leave blank to keep current'
                      )}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Saved monitoring AI analysis API keys are not shown. Enter a new API key to update it, or leave blank to keep the current one.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='monitor_setting.ai_analysis_base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Monitoring AI analysis base URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://api.openai.com/v1'
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Used for Codex official URL AI analysis. Enter a /v1 base URL or a full /responses endpoint.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='monitor_setting.ai_analysis_model'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Monitoring AI analysis model')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='gpt-5.4-mini'
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Model used to analyze official Codex notices for lifecycle changes.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='codex_model_governance_setting.enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Enable Codex model governance')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Move explicitly unsupported Codex subscription models to manual review.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name='codex_model_governance_setting.probe_enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Probe Codex models')}</FormLabel>
                    <FormDescription>
                      {t('Lightweight checks run only against Codex channels.')}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='codex_model_governance_setting.probe_interval_minutes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Codex probe interval (minutes)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={60}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='codex_model_governance_setting.alert_cooldown_minutes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Codex governance alert cooldown (minutes)')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='codex_model_governance_setting.unsupported_message_patterns'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Codex unsupported message patterns')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder={t('one regex per line')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Only matching messages move a model to unsupported review.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='space-y-3 rounded-md border p-4'>
            <FormLabel>{t('Test Codex rule')}</FormLabel>
            <Textarea
              rows={3}
              value={codexRuleTestMessage}
              onChange={(event) => {
                setCodexRuleTestMessage(event.target.value)
                setCodexRuleTestResult(null)
              }}
              placeholder={t('Paste an upstream error message')}
            />
            <div className='flex flex-wrap items-center gap-3'>
              <Button
                type='button'
                variant='outline'
                disabled={isCodexRuleTesting}
                onClick={handleCodexRuleTest}
              >
                {t('Test Codex rule')}
              </Button>
              {codexRuleTestResult && (
                <div className='flex flex-wrap items-center gap-2 text-sm'>
                  <Badge
                    variant={
                      codexRuleTestResult.matched ? 'default' : 'secondary'
                    }
                  >
                    {codexRuleTestResult.matched
                      ? t('Rule matched')
                      : t('Rule did not match')}
                  </Badge>
                  {codexRuleTestResult.model_name && (
                    <span className='text-muted-foreground'>
                      {t('Extracted model')}:{' '}
                      <span className='text-foreground'>
                        {codexRuleTestResult.model_name}
                      </span>
                    </span>
                  )}
                  {codexRuleTestResult.matched_rule && (
                    <span className='text-muted-foreground'>
                      {t('Matched rule')}:{' '}
                      <span className='text-foreground break-all'>
                        {codexRuleTestResult.matched_rule}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='codex_model_governance_setting.official_source_urls'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Official Codex source URLs')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder={t('one URL per line')}
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='codex_model_governance_setting.official_lifecycle_terms'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Official lifecycle terms')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder={t('one term per line')}
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='ChannelDisableThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Disable threshold (seconds)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Automatically disable channels exceeding this response time'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='QuotaRemindThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Quota reminder (tokens)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Send email alerts when a user falls below this quota')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='AutomaticDisableChannelEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Disable on failure')}</FormLabel>
                    <FormDescription>
                      {t('Automatically disable channels when tests fail')}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name='AutomaticEnableChannelEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Re-enable on success')}</FormLabel>
                    <FormDescription>
                      {t('Bring channels back online after successful checks')}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='AutomaticDisableKeywords'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Failure keywords')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    placeholder={t('one keyword per line')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'If an upstream error contains any of these keywords (case insensitive), the channel will be disabled automatically.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='AutomaticDisableStatusCodes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Auto-disable status codes')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g. 401, 403, 429, 500-599')}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Accepts comma-separated status codes and inclusive ranges.'
                    )}{' '}
                    {autoDisableParsed.ok &&
                      autoDisableParsed.normalized &&
                      autoDisableParsed.normalized !== field.value.trim() && (
                        <span className='text-muted-foreground'>
                          {t('Normalized:')} {autoDisableParsed.normalized}
                        </span>
                      )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='AutomaticRetryStatusCodes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Auto-retry status codes')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g. 401, 403, 429, 500-599')}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Accepts comma-separated status codes and inclusive ranges.'
                    )}{' '}
                    {autoRetryParsed.ok &&
                      autoRetryParsed.normalized &&
                      autoRetryParsed.normalized !== field.value.trim() && (
                        <span className='text-muted-foreground'>
                          {t('Normalized:')} {autoRetryParsed.normalized}
                        </span>
                      )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
