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
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useForm,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getSmsStatus, sendSmsTest } from '../api'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  buildSmsSettingsUpdates,
  defaultSmsTestValues,
  smsSceneOptions,
  type SmsSettingsFormValues,
  type SmsStatusResult,
  type SmsTestFormValues,
  type SmsTestResult,
} from './sms-settings'

const smsSettingsSchema = z.object({
  SMSEnabled: z.boolean(),
  SMSProvider: z.string(),
  SMSBaoEndpoint: z.string(),
  SMSBaoQueryEndpoint: z.string(),
  SMSBaoUsername: z.string(),
  SMSBaoCredential: z.string(),
  SMSBaoCredentialMode: z.string(),
  SMSBaoProductID: z.string(),
  SMSCodeValidMinutes: z.number().int().min(1),
  SMSCodeCooldownSeconds: z.number().int().min(0),
  SMSSignature: z.string(),
  SMSSignatureReviewStatus: z.enum(['pending', 'approved', 'rejected']),
  SMSProductName: z.string(),
  SMSTemplate: z.string(),
  SMSRateLimitEnabled: z.boolean(),
  SMSRateLimitWindowSeconds: z.number().int().min(1),
  SMSRateLimitPhoneCount: z.number().int().min(0),
  SMSRateLimitIPCount: z.number().int().min(0),
  SMSRateLimitAccountCount: z.number().int().min(0),
  SMSRateLimitSceneCount: z.number().int().min(0),
})

const smsTestSchema = z.object({
  phone: z.string(),
  scene: z.string(),
  code: z.string(),
})

type TextFieldProps<TValues extends FieldValues> = {
  control: Control<TValues>
  name: FieldPath<TValues>
  label: string
  placeholder?: string
  description?: string
  type?: string
}

function TextField<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  type = 'text',
}: TextFieldProps<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              autoComplete='off'
              type={type}
              placeholder={placeholder}
              {...field}
              value={
                typeof field.value === 'string' ||
                typeof field.value === 'number'
                  ? field.value
                  : ''
              }
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type NumberFieldProps<TValues extends FieldValues> = {
  control: Control<TValues>
  name: FieldPath<TValues>
  label: string
  min?: number
  description?: string
}

