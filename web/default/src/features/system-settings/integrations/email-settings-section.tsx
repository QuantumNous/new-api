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
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
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
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

type SMTPFromAliasesResult = {
  aliases: string[]
  persisted: string
}

type EmailOptionUpdate = {
  key: string
  value: string | boolean
}

const PLAIN_MAILBOX_PATTERN = /^[^\s@<>,"]+@[^\s@<>,"]+\.[^\s@<>,"]+$/

export function parseSMTPFromAliases(
  input: string,
  smtpFrom: string
): SMTPFromAliasesResult {
  const aliases: string[] = []
  const seen = new Set<string>()
  const normalizedSMTPFrom = smtpFrom.trim().toLowerCase()

  for (const rawLine of input.split(/\r\n|\n|\r/)) {
    const alias = rawLine.trim()
    if (!alias) continue

    if (!PLAIN_MAILBOX_PATTERN.test(alias)) {
      throw new Error('Each alias must be a plain email address.')
    }

    const normalizedAlias = alias.toLowerCase()
    if (normalizedAlias === normalizedSMTPFrom) {
      throw new Error('Sender aliases must not duplicate the From address.')
    }

    if (seen.has(normalizedAlias)) {
      throw new Error('Sender aliases must be unique.')
    }

    seen.add(normalizedAlias)
    aliases.push(alias)
  }

  return {
    aliases,
    persisted: aliases.join(','),
  }
}

const createEmailSchema = (t: (key: string) => string) =>
  z
    .object({
      SMTPServer: z.string(),
      SMTPPort: z.string().refine((value) => {
        const trimmed = value.trim()
        if (!trimmed) return true
        return /^\d+$/.test(trimmed)
      }, t('Port must be a positive integer')),
      SMTPAccount: z.string(),
      SMTPFrom: z.string().refine((value) => {
        const trimmed = value.trim()
        if (!trimmed) return true
        return PLAIN_MAILBOX_PATTERN.test(trimmed)
      }, t('Enter a valid email or leave blank')),
      SMTPFromAliases: z.string(),
      SMTPToken: z.string(),
      SMTPSSLEnabled: z.boolean(),
      SMTPForceAuthLogin: z.boolean(),
    })
    .superRefine((values, context) => {
      try {
        parseSMTPFromAliases(values.SMTPFromAliases, values.SMTPFrom)
      } catch (error) {
        context.addIssue({
          code: 'custom',
          path: ['SMTPFromAliases'],
          message: t(error instanceof Error ? error.message : String(error)),
        })
      }
    })

export type EmailFormValues = z.infer<ReturnType<typeof createEmailSchema>>

type EmailSettingsSectionProps = {
  defaultValues: EmailFormValues
}

export function buildEmailOptionUpdates(
  defaultValues: EmailFormValues,
  values: EmailFormValues
): EmailOptionUpdate[] {
  const sanitized = {
    SMTPServer: values.SMTPServer.trim(),
    SMTPPort: values.SMTPPort.trim(),
    SMTPAccount: values.SMTPAccount.trim(),
    SMTPFrom: values.SMTPFrom.trim(),
    SMTPFromAliases: parseSMTPFromAliases(
      values.SMTPFromAliases,
      values.SMTPFrom
    ).persisted,
    SMTPToken: values.SMTPToken.trim(),
    SMTPSSLEnabled: values.SMTPSSLEnabled,
    SMTPForceAuthLogin: values.SMTPForceAuthLogin,
  }

  const initial = {
    SMTPServer: defaultValues.SMTPServer.trim(),
    SMTPPort: defaultValues.SMTPPort.trim(),
    SMTPAccount: defaultValues.SMTPAccount.trim(),
    SMTPFrom: defaultValues.SMTPFrom.trim(),
    SMTPFromAliases: parseSMTPFromAliases(
      defaultValues.SMTPFromAliases,
      defaultValues.SMTPFrom
    ).persisted,
    SMTPToken: defaultValues.SMTPToken.trim(),
    SMTPSSLEnabled: defaultValues.SMTPSSLEnabled,
    SMTPForceAuthLogin: defaultValues.SMTPForceAuthLogin,
  }

  const updates: EmailOptionUpdate[] = []

  if (sanitized.SMTPServer !== initial.SMTPServer) {
    updates.push({ key: 'SMTPServer', value: sanitized.SMTPServer })
  }

  if (sanitized.SMTPPort !== initial.SMTPPort) {
    updates.push({ key: 'SMTPPort', value: sanitized.SMTPPort })
  }

  if (sanitized.SMTPAccount !== initial.SMTPAccount) {
    updates.push({ key: 'SMTPAccount', value: sanitized.SMTPAccount })
  }

  if (sanitized.SMTPFrom !== initial.SMTPFrom) {
    updates.push({ key: 'SMTPFrom', value: sanitized.SMTPFrom })
  }

  if (sanitized.SMTPFromAliases !== initial.SMTPFromAliases) {
    updates.push({
      key: 'SMTPFromAliases',
      value: sanitized.SMTPFromAliases,
    })
  }

  if (sanitized.SMTPToken && sanitized.SMTPToken !== initial.SMTPToken) {
    updates.push({ key: 'SMTPToken', value: sanitized.SMTPToken })
  }

  if (sanitized.SMTPSSLEnabled !== initial.SMTPSSLEnabled) {
    updates.push({
      key: 'SMTPSSLEnabled',
      value: sanitized.SMTPSSLEnabled,
    })
  }

  if (sanitized.SMTPForceAuthLogin !== initial.SMTPForceAuthLogin) {
    updates.push({
      key: 'SMTPForceAuthLogin',
      value: sanitized.SMTPForceAuthLogin,
    })
  }

  return updates
}

export function EmailSettingsSection({
  defaultValues,
}: EmailSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const emailSchema = createEmailSchema(t)

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (values: EmailFormValues) => {
    const updates = buildEmailOptionUpdates(defaultValues, values)

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection title={t('SMTP Email')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save SMTP settings'
          />
          <FormField
            control={form.control}
            name='SMTPServer'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('SMTP Host')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder={t('smtp.example.com')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Hostname or IP of your SMTP provider')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='SMTPPort'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Port')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      type='number'
                      placeholder='587'
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Common ports include 25, 465, and 587')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='SMTPSSLEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Enable SSL/TLS')}</FormLabel>
                    <FormDescription>
                      {t('Use secure connection when sending emails')}
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
              name='SMTPForceAuthLogin'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Force AUTH LOGIN')}</FormLabel>
                    <FormDescription>
                      {t('Force SMTP authentication using AUTH LOGIN method')}
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
            name='SMTPAccount'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Username')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder={t('noreply@example.com')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Account used when authenticating with the SMTP server')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SMTPFrom'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('From Address')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder={t('New API &lt;noreply@example.com&gt;')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Display name and email used in outgoing messages')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SMTPFromAliases'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Allowed From aliases')}</FormLabel>
                <FormControl>
                  <Textarea
                    autoComplete='off'
                    placeholder={t(
                      'Enter one authorized email address per line.'
                    )}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Aliases must already be authorized by your SMTP provider.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SMTPToken'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Password / Access Token')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    type='password'
                    placeholder={t('Enter new token to update')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Leave blank to keep the existing credential')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
