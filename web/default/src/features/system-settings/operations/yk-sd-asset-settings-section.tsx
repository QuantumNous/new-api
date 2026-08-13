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
import { z } from 'zod'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z.object({
  enabled: z.boolean(),
  gatewayChannelId: z.coerce.number().int().min(0),
})

type Values = z.infer<typeof schema>

export function YkSdAssetSettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    gatewayChannelId: number
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      gatewayChannelId: defaultValues.gatewayChannelId,
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []
    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'yk_sd_asset.enabled',
        value: String(values.enabled),
      })
    }
    if (values.gatewayChannelId !== defaultValues.gatewayChannelId) {
      updates.push({
        key: 'yk_sd_asset.gateway_channel_id',
        value: String(values.gatewayChannelId),
      })
    }
    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
    form.reset(values)
  }

  return (
    <SettingsSection
      title={t('yk-sd Asset Gateway')}
      description={t(
        'Proxy /api/yk-sd/assets to a yk-sd (KYY) channel for Seedance asset upload/detail'
      )}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          autoComplete='off'
          className='space-y-6'
        >
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel>{t('Enable yk-sd asset APIs')}</FormLabel>
                  <FormDescription>
                    {t('Expose /api/yk-sd/assets/upload and /detail')}
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
            name='gatewayChannelId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Gateway channel ID')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    value={field.value}
                    onChange={(e) =>
                      field.onChange(Number(e.target.value || 0))
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t('Point to a yk-sd channel (type 70) for Base URL and Key')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit' disabled={!isDirty || isSubmitting}>
            {t('Save yk-sd asset settings')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
