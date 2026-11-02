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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { parseHttpStatusCodeRules } from '@/lib/http-status-code-rules'

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

const channelTestModes = [
  'scheduled_all',
  'auto_ban_only',
  'passive_recovery',
] as const
type ChannelTestMode = (typeof channelTestModes)[number]

const createRoutingReliabilitySchema = (
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const numericString = z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    return !Number.isNaN(Number(trimmed)) && Number(trimmed) >= 0
  }, t('Enter a non-negative number or leave empty'))

  const dispatchMs = z.coerce
    .number()
    .int()
    .min(0, t('Dispatch durations must be non-negative'))

  const failureThreshold = z.coerce
    .number()
    .int()
    .min(1, t('Failure threshold must be at least 1'))

  const availabilityThreshold = z.coerce
    .number()
    .int()
    .min(0, t('Availability threshold must be between 0 and 100'))
    .max(100, t('Availability threshold must be between 0 and 100'))

  const dispatchRampSteps = z.coerce
    .number()
    .int()
    .min(1, t('Cooldown ramp steps must be at least 1'))

  const healthAlpha = z.coerce
    .number()
    .gt(0, t('Smoothing factor must be in (0, 1]'))
    .max(1, t('Smoothing factor must be in (0, 1]'))

  const healthMinRequests = z.coerce
    .number()
    .int()
    .min(0, t('Minimum requests must be non-negative'))

  const scoreFloor = z.coerce
    .number()
    .min(0, t('Score floor must be between 0 and 1'))
    .max(1, t('Score floor must be between 0 and 1'))

  const concurrencyLimit = z.coerce
    .number()
    .int()
    .min(0, t('Concurrency limits must be non-negative (0 means unlimited)'))

  return z
    .object({
      RetryTimes: z.coerce.number().min(0).max(10),
      GatewayDispatchCooldownBaseMs: dispatchMs,
      GatewayDispatchCooldownMaxMs: dispatchMs,
      GatewayDispatchCooldownRampSteps: dispatchRampSteps,
      GatewayDispatchThrottleBaseMs: dispatchMs,
      GatewayDispatchThrottleMaxMs: dispatchMs,
      GatewayDispatchScoreDecayTauMs: dispatchMs,
      GatewayDispatchHealthAlpha: healthAlpha,
      GatewayDispatchHealthMinRequests: healthMinRequests,
      GatewayDispatchHealthMinScoreFloor: scoreFloor,
      GatewayRetryTotalBudgetMs: dispatchMs,
      GatewayForwardMaxConcurrency: concurrencyLimit,
      GatewayChannelMaxConcurrency: concurrencyLimit,
      LocalFailureThreshold: failureThreshold,
      UpstreamFailureThreshold: failureThreshold,
      EmergencyThreshold: availabilityThreshold,
      WarningThreshold: availabilityThreshold,
      KeyProbeEnabled: z.boolean(),
      ChannelDisableThreshold: numericString,
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
          .min(1, t('Interval must be at least 1 minute')),
        channel_test_mode: z.enum(channelTestModes),
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
          message: t('Invalid status code rules: {{codes}}', {
            codes: disableParsed.invalidTokens.join(', '),
          }),
        })
      }

      const retryParsed = parseHttpStatusCodeRules(
        values.AutomaticRetryStatusCodes
      )
      if (!retryParsed.ok) {
        ctx.addIssue({
          code: 'custom',
          path: ['AutomaticRetryStatusCodes'],
          message: t('Invalid status code rules: {{codes}}', {
            codes: retryParsed.invalidTokens.join(', '),
          }),
        })
      }
    })
}

// The gateway-dispatch keys share one numeric shape across the form input,
// the parsed values, and the diffed payload, so they are declared once here.
// KeyProbeEnabled is boolean and lives outside this group.
type RouteIsolationValues = {
  GatewayDispatchCooldownBaseMs: number
  GatewayDispatchCooldownMaxMs: number
  GatewayDispatchCooldownRampSteps: number
  GatewayDispatchThrottleBaseMs: number
  GatewayDispatchThrottleMaxMs: number
  GatewayDispatchScoreDecayTauMs: number
  GatewayDispatchHealthAlpha: number
  GatewayDispatchHealthMinRequests: number
  GatewayDispatchHealthMinScoreFloor: number
  GatewayRetryTotalBudgetMs: number
  GatewayForwardMaxConcurrency: number
  GatewayChannelMaxConcurrency: number
  EmergencyThreshold: number
  WarningThreshold: number
}

