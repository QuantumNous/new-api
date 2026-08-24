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
import { useEffect, useMemo, useRef } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

/**
 * react-hook-form 7 interprets dotted `name` strings as nested paths, so the
 * form models the module as a nested object and flattens back to the
 * server-side `channel_concurrency_setting.*` keys right before persisting
 * (same pattern as PerformanceSection).
 */
const concurrencySchema = z.object({
  channel_concurrency_setting: z.object({
    wait_enabled: z.boolean(),
    wait_timeout_ms: z.coerce.number().int().min(0),
    max_waiting_per_channel: z.coerce.number().int().min(0),
    cooldown_enabled: z.boolean(),
    cooldown_seconds: z.coerce.number().int().min(1),
    cooldown_on_status_429: z.boolean(),
    cooldown_on_message_match: z.boolean(),
    load_cache_enabled: z.boolean(),
  }),
})

type ConcurrencyFormInput = z.input<typeof concurrencySchema>
type ConcurrencyFormValues = z.output<typeof concurrencySchema>

type FlatConcurrencyDefaults = {
  'channel_concurrency_setting.wait_enabled': boolean
  'channel_concurrency_setting.wait_timeout_ms': number
  'channel_concurrency_setting.max_waiting_per_channel': number
  'channel_concurrency_setting.cooldown_enabled': boolean
  'channel_concurrency_setting.cooldown_seconds': number
  'channel_concurrency_setting.cooldown_on_status_429': boolean
  'channel_concurrency_setting.cooldown_on_message_match': boolean
  'channel_concurrency_setting.load_cache_enabled': boolean
}

const buildFormDefaults = (
  defaults: FlatConcurrencyDefaults
): ConcurrencyFormInput => ({
  channel_concurrency_setting: {
    wait_enabled: defaults['channel_concurrency_setting.wait_enabled'],
    wait_timeout_ms: defaults['channel_concurrency_setting.wait_timeout_ms'],
    max_waiting_per_channel:
      defaults['channel_concurrency_setting.max_waiting_per_channel'],
    cooldown_enabled: defaults['channel_concurrency_setting.cooldown_enabled'],
    cooldown_seconds: defaults['channel_concurrency_setting.cooldown_seconds'],
    cooldown_on_status_429:
      defaults['channel_concurrency_setting.cooldown_on_status_429'],
    cooldown_on_message_match:
      defaults['channel_concurrency_setting.cooldown_on_message_match'],
    load_cache_enabled:
      defaults['channel_concurrency_setting.load_cache_enabled'],
  },
})

const normalizeFormValues = (
  values: ConcurrencyFormValues
): FlatConcurrencyDefaults => ({
  'channel_concurrency_setting.wait_enabled':
    values.channel_concurrency_setting.wait_enabled,
  'channel_concurrency_setting.wait_timeout_ms':
    values.channel_concurrency_setting.wait_timeout_ms,
  'channel_concurrency_setting.max_waiting_per_channel':
    values.channel_concurrency_setting.max_waiting_per_channel,
  'channel_concurrency_setting.cooldown_enabled':
    values.channel_concurrency_setting.cooldown_enabled,
  'channel_concurrency_setting.cooldown_seconds':
    values.channel_concurrency_setting.cooldown_seconds,
  'channel_concurrency_setting.cooldown_on_status_429':
    values.channel_concurrency_setting.cooldown_on_status_429,
  'channel_concurrency_setting.cooldown_on_message_match':
    values.channel_concurrency_setting.cooldown_on_message_match,
  'channel_concurrency_setting.load_cache_enabled':
    values.channel_concurrency_setting.load_cache_enabled,
})

interface Props {
  defaultValues: FlatConcurrencyDefaults
}

