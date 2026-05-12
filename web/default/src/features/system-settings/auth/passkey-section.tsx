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
import { useMemo } from 'react'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const passkeySchema = z.object({
  'passkey.enabled': z.boolean(),
  'passkey.rp_display_name': z.string(),
  'passkey.rp_id': z.string(),
  'passkey.origins': z.string(),
  'passkey.allow_insecure_origin': z.boolean(),
  'passkey.user_verification': z.enum(['required', 'preferred', 'discouraged']),
  'passkey.attachment_preference': z.enum([
    'none',
    'platform',
    'cross-platform',
  ]),
})

type PasskeyFormValues = z.infer<typeof passkeySchema>

interface PasskeySectionProps {
  defaultValues: PasskeyFormValues
}

export function PasskeySection({ defaultValues }: PasskeySectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults = useMemo<PasskeyFormValues>(
    () => ({
      ...defaultValues,
      'passkey.origins': (defaultValues['passkey.origins'] as string)
        .split(',')
        .map((origin: string) => origin.trim())
        .filter(Boolean)
        .join('\n'),
      'passkey.attachment_preference':
        (defaultValues['passkey.attachment_preference'] as string) === ''
          ? 'none'
          : (defaultValues['passkey.attachment_preference'] as
              | 'platform'
              | 'cross-platform'),
    }),
    [defaultValues]
  )

  const form = useForm<PasskeyFormValues>({
    resolver: zodResolver(passkeySchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const onSubmit = async () => {
    const rawData = form.getValues() as Record<string, unknown>
    const flattenedEntries: Array<
      [keyof PasskeyFormValues, PasskeyFormValues[keyof PasskeyFormValues]]
    > = []

    Object.entries(rawData).forEach(([key, value]) => {
      if (key === 'passkey' && value && typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(
          ([nestedKey, nestedValue]) => {
            flattenedEntries.push([
              `passkey.${nestedKey}` as keyof PasskeyFormValues,
              nestedValue as PasskeyFormValues[keyof PasskeyFormValues],
            ])
          }
        )
      } else {
        flattenedEntries.push([
          key as keyof PasskeyFormValues,
          value as PasskeyFormValues[keyof PasskeyFormValues],
        ])
      }
    })

    const data = Object.fromEntries(flattenedEntries) as PasskeyFormValues
    const updates: Array<{ key: string; value: string | boolean }> = []

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'passkey.origins') {
        const processed = (value as string)
          .split('\n')
          .map((origin: string) => origin.trim())
          .filter(Boolean)
          .join(',')
        const currentDefault = defaultValues['passkey.origins'] as string
        if (processed !== currentDefault) {
          updates.push({ key, value: processed })
        }
      } else if (key === 'passkey.attachment_preference') {
        const attachmentPreference =
          value as PasskeyFormValues['passkey.attachment_preference']
        const incoming =
          attachmentPreference === 'none' ? '' : attachmentPreference
        const currentDefault =
          defaultValues['passkey.attachment_preference'] === 'none'
            ? ''
            : defaultValues['passkey.attachment_preference']
        if (incoming !== currentDefault) {
          updates.push({ key, value: incoming })
        }
      } else if (value !== defaultValues[key as keyof PasskeyFormValues]) {
        updates.push({ key, value })
      }
    })

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection
      title={t('Passkey Authentication')}
      description={t('Configure Passkey (WebAuthn) login settings')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='passkey.enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    {t('Enable Passkey')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Allow users to register and sign in with Passkey (WebAuthn)'
                    )}
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

          <FormField
            control={form.control}
            name='passkey.rp_display_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Relying Party Display Name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('e.g. New API Console')}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Human-readable name shown to users during Passkey prompts.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.rp_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Relying Party ID')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('e.g. example.com')}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'The effective domain for Passkey registration. Must match the current domain or be its parent domain.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.user_verification'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('User Verification')}</FormLabel>
                <FormControl>
                  <Select
                    items={[
                      { value: 'required', label: t('Required') },
                      { value: 'preferred', label: t('Recommended') },
                      { value: 'discouraged', label: t('Discouraged') },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('Select requirement')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='required'>
                          {t('Required')}
                        </SelectItem>
                        <SelectItem value='preferred'>
                          {t('Recommended')}
                        </SelectItem>
                        <SelectItem value='discouraged'>
                          {t('Discouraged')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  {t(
                    'Controls whether user verification (biometrics/PIN) is required during Passkey flows.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.attachment_preference'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Device Type Preference')}</FormLabel>
                <FormControl>
                  <Select
                    items={[
                      { value: 'none', label: t('Unlimited') },
                      { value: 'platform', label: t('Built-in Device') },
                      { value: 'cross-platform', label: t('External Device') },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('No preference')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='none'>{t('Unlimited')}</SelectItem>
                        <SelectItem value='platform'>
                          {t('Built-in Device')}
                        </SelectItem>
                        <SelectItem value='cross-platform'>
                          {t('External Device')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  {t(
                    'Built-in: phone fingerprint/face, or Windows Hello; External: USB security key'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.allow_insecure_origin'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    {t('Allow Insecure Origins')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Permit Passkey registration on non-HTTPS origins (only recommended for development)'
                    )}
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

          <FormField
            control={form.control}
            name='passkey.origins'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Allowed Origins')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder={t('https://example.com')}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'List of origins (one per line) allowed for Passkey registration and authentication.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit'>{t('Save Changes')}</Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