const ROUTE_ISOLATION_KEYS = [
  'GatewayDispatchCooldownBaseMs',
  'GatewayDispatchCooldownMaxMs',
  'GatewayDispatchCooldownRampSteps',
  'GatewayDispatchThrottleBaseMs',
  'GatewayDispatchThrottleMaxMs',
  'GatewayDispatchScoreDecayTauMs',
  'GatewayDispatchHealthAlpha',
  'GatewayDispatchHealthMinRequests',
  'GatewayDispatchHealthMinScoreFloor',
  'GatewayRetryTotalBudgetMs',
  'GatewayForwardMaxConcurrency',
  'GatewayChannelMaxConcurrency',
  'EmergencyThreshold',
  'WarningThreshold',
] as const satisfies ReadonlyArray<keyof RouteIsolationValues>

// Mirrors the backend DefaultUnitHealthSetting and the zero-value
// ConcurrencyLimitSetting (0 = unlimited), so a form rendered before the
// options request resolves shows the values that are actually in effect.
const ROUTE_ISOLATION_DEFAULTS: RouteIsolationValues = {
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
  EmergencyThreshold: 20,
  WarningThreshold: 50,
}

type RoutingReliabilityFormValues = RouteIsolationValues & {
  RetryTimes: number
  LocalFailureThreshold: number
  UpstreamFailureThreshold: number
  KeyProbeEnabled: boolean
  ChannelDisableThreshold: string
  AutomaticDisableChannelEnabled: boolean
  AutomaticEnableChannelEnabled: boolean
  AutomaticDisableKeywords: string
  AutomaticDisableStatusCodes: string
  AutomaticRetryStatusCodes: string
  monitor_setting: {
    auto_test_channel_enabled: boolean
    auto_test_channel_minutes: number
    channel_test_mode: ChannelTestMode
  }
}

type RoutingReliabilityFormInput = Record<
  keyof RouteIsolationValues,
  unknown
> & {
  RetryTimes: unknown
  LocalFailureThreshold: unknown
  UpstreamFailureThreshold: unknown
  KeyProbeEnabled: boolean
  ChannelDisableThreshold: string
  AutomaticDisableChannelEnabled: boolean
  AutomaticEnableChannelEnabled: boolean
  AutomaticDisableKeywords: string
  AutomaticDisableStatusCodes: string
  AutomaticRetryStatusCodes: string
  monitor_setting: {
    auto_test_channel_enabled: boolean
    auto_test_channel_minutes: unknown
    channel_test_mode: ChannelTestMode
  }
}

export type RoutingReliabilitySectionProps = {
  defaultValues: Partial<RouteIsolationValues> & {
    RetryTimes: number
    LocalFailureThreshold: number
    UpstreamFailureThreshold: number
    KeyProbeEnabled: boolean
    ChannelDisableThreshold: string
    AutomaticDisableChannelEnabled: boolean
    AutomaticEnableChannelEnabled: boolean
    AutomaticDisableKeywords: string
    AutomaticDisableStatusCodes: string
    AutomaticRetryStatusCodes: string
    'monitor_setting.auto_test_channel_enabled': boolean
    'monitor_setting.auto_test_channel_minutes': number
    'monitor_setting.channel_test_mode': ChannelTestMode
  }
}

function normalizeLineEndings(value: string) {
  return value.replaceAll('\r\n', '\n')
}

type NormalizedRoutingReliabilityValues = RouteIsolationValues & {
  RetryTimes: number
  LocalFailureThreshold: number
  UpstreamFailureThreshold: number
  KeyProbeEnabled: boolean
  ChannelDisableThreshold: string
  AutomaticDisableChannelEnabled: boolean
  AutomaticEnableChannelEnabled: boolean
  AutomaticDisableKeywords: string
  AutomaticDisableStatusCodes: string
  AutomaticRetryStatusCodes: string
  'monitor_setting.auto_test_channel_enabled': boolean
  'monitor_setting.auto_test_channel_minutes': number
  'monitor_setting.channel_test_mode': ChannelTestMode
}