function NumberField<TValues extends FieldValues>({
  control,
  name,
  label,
  min = 0,
  description,
}: NumberFieldProps<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              autoComplete='off'
              type='number'
              min={min}
              {...field}
              value={field.value ?? 0}
              onChange={(event) =>
                field.onChange(
                  event.target.value === '' ? min : event.target.valueAsNumber
                )
              }
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type TextareaFieldProps = {
  control: Control<SmsSettingsFormValues>
  name: FieldPath<SmsSettingsFormValues>
  label: string
  placeholder: string
}

function TextareaField({
  control,
  name,
  label,
  placeholder,
}: TextareaFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              rows={3}
              placeholder={placeholder}
              {...field}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          <FormDescription>
            {'{code} / {minutes} / {product} / {site}'}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type SelectFieldProps<TValues extends FieldValues> = {
  control: Control<TValues>
  name: FieldPath<TValues>
  label: string
  description?: string
  options: Array<{ value: string; label: string }>
}

function SelectField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  options,
}: SelectFieldProps<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={String(field.value)} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent alignItemWithTrigger={false}>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type SmsSettingsSectionProps = {
  defaultValues: SmsSettingsFormValues
}

export function SmsSettingsSection({ defaultValues }: SmsSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [testResult, setTestResult] = useState<SmsTestResult | null>(null)
  const [statusResult, setStatusResult] = useState<SmsStatusResult | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

  const form = useForm<SmsSettingsFormValues, unknown, SmsSettingsFormValues>({
    resolver: zodResolver(smsSettingsSchema),
    defaultValues,
  })
  const testForm = useForm<SmsTestFormValues, unknown, SmsTestFormValues>({
    resolver: zodResolver(smsTestSchema),
    defaultValues: defaultSmsTestValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (values: SmsSettingsFormValues) => {
    const updates = buildSmsSettingsUpdates(values, defaultValues)
    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
    form.setValue('SMSBaoCredential', '')
  }

  const onSendTest = async (values: SmsTestFormValues) => {
    setTestLoading(true)
    setTestResult(null)
    try {
      const response = await sendSmsTest(values)
      if (!response.success) {
        toast.error(response.message || t('Failed to send test SMS'))
        return
      }
      setTestResult(response.data ?? null)
      toast.success(t('Test SMS sent'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to send test SMS')
      )
    } finally {
      setTestLoading(false)
    }
  }

  const onFetchStatus = async () => {
    setStatusLoading(true)
    setStatusResult(null)
    try {
      const response = await getSmsStatus()
      if (!response.success) {
        toast.error(response.message || t('Failed to query SMS status'))
        return
      }
      setStatusResult(response.data ?? null)
      toast.success(t('SMS status refreshed'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to query SMS status')
      )
    } finally {
      setStatusLoading(false)
    }
  }

  return (
    <SettingsSection title={t('SMS Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save SMS settings'
          />

          <Alert>
            <AlertTitle>{t('Credential safety')}</AlertTitle>
            <AlertDescription>
              {t(
                'SMSBao credentials are not returned by the backend. Leave the credential field blank to keep the existing value.'
              )}
            </AlertDescription>
          </Alert>

          <FormField
            control={form.control}
            name='SMSEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable SMS')}</FormLabel>
                  <FormDescription>
                    {t('Allow SMS verification messages to be sent')}
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

          <SelectField
            control={form.control}
            name='SMSProvider'
            label={t('SMS provider')}
            options={[{ value: 'smsbao', label: 'SMSBao' }]}
          />
          <SelectField
            control={form.control}
            name='SMSSignatureReviewStatus'
            label={t('Signature review status')}
            description={t('Only approved signatures can send SMS messages')}
            options={[
              { value: 'pending', label: t('Pending') },
              { value: 'approved', label: t('Approved') },
              { value: 'rejected', label: t('Rejected') },
            ]}
          />
          <SelectField
            control={form.control}
            name='SMSBaoCredentialMode'
            label={t('Credential mode')}
            options={[
              { value: 'api_key', label: t('API Key') },
              { value: 'md5_password', label: t('MD5 password') },
            ]}
          />

          <TextField
            control={form.control}
            name='SMSBaoEndpoint'
            label={t('SMSBao send endpoint')}
          />
          <TextField
            control={form.control}
            name='SMSBaoQueryEndpoint'
            label={t('SMSBao query endpoint')}
          />
          <TextField
            control={form.control}
            name='SMSBaoProductID'
            label={t('Dedicated product ID')}
            placeholder={t('Optional')}
          />
          <TextField
            control={form.control}
            name='SMSBaoUsername'
            label={t('SMSBao username')}
          />
          <TextField
            control={form.control}
            name='SMSBaoCredential'
            label={t('SMSBao credential')}
            type='password'
            placeholder={t('Leave blank to keep the existing credential')}
          />
          <TextField
            control={form.control}
            name='SMSSignature'
            label={t('SMS signature')}
            placeholder={t('Example: NewAPI')}
          />
          <TextField
            control={form.control}
            name='SMSProductName'
            label={t('SMS product name')}
            placeholder={t('Used by the {product} template variable')}
          />
          <NumberField
            control={form.control}
            name='SMSCodeValidMinutes'
            label={t('Code validity minutes')}
            min={1}
          />
          <NumberField
            control={form.control}
            name='SMSCodeCooldownSeconds'
            label={t('Code cooldown seconds')}
            min={0}
          />

          <TextareaField
            control={form.control}
            name='SMSTemplate'
            label={t('SMS template')}
            placeholder='{product} verification code {code}, valid for {minutes} minutes.'
          />

          <FormField
            control={form.control}
            name='SMSRateLimitEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable SMS rate limit')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Apply phone, IP, account, and scene limits before send'
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
          <NumberField
            control={form.control}
            name='SMSRateLimitWindowSeconds'
            label={t('Rate limit window seconds')}
            min={1}
          />
          <NumberField
            control={form.control}
            name='SMSRateLimitPhoneCount'
            label={t('Phone limit')}
            min={0}
            description={t('0 disables this dimension')}
          />
          <NumberField
            control={form.control}
            name='SMSRateLimitIPCount'
            label={t('IP limit')}
            min={0}
            description={t('0 disables this dimension')}
          />
          <NumberField
            control={form.control}
            name='SMSRateLimitAccountCount'
            label={t('Account limit')}
            min={0}
            description={t('0 disables this dimension')}
          />
          <NumberField
            control={form.control}
            name='SMSRateLimitSceneCount'
            label={t('Scene limit')}
            min={0}
            description={t('0 disables this dimension')}
          />
        </SettingsForm>
      </Form>

      <Form {...testForm}>
        <SettingsForm
          onSubmit={testForm.handleSubmit(onSendTest)}
          autoComplete='off'
          className='rounded-xl border p-4'
        >
          <div className='flex flex-col gap-1 lg:col-span-2'>
            <h4 className='text-sm font-medium'>{t('Test send and status')}</h4>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Responses only show masked phone, provider code, and balance counters.'
              )}
            </p>
          </div>
          <TextField
            control={testForm.control}
            name='phone'
            label={t('Test phone')}
            placeholder='13800138000'
          />
          <SelectField
            control={testForm.control}
            name='scene'
            label={t('Test scene')}
            options={smsSceneOptions.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
          />
          <TextField
            control={testForm.control}
            name='code'
            label={t('Test code')}
            placeholder={t('Example: 123456')}
          />
          <div className='flex flex-wrap gap-2 lg:col-span-2'>
            <Button type='submit' disabled={testLoading}>
              {testLoading ? t('Sending...') : t('Send test SMS')}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={onFetchStatus}
              disabled={statusLoading}
            >
              {statusLoading ? t('Querying...') : t('Query SMS status')}
            </Button>
          </div>
          {(testResult || statusResult) && (
            <Alert className='lg:col-span-2'>
              <AlertTitle>{t('SMS provider result')}</AlertTitle>
              <AlertDescription>
                {testResult && (
                  <span className='block'>
                    {t('Test send')}: {testResult.phone_masked ?? '-'} /{' '}
                    {testResult.provider ?? '-'} /{' '}
                    {testResult.provider_code ?? '-'}
                  </span>
                )}
                {statusResult && (
                  <span className='block'>
                    {t('Status')}: {statusResult.provider ?? '-'} /{' '}
                    {statusResult.provider_code ?? '-'} / {t('Sent')}{' '}
                    {statusResult.sent_count ?? '-'} / {t('Remaining')}{' '}
                    {statusResult.remaining_count ?? '-'}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
