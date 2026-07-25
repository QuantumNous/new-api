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
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const relayTraceLogModeSchema = z.object({
  RelayTraceLogMode: z.enum(['off', 'failure', 'all']),
  RelayTraceLogFullBodyEnabled: z.boolean(),
})

type RelayTraceLogMode = z.infer<
  typeof relayTraceLogModeSchema
>['RelayTraceLogMode']
type RelayTraceLogFormValues = z.infer<typeof relayTraceLogModeSchema>

type RelayTraceSectionProps = {
  defaultMode: RelayTraceLogMode
  defaultFullBodyEnabled: boolean
}

export function RelayTraceSection(props: RelayTraceSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<RelayTraceLogFormValues>({
    resolver: zodResolver(relayTraceLogModeSchema),
    defaultValues: {
      RelayTraceLogMode: props.defaultMode,
      RelayTraceLogFullBodyEnabled: props.defaultFullBodyEnabled,
    },
  })
  const selectedMode = form.watch('RelayTraceLogMode')
  const selectedFullBodyEnabled = form.watch('RelayTraceLogFullBodyEnabled')

  useEffect(() => {
    form.reset({
      RelayTraceLogMode: props.defaultMode,
      RelayTraceLogFullBodyEnabled: props.defaultFullBodyEnabled,
    })
  }, [form, props.defaultFullBodyEnabled, props.defaultMode])

  const onSubmit = async (values: RelayTraceLogFormValues) => {
    if (values.RelayTraceLogMode !== props.defaultMode) {
      await updateOption.mutateAsync({
        key: 'RelayTraceLogMode',
        value: values.RelayTraceLogMode,
      })
    }
    if (values.RelayTraceLogFullBodyEnabled !== props.defaultFullBodyEnabled) {
      await updateOption.mutateAsync({
        key: 'RelayTraceLogFullBodyEnabled',
        value: values.RelayTraceLogFullBodyEnabled,
      })
    }
  }

  return (
    <SettingsSection title={t('Relay Request Tracing')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            isSaveDisabled={
              selectedMode === props.defaultMode &&
              selectedFullBodyEnabled === props.defaultFullBodyEnabled
            }
          />
          <FormField
            control={form.control}
            name='RelayTraceLogMode'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Trace logging mode')}</FormLabel>
                <Select
                  items={[
                    { value: 'off', label: t('Disabled') },
                    { value: 'failure', label: t('Failures only') },
                    { value: 'all', label: t('All relay requests') },
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
                      <SelectItem value='off'>{t('Disabled')}</SelectItem>
                      <SelectItem value='failure'>
                        {t('Failures only')}
                      </SelectItem>
                      <SelectItem value='all'>
                        {t('All relay requests')}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t(
                    'Record the request, each upstream attempt, and the final response as a single server log event.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='RelayTraceLogFullBodyEnabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between gap-4 rounded-lg border px-3 py-2.5'>
                <div className='min-w-0 space-y-0.5'>
                  <FormLabel>
                    {t('Record complete request and response bodies')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Stores the unredacted downstream and upstream request and response bodies. This setting only applies while relay tracing is enabled.'
                    )}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={selectedMode === 'off'}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {selectedFullBodyEnabled && (
            <Alert variant='destructive'>
              <AlertDescription>
                {t(
                  'Privacy and storage warning: complete bodies are written to server logs and can contain prompts, generated media, personal data, and secrets supplied in request bodies. Enable this only for short troubleshooting windows; it can substantially increase log storage and memory use.'
                )}
              </AlertDescription>
            </Alert>
          )}
          <Alert>
            <AlertDescription>
              {t(
                'Standard relay tracing uses redacted previews and omits binary media. Search server logs for relay_trace= and the request ID when investigating a failure.'
              )}
            </AlertDescription>
          </Alert>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
