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
import { useState } from 'react'
import * as z from 'zod'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const oauthSchema = z.object({
  GitHubOAuthEnabled: z.boolean(),
  GitHubClientId: z.string().optional(),
  GitHubClientSecret: z.string().optional(),
  'discord.enabled': z.boolean(),
  'discord.client_id': z.string().optional(),
  'discord.client_secret': z.string().optional(),
  'oidc.enabled': z.boolean(),
  'oidc.client_id': z.string().optional(),
  'oidc.client_secret': z.string().optional(),
  'oidc.well_known': z.string().optional(),
  'oidc.authorization_endpoint': z.string().optional(),
  'oidc.token_endpoint': z.string().optional(),
  'oidc.user_info_endpoint': z.string().optional(),
  TelegramOAuthEnabled: z.boolean(),
  TelegramBotToken: z.string().optional(),
  TelegramBotName: z.string().optional(),
  LinuxDOOAuthEnabled: z.boolean(),
  LinuxDOClientId: z.string().optional(),
  LinuxDOClientSecret: z.string().optional(),
  LinuxDOMinimumTrustLevel: z.string().optional(),
  WeChatAuthEnabled: z.boolean(),
  WeChatServerAddress: z.string().optional(),
  WeChatServerToken: z.string().optional(),
  WeChatAccountQRCodeImageURL: z.string().optional(),
})

type OAuthFormValues = z.infer<typeof oauthSchema>

type OAuthSectionProps = {
  defaultValues: OAuthFormValues
}