function normalizeChannelTestMode(value?: string): ChannelTestMode {
  if (value === 'auto_ban_only' || value === 'passive_recovery') {
    return value
  }
  return 'scheduled_all'
}

// resolveIsolationValues fills every isolation key from the loaded options,
// falling back to the backend defaults. Both the form defaults and the saved
// baseline read it, so an unsaved field cannot appear changed on first render.
function resolveIsolationValues(
  defaults: RoutingReliabilitySectionProps['defaultValues']
): RouteIsolationValues {
  const resolved = { ...ROUTE_ISOLATION_DEFAULTS }
  for (const key of ROUTE_ISOLATION_KEYS) {
    resolved[key] = defaults[key] ?? ROUTE_ISOLATION_DEFAULTS[key]
  }
  return resolved
}

const buildFormDefaults = (
  defaults: RoutingReliabilitySectionProps['defaultValues']
): RoutingReliabilityFormInput => ({
  ...resolveIsolationValues(defaults),
  RetryTimes: defaults.RetryTimes ?? 0,
  LocalFailureThreshold: defaults.LocalFailureThreshold ?? 1,
  UpstreamFailureThreshold: defaults.UpstreamFailureThreshold ?? 1,
  KeyProbeEnabled: defaults.KeyProbeEnabled ?? true,
  ChannelDisableThreshold: defaults.ChannelDisableThreshold ?? '',
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
    channel_test_mode: normalizeChannelTestMode(
      defaults['monitor_setting.channel_test_mode']
    ),
  },
})

const normalizeDefaults = (
  defaults: RoutingReliabilitySectionProps['defaultValues']
): NormalizedRoutingReliabilityValues => ({
  ...resolveIsolationValues(defaults),
  RetryTimes: defaults.RetryTimes ?? 0,
  LocalFailureThreshold: defaults.LocalFailureThreshold ?? 1,
  UpstreamFailureThreshold: defaults.UpstreamFailureThreshold ?? 1,
  KeyProbeEnabled: defaults.KeyProbeEnabled ?? true,
  ChannelDisableThreshold: (defaults.ChannelDisableThreshold ?? '').trim(),
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
  'monitor_setting.channel_test_mode': normalizeChannelTestMode(
    defaults['monitor_setting.channel_test_mode']
  ),
})

const normalizeFormValues = (
  values: RoutingReliabilityFormValues
): NormalizedRoutingReliabilityValues => ({
  GatewayDispatchCooldownBaseMs: values.GatewayDispatchCooldownBaseMs,
  GatewayDispatchCooldownMaxMs: values.GatewayDispatchCooldownMaxMs,
  GatewayDispatchCooldownRampSteps: values.GatewayDispatchCooldownRampSteps,
  GatewayDispatchThrottleBaseMs: values.GatewayDispatchThrottleBaseMs,
  GatewayDispatchThrottleMaxMs: values.GatewayDispatchThrottleMaxMs,
  GatewayDispatchScoreDecayTauMs: values.GatewayDispatchScoreDecayTauMs,
  GatewayDispatchHealthAlpha: values.GatewayDispatchHealthAlpha,
  GatewayDispatchHealthMinRequests: values.GatewayDispatchHealthMinRequests,
  GatewayDispatchHealthMinScoreFloor:
    values.GatewayDispatchHealthMinScoreFloor,
  GatewayRetryTotalBudgetMs: values.GatewayRetryTotalBudgetMs,
  GatewayForwardMaxConcurrency: values.GatewayForwardMaxConcurrency,
  GatewayChannelMaxConcurrency: values.GatewayChannelMaxConcurrency,
  EmergencyThreshold: values.EmergencyThreshold,
  WarningThreshold: values.WarningThreshold,
  KeyProbeEnabled: values.KeyProbeEnabled,
  RetryTimes: values.RetryTimes,
  LocalFailureThreshold: values.LocalFailureThreshold,
  UpstreamFailureThreshold: values.UpstreamFailureThreshold,
  ChannelDisableThreshold: values.ChannelDisableThreshold.trim(),
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
  'monitor_setting.channel_test_mode': values.monitor_setting.channel_test_mode,
})


