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
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const botProtectionSchema = z.object({
  TurnstileCheckEnabled: z.boolean(),
  TurnstileSiteKey: z.string().optional(),
  TurnstileSecretKey: z.string().optional(),
})

type BotProtectionFormValues = z.infer<typeof botProtectionSchema>

type BotProtectionSectionProps = {
  defaultValues: BotProtectionFormValues
}

const SECRET_MASK = '********'

export function BotProtectionSection({
  defaultValues,
}: BotProtectionSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<BotProtectionFormValues>({
    resolver: zodResolver(botProtectionSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const onSubmit = async (data: BotProtectionFormValues) => {
    const siteKey = (data.TurnstileSiteKey || '').trim()
    const secretKey = (data.TurnstileSecretKey || '').trim()

    if (data.TurnstileCheckEnabled && !siteKey) {
      toast.error(
        t(
          'Unable to enable Turnstile. Please fill in the Turnstile site key first.'
        )
      )
      return
    }

    // Save keys before enabling — backend rejects enable when site key is empty
    const updates: Array<{ key: string; value: string }> = []

    if (siteKey !== (defaultValues.TurnstileSiteKey || '')) {
      updates.push({ key: 'TurnstileSiteKey', value: siteKey })
    }

    // Secret is masked when already configured; only send a real new secret
    if (
      secretKey &&
      secretKey !== SECRET_MASK &&
      secretKey !== (defaultValues.TurnstileSecretKey || '')
    ) {
      updates.push({ key: 'TurnstileSecretKey', value: secretKey })
    }

    if (data.TurnstileCheckEnabled !== defaultValues.TurnstileCheckEnabled) {
      updates.push({
        key: 'TurnstileCheckEnabled',
        value: String(data.TurnstileCheckEnabled),
      })
    }

    if (updates.length === 0) {
      toast.message(t('No changes to save'))
      return
    }

    try {
      for (const item of updates) {
        await updateOption.mutateAsync(item)
      }
      form.reset({
        ...data,
        TurnstileSiteKey: siteKey,
        TurnstileSecretKey:
          secretKey && secretKey !== SECRET_MASK ? SECRET_MASK : secretKey,
      })
    } catch {
      // toast handled by mutation
    }
  }

  return (
    <SettingsSection title={t('Bot Protection')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='TurnstileCheckEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Turnstile')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Protect login, registration and lottery draws with Cloudflare Turnstile'
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
            name='TurnstileSiteKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Site Key')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('Your Turnstile site key')}
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Public site key from Cloudflare Turnstile. Required for the widget to render.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='TurnstileSecretKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Secret Key')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={t('Your Turnstile secret key')}
                    autoComplete='new-password'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'If already saved, this field shows ********. Leave it unchanged unless you need to replace the secret.'
                  )}
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
