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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z.object({
  enabled: z.boolean(),
  gatewayChannelId: z.coerce.number().int().min(0),
  refreshOnGet: z.boolean(),
  defaultCallbackUrl: z.string(),
  platform: z.enum(['cn', 'overseas']),
  projectName: z.string().min(1),
})

type Values = z.infer<typeof schema>

export function SeedanceOfficialAssetSettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    gatewayChannelId: number
    refreshOnGet: boolean
    defaultCallbackUrl: string
    platform: 'cn' | 'overseas'
    projectName: string
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
      defaultCallbackUrl: defaultValues.defaultCallbackUrl,
      platform: defaultValues.platform === 'overseas' ? 'overseas' : 'cn',
      projectName: defaultValues.projectName || 'default',
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'seedance_asset_official.enabled',
        value: String(values.enabled),
      })
    }
    if (values.gatewayChannelId !== defaultValues.gatewayChannelId) {
      updates.push({
        key: 'seedance_asset_official.gateway_channel_id',
        value: String(values.gatewayChannelId),
      })
    }
    if (values.refreshOnGet !== defaultValues.refreshOnGet) {
      updates.push({
        key: 'seedance_asset_official.refresh_on_get',
        value: String(values.refreshOnGet),
      })
    }
    if (values.defaultCallbackUrl !== defaultValues.defaultCallbackUrl) {
      updates.push({
        key: 'seedance_asset_official.default_callback_url',
        value: values.defaultCallbackUrl,
      })
    }
    if (values.platform !== defaultValues.platform) {
      updates.push({
        key: 'seedance_asset_official.platform',
        value: values.platform,
      })
    }
    if (values.projectName !== defaultValues.projectName) {
      updates.push({
        key: 'seedance_asset_official.project_name',
        value: values.projectName.trim() || 'default',
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
      title={t('Seedance Official Asset Gateway')}
      description={t(
        'Direct Volcengine Ark private asset APIs with console AK/SK (parallel to 83zi)'
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
                    {t('Enable Seedance official asset APIs')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Expose /api/seedance/official asset-group and real-person endpoints'
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
            name='platform'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Official asset platform')}</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={updateOption.isPending || isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='cn'>
                      {t('China Volcengine (cn-beijing)')}
                    </SelectItem>
                    <SelectItem value='overseas'>
                      {t('Overseas BytePlus (ap-southeast-1)')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t(
                    'Choose China or overseas endpoint; does not replace the other. Channel Key still uses AK|SK.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='gatewayChannelId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Official gateway channel ID')}</FormLabel>
                <FormControl>
                  <Input type='number' min={0} {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'Channel Key must be AK|SK or AK|SK|Region; Base URL optional (uses platform default host when empty)'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='projectName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Official asset project name')}</FormLabel>
                <FormControl>
                  <Input placeholder='project_zzz' {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'BytePlus/Volcengine ProjectName used by CreateAssetGroup and CreateAsset'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='defaultCallbackUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Default real-person CallbackURL')}</FormLabel>
                <FormControl>
                  <Input
                    type='url'
                    placeholder='https://your-app.com/face-verify/callback'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Used by CreateVisualValidateSession when clients omit callback_url'
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
                    {t('Refresh official asset status on GET')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'When enabled, GET /api/seedance/official/assets/{id} refreshes status from Volcengine'
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
              : t('Save Seedance official asset settings')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
