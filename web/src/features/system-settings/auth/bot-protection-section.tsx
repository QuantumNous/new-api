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
import { useEffect, useMemo, useRef } from 'react'
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
import { Switch } from '@/components/ui/switch'

import {
  SettingsControlGroup,
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const botProtectionSchema = z.object({
  provider: z.enum(['none', 'turnstile', 'geetest', 'corptcha']),
  CaptchaLoginEnabled: z.boolean(),
  CaptchaRegisterEnabled: z.boolean(),
  CaptchaResetEnabled: z.boolean(),
  TurnstileSiteKey: z.string().optional(),
  TurnstileSecretKey: z.string().optional(),
  GeeTestCaptchaId: z.string().optional(),
  GeeTestCaptchaKey: z.string().optional(),
  CorptchaSiteId: z.string().optional(),
  CorptchaSecret: z.string().optional(),
})

type BotProtectionFormValues = z.infer<typeof botProtectionSchema>
type ProviderValue = BotProtectionFormValues['provider']

type FlatBotProtectionDefaults = {
  TurnstileCheckEnabled: boolean
  TurnstileSiteKey: string
  TurnstileSecretKey: string
  GeeTestCheckEnabled: boolean
  GeeTestCaptchaId: string
  GeeTestCaptchaKey: string
  CorptchaCheckEnabled: boolean
  CorptchaSiteId: string
  CorptchaSecret: string
  CaptchaLoginEnabled: boolean
  CaptchaRegisterEnabled: boolean
  CaptchaResetEnabled: boolean
}

type BotProtectionSectionProps = {
  defaultValues: FlatBotProtectionDefaults
}

// 多渠道互斥：同一时刻仅允许启用一个验证渠道
const toProvider = (defaults: FlatBotProtectionDefaults): ProviderValue => {
  if (defaults.CorptchaCheckEnabled) return 'corptcha'
  if (defaults.GeeTestCheckEnabled) return 'geetest'
  if (defaults.TurnstileCheckEnabled) return 'turnstile'
  return 'none'
}

const buildFormDefaults = (
  defaults: FlatBotProtectionDefaults
): BotProtectionFormValues => ({
  provider: toProvider(defaults),
  CaptchaLoginEnabled: defaults.CaptchaLoginEnabled,
  CaptchaRegisterEnabled: defaults.CaptchaRegisterEnabled,
  CaptchaResetEnabled: defaults.CaptchaResetEnabled,
  TurnstileSiteKey: defaults.TurnstileSiteKey ?? '',
  TurnstileSecretKey: defaults.TurnstileSecretKey ?? '',
  GeeTestCaptchaId: defaults.GeeTestCaptchaId ?? '',
  GeeTestCaptchaKey: defaults.GeeTestCaptchaKey ?? '',
  CorptchaSiteId: defaults.CorptchaSiteId ?? '',
  CorptchaSecret: defaults.CorptchaSecret ?? '',
})

const normalizeFormValues = (
  values: BotProtectionFormValues
): FlatBotProtectionDefaults => ({
  TurnstileCheckEnabled: values.provider === 'turnstile',
  TurnstileSiteKey: values.TurnstileSiteKey ?? '',
  TurnstileSecretKey: values.TurnstileSecretKey ?? '',
  GeeTestCheckEnabled: values.provider === 'geetest',
  GeeTestCaptchaId: values.GeeTestCaptchaId ?? '',
  GeeTestCaptchaKey: values.GeeTestCaptchaKey ?? '',
  CorptchaCheckEnabled: values.provider === 'corptcha',
  CorptchaSiteId: values.CorptchaSiteId ?? '',
  CorptchaSecret: values.CorptchaSecret ?? '',
  CaptchaLoginEnabled: values.CaptchaLoginEnabled,
  CaptchaRegisterEnabled: values.CaptchaRegisterEnabled,
  CaptchaResetEnabled: values.CaptchaResetEnabled,
})

export function BotProtectionSection({
  defaultValues,
}: BotProtectionSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults = useMemo(
    () => buildFormDefaults(defaultValues),
    [defaultValues]
  )

  const form = useForm<BotProtectionFormValues>({
    resolver: zodResolver(botProtectionSchema),
    defaultValues: formDefaults,
  })

  const baselineRef = useRef<FlatBotProtectionDefaults>(defaultValues)
  const baselineSerializedRef = useRef<string>(JSON.stringify(defaultValues))

  useEffect(() => {
    const serialized = JSON.stringify(defaultValues)
    if (serialized === baselineSerializedRef.current) return
    baselineRef.current = defaultValues
    baselineSerializedRef.current = serialized
    form.reset(buildFormDefaults(defaultValues))
  }, [defaultValues, form])

  const provider = form.watch('provider')

  const onSubmit = async (values: BotProtectionFormValues) => {
    const normalized = normalizeFormValues(values)
    const changedKeys: Array<keyof FlatBotProtectionDefaults> = []

    // 先收集密钥等配置变更
    for (const key of [
      'TurnstileSiteKey',
      'TurnstileSecretKey',
      'GeeTestCaptchaId',
      'GeeTestCaptchaKey',
      'CorptchaSiteId',
      'CorptchaSecret',
    ] as const) {
      if (normalized[key] !== baselineRef.current[key]) {
        changedKeys.push(key)
      }
    }

    // 应用场景开关（登录 / 注册 / 重置密码）
    for (const key of [
      'CaptchaLoginEnabled',
      'CaptchaRegisterEnabled',
      'CaptchaResetEnabled',
    ] as const) {
      if (normalized[key] !== baselineRef.current[key]) {
        changedKeys.push(key)
      }
    }

    // 切换渠道时仅提交目标渠道的启用开关，
    // 由后端在启用成功后再关闭另一个渠道，避免启用失败导致当前渠道被误关
    let enableKey: keyof FlatBotProtectionDefaults | null = null
    if (values.provider === 'turnstile') {
      enableKey = 'TurnstileCheckEnabled'
    } else if (values.provider === 'geetest') {
      enableKey = 'GeeTestCheckEnabled'
    } else if (values.provider === 'corptcha') {
      enableKey = 'CorptchaCheckEnabled'
    }
    if (enableKey && normalized[enableKey] !== baselineRef.current[enableKey]) {
      changedKeys.push(enableKey)
    }
    if (values.provider === 'none') {
      if (baselineRef.current.TurnstileCheckEnabled) {
        changedKeys.push('TurnstileCheckEnabled')
      }
      if (baselineRef.current.GeeTestCheckEnabled) {
        changedKeys.push('GeeTestCheckEnabled')
      }
      if (baselineRef.current.CorptchaCheckEnabled) {
        changedKeys.push('CorptchaCheckEnabled')
      }
    }

    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of changedKeys) {
      const res = await updateOption.mutateAsync({
        key,
        value: normalized[key],
      })
      if (!res.success) {
        // 保存失败时回滚表单到已持久化状态
        form.reset(buildFormDefaults(baselineRef.current))
        return
      }
    }

    baselineRef.current = normalized
    baselineSerializedRef.current = JSON.stringify(normalized)
    form.reset(buildFormDefaults(normalized))
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
            name='CaptchaLoginEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Login Protection')}</FormLabel>
                  <FormDescription>
                    {t('Require captcha verification on login')}
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
            name='CaptchaRegisterEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Registration Protection')}</FormLabel>
                  <FormDescription>
                    {t('Require captcha verification on registration')}
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
            name='CaptchaResetEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Password Reset Protection')}</FormLabel>
                  <FormDescription>
                    {t('Require captcha verification on password reset')}
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
            name='provider'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Captcha Provider')}</FormLabel>
                <FormDescription>
                  {t(
                    'Select the captcha provider used to protect login and registration. Only one can be enabled at a time.'
                  )}
                </FormDescription>
                <FormControl>
                  <Select
                    items={[
                      { value: 'none', label: t('Disabled') },
                      { value: 'turnstile', label: t('Cloudflare Turnstile') },
                      { value: 'geetest', label: t('GeeTest') },
                      { value: 'corptcha', label: t('Corptcha') },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className='w-full sm:w-72'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='none'>{t('Disabled')}</SelectItem>
                        <SelectItem value='turnstile'>
                          {t('Cloudflare Turnstile')}
                        </SelectItem>
                        <SelectItem value='geetest'>{t('GeeTest')}</SelectItem>
                        <SelectItem value='corptcha'>{t('Corptcha')}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {provider === 'turnstile' && (
            <SettingsControlGroup>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsControlGroup>
          )}

          {provider === 'geetest' && (
            <SettingsControlGroup>
              <FormField
                control={form.control}
                name='GeeTestCaptchaId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Captcha ID')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Your GeeTest captcha id')}
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
                name='GeeTestCaptchaKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Captcha Key')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={t('Your GeeTest captcha key')}
                        autoComplete='new-password'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsControlGroup>
          )}

          {provider === 'corptcha' && (
            <SettingsControlGroup>
              <FormField
                control={form.control}
                name='CorptchaSiteId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Site ID')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Your Corptcha site id')}
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
                name='CorptchaSecret'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Secret')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={t('Your Corptcha secret')}
                        autoComplete='new-password'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsControlGroup>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
