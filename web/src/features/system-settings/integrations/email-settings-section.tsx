import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
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
import { SettingsAccordion } from '../components/settings-accordion'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const emailSchema = z.object({
  SMTPServer: z.string(),
  SMTPPort: z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    return /^\d+$/.test(trimmed)
  }, 'Port must be a positive integer'),
  SMTPAccount: z.string(),
  SMTPFrom: z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  }, 'Enter a valid email or leave blank'),
  SMTPToken: z.string(),
  SMTPSSLEnabled: z.boolean(),
})

type EmailFormValues = z.infer<typeof emailSchema>

type EmailSettingsSectionProps = {
  defaultValues: EmailFormValues
}

export function EmailSettingsSection({
  defaultValues,
}: EmailSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (values: EmailFormValues) => {
    const sanitized = {
      SMTPServer: values.SMTPServer.trim(),
      SMTPPort: values.SMTPPort.trim(),
      SMTPAccount: values.SMTPAccount.trim(),
      SMTPFrom: values.SMTPFrom.trim(),
      SMTPToken: values.SMTPToken.trim(),
      SMTPSSLEnabled: values.SMTPSSLEnabled,
    }

    const initial = {
      SMTPServer: defaultValues.SMTPServer.trim(),
      SMTPPort: defaultValues.SMTPPort.trim(),
      SMTPAccount: defaultValues.SMTPAccount.trim(),
      SMTPFrom: defaultValues.SMTPFrom.trim(),
      SMTPToken: defaultValues.SMTPToken.trim(),
      SMTPSSLEnabled: defaultValues.SMTPSSLEnabled,
    }

    const updates: Array<{ key: string; value: string | boolean }> = []

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

    if (sanitized.SMTPToken && sanitized.SMTPToken !== initial.SMTPToken) {
      updates.push({ key: 'SMTPToken', value: sanitized.SMTPToken })
    }

    if (sanitized.SMTPSSLEnabled !== initial.SMTPSSLEnabled) {
      updates.push({
        key: 'SMTPSSLEnabled',
        value: sanitized.SMTPSSLEnabled,
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsAccordion
      value='email-settings'
      title={t('SMTP Email')}
      description={t('Configure outgoing email server for notifications')}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
          autoComplete='off'
        >
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
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      {t('Enable SSL/TLS')}
                    </FormLabel>
                    <FormDescription>
                      {t('Use secure connection when sending emails')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
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

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? 'Saving...' : 'Save SMTP settings'}
          </Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
