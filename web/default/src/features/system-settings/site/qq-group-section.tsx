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
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useSystemConfigStore } from '@/stores/system-config-store'
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
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

type QQGroupFormValues = {
  QQGroupEnabled: boolean
  QQGroupNumber: string
  QQGroupQRCodeURLLight: string
  QQGroupQRCodeURLDark: string
}

type QQGroupSectionProps = {
  defaultValues: QQGroupFormValues
}

function normalizeValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
}

const optionalImageUrl = (message: string) =>
  z.string().url({ error: () => message }).optional().or(z.literal(''))

export function QQGroupSection({ defaultValues }: QQGroupSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const setConfig = useSystemConfigStore((state) => state.setConfig)

  const normalizedDefaults: QQGroupFormValues = {
    QQGroupEnabled: defaultValues.QQGroupEnabled === true,
    QQGroupNumber: normalizeValue(defaultValues.QQGroupNumber),
    QQGroupQRCodeURLLight: normalizeValue(defaultValues.QQGroupQRCodeURLLight),
    QQGroupQRCodeURLDark: normalizeValue(defaultValues.QQGroupQRCodeURLDark),
  }

  const qqGroupSchemaWithI18n = z.object({
    QQGroupEnabled: z.boolean(),
    QQGroupNumber: z.string(),
    QQGroupQRCodeURLLight: optionalImageUrl(
      t('Please enter a valid image URL')
    ),
    QQGroupQRCodeURLDark: optionalImageUrl(t('Please enter a valid image URL')),
  })

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<QQGroupFormValues>({
      resolver: zodResolver(qqGroupSchemaWithI18n) as Resolver<
        QQGroupFormValues,
        unknown,
        QQGroupFormValues
      >,
      defaultValues: normalizedDefaults,
      onSubmit: async (data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          await updateOption.mutateAsync({
            key,
            value:
              typeof value === 'boolean' ? value : normalizeValue(value).trim(),
          })
        }
        setConfig({
          qqGroup: {
            enabled: data.QQGroupEnabled,
            number: normalizeValue(data.QQGroupNumber).trim(),
            qrcodeUrlLight: normalizeValue(
              data.QQGroupQRCodeURLLight
            ).trim(),
            qrcodeUrlDark: normalizeValue(data.QQGroupQRCodeURLDark).trim(),
          },
        })
      },
    })

  return (
    <>
      <FormNavigationGuard when={isDirty} />

      <SettingsSection
        title={t('QQ Group')}
        description={t('Configure the global QQ group entry for users')}
      >
        <Form {...form}>
          <form onSubmit={handleSubmit} className='flex flex-col gap-6'>
            <SettingsPageFormActions
              onSave={handleSubmit}
              onReset={handleReset}
              isSaving={isSubmitting || updateOption.isPending}
              isResetDisabled={!isDirty}
            />
            <FormDirtyIndicator isDirty={isDirty} />

            <FormField
              control={form.control}
              name='QQGroupEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      {t('Enable QQ group entry')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Show a floating QQ group button in the authenticated console.'
                      )}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={updateOption.isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='QQGroupNumber'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('QQ group number')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('Enter QQ group number')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Displayed in the QR code dialog and used for copying.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='QQGroupQRCodeURLLight'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Light theme QQ group QR code URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('https://example.com/qq-group-light.png')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Shown when the console is using the light theme.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='QQGroupQRCodeURLDark'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Dark theme QQ group QR code URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('https://example.com/qq-group-dark.png')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Shown when the console is using the dark theme.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </SettingsSection>
    </>
  )
}
