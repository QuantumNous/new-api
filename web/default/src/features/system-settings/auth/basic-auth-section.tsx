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
import { useMemo, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
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
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/copy-button'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const basicAuthSchema = z.object({
  PasswordLoginEnabled: z.boolean(),
  PasswordRegisterEnabled: z.boolean(),
  InviteOnlyRegisterEnabled: z.boolean(),
  InviteCodeDailyLimit: z.number().min(0),
  EmailVerificationEnabled: z.boolean(),
  RegisterEnabled: z.boolean(),
  EmailDomainRestrictionEnabled: z.boolean(),
  EmailAliasRestrictionEnabled: z.boolean(),
  EmailDomainWhitelist: z.string(),
})

type BasicAuthFormValues = z.infer<typeof basicAuthSchema>

type BasicAuthSectionProps = {
  defaultValues: BasicAuthFormValues
}

function AdminInviteCodeCreator() {
  const { t } = useTranslation()
  const [name, setName] = useState('invite')
  const [count, setCount] = useState(10)
  const [isCreating, setIsCreating] = useState(false)
  const [createdCodes, setCreatedCodes] = useState<string[]>([])
  const createdText = createdCodes.join('\n')

  const handleCreate = async () => {
    const normalizedCount = Math.max(1, Math.min(100, Number(count) || 1))
    setIsCreating(true)
    try {
      const res = await api.post('/api/user/admin/invite_codes', {
        name: name.trim() || 'invite',
        count: normalizedCount,
        max_uses: 1,
      })
      if (res.data?.success) {
        setCreatedCodes(res.data.data ?? [])
        toast.success(t('Invitation codes created successfully'))
      } else {
        toast.error(res.data?.message || t('Failed to create invitation codes'))
      }
    } catch (_error) {
      toast.error(t('Failed to create invitation codes'))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className='border-border mt-6 grid gap-4 border-t pt-6'>
      <div>
        <h3 className='text-sm font-medium'>{t('Invitation Code Batch')}</h3>
        <p className='text-muted-foreground mt-1 text-sm'>
          {t(
            'Administrators can create invitation codes without the daily limit.'
          )}
        </p>
      </div>
      <div className='grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end'>
        <div className='grid gap-2'>
          <label className='text-sm font-medium'>{t('Batch Name')}</label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className='grid gap-2'>
          <label className='text-sm font-medium'>{t('Quantity')}</label>
          <Input
            type='number'
            min={1}
            max={100}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </div>
        <Button type='button' onClick={handleCreate} disabled={isCreating}>
          {t('Create Codes')}
        </Button>
      </div>
      {createdCodes.length > 0 ? (
        <div className='grid gap-2'>
          <div className='flex items-center justify-between gap-2'>
            <label className='text-sm font-medium'>{t('Created Codes')}</label>
            <CopyButton
              value={createdText}
              variant='outline'
              size='sm'
              tooltip={t('Copy invitation codes')}
              aria-label={t('Copy invitation codes')}
            />
          </div>
          <Textarea
            readOnly
            rows={5}
            value={createdText}
            className='font-mono'
          />
        </div>
      ) : null}
    </div>
  )
}

export function BasicAuthSection({ defaultValues }: BasicAuthSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults = useMemo<BasicAuthFormValues>(
    () => ({
      ...defaultValues,
      EmailDomainWhitelist: defaultValues.EmailDomainWhitelist.split(',')
        .map((domain) => domain.trim())
        .filter(Boolean)
        .join('\n'),
    }),
    [defaultValues]
  )

  const form = useForm<BasicAuthFormValues>({
    resolver: zodResolver(basicAuthSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const onSubmit = async (data: BasicAuthFormValues) => {
    const updates: Array<{ key: string; value: string | boolean | number }> =
      []

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'EmailDomainWhitelist') {
        if (typeof value !== 'string') return
        const domains = value
          .split('\n')
          .map((domain) => domain.trim())
          .filter(Boolean)
          .join(',')
        if (domains !== defaultValues.EmailDomainWhitelist) {
          updates.push({ key, value: domains })
        }
      } else if (value !== defaultValues[key as keyof typeof defaultValues]) {
        updates.push({ key, value })
      }
    })

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection title={t('Basic Authentication')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='PasswordLoginEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Password Login')}</FormLabel>
                  <FormDescription>
                    {t('Allow users to log in with password')}
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
            name='RegisterEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Registration Enabled')}</FormLabel>
                  <FormDescription>
                    {t('Allow new users to register')}
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
            name='PasswordRegisterEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Password Registration')}</FormLabel>
                  <FormDescription>
                    {t('Allow registration with password')}
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
            name='InviteOnlyRegisterEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Invite-only Registration')}</FormLabel>
                  <FormDescription>
                    {t('Require a valid invitation code for new accounts')}
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
            name='InviteCodeDailyLimit'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Daily Invitation Code Limit')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(Number(event.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Maximum invitation codes a regular user can create per day. Administrators are unlimited.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='EmailVerificationEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Email Verification')}</FormLabel>
                  <FormDescription>
                    {t('Require email verification for new accounts')}
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
            name='EmailDomainRestrictionEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Email Domain Restriction')}</FormLabel>
                  <FormDescription>
                    {t('Only allow specific email domains')}
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
            name='EmailAliasRestrictionEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Email Alias Restriction')}</FormLabel>
                  <FormDescription>
                    {t('Block email aliases (e.g., user+alias@domain.com)')}
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
            name='EmailDomainWhitelist'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Email Domain Whitelist')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('example.com&#10;company.com')}
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'One domain per line (only used when domain restriction is enabled)'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
      <AdminInviteCodeCreator />
    </SettingsSection>
  )
}
