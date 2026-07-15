/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    10|but WITHOUT ANY WARRANTY; without even the implied warranty of
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
  refreshOnGet: z.boolean(),
})

type Values = z.infer<typeof schema>

export function SeedanceAssetSettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    gatewayChannelId: number
    refreshOnGet: boolean
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      gatewayChannelId: defaultValues.gatewayChannelId,
      refreshOnGet: defaultValues.refreshOnGet,
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'seedance_asset.enabled',
        value: String(values.enabled),
      })
    }
    if (values.gatewayChannelId !== defaultValues.gatewayChannelId) {
      updates.push({
        key: 'seedance_asset.gateway_channel_id',
        value: String(values.gatewayChannelId),
      })
    }
    if (values.refreshOnGet !== defaultValues.refreshOnGet) {
      updates.push({
        key: 'seedance_asset.refresh_on_get',
        value: String(values.refreshOnGet),
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
      title={t('Seedance Asset Gateway')}
      description={t(
        'Proxy seedance asset APIs to an 83zi gateway channel with local user ownership'
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
                  <FormLabel className='text-base'>
                    {t('Enable Seedance asset APIs')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Expose /api/seedance asset-group and real-person endpoints'
                    )}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
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
                  <Input type='number' min={0} {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'Channel whose Base URL points to 83zi (e.g. http://s.83zi.com) and Key is that site sk-'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='refreshOnGet'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    {t('Refresh asset status on GET')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'When enabled, GET /api/seedance/assets/{id} refreshes status from the gateway'
                    )}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Button
            type='submit'
            disabled={!isDirty || updateOption.isPending || isSubmitting}
          >
            {updateOption.isPending || isSubmitting
              ? t('Saving...')
              : t('Save Seedance asset settings')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