export function ChannelConcurrencySection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults = useMemo(
    () => buildFormDefaults(props.defaultValues),
    [props.defaultValues]
  )

  const form = useForm<ConcurrencyFormInput, unknown, ConcurrencyFormValues>({
    resolver: zodResolver(concurrencySchema),
    defaultValues: formDefaults,
  })

  const baselineRef = useRef<FlatConcurrencyDefaults>(props.defaultValues)
  const baselineSerializedRef = useRef<string>(
    JSON.stringify(props.defaultValues)
  )

  useEffect(() => {
    const serialized = JSON.stringify(props.defaultValues)
    if (serialized === baselineSerializedRef.current) return
    baselineRef.current = props.defaultValues
    baselineSerializedRef.current = serialized
    form.reset(buildFormDefaults(props.defaultValues))
  }, [props.defaultValues, form])

  const waitEnabled = form.watch('channel_concurrency_setting.wait_enabled')
  const cooldownEnabled = form.watch(
    'channel_concurrency_setting.cooldown_enabled'
  )

  const onSubmit = async (values: ConcurrencyFormValues) => {
    const normalized = normalizeFormValues(values)
    const changedKeys = (
      Object.keys(normalized) as Array<keyof FlatConcurrencyDefaults>
    ).filter((key) => normalized[key] !== baselineRef.current[key])

    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of changedKeys) {
      await updateOption.mutateAsync({
        key,
        value: normalized[key],
      })
    }

    baselineRef.current = normalized
    baselineSerializedRef.current = JSON.stringify(normalized)
    form.reset(buildFormDefaults(normalized))
  }

  return (
    <Form {...form}>
      <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
        <SettingsPageFormActions
          onSave={form.handleSubmit(onSubmit)}
          isSaving={updateOption.isPending}
        />

        <div data-settings-form-span='full'>
          <h4 className='font-medium'>{t('Channel Concurrency Limits')}</h4>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t(
              'Controls queueing and cooldown for channels with a max concurrency; channels without a limit are unaffected'
            )}
          </p>
        </div>

        <FormField
          control={form.control}
          name='channel_concurrency_setting.wait_enabled'
          render={({ field }) => (
            <SettingsSwitchItem>
              <SettingsSwitchContent>
                <FormLabel>{t('Queue when concurrency is full')}</FormLabel>
                <FormDescription>
                  {t(
                    'When a bounded channel is saturated, hold the request briefly for a freed slot instead of failing immediately'
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
          name='channel_concurrency_setting.wait_timeout_ms'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Queue timeout (ms)')}</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  disabled={!waitEnabled}
                  {...safeNumberFieldProps(field)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='channel_concurrency_setting.max_waiting_per_channel'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('Max waiting per channel (0 = same as its concurrency limit)')}
              </FormLabel>
              <FormControl>
                <Input
                  type='number'
                  disabled={!waitEnabled}
                  {...safeNumberFieldProps(field)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='channel_concurrency_setting.cooldown_enabled'
          render={({ field }) => (
            <SettingsSwitchItem>
              <SettingsSwitchContent>
                <FormLabel>{t('Enable channel cooldown')}</FormLabel>
                <FormDescription>
                  {t(
                    'Temporarily exclude a bounded channel from selection after upstream rate-limit signals'
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
          name='channel_concurrency_setting.cooldown_seconds'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Cooldown duration (seconds)')}</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  disabled={!cooldownEnabled}
                  {...safeNumberFieldProps(field)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='channel_concurrency_setting.cooldown_on_status_429'
          render={({ field }) => (
            <SettingsSwitchItem>
              <SettingsSwitchContent>
                <FormLabel>{t('Cool down on upstream HTTP 429')}</FormLabel>
                <FormDescription>
                  {t(
                    'Trigger cooldown only when the upstream explicitly returns HTTP 429'
                  )}
                </FormDescription>
              </SettingsSwitchContent>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!cooldownEnabled}
                />
              </FormControl>
            </SettingsSwitchItem>
          )}
        />

        <FormField
          control={form.control}
          name='channel_concurrency_setting.cooldown_on_message_match'
          render={({ field }) => (
            <SettingsSwitchItem>
              <SettingsSwitchContent>
                <FormLabel>
                  {t(
                    'Cool down on rate-limit keywords in error messages (prone to false positives)'
                  )}
                </FormLabel>
                <FormDescription>
                  {t(
                    'Also trigger cooldown when error messages merely mention rate-limit-like keywords; fuzzy matching, off by default'
                  )}
                </FormDescription>
              </SettingsSwitchContent>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!cooldownEnabled}
                />
              </FormControl>
            </SettingsSwitchItem>
          )}
        />

        <FormField
          control={form.control}
          name='channel_concurrency_setting.load_cache_enabled'
          render={({ field }) => (
            <SettingsSwitchItem>
              <SettingsSwitchContent>
                <FormLabel>
                  {t('Load snapshot cache (reduces Redis pressure)')}
                </FormLabel>
                <FormDescription>
                  {t(
                    'Cache channel load snapshots briefly for routing decisions; disable only to debug routing with live reads'
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
      </SettingsForm>
    </Form>
  )
}
