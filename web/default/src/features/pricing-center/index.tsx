/* Copyright (C) 2023-2026 QuantumNous */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ModelRatioVisualEditor } from '@/features/system-settings/models/model-ratio-visual-editor'
import { UpstreamRatioSync } from '@/features/system-settings/models/upstream-ratio-sync'

import {
  bulkPutPricingModels,
  getPricingModels,
  pricingCenterQueryKey,
  putPricingModel,
} from './api'
import {
  editorToPricing,
  mergeReferenceResolution,
  recordsToLegacyMaps,
} from './model-pricing-domain'

export function PricingCenter(props: { initialModelFilter?: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [referenceOpen, setReferenceOpen] = useState(false)
  const [showUnsetOnly, setShowUnsetOnly] = useState(false)
  const query = useQuery({
    queryKey: pricingCenterQueryKey,
    queryFn: getPricingModels,
  })
  const maps = useMemo(
    () => recordsToLegacyMaps(query.data?.models ?? []),
    [query.data?.models]
  )
  const modelMetadata = useMemo(
    () =>
      Object.fromEntries(
        (query.data?.models ?? []).map((model) => [
          model.model_name,
          {
            hasChannel: model.has_channel,
            configured: model.configured,
            completionRatioLocked: model.completion_ratio_locked,
          },
        ])
      ),
    [query.data?.models]
  )
  const preparePricing = (
    modelName: string,
    pricing: ReturnType<typeof editorToPricing>
  ) => {
    if (!modelMetadata[modelName]?.completionRatioLocked) return pricing
    const next = { ...pricing }
    delete next.completion_ratio
    return next
  }
  const refetchConflict = async (error: unknown) => {
    if (
      (error as { response?: { status?: number } }).response?.status === 409
    ) {
      toast.error(
        t('Pricing changed elsewhere. Latest prices have been reloaded.')
      )
      await queryClient.invalidateQueries({ queryKey: pricingCenterQueryKey })
      return
    }
    toast.error(
      (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message ?? (error as Error).message
    )
  }
  const save = useMutation({
    mutationFn: ({
      name,
      pricing,
    }: {
      name: string
      pricing: ReturnType<typeof editorToPricing>
    }) => putPricingModel(query.data?.revision ?? 0, name, pricing),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: pricingCenterQueryKey }),
    onError: refetchConflict,
  })
  const bulk = useMutation({
    mutationFn: (
      models: Array<{
        model_name: string
        pricing: ReturnType<typeof editorToPricing>
      }>
    ) => bulkPutPricingModels(query.data?.revision ?? 0, models),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: pricingCenterQueryKey }),
    onError: refetchConflict,
  })
  const field = (name: string) => maps[name] ?? '{}'
  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Pricing Center')}</SectionPageLayout.Title>
      <SectionPageLayout.Breadcrumb>
        <Badge>
          {t('{{count}} total', { count: query.data?.summary.total ?? 0 })}
        </Badge>
        <Badge variant='secondary'>
          {t('{{count}} configured', {
            count: query.data?.summary.configured ?? 0,
          })}
        </Badge>
        <Badge variant='outline'>
          {t('{{count}} unset', {
            count: query.data?.summary.unconfigured ?? 0,
          })}
        </Badge>
      </SectionPageLayout.Breadcrumb>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          onClick={() => setShowUnsetOnly((current) => !current)}
        >
          {showUnsetOnly ? t('Show all models') : t('Show unset only')}
        </Button>
        <Button onClick={() => setReferenceOpen(true)}>
          <Scale />
          {t('Compare reference prices')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        {query.isLoading && t('Loading...')}
        {query.isError && t('Failed to load model pricing')}
        {!query.isLoading && !query.isError && (
          <ModelRatioVisualEditor
            savedModelPrice={field('ModelPrice')}
            savedModelRatio={field('ModelRatio')}
            savedCacheRatio={field('CacheRatio')}
            savedCreateCacheRatio={field('CreateCacheRatio')}
            savedCompletionRatio={field('CompletionRatio')}
            savedImageRatio={field('ImageRatio')}
            savedAudioRatio={field('AudioRatio')}
            savedAudioCompletionRatio={field('AudioCompletionRatio')}
            savedBillingMode={field('billing_setting.billing_mode')}
            savedBillingExpr={field('billing_setting.billing_expr')}
            modelPrice={field('ModelPrice')}
            modelRatio={field('ModelRatio')}
            cacheRatio={field('CacheRatio')}
            createCacheRatio={field('CreateCacheRatio')}
            completionRatio={field('CompletionRatio')}
            imageRatio={field('ImageRatio')}
            audioRatio={field('AudioRatio')}
            audioCompletionRatio={field('AudioCompletionRatio')}
            billingMode={field('billing_setting.billing_mode')}
            billingExpr={field('billing_setting.billing_expr')}
            candidateModelNames={query.data?.models.map(
              (model) => model.model_name
            )}
            modelMetadata={modelMetadata}
            initialModelFilter={props.initialModelFilter}
            filterMode={showUnsetOnly ? 'unset' : 'all'}
            onChange={() => {}}
            onSave={() => {}}
            isSaving={save.isPending || bulk.isPending}
            onSaveModel={async (data) => {
              await save.mutateAsync({
                name: data.name,
                pricing: preparePricing(data.name, editorToPricing(data)),
              })
            }}
            onUnsetModel={async (name) => {
              await save.mutateAsync({ name, pricing: { mode: 'unset' } })
            }}
            onBulkCopy={async (data, names) => {
              await bulk.mutateAsync(
                names.map((model_name) => ({
                  model_name,
                  pricing: preparePricing(model_name, editorToPricing(data)),
                }))
              )
            }}
          />
        )}
      </SectionPageLayout.Content>
      <Dialog open={referenceOpen} onOpenChange={setReferenceOpen}>
        <DialogContent className='h-[90vh] max-w-[95vw]'>
          <DialogHeader>
            <DialogTitle>{t('Compare reference prices')}</DialogTitle>
          </DialogHeader>
          <UpstreamRatioSync
            modelRatios={{
              ModelPrice: field('ModelPrice'),
              ModelRatio: field('ModelRatio'),
              CompletionRatio: field('CompletionRatio'),
              CacheRatio: field('CacheRatio'),
              CreateCacheRatio: field('CreateCacheRatio'),
              ImageRatio: field('ImageRatio'),
              AudioRatio: field('AudioRatio'),
              AudioCompletionRatio: field('AudioCompletionRatio'),
              'billing_setting.billing_mode': field(
                'billing_setting.billing_mode'
              ),
              'billing_setting.billing_expr': field(
                'billing_setting.billing_expr'
              ),
            }}
            onApply={async (resolutions) => {
              const models = Object.entries(resolutions).flatMap(
                ([model_name, selected]) => {
                  const merged = mergeReferenceResolution(
                    query.data?.models.find((m) => m.model_name === model_name)
                      ?.pricing ?? { mode: 'unset' },
                    selected
                  )
                  return merged
                    ? [
                        {
                          model_name,
                          pricing: preparePricing(model_name, merged),
                        },
                      ]
                    : []
                }
              )
              if (models.length !== Object.keys(resolutions).length) {
                toast.warning(
                  t('Input price is required before saving dependent prices.')
                )
              }
              if (models.length === 0) {
                throw new Error(
                  t('Input price is required before saving dependent prices.')
                )
              }
              return bulk.mutateAsync(models)
            }}
          />
        </DialogContent>
      </Dialog>
    </SectionPageLayout>
  )
}
