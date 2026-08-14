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
import axios from 'axios'
import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { Textarea } from '@/components/ui/textarea'

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
import {
  autoPricingFormSchema,
  parseAllowedHosts,
  type AutoPricingDefaults,
  type AutoPricingFormValues,
} from './auto-pricing-form'
import { AutoPricingReviewList } from './auto-pricing-review-list'
import { AutoPricingStatusPanel } from './auto-pricing-status-panel'

const AUTO_PRICING_STATUS_KEY = ['system-settings', 'auto-pricing-status']
const AUTO_PRICING_PENDING_KEY = ['system-settings', 'auto-pricing-pending']

export type { AutoPricingDefaults }

type ReviewSubmission = {
  models: string[]
  action: 'approve' | 'reject'
  revision: string
}

export function AutoPricingSection(props: {
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
      void refreshAutoPricingQueries(queryClient)
    },
    onError: (error) =>
      toast.error(
        requestErrorMessage(error) ?? t('Failed to sync pricing catalog')
      ),
  })

  const reviewMutation = useMutation({
    mutationFn: (submission: ReviewSubmission) =>
      reviewAutoPricing(
        { models: submission.models, action: submission.action },
        submission.revision
      ),
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message ?? t('Failed to review pricing changes'))
        return
      }
      toast.success(t('Pricing review saved'))
      setSelectedModels([])
      void refreshAutoPricingQueries(queryClient)
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error(t('Pricing review queue changed. Refresh and try again.'))
        setSelectedModels([])
        void refreshAutoPricingQueries(queryClient)
        return
      }
      toast.error(
        requestErrorMessage(error) ?? t('Failed to review pricing changes')
      )
    },
  })

  const form = useForm<AutoPricingFormValues>({
    resolver: zodResolver(
      autoPricingFormSchema
    ) as unknown as Resolver<AutoPricingFormValues>,
    defaultValues: {
      enabled: props.defaultValues.enabled,
      remoteUrl: props.defaultValues.remoteUrl,
      hashUrl: props.defaultValues.hashUrl,
      allowedHosts: props.defaultValues.allowedHosts.join('\n'),
      proxyUrl: props.defaultValues.proxyUrl,
      allowDirectOnProxyFailure: props.defaultValues.allowDirectOnProxyFailure,
      checkIntervalMinutes: props.defaultValues.checkIntervalMinutes,
      fuzzyMatchEnabled: props.defaultValues.fuzzyMatchEnabled,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const isBusy =
    updateOption.isPending ||
    isSubmitting ||
    syncMutation.isPending ||
    reviewMutation.isPending
  const reviewRevision =
    pendingQuery.data?.revision ?? statusQuery.data?.data.revision ?? ''

  async function onSubmit(values: AutoPricingFormValues) {
    const updates: Array<{ key: string; value: string }> = []
    const nextAllowedHosts = parseAllowedHosts(values.allowedHosts)

    if (values.enabled !== props.defaultValues.enabled) {
      updates.push({
        key: 'auto_pricing.enabled',
        value: String(values.enabled),
      })
    }
    if (values.remoteUrl !== props.defaultValues.remoteUrl) {
      updates.push({ key: 'auto_pricing.remote_url', value: values.remoteUrl })
    }
    if (values.hashUrl !== props.defaultValues.hashUrl) {
      updates.push({ key: 'auto_pricing.hash_url', value: values.hashUrl })
    }
    if (!sameStringArray(nextAllowedHosts, props.defaultValues.allowedHosts)) {
      updates.push({
        key: 'auto_pricing.allowed_hosts',
        value: JSON.stringify(nextAllowedHosts),
      })
    }
    if (values.proxyUrl !== props.defaultValues.proxyUrl) {
      updates.push({ key: 'auto_pricing.proxy_url', value: values.proxyUrl })
    }
    if (
      values.allowDirectOnProxyFailure !==
      props.defaultValues.allowDirectOnProxyFailure
    ) {
      updates.push({
        key: 'auto_pricing.allow_direct_on_proxy_failure',
        value: String(values.allowDirectOnProxyFailure),
      })
    }
    if (
      values.checkIntervalMinutes !== props.defaultValues.checkIntervalMinutes
    ) {
      updates.push({
        key: 'auto_pricing.check_interval_minutes',
        value: String(values.checkIntervalMinutes),
      })
    }
    if (values.fuzzyMatchEnabled !== props.defaultValues.fuzzyMatchEnabled) {
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

    form.reset({
      ...values,
      allowedHosts: nextAllowedHosts.join('\n'),
    })
    void queryClient.invalidateQueries({ queryKey: AUTO_PRICING_STATUS_KEY })
  }

  function submitReview(action: 'approve' | 'reject') {
    if (!reviewRevision) {
      toast.error(t('Pricing review queue changed. Refresh and try again.'))
      void refreshAutoPricingQueries(queryClient)
      return
    }
    reviewMutation.mutate({
      models: selectedModels,
      action,
      revision: reviewRevision,
    })
  }

  return (
    <SettingsSection title={t('Automatic Model Pricing')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={isBusy}
            isSaveDisabled={!isDirty || isBusy}
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

          {enabled ? (
            <>
              <AutoPricingStatusPanel
                isLoading={statusQuery.isPending}
                error={requestErrorMessage(statusQuery.error)}
                status={statusQuery.data?.data}
                isSyncing={syncMutation.isPending || reviewMutation.isPending}
                onSync={() => syncMutation.mutate()}
              />

              <AutoPricingReviewList
                items={pendingQuery.data?.data ?? []}
                isLoading={pendingQuery.isPending}
                error={requestErrorMessage(pendingQuery.error)}
                selectedModels={selectedModels}
                onSelectionChange={setSelectedModels}
                isReviewing={
                  reviewMutation.isPending ||
                  syncMutation.isPending ||
                  !reviewRevision
                }
                onReview={submitReview}
              />

              <FormField
                control={form.control}
                name='fuzzyMatchEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>
                        {t('Enable compatible model matching')}
                      </FormLabel>
                      <FormDescription>
                        {t(
                          'Allow explicit provider paths and deterministic release-date variants to use the same catalog entry.'
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
                      <Input type='url' {...field} disabled={isBusy} />
                    </FormControl>
                    <FormDescription>
                      {t('The primary Wei-Shaw mirror URL. HTTPS is required.')}
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
                        <Input type='url' {...field} disabled={isBusy} />
                      </FormControl>
                      <FormDescription>
                        {t('SHA256 checksum published next to the catalog.')}
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
                        <Input
                          type='number'
                          min={5}
                          max={10080}
                          {...field}
                          disabled={isBusy}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('How often to check source versions for changes.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='allowedHosts'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Allowed pricing hosts')}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} disabled={isBusy} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'HTTPS host names allowed for the configurable catalog and checksum URLs, separated by commas or new lines.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='proxyUrl'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Pricing proxy URL (optional)')}</FormLabel>
                    <FormControl>
                      <Input type='url' {...field} disabled={isBusy} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'HTTP, HTTPS, SOCKS5, and SOCKS5H proxies are supported.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='allowDirectOnProxyFailure'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>
                        {t('Allow direct connection when proxy setup fails')}
                      </FormLabel>
                      <FormDescription>
                        {t(
                          'Disabled by default so an invalid proxy cannot silently bypass the configured route.'
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
            </>
          ) : null}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}

function refreshAutoPricingQueries(
  queryClient: ReturnType<typeof useQueryClient>
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: AUTO_PRICING_STATUS_KEY }),
    queryClient.invalidateQueries({ queryKey: AUTO_PRICING_PENDING_KEY }),
  ]).then(() => undefined)
}

function requestErrorMessage(error: unknown): string | undefined {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message
  }
  return error instanceof Error ? error.message : undefined
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}
