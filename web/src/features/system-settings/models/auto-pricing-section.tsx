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
import { Check, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  getAutoPricingPending,
  getAutoPricingStatus,
  reviewAutoPricing,
  syncAutoPricing,
} from '../api'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import type { AutoPricingPendingReview, AutoPricingStatus } from '../types'
import {
  autoPricingFormSchema,
  type AutoPricingDefaults,
  type AutoPricingFormValues,
} from './auto-pricing-form'

const AUTO_PRICING_STATUS_KEY = ['system-settings', 'auto-pricing-status']
const AUTO_PRICING_PENDING_KEY = ['system-settings', 'auto-pricing-pending']

export type { AutoPricingDefaults }

export function AutoPricingSection({
  defaultValues,
}: {
  defaultValues: AutoPricingDefaults
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const queryClient = useQueryClient()
  const [selectedModels, setSelectedModels] = useState<string[]>([])

  const statusQuery = useQuery({
    queryKey: AUTO_PRICING_STATUS_KEY,
    queryFn: getAutoPricingStatus,
  })

  const pendingQuery = useQuery({
    queryKey: AUTO_PRICING_PENDING_KEY,
    queryFn: getAutoPricingPending,
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
      setSelectedModels([])
      void queryClient.invalidateQueries({ queryKey: AUTO_PRICING_STATUS_KEY })
      void queryClient.invalidateQueries({ queryKey: AUTO_PRICING_PENDING_KEY })
    },
    onError: () => toast.error(t('Failed to sync pricing catalog')),
  })

  const reviewMutation = useMutation({
    mutationFn: reviewAutoPricing,
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message ?? t('Failed to review pricing changes'))
        return
      }
      toast.success(t('Pricing review saved'))
      setSelectedModels([])
      void queryClient.invalidateQueries({ queryKey: AUTO_PRICING_STATUS_KEY })
      void queryClient.invalidateQueries({ queryKey: AUTO_PRICING_PENDING_KEY })
    },
    onError: () => toast.error(t('Failed to review pricing changes')),
  })

  const form = useForm<AutoPricingFormValues>({
    resolver: zodResolver(
      autoPricingFormSchema
    ) as unknown as Resolver<AutoPricingFormValues>,
    defaultValues: {
      enabled: defaultValues.enabled,
      remoteUrl: defaultValues.remoteUrl,
      hashUrl: defaultValues.hashUrl,
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
                isSyncing={syncMutation.isPending || reviewMutation.isPending}
                onSync={() => syncMutation.mutate()}
              />

              <AutoPricingReviewList
                items={pendingQuery.data?.data ?? []}
                isLoading={pendingQuery.isPending}
                error={
                  pendingQuery.error instanceof Error
                    ? pendingQuery.error.message
                    : undefined
                }
                selectedModels={selectedModels}
                onSelectionChange={setSelectedModels}
                isReviewing={reviewMutation.isPending || syncMutation.isPending}
                onReview={(action) =>
                  reviewMutation.mutate({ models: selectedModels, action })
                }
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
  status?: AutoPricingStatus
  isSyncing: boolean
  onSync: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className='space-y-4 rounded-lg border p-4'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
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
          {props.status ? (
            <p className='text-muted-foreground'>
              {t('{{pendingCount}} pending reviews / takeover {{state}}', {
                pendingCount: props.status.pending_count,
                state: props.status.takeover_complete
                  ? t('complete')
                  : t('not complete'),
              })}
            </p>
          ) : null}
        </div>
        <Button
          type='button'
          variant='outline'
          onClick={props.onSync}
          disabled={props.isSyncing}
        >
          <RefreshCw className={props.isSyncing ? 'animate-spin' : undefined} />
          {props.isSyncing ? t('Syncing...') : t('Sync now')}
        </Button>
      </div>
      {props.status?.sources.length ? (
        <div className='grid gap-2 text-sm sm:grid-cols-2'>
          {props.status.sources.map((source) => (
            <div key={source.source} className='min-w-0 border-t pt-2'>
              <p className='font-medium'>{source.source}</p>
              <p
                className='text-muted-foreground truncate'
                title={source.version}
              >
                {source.version || t('No version reported')}
              </p>
              {source.error ? (
                <p className='text-destructive'>{source.error}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AutoPricingReviewList(props: {
  items: AutoPricingPendingReview[]
  isLoading: boolean
  error?: string
  selectedModels: string[]
  onSelectionChange: (models: string[]) => void
  isReviewing: boolean
  onReview: (action: 'approve' | 'reject') => void
}) {
  const { t } = useTranslation()
  const selected = new Set(props.selectedModels)

  function toggle(model: string, checked: boolean) {
    props.onSelectionChange(
      checked
        ? [...new Set([...props.selectedModels, model])]
        : props.selectedModels.filter((item) => item !== model)
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-medium'>{t('Pending pricing reviews')}</p>
          <p className='text-muted-foreground text-sm'>
            {props.isLoading
              ? t('Loading...')
              : t('{{count}} changes require review', {
                  count: props.items.length,
                })}
          </p>
          {props.error ? (
            <p className='text-destructive text-sm'>{props.error}</p>
          ) : null}
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            disabled={props.isReviewing || selected.size === 0}
            onClick={() => props.onReview('reject')}
          >
            <X />
            {t('Reject selected')}
          </Button>
          <Button
            type='button'
            disabled={props.isReviewing || selected.size === 0}
            onClick={() => props.onReview('approve')}
          >
            <Check />
            {t('Approve selected')}
          </Button>
        </div>
      </div>

      {props.items.map((item) => (
        <label
          key={item.fingerprint}
          className='grid cursor-pointer gap-3 rounded-lg border p-4 sm:grid-cols-[auto_minmax(0,1fr)]'
        >
          <Checkbox
            checked={selected.has(item.model)}
            onCheckedChange={(checked) => toggle(item.model, checked === true)}
            disabled={props.isReviewing}
            aria-label={t('Select {{model}}', { model: item.model })}
          />
          <div className='min-w-0 space-y-3'>
            <div>
              <p className='font-medium'>{item.model}</p>
              <p className='text-muted-foreground text-sm'>{item.reason}</p>
            </div>
            <div className='grid gap-3 text-xs lg:grid-cols-2'>
              <PricingRecord title={t('Current price')} record={item.current} />
              <PricingRecord
                title={t('Candidate price')}
                record={item.candidate}
              />
            </div>
            {item.candidate.field_sources ? (
              <p className='text-muted-foreground text-xs break-words'>
                {t('Field sources')}:{' '}
                {formatFieldSources(item.candidate.field_sources)}
              </p>
            ) : null}
          </div>
        </label>
      ))}
    </div>
  )
}

function PricingRecord(props: {
  title: string
  record?: AutoPricingPendingReview['candidate']
}) {
  return (
    <div className='bg-muted/40 min-w-0 p-3'>
      <p className='mb-2 font-medium'>{props.title}</p>
      <pre className='max-h-48 overflow-auto break-words whitespace-pre-wrap'>
        {props.record ? JSON.stringify(props.record, null, 2) : '-'}
      </pre>
    </div>
  )
}

function formatFieldSources(sources: Record<string, string>) {
  return Object.entries(sources)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([field, source]) => `${field}: ${source}`)
    .join(', ')
}

function AutoPricingStatusText(props: {
  isLoading: boolean
  status?: {
    loaded: boolean
    model_count: number
    updated_at?: string
  }
}) {
  const { t } = useTranslation()

  if (props.isLoading) {
    return <>{t('Loading...')}</>
  }
  if (!props.status?.loaded) {
    return <>{t('No pricing catalog loaded yet')}</>
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
