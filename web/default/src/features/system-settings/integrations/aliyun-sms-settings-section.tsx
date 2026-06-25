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
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const aliyunSmsSchema = z.object({
  AliyunSmsAccessKeyId: z.string(),
  AliyunSmsAccessKeySecret: z.string(),
  AliyunSmsSignName: z.string(),
  AliyunSmsTemplateCode: z.string(),
  AliyunSmsEndpoint: z.string(),
})

type AliyunSmsFormValues = z.infer<typeof aliyunSmsSchema>

type AliyunSmsSettingsSectionProps = {
  defaultValues: AliyunSmsFormValues
}

export function AliyunSmsSettingsSection({
  defaultValues,
}: AliyunSmsSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<AliyunSmsFormValues>({
    resolver: zodResolver(aliyunSmsSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (values: AliyunSmsFormValues) => {
    const sanitized = {
      AliyunSmsAccessKeyId: values.AliyunSmsAccessKeyId.trim(),
      AliyunSmsAccessKeySecret: values.AliyunSmsAccessKeySecret.trim(),
      AliyunSmsSignName: values.AliyunSmsSignName.trim(),
      AliyunSmsTemplateCode: values.AliyunSmsTemplateCode.trim(),
      AliyunSmsEndpoint:
        values.AliyunSmsEndpoint.trim() || 'dysmsapi.aliyuncs.com',
    }

    const initial = {
      AliyunSmsAccessKeyId: defaultValues.AliyunSmsAccessKeyId.trim(),
      AliyunSmsAccessKeySecret: defaultValues.AliyunSmsAccessKeySecret.trim(),
      AliyunSmsSignName: defaultValues.AliyunSmsSignName.trim(),
      AliyunSmsTemplateCode: defaultValues.AliyunSmsTemplateCode.trim(),
      AliyunSmsEndpoint:
        defaultValues.AliyunSmsEndpoint.trim() || 'dysmsapi.aliyuncs.com',
    }

    const updates: Array<{ key: string; value: string }> = []
    if (
      sanitized.AliyunSmsAccessKeyId &&
      sanitized.AliyunSmsAccessKeyId !== initial.AliyunSmsAccessKeyId
    ) {
      updates.push({
        key: 'AliyunSmsAccessKeyId',
        value: sanitized.AliyunSmsAccessKeyId,
      })
    }
    if (
      sanitized.AliyunSmsAccessKeySecret &&
      sanitized.AliyunSmsAccessKeySecret !== initial.AliyunSmsAccessKeySecret
    ) {
      updates.push({
        key: 'AliyunSmsAccessKeySecret',
        value: sanitized.AliyunSmsAccessKeySecret,
      })
    }
    if (sanitized.AliyunSmsSignName !== initial.AliyunSmsSignName) {
      updates.push({
        key: 'AliyunSmsSignName',
        value: sanitized.AliyunSmsSignName,
      })
    }
    if (sanitized.AliyunSmsTemplateCode !== initial.AliyunSmsTemplateCode) {
      updates.push({
        key: 'AliyunSmsTemplateCode',
        value: sanitized.AliyunSmsTemplateCode,
      })
    }
    if (sanitized.AliyunSmsEndpoint !== initial.AliyunSmsEndpoint) {
      updates.push({
        key: 'AliyunSmsEndpoint',
        value: sanitized.AliyunSmsEndpoint,
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection
      title={t('Aliyun SMS')}
      description={t('Configure Aliyun SMS service for phone sign-in')}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
          autoComplete='off'
        >
          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='AliyunSmsAccessKeyId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('AccessKey ID')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      placeholder={t('Enter new AccessKey ID to update')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Leave blank to keep the existing credential')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='AliyunSmsAccessKeySecret'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('AccessKey Secret')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      type='password'
                      placeholder={t('Enter new secret to update')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Leave blank to keep the existing credential')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='AliyunSmsSignName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('SMS sign name')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      placeholder={t('Your approved SMS sign name')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Must match the sign name approved in Aliyun SMS')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='AliyunSmsTemplateCode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Template code')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      placeholder='SMS_123456789'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Template must use the code variable')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='AliyunSmsEndpoint'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Endpoint')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder='dysmsapi.aliyuncs.com'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('Default endpoint is dysmsapi.aliyuncs.com')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending
              ? t('Saving...')
              : t('Save Aliyun SMS settings')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
