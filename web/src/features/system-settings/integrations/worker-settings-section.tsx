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
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

import { testWorkerProxy } from '../api'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { removeTrailingSlash } from './utils'

const createWorkerSchema = (t: (key: string) => string) =>
  z.object({
    WorkerUrl: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^https?:\/\//.test(trimmed)
    }, t('Provide a valid URL starting with http:// or https://')),
    WorkerValidKey: z.string(),
    UserOutboundRequestsEnabled: z.boolean(),
    WorkerAllowHttpImageRequestEnabled: z.boolean(),
  })

type WorkerFormValues = z.infer<ReturnType<typeof createWorkerSchema>>

type WorkerSettingsSectionProps = {
  defaultValues: WorkerFormValues
}

export function WorkerSettingsSection({
  defaultValues,
}: WorkerSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const workerSchema = createWorkerSchema(t)
  const [pendingValues, setPendingValues] = useState<WorkerFormValues | null>(
    null
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const form = useForm<WorkerFormValues>({
    resolver: zodResolver(workerSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const currentWorkerURL = useWatch({
    control: form.control,
    name: 'WorkerUrl',
  })

  const saveValues = async (values: WorkerFormValues) => {
    const sanitizedUrl = removeTrailingSlash(values.WorkerUrl)
    const sanitizedKey = values.WorkerValidKey.trim()
    const initialUrl = removeTrailingSlash(defaultValues.WorkerUrl)
    const initialKey = defaultValues.WorkerValidKey.trim()

    const updates: Array<{ key: string; value: string | boolean }> = []
    const outboundSettingChanged =
      values.UserOutboundRequestsEnabled !==
      defaultValues.UserOutboundRequestsEnabled

    if (outboundSettingChanged && !values.UserOutboundRequestsEnabled) {
      updates.push({
        key: 'UserOutboundRequestsEnabled',
        value: false,
      })
    }

    if (sanitizedUrl !== initialUrl) {
      updates.push({ key: 'WorkerUrl', value: sanitizedUrl })
    }

    if (sanitizedKey !== initialKey || sanitizedUrl === '') {
      updates.push({ key: 'WorkerValidKey', value: sanitizedKey })
    }

    if (
      values.WorkerAllowHttpImageRequestEnabled !==
      defaultValues.WorkerAllowHttpImageRequestEnabled
    ) {
      updates.push({
        key: 'WorkerAllowHttpImageRequestEnabled',
        value: values.WorkerAllowHttpImageRequestEnabled,
      })
    }

    if (outboundSettingChanged && values.UserOutboundRequestsEnabled) {
      updates.push({
        key: 'UserOutboundRequestsEnabled',
        value: true,
      })
    }

    setIsSaving(true)
    try {
      for (const update of updates) {
        const result = await updateOption.mutateAsync(update)
        if (!result.success) return false
      }
      return true
    } finally {
      setIsSaving(false)
    }
  }

  const onSubmit = async (values: WorkerFormValues) => {
    const sanitizedUrl = removeTrailingSlash(values.WorkerUrl)
    const initialUrl = removeTrailingSlash(defaultValues.WorkerUrl)
    const enablingWithoutWorker =
      sanitizedUrl === '' &&
      values.UserOutboundRequestsEnabled &&
      (!defaultValues.UserOutboundRequestsEnabled || initialUrl !== '')

    if (enablingWithoutWorker) {
      setPendingValues(values)
      return
    }

    await saveValues(values)
  }

  const handleConfirmDirectOutbound = async () => {
    if (!pendingValues) return
    const saved = await saveValues(pendingValues)
    if (saved) setPendingValues(null)
  }

  const handleTestWorker = async () => {
    const workerURL = removeTrailingSlash(form.getValues('WorkerUrl'))
    if (!workerURL) {
      toast.error(t('Enter a Worker URL before testing'))
      return
    }
    const valid = await form.trigger('WorkerUrl')
    if (!valid) return

    setIsTesting(true)
    try {
      const response = await testWorkerProxy({
        worker_url: workerURL,
        worker_valid_key: form.getValues('WorkerValidKey').trim(),
      })
      if (response.success && response.data?.ip) {
        toast.success(
          t('Worker test succeeded. Exit IP: {{ip}}', {
            ip: response.data.ip,
          })
        )
        return
      }
      toast.error(response.message || t('Worker test failed'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Worker test failed')
      )
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <SettingsSection title={t('Worker Proxy')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={isSaving || updateOption.isPending}
            saveLabel='Save Worker settings'
          />
          <Alert>
            <AlertTitle>{t('User-controlled outbound requests')}</AlertTitle>
            <AlertDescription>
              {t(
                'Webhook, Bark, Gotify, and remote media destinations can be controlled by regular users. When a Worker URL is configured, these requests are forwarded through the Worker.'
              )}
            </AlertDescription>
          </Alert>

          {!currentWorkerURL.trim() && (
            <Alert variant='destructive'>
              <AlertTitle>
                {t('Configure a Worker before enabling outbound requests')}
              </AlertTitle>
              <AlertDescription>
                {t(
                  'Without a Worker, the source server connects directly to user-controlled destinations and may expose its public IP address.'
                )}
              </AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name='UserOutboundRequestsEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>
                    {t('Allow user-controlled outbound requests')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Disabled by default. When off, all HTTP and HTTPS requests to destinations controlled by regular users are blocked.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    aria-label={t('Allow user-controlled outbound requests')}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='WorkerUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Worker URL')}</FormLabel>
                <InputGroup>
                  <FormControl>
                    <InputGroupInput
                      type='url'
                      inputMode='url'
                      placeholder={t('https://worker.example.workers.dev')}
                      autoComplete='off'
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <InputGroupAddon align='inline-end'>
                    <InputGroupButton
                      onClick={handleTestWorker}
                      disabled={isTesting || isSaving}
                    >
                      {isTesting && <Spinner data-icon='inline-start' />}
                      {isTesting ? t('Testing...') : t('Test Worker')}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FormDescription>
                  {t(
                    'Requests will be forwarded to this worker. Trailing slashes are removed automatically.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='WorkerValidKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Worker Access Key')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={t('Enter new key to update')}
                    autoComplete='new-password'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Used to authenticate with the worker. Leave blank to keep the existing secret.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='WorkerAllowHttpImageRequestEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Allow unencrypted HTTP requests')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Only permits plain HTTP when user-controlled outbound requests are enabled. HTTPS is unaffected.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    aria-label={t('Allow unencrypted HTTP requests')}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
        </SettingsForm>
      </Form>
      <ConfirmDialog
        open={pendingValues !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) setPendingValues(null)
        }}
        title={t('Enable outbound requests without a Worker?')}
        desc={t(
          'The source server will connect directly to destinations controlled by regular users, which may expose the source IP. Configure a Worker whenever possible.'
        )}
        confirmText={t('Enable anyway')}
        destructive
        isLoading={isSaving}
        handleConfirm={() => void handleConfirmDirectOutbound()}
      />
    </SettingsSection>
  )
}
