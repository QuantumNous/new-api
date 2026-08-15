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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
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

import { getAutoPricingStatus, syncAutoPricing } from '../api'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  autoPricingFormSchema,
  type AutoPricingDefaults,
  type AutoPricingFormValues,
} from './auto-pricing-form'

const AUTO_PRICING_STATUS_KEY = ['system-settings', 'auto-pricing-status']

export type { AutoPricingDefaults }

export function AutoPricingSection({
  defaultValues,
}: {
  defaultValues: AutoPricingDefaults
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: AUTO_PRICING_STATUS_KEY,
    queryFn: getAutoPricingStatus,
  })

  const syncMutation = useMutation({
    mutationFn: syncAutoPricing,
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message ?? t('Failed to sync pricing catalog'))
      } else {
        toast.success(
          t('Pricing catalog updated with {{modelCount}} models', {
            modelCount: response.data.model_count,
          })
        )
      }
      void queryClient.invalidateQueries({ queryKey: AUTO_PRICING_STATUS_KEY })
    },
  })

  const form = useForm<AutoPricingFormValues>({
    resolver: zodResolver(
      autoPricingFormSchema
    ) as unknown as Resolver<AutoPricingFormValues>,
    defaultValues: {
      enabled: defaultValues.enabled,
      remoteUrl: defaultValues.remoteUrl,
      hashUrl: defaultValues.hashUrl,
      modelsDevUrl: defaultValues.modelsDevUrl,
      checkIntervalMinutes: defaultValues.checkIntervalMinutes,
      fuzzyMatchEnabled: defaultValues.fuzzyMatchEnabled,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const isBusy = updateOption.isPending || isSubmitting

  async function onSubmit(values: AutoPricingFormValues) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'auto_pricing.enabled',
        value: String(values.enabled),
      })
    }
    if (values.remoteUrl !== defaultValues.remoteUrl) {
      updates.push({ key: 'auto_pricing.remote_url', value: values.remoteUrl })
    }
    if (values.hashUrl !== defaultValues.hashUrl) {
      updates.push({ key: 'auto_pricing.hash_url', value: values.hashUrl })
    }
    if (values.modelsDevUrl !== defaultValues.modelsDevUrl) {
      updates.push({
        key: 'auto_pricing.models_dev_url',
        value: values.modelsDevUrl,
      })
    }
    if (values.checkIntervalMinutes !== defaultValues.checkIntervalMinutes) {
      updates.push({
        key: 'auto_pricing.check_interval_minutes',
        value: String(values.checkIntervalMinutes),
      })
    }
    if (values.fuzzyMatchEnabled !== defaultValues.fuzzyMatchEnabled) {
      updates.push({
        key: 'auto_pricing.fuzzy_match_enabled',
        value: String(values.fuzzyMatchEnabled),
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
    void queryClient.invalidateQueries({ queryKey: AUTO_PRICING_STATUS_KEY })
  }

  return (
    <SettingsSection title={t('Automatic Model Pricing')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={isBusy}
            isSaveDisabled={!isDirty}
            saveLabel='Save automatic pricing settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable automatic model pricing')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Price models that have no manual ratio and no manual fixed price using an upstream pricing catalog. Models you have priced manually are never affected.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isBusy}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <>
              <AutoPricingStatusPanel
                isLoading={statusQuery.isPending}
                status={statusQuery.data?.data}
                isSyncing={syncMutation.isPending}
                onSync={() => syncMutation.mutate()}
              />

              <FormField
                control={form.control}
                name='fuzzyMatchEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Enable fuzzy model matching')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Allow a model to be priced by a closely related catalog entry, such as another release date of the same model. Turn this off to require an exact catalog match.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isBusy}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              <FormField
                control={form.control}
                name='remoteUrl'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Pricing catalog URL')}</FormLabel>
                    <FormControl>
                      <Input type='url' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'A LiteLLM format pricing document. Use a mirror if the default host is unreachable.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='modelsDevUrl'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('models.dev pricing URL')}</FormLabel>
                    <FormControl>
                      <Input type='url' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Secondary pricing source used to fill models missing from LiteLLM.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='hashUrl'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Checksum URL (optional)')}</FormLabel>
                      <FormControl>
                        <Input type='url' {...field} />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Checksum file published next to the catalog. Used to detect changes on mirrors that do not send an ETag.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='checkIntervalMinutes'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Check interval (minutes)')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={5} max={10080} {...field} />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'How often to check for a new catalog. The document is downloaded only when it changed.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}