export function RoutingReliabilitySection({
  defaultValues,
}: RoutingReliabilitySectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const routingReliabilitySchema = useMemo(
    () => createRoutingReliabilitySchema(t),
    [t]
  )
  const baselineRef = useRef<NormalizedRoutingReliabilityValues>(
    normalizeDefaults(defaultValues)
  )

  const formDefaults = useMemo(
    () => buildFormDefaults(defaultValues),
    [defaultValues]
  )

  const form = useForm<
    RoutingReliabilityFormInput,
    unknown,
    RoutingReliabilityFormValues
  >({
    resolver: zodResolver(routingReliabilitySchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const autoDisableStatusCodes = form.watch('AutomaticDisableStatusCodes')
  const autoRetryStatusCodes = form.watch('AutomaticRetryStatusCodes')
  const channelTestMode = form.watch('monitor_setting.channel_test_mode')
  let channelTestModeDescription: string
  switch (channelTestMode) {
    case 'auto_ban_only':
      channelTestModeDescription = t(
        'Periodically checks only channels with auto-disable enabled, excluding manually disabled channels.'
      )
      break
    case 'passive_recovery':
      channelTestModeDescription = t(
        'Does not check healthy channels. It only rechecks auto-disabled channels and restores them after they recover.'
      )
      break
    default:
      channelTestModeDescription = t(
        'Periodically checks all channels except manually disabled ones to detect failures and recover channels automatically.'
      )
  }
  const autoDisableParsed = useMemo(
    () => parseHttpStatusCodeRules(autoDisableStatusCodes),
    [autoDisableStatusCodes]
  )
  const autoRetryParsed = useMemo(
    () => parseHttpStatusCodeRules(autoRetryStatusCodes),
    [autoRetryStatusCodes]
  )

  const onSubmit = async (values: RoutingReliabilityFormValues) => {
    const normalized = normalizeFormValues(values)
    const updates = (
      Object.keys(normalized) as Array<keyof NormalizedRoutingReliabilityValues>
    ).filter((key) => normalized[key] !== baselineRef.current[key])

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of updates) {
      const value = normalized[key]
      await updateOption.mutateAsync({
        key,
        value,
      })
    }

    baselineRef.current = normalized
  }

  return (
    <SettingsSection title={t('Routing Reliability')}>
      <Form {...form}>
        <SettingsForm
          onSubmit={form.handleSubmit(onSubmit)}
          className='rounded-xl bg-card-surface p-4 backdrop-blur-card'
        >
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <div className='flex min-w-0 flex-col gap-4'>
            <div className='flex flex-col gap-1'>
              <h4 className='text-sm font-medium'>{t('Request retry')}</h4>
            </div>
            <div className='grid min-w-0 gap-6 xl:grid-cols-[minmax(12rem,24rem)_minmax(0,1fr)]'>
              <FormField
                control={form.control}
                name='RetryTimes'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Retry Times')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        max='10'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      <span className='block'>
                        {t('Number of times to retry failed requests (0-10)')}
                      </span>
                      <span className='block'>
                        {t(
                          'Also controls request-level channel exclusion: a failed channel is skipped for the rest of the request only when retries remain. With 0, exclusion has no effect.'
                        )}
                      </span>
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
          </div>
          <Separator />

          <div className='flex min-w-0 flex-col gap-4'>
            <div className='flex flex-col gap-1'>
              <h4 className='text-sm font-medium'>{t('Gateway dispatch')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'A failure cools a route off, repeated failures climb the cooldown ladder to its ceiling, and 429 responses run on their own ladder. A smoothed score decides how each route comes back.'
                )}
              </p>
            </div>
            <div className='grid min-w-0 gap-6 lg:grid-cols-2'>
              <FormField
                control={form.control}
                name='GatewayDispatchCooldownBaseMs'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Cooldown base (ms)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Starting cooldown window after a single failed request')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayDispatchCooldownMaxMs'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Cooldown ceiling (ms)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Ceiling the cooldown ladder reaches after repeated failures'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayDispatchCooldownRampSteps'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Cooldown ramp steps')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='1'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Failures the ladder climbs before it reaches the ceiling')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayDispatchThrottleBaseMs'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('429 throttle base (ms)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Starting isolation window after a 429 response')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayDispatchThrottleMaxMs'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('429 throttle ceiling (ms)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Ceiling of the 429 isolation ladder')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayDispatchScoreDecayTauMs'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Score aging constant (ms)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Time constant at which route scores age toward healthy; 0 freezes scores'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayDispatchHealthAlpha'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Score smoothing factor')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        max='1'
                        step='0.01'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Weight of the newest result when updating a route score (0, 1]')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayDispatchHealthMinRequests'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Score trust threshold')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Samples a route must record before its score is trusted')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayDispatchHealthMinScoreFloor'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Score floor')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        max='1'
                        step='0.01'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Lowest score a route keeps while re-entering slow start')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayRetryTotalBudgetMs'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Failover time budget (ms)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Time a request may spend failing over between routes; the server clamps it to 1s-300s'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayForwardMaxConcurrency'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Forward concurrency limit')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Process-wide cap on in-flight relayed requests; 0 is unlimited')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='GatewayChannelMaxConcurrency'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Channel concurrency limit')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Per-key cap on in-flight requests; 0 is unlimited')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='LocalFailureThreshold'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Local failure threshold')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='1'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Number of local failures (no available channel, parse error, quota rejection) before a route is isolated. Local failures are tracked separately from upstream errors.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='UpstreamFailureThreshold'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Upstream failure threshold')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='1'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Number of upstream provider errors before a route is isolated. Upstream failures reflect channel health and may need a lower threshold than local failures.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className='flex min-w-0 flex-col gap-4'>
            <div className='flex flex-col gap-1'>
              <h4 className='text-sm font-medium'>{t('Pool pressure')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'When a model pool runs short of healthy units, these thresholds suppress new escalation and pull the least-isolated routes back.'
                )}
              </p>
            </div>
            <div className='grid min-w-0 gap-6 lg:grid-cols-2'>
              <FormField
                control={form.control}
                name='EmergencyThreshold'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Emergency availability (%)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        max='100'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Below this share of healthy units for a model, isolation is ignored entirely and the least-damaged routes are pulled back.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='WarningThreshold'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Warning availability (%)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='0'
                        max='100'
                        step='1'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Below this share of healthy units, no new isolation is recorded and recovery speeds up. Also the target the emergency pull-back aims for.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='KeyProbeEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Verify key on auto-disable')}</FormLabel>
                      <FormDescription>
                        {t(
                          'When a route is auto-disabled, check the key with a model-list request, which spends no tokens. A 401 or 403 disables every model behind that key.'
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
            </div>
          </div>

          <Separator />

          <div className='flex min-w-0 flex-col gap-4'>
            <div className='flex flex-col gap-1'>
              <h4 className='text-sm font-medium'>
                {t('Channel health checks')}
              </h4>
            </div>
            <div className='grid min-w-0 gap-6 lg:grid-cols-3'>
              <FormField
                control={form.control}
                name='monitor_setting.auto_test_channel_enabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Scheduled channel tests')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Automatically probe all channels in the background'
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
                name='monitor_setting.channel_test_mode'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Channel test mode')}</FormLabel>
                    <Select
                      items={[
                        {
                          value: 'scheduled_all',
                          label: t('Actively check all channels'),
                        },
                        {
                          value: 'auto_ban_only',
                          label: t(
                            'Actively check auto-disable-enabled channels'
                          ),
                        },
                        {
                          value: 'passive_recovery',
                          label: t('Check channels awaiting recovery only'),
                        },
                      ]}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='scheduled_all'>
                            {t('Actively check all channels')}
                          </SelectItem>
                          <SelectItem value='auto_ban_only'>
                            {t('Actively check auto-disable-enabled channels')}
                          </SelectItem>
                          <SelectItem value='passive_recovery'>
                            {t('Check channels awaiting recovery only')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {channelTestModeDescription}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
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
                      {channelTestMode === 'passive_recovery'
                        ? t(
                            'How frequently the system checks auto-disabled channels for recovery'
                          )
                        : t('How frequently the system tests all channels')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
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
                        {t(
                          'Bring channels back online after successful checks'
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
            </div>
          </div>

          <Separator />

          <div className='flex min-w-0 flex-col gap-4'>
            <div className='flex flex-col gap-1'>
              <h4 className='text-sm font-medium'>{t('Auto-disable rules')}</h4>
            </div>
            <div className='grid min-w-0 gap-6 lg:grid-cols-2'>
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
            </div>
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
