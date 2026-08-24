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
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const createAliyunSmsSchema = () =>
  z.object({
    AliyunSMSSignName: z.string(),
    AliyunSMSTemplateCode: z.string(),
    AliyunSMSRegionId: z.string(),
  })

type AliyunSmsFormValues = z.infer<ReturnType<typeof createAliyunSmsSchema>>

type AliyunSmsSettingsSectionProps = {
  defaultValues: AliyunSmsFormValues
}

export function AliyunSmsSettingsSection({
  defaultValues,
}: AliyunSmsSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const smsSchema = createAliyunSmsSchema()

  const form = useForm<AliyunSmsFormValues>({
    resolver: zodResolver(smsSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (values: AliyunSmsFormValues) => {
    const sanitized = {
      AliyunSMSSignName: values.AliyunSMSSignName.trim(),
      AliyunSMSTemplateCode: values.AliyunSMSTemplateCode.trim(),
      AliyunSMSRegionId: values.AliyunSMSRegionId.trim(),
    }

    const initial = {
      AliyunSMSSignName: defaultValues.AliyunSMSSignName.trim(),
      AliyunSMSTemplateCode: defaultValues.AliyunSMSTemplateCode.trim(),
      AliyunSMSRegionId: defaultValues.AliyunSMSRegionId.trim(),
    }

    const updates: Array<{ key: string; value: string }> = []

    if (sanitized.AliyunSMSSignName !== initial.AliyunSMSSignName) {
      updates.push({
        key: 'AliyunSMSSignName',
        value: sanitized.AliyunSMSSignName,
      })
    }

    if (sanitized.AliyunSMSTemplateCode !== initial.AliyunSMSTemplateCode) {
      updates.push({
        key: 'AliyunSMSTemplateCode',
        value: sanitized.AliyunSMSTemplateCode,
      })
    }

    if (sanitized.AliyunSMSRegionId !== initial.AliyunSMSRegionId) {
      updates.push({
        key: 'AliyunSMSRegionId',
        value: sanitized.AliyunSMSRegionId,
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection title={t('Aliyun SMS')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save Aliyun SMS settings'
          />

          <SettingsSwitchItem>
            <SettingsSwitchContent>
              <FormLabel>{t('AccessKey')}</FormLabel>
              <FormDescription>
                {t(
                  'AccessKey ID and AccessKey Secret are configured in the server code (common/constants.go). Contact the administrator if SMS sending fails.'
                )}
              </FormDescription>
            </SettingsSwitchContent>
          </SettingsSwitchItem>

          <FormField
            control={form.control}
            name='AliyunSMSSignName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('SMS Sign Name')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder={t('e.g. New API')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('The SMS signature approved in the Aliyun console')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='AliyunSMSTemplateCode'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('SMS Template Code')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder='SMS_000000'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Template Code of the approved SMS template. It must contain a ${code} variable that receives the 6-digit verification code.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='AliyunSMSRegionId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Region')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder='cn-hangzhou'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Aliyun region of the SMS service (default: cn-hangzhou)')}
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
