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
import { useEffect } from 'react'
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
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const botProtectionSchema = z.object({
  ESACaptchaEnabled: z.boolean(),
  ESAStrictModeEnabled: z.boolean(),
  ESARegion: z.string().optional(),
  ESAPrefix: z.string().optional(),
  ESACaptchaLoginSceneId: z.string().optional(),
  ESACaptchaRegisterSceneId: z.string().optional(),
  ESACaptchaResetPasswordSceneId: z.string().optional(),
  ESACaptchaChangePasswordSceneId: z.string().optional(),
  ESACaptchaDeleteAccountSceneId: z.string().optional(),
  ESACaptchaCheckinSceneId: z.string().optional(),
  ESACaptchaVerificationSceneId: z.string().optional(),
})

type BotProtectionFormValues = z.infer<typeof botProtectionSchema>

type BotProtectionSectionProps = {
  defaultValues: BotProtectionFormValues
}

const sceneFields = [
  ['ESACaptchaLoginSceneId', 'Login scene ID'],
  ['ESACaptchaVerificationSceneId', 'Email verification scene ID'],
  ['ESACaptchaResetPasswordSceneId', 'Password reset email scene ID'],
  ['ESACaptchaRegisterSceneId', 'Register scene ID'],
  ['ESACaptchaChangePasswordSceneId', 'Change password scene ID'],
  ['ESACaptchaDeleteAccountSceneId', 'Delete account scene ID'],
  ['ESACaptchaCheckinSceneId', 'Check-in scene ID'],
] as const

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
    const updates = Object.entries(data).filter(
      ([key, value]) =>
        value !== defaultValues[key as keyof BotProtectionFormValues]
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value: value ?? '' })
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
            name='ESACaptchaEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Aliyun ESA captcha')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Protect sign-in, email verification, password reset email, and check-in with Aliyun ESA captcha.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='ESAStrictModeEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('拦截空 Token 请求（严格模式）')}</FormLabel>
                  <FormDescription>
                    {t(
                      '开启后 ESA 边缘节点会拦截未携带 captchaVerifyParam 的请求，大幅提高安全性。需要在 ESA 控制台同步开启「拦截空Token请求」，并确保所有客户端已完成前端 HTML 集成与全网发布后再启用。否则旧客户端（未集成验证码JS）的请求也会被拦截。'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='ESARegion'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Region')}</FormLabel>
                <FormControl>
                  <Input placeholder='cn / sgp' autoComplete='off' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='ESAPrefix'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('ESA identity prefix')}</FormLabel>
                <FormControl>
                  <Input placeholder='esa-********' autoComplete='off' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {sceneFields.map(([name, label]) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(label)}</FormLabel>
                  <FormControl>
                    <Input autoComplete='off' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
