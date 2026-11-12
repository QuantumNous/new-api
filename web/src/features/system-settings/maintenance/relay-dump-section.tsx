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
import { useEffect, useId, useMemo, useRef } from 'react'
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

import {
  SettingsForm,
  SettingsFormGrid,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'
import { RelayDumpViewer } from './relay-dump-viewer'

const relayDumpSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['error', 'all']),
  output: z.enum(['file', 'log', 'both']),
  directory: z.string().min(1),
  max_body_kb: z.number().int().min(1).max(8192),
  max_files: z.number().int().min(1).max(100000),
  redact_headers: z.boolean(),
  redact_list: z.string(),
})

type RelayDumpFormValues = z.infer<typeof relayDumpSchema>

type RelayDumpSectionProps = {
  defaultValues: {
    'relay_dump_setting.enabled': boolean
    'relay_dump_setting.mode': string
    'relay_dump_setting.output': string
    'relay_dump_setting.directory': string
    'relay_dump_setting.max_body_kb': number
    'relay_dump_setting.max_files': number
    'relay_dump_setting.redact_headers': boolean
    'relay_dump_setting.redact_list': string[]
  }
}

type RelayDumpSectionDefaults = RelayDumpSectionProps['defaultValues']

const splitLines = (value: string) =>
  value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)

const buildFormDefaults = (
  defaults: RelayDumpSectionDefaults
): RelayDumpFormValues => ({
  enabled: defaults['relay_dump_setting.enabled'],
  mode: defaults['relay_dump_setting.mode'] === 'all' ? 'all' : 'error',
  output: defaults['relay_dump_setting.output'],
  directory: defaults['relay_dump_setting.directory'] || 'relay-dump',
  max_body_kb: defaults['relay_dump_setting.max_body_kb'],
  max_files: defaults['relay_dump_setting.max_files'],
  redact_headers: defaults['relay_dump_setting.redact_headers'],
  redact_list: defaults['relay_dump_setting.redact_list'].join('\n'),
})

type RelayDumpOptionValues = Record<
  string,
  string | number | boolean | string[]
>

const normalizeDefaults = (
  defaults: RelayDumpSectionDefaults
): RelayDumpOptionValues => ({
  'relay_dump_setting.enabled': defaults['relay_dump_setting.enabled'],
  'relay_dump_setting.mode': defaults['relay_dump_setting.mode'],
  'relay_dump_setting.output': defaults['relay_dump_setting.output'],
  'relay_dump_setting.directory': defaults['relay_dump_setting.directory'],
  'relay_dump_setting.max_body_kb': defaults['relay_dump_setting.max_body_kb'],
  'relay_dump_setting.max_files': defaults['relay_dump_setting.max_files'],
  'relay_dump_setting.redact_headers':
    defaults['relay_dump_setting.redact_headers'],
  'relay_dump_setting.redact_list': defaults['relay_dump_setting.redact_list'],
})

const normalizeFormValues = (
  values: RelayDumpFormValues
): RelayDumpOptionValues => ({
  'relay_dump_setting.enabled': values.enabled,
  'relay_dump_setting.mode': values.mode,
  'relay_dump_setting.output': values.output,
  'relay_dump_setting.directory': values.directory.trim(),
  'relay_dump_setting.max_body_kb': values.max_body_kb,
  'relay_dump_setting.max_files': values.max_files,
  'relay_dump_setting.redact_headers': values.redact_headers,
  'relay_dump_setting.redact_list': splitLines(values.redact_list),
})

const isEqual = (a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return a === b
}

/**
 * Relay dump settings: capture upstream request/response traffic for
 * troubleshooting, plus the viewer for stored captures.
 */
export function RelayDumpSection(props: RelayDumpSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const captureTitleId = useId()
  const baselineRef = useRef<RelayDumpOptionValues>(
    normalizeDefaults(props.defaultValues)
  )

  const formDefaults = useMemo(
    () => buildFormDefaults(props.defaultValues),
    [props.defaultValues]
  )

  const form = useForm<RelayDumpFormValues>({
    resolver: zodResolver(relayDumpSchema),
    defaultValues: formDefaults,
  })

  useEffect(() => {
    baselineRef.current = normalizeDefaults(props.defaultValues)
    form.reset(buildFormDefaults(props.defaultValues))
  }, [props.defaultValues, form])

  const onSubmit = async (values: RelayDumpFormValues) => {
    const normalized = normalizeFormValues(values)
    const updates = Object.keys(normalized).filter(
      (key) => !isEqual(normalized[key], baselineRef.current[key])
    )

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of updates) {
      const value = normalized[key]
      await updateOption.mutateAsync({
        key,
        value: Array.isArray(value) ? JSON.stringify(value) : value,
      })
    }

    baselineRef.current = normalized
  }

  return (
    <SettingsSection title={t('Relay Dump')} className='gap-6'>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save relay dump settings'
          />
          <div
            role='group'
            aria-labelledby={captureTitleId}
            className='flex min-w-0 flex-col gap-4'
          >
            <h4 id={captureTitleId} className='font-medium'>
              {t('Capture settings')}
            </h4>
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Enable relay dump')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Record upstream request headers/body and response headers/body for troubleshooting. Captured data may contain user conversation content; keep the dump directory secure.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </SettingsSwitchItem>
              )}
            />
            <SettingsFormGrid>
              <FormField
                control={form.control}
                name='mode'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Capture scope')}</FormLabel>
                    <Select
                      items={[
                        {
                          value: 'error',
                          label: t('Failed requests only'),
                        },
                        { value: 'all', label: t('All requests') },
                      ]}
                      value={field.value}
                      onValueChange={(value) =>
                        value !== null && field.onChange(value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='error'>
                            {t('Failed requests only')}
                          </SelectItem>
                          <SelectItem value='all'>
                            {t('All requests')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'Failed means a transport error or an upstream status of 400 or higher.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='output'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Output target')}</FormLabel>
                    <Select
                      items={[
                        { value: 'file', label: t('Save to files') },
                        { value: 'log', label: t('Server log') },
                        { value: 'both', label: t('Files and log') },
                      ]}
                      value={field.value}
                      onValueChange={(value) =>
                        value !== null && field.onChange(value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='file'>
                            {t('Save to files')}
                          </SelectItem>
                          <SelectItem value='log'>
                            {t('Server log')}
                          </SelectItem>
                          <SelectItem value='both'>
                            {t('Files and log')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('Where captured exchanges are written.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='directory'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Dump directory')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='relay-dump'
                        autoComplete='off'
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value)}
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Directory for dump files, relative to the server working directory.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='max_body_kb'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Body size limit (KB)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={8192}
                        step={1}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Bodies larger than this limit are truncated.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='max_files'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Max stored files')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={100000}
                        step={1}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Oldest captures are deleted beyond this limit.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsFormGrid>
            <FormField
              control={form.control}
              name='redact_headers'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Redact sensitive headers')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Built-in credential headers (Authorization, Cookie, etc.) are replaced with <redacted> before saving.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </SettingsSwitchItem>
              )}
            />
            <FormField
              control={form.control}
              name='redact_list'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Additional redacted headers')}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder={'X-Internal-Secret\nX-My-Token'}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'One header name per line. Values of these headers are redacted in captures.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SettingsForm>
      </Form>

      <Separator />

      <RelayDumpViewer />
    </SettingsSection>
  )
}