function AutoPricingStatusPanel(props: {
  isLoading: boolean
  status?: {
    loaded: boolean
    model_count: number
    skipped_count: number
    updated_at?: string
    last_error?: string
    state?: string
    primary_model_count?: number
    secondary_model_count?: number
    secondary_supplement_count?: number
    sources?: Array<{
      name: string
      url: string
      hash_url?: string
      model_count: number
      state: string
      version?: string
      updated_at?: string
      last_sync_at?: string
      last_error?: string
    }>
  }
  isSyncing: boolean
  onSync: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className='flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4'>
      <div className='space-y-1 text-sm'>
        <p className='font-medium'>{t('Catalog status')}</p>
        <p className='text-muted-foreground'>
          <AutoPricingStatusText
            isLoading={props.isLoading}
            status={props.status}
          />
        </p>
        {props.status?.last_error ? (
          <p className='text-destructive'>
            {t('Last sync failed: {{error}}', {
              error: props.status.last_error,
            })}
          </p>
        ) : null}
        {/*
          props.status?.sources?.map((source) => (
            <p key={source.name} className="text-muted-foreground">
              {source.name}: {source.model_count} models ({source.state})
              {source.version ? ` · ${source.version.slice(0, 16)}` : ""}
              {source.last_error ? ` · ${source.last_error}` : ""}
            </p>
          ))}
        */}
        {props.status?.sources?.map((source) => (
          <div
            key={`${source.name}-details`}
            className='text-muted-foreground space-y-0.5'
          >
            <p>
              <span className='font-medium'>{source.name}</span>:{' '}
              {t('{{count}} models', { count: source.model_count })} (
              {source.state})
            </p>
            <p className='break-all'>
              {t('Source URL: {{url}}', { url: source.url })}
            </p>
            {source.hash_url ? (
              <p className='break-all'>
                {t('Checksum URL: {{url}}', { url: source.hash_url })}
              </p>
            ) : null}
            {source.version ? (
              <p className='break-all'>
                {t('Version/hash: {{version}}', { version: source.version })}
              </p>
            ) : null}
            {source.updated_at ? (
              <p>
                {t('Updated: {{time}}', {
                  time: new Date(source.updated_at).toLocaleString(),
                })}
              </p>
            ) : null}
            {source.last_sync_at ? (
              <p>
                {t('Last checked: {{time}}', {
                  time: new Date(source.last_sync_at).toLocaleString(),
                })}
              </p>
            ) : null}
            {source.last_error ? (
              <p className='text-destructive'>{source.last_error}</p>
            ) : null}
          </div>
        ))}
        {props.status?.secondary_supplement_count !== undefined ? (
          <p className='text-muted-foreground'>
            {t(
              'Merged catalog: {{count}} models; models.dev supplements: {{supplements}}',
              {
                count: props.status.model_count,
                supplements: props.status.secondary_supplement_count,
              }
            )}
          </p>
        ) : null}
      </div>
      <Button
        type='button'
        variant='outline'
        onClick={props.onSync}
        disabled={props.isSyncing}
      >
        {props.isSyncing ? t('Syncing...') : t('Sync now')}
      </Button>
    </div>
  )
}

function AutoPricingStatusText(props: {
  isLoading: boolean
  status?: {
    loaded: boolean
    model_count: number
    updated_at?: string
    state?: string
  }
}) {
  const { t } = useTranslation()

  if (props.isLoading) {
    return <>{t('Loading...')}</>
  }
  if (!props.status?.loaded) {
    return <>{t('No pricing catalog loaded yet')}</>
  }
  if (props.status.state) {
    return (
      <>
        {t('Catalog state: {{state}}; {{modelCount}} models', {
          state: props.status.state,
          modelCount: props.status.model_count,
        })}
      </>
    )
  }
  if (!props.status.updated_at) {
    return (
      <>
        {t('Catalog prices {{modelCount}} models', {
          modelCount: props.status.model_count,
        })}
      </>
    )
  }
  return (
    <>
      {t('Catalog prices {{modelCount}} models, updated {{time}}', {
        modelCount: props.status.model_count,
        time: new Date(props.status.updated_at).toLocaleString(),
      })}
    </>
  )
}