export function OAuthSection({ defaultValues }: OAuthSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [activeTab, setActiveTab] = useState('github')

  // Normalize empty strings for optional fields (only at mount)
  const normalizedDefaults: OAuthFormValues = {
    ...defaultValues,
    GitHubClientId: defaultValues.GitHubClientId ?? '',
    GitHubClientSecret: defaultValues.GitHubClientSecret ?? '',
    'discord.client_id': defaultValues['discord.client_id'] ?? '',
    'discord.client_secret': defaultValues['discord.client_secret'] ?? '',
    'oidc.client_id': defaultValues['oidc.client_id'] ?? '',
    'oidc.client_secret': defaultValues['oidc.client_secret'] ?? '',
    'oidc.well_known': defaultValues['oidc.well_known'] ?? '',
    'oidc.authorization_endpoint':
      defaultValues['oidc.authorization_endpoint'] ?? '',
    'oidc.token_endpoint': defaultValues['oidc.token_endpoint'] ?? '',
    'oidc.user_info_endpoint': defaultValues['oidc.user_info_endpoint'] ?? '',
    TelegramBotToken: defaultValues.TelegramBotToken ?? '',
    TelegramBotName: defaultValues.TelegramBotName ?? '',
    LinuxDOClientId: defaultValues.LinuxDOClientId ?? '',
    LinuxDOClientSecret: defaultValues.LinuxDOClientSecret ?? '',
    LinuxDOMinimumTrustLevel: defaultValues.LinuxDOMinimumTrustLevel ?? '',
    WeChatServerAddress: defaultValues.WeChatServerAddress ?? '',
    WeChatServerToken: defaultValues.WeChatServerToken ?? '',
    WeChatAccountQRCodeImageURL:
      defaultValues.WeChatAccountQRCodeImageURL ?? '',
  }

  const form = useForm<OAuthFormValues>({
    resolver: zodResolver(oauthSchema),
    defaultValues: normalizedDefaults,
  })

  const onSubmit = async () => {
    // Get raw form values directly
    // React Hook Form treats "oidc.xxx" as nested paths, so we need to flatten
    const rawData = form.getValues() as Record<string, unknown>

    // Flatten nested oidc object back to dot notation keys
    const flattenedData: Record<string, unknown> = {}

    Object.entries(rawData).forEach(([key, value]) => {
      if (
        (key === 'oidc' || key === 'discord') &&
        typeof value === 'object' &&
        value !== null
      ) {
        // React Hook Form auto-nested these fields, flatten them back
        Object.entries(value as Record<string, unknown>).forEach(
          ([nestedKey, nestedValue]) => {
            flattenedData[`${key}.${nestedKey}`] = nestedValue
          }
        )
      } else {
        flattenedData[key] = value
      }
    })

    const finalData = flattenedData as OAuthFormValues

    if (finalData['oidc.well_known'] && finalData['oidc.well_known'] !== '') {
      if (
        !finalData['oidc.well_known'].startsWith('http://') &&
        !finalData['oidc.well_known'].startsWith('https://')
      ) {
        toast.error(t('Well-Known URL must start with http:// or https://'))
        return
      }

      try {
        const res = await axios.create().get(finalData['oidc.well_known'])
        const authEndpoint = res.data['authorization_endpoint'] || ''
        const tokenEndpoint = res.data['token_endpoint'] || ''
        const userInfoEndpoint = res.data['userinfo_endpoint'] || ''

        finalData['oidc.authorization_endpoint'] = authEndpoint
        finalData['oidc.token_endpoint'] = tokenEndpoint
        finalData['oidc.user_info_endpoint'] = userInfoEndpoint

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setValue('oidc.authorization_endpoint' as any, authEndpoint)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setValue('oidc.token_endpoint' as any, tokenEndpoint)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setValue('oidc.user_info_endpoint' as any, userInfoEndpoint)

        toast.success(t('OIDC configuration fetched successfully'))
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err)
        toast.error(
          t(
            'Failed to fetch OIDC configuration. Please check the URL and network status'
          )
        )
        return
      }
    }

    // Find changed fields by comparing to initial values
    const updates = Object.entries(finalData).filter(
      ([key, value]) =>
        value !== normalizedDefaults[key as keyof OAuthFormValues]
    )

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    // Save all changed fields
    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value: value ?? '' })
    }

    // Reset form dirty state after successful save
    form.reset(finalData)
  }

  const handleReset = () => {
    // React Hook Form auto-nests 'oidc.xxx' fields into { oidc: { xxx: value } }
    // So we need to pass the same structure when resetting
    const currentValues = form.getValues() as Record<string, unknown>

    // Create reset values matching RHF's internal structure
    const resetValues = { ...currentValues }

    // Update nested oidc fields
    if (resetValues.oidc && typeof resetValues.oidc === 'object') {
      Object.keys(resetValues.oidc as Record<string, unknown>).forEach(
        (key) => {
          const flatKey = `oidc.${key}` as keyof typeof normalizedDefaults
          if (flatKey in normalizedDefaults) {
            ;(resetValues.oidc as Record<string, unknown>)[key] =
              normalizedDefaults[flatKey]
          }
        }
      )
    }

    // Update nested discord fields
    if (resetValues.discord && typeof resetValues.discord === 'object') {
      Object.keys(resetValues.discord as Record<string, unknown>).forEach(
        (key) => {
          const flatKey = `discord.${key}` as keyof typeof normalizedDefaults
          if (flatKey in normalizedDefaults) {
            ;(resetValues.discord as Record<string, unknown>)[key] =
              normalizedDefaults[flatKey]
          }
        }
      )
    }

    // Update top-level fields
    Object.keys(resetValues).forEach((key) => {
      if (key !== 'oidc' && key in normalizedDefaults) {
        resetValues[key] =
          normalizedDefaults[key as keyof typeof normalizedDefaults]
      }
    })

    form.reset(resetValues, {
      keepDirty: false,
      keepDirtyValues: false,
      keepErrors: false,
    })
    toast.success(t('Form reset to saved values'))
  }

  return (
    <>
      <FormNavigationGuard when={form.formState.isDirty} />

      <SettingsSection
        title={t('OAuth Integrations')}
        description={t('Configure third-party authentication providers')}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormDirtyIndicator isDirty={form.formState.isDirty} />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className='grid w-full grid-cols-6'>
                <TabsTrigger value='github'>{t('GitHub')}</TabsTrigger>
                <TabsTrigger value='discord'>{t('Discord')}</TabsTrigger>
                <TabsTrigger value='oidc'>{t('OIDC')}</TabsTrigger>
                <TabsTrigger value='telegram'>{t('Telegram')}</TabsTrigger>
                <TabsTrigger value='linuxdo'>{t('LinuxDO')}</TabsTrigger>
                <TabsTrigger value='wechat'>{t('WeChat')}</TabsTrigger>
              </TabsList>

              <TabsContent value='github' className='space-y-4'>
                <FormField
                  control={form.control}
                  name='GitHubOAuthEnabled'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          {t('Enable GitHub OAuth')}
                        </FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with GitHub')}
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
                  name='GitHubClientId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Your GitHub OAuth Client ID')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='GitHubClientSecret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('Your GitHub OAuth Client Secret')}
                          autoComplete='new-password'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='discord' className='space-y-4'>
                <FormField
                  control={form.control}
                  name='discord.enabled'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          {t('Enable Discord OAuth')}
                        </FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with Discord')}
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  name={'discord.client_id' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Your Discord OAuth Client ID')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='discord.client_secret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('Your Discord OAuth Client Secret')}
                          autoComplete='new-password'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='oidc' className='space-y-4'>
                <FormField
                  control={form.control}
                  name='oidc.enabled'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          {t('Enable OIDC')}
                        </FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with OpenID Connect')}
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  name={'oidc.client_id' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('OIDC Client ID')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.client_secret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('OIDC Client Secret')}
                          autoComplete='new-password'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.well_known'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Well-Known URL')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'https://provider.com/.well-known/openid-configuration'
                          )}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Auto-discovers endpoints from the provider')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.authorization_endpoint'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Authorization Endpoint (Optional)')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Override auto-discovered endpoint')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.token_endpoint'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Token Endpoint (Optional)')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Override auto-discovered endpoint')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.user_info_endpoint'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('User Info Endpoint (Optional)')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Override auto-discovered endpoint')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='telegram' className='space-y-4'>
                <FormField
                  control={form.control}
                  name='TelegramOAuthEnabled'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          {t('Enable Telegram OAuth')}
                        </FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with Telegram')}
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
                  name='TelegramBotToken'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Bot Token')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('Your Telegram Bot Token')}
                          autoComplete='new-password'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='TelegramBotName'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Bot Name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Your Bot Name')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='linuxdo' className='space-y-4'>
                <FormField
                  control={form.control}
                  name='LinuxDOOAuthEnabled'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          {t('Enable LinuxDO OAuth')}
                        </FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with LinuxDO')}
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
                  name='LinuxDOClientId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('LinuxDO Client ID')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='LinuxDOClientSecret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('LinuxDO Client Secret')}
                          autoComplete='new-password'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='LinuxDOMinimumTrustLevel'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Minimum Trust Level')}</FormLabel>
                      <FormControl>
                        <Input placeholder='0' autoComplete='off' {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('Minimum LinuxDO trust level required')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='wechat' className='space-y-4'>
                <FormField
                  control={form.control}
                  name='WeChatAuthEnabled'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          {t('Enable WeChat Auth')}
                        </FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with WeChat')}
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
                  name='WeChatServerAddress'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Server Address')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('https://wechat-server.example.com')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='WeChatServerToken'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Server Token')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('Server Token')}
                          autoComplete='new-password'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='WeChatAccountQRCodeImageURL'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('QR Code Image URL')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('https://example.com/qr-code.png')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className='flex gap-2'>
              <Button type='submit' disabled={updateOption.isPending}>
                {updateOption.isPending ? t('Saving...') : t('Save Changes')}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={handleReset}
                disabled={!form.formState.isDirty || updateOption.isPending}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                {t('Reset')}
              </Button>
            </div>
          </form>
        </Form>
      </SettingsSection>
    </>
  )
}
