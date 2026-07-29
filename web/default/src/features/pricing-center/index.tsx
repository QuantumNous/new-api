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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LockKeyhole, Scale, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
} from '@/features/system-settings/models/model-pricing-sheet'
import { UpstreamRatioSync } from '@/features/system-settings/models/upstream-ratio-sync'
import { cn } from '@/lib/utils'

import {
  bulkPutPricingModels,
  getPricingModels,
  pricingCenterQueryKey,
  putPricingModel,
} from './api'
import {
  editorToPricing,
  filterPricingModels,
  mergeReferenceResolution,
  pricingRecordToEditor,
  recordsToLegacyMaps,
  resolveSelectedModelName,
  stripLockedCompletionRatio,
  type PricingModelRecord,
  type PricingStatusFilter,
} from './model-pricing-domain'

export function PricingCenter(props: { initialModelFilter?: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const editorRef = useRef<ModelPricingEditorPanelHandle>(null)
  const [referenceOpen, setReferenceOpen] = useState(false)
  const [search, setSearch] = useState(props.initialModelFilter ?? '')
  const [statusFilter, setStatusFilter] = useState<PricingStatusFilter>('all')
  const [selectedName, setSelectedName] = useState<string | null>(
    props.initialModelFilter ?? null
  )
  const [unsetConfirmOpen, setUnsetConfirmOpen] = useState(false)
  const preferredNameRef = useRef(props.initialModelFilter ?? null)

  const query = useQuery({
    queryKey: pricingCenterQueryKey,
    queryFn: getPricingModels,
  })

  const models = useMemo(() => query.data?.models ?? [], [query.data?.models])
  const summary = useMemo(
    () =>
      query.data?.summary ?? {
        total: models.length,
        configured: models.filter((model) => model.configured).length,
        unconfigured: models.filter((model) => !model.configured).length,
      },
    [models, query.data?.summary]
  )

  const filteredModels = useMemo(
    () => filterPricingModels(models, { search, status: statusFilter }),
    [models, search, statusFilter]
  )

  useEffect(() => {
    const next = resolveSelectedModelName(
      filteredModels,
      selectedName,
      preferredNameRef.current
    )
    if (next !== selectedName) setSelectedName(next)
  }, [filteredModels, selectedName])

  const selectedModel = useMemo(
    () => models.find((model) => model.model_name === selectedName) ?? null,
    [models, selectedName]
  )

  const editData = useMemo(
    () => (selectedModel ? pricingRecordToEditor(selectedModel) : null),
    [selectedModel]
  )

  const maps = useMemo(() => recordsToLegacyMaps(models), [models])
  const field = (name: string) => maps[name] ?? '{}'

  const preparePricing = (
    modelName: string,
    pricing: ReturnType<typeof editorToPricing>
  ) => {
    const locked =
      models.find((model) => model.model_name === modelName)
        ?.completion_ratio_locked ?? false
    return stripLockedCompletionRatio(pricing, locked)
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
    onSuccess: async () => {
      toast.success(t('Model pricing saved'))
      await queryClient.invalidateQueries({ queryKey: pricingCenterQueryKey })
    },
    onError: refetchConflict,
  })

  const bulk = useMutation({
    mutationFn: (
      payload: Array<{
        model_name: string
        pricing: ReturnType<typeof editorToPricing>
      }>
    ) => bulkPutPricingModels(query.data?.revision ?? 0, payload),
    onSuccess: async () => {
      toast.success(t('Reference prices applied'))
      await queryClient.invalidateQueries({ queryKey: pricingCenterQueryKey })
    },
    onError: refetchConflict,
  })

  const isBusy = save.isPending || bulk.isPending

  const handleSelect = (name: string) => {
    preferredNameRef.current = name
    setSelectedName(name)
  }

  const handleSave = async () => {
    if (!selectedModel || !editorRef.current) return
    const data = await editorRef.current.commitDraft()
    if (!data) return
    preferredNameRef.current = selectedModel.model_name
    try {
      await save.mutateAsync({
        name: selectedModel.model_name,
        pricing: preparePricing(
          selectedModel.model_name,
          editorToPricing(data)
        ),
      })
    } catch {
      // Error toast is handled in mutation onError.
    }
  }

  const handleUnset = async () => {
    if (!selectedModel) return
    preferredNameRef.current = selectedModel.model_name
    try {
      await save.mutateAsync({
        name: selectedModel.model_name,
        pricing: { mode: 'unset' },
      })
      setUnsetConfirmOpen(false)
    } catch {
      // Error toast is handled in mutation onError.
    }
  }

  const statusOptions: Array<{
    value: PricingStatusFilter
    label: string
    count: number
  }> = [
    { value: 'all', label: t('All'), count: summary.total },
    {
      value: 'configured',
      label: t('Configured'),
      count: summary.configured,
    },
    {
      value: 'unconfigured',
      label: t('Unconfigured'),
      count: summary.unconfigured,
    },
  ]

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Pricing Center')}</SectionPageLayout.Title>
      <SectionPageLayout.Breadcrumb>
        <div className='flex flex-wrap items-center gap-1.5'>
          <Badge variant='secondary'>
            {t('{{count}} total', { count: summary.total })}
          </Badge>
          <Badge variant='outline'>
            {t('{{count}} configured', { count: summary.configured })}
          </Badge>
          <Badge variant='outline'>
            {t('{{count}} unset', { count: summary.unconfigured })}
          </Badge>
        </div>
      </SectionPageLayout.Breadcrumb>
      <SectionPageLayout.Actions>
        <Button variant='outline' onClick={() => setReferenceOpen(true)}>
          <Scale data-icon='inline-start' />
          {t('Compare reference prices')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col gap-3 lg:flex-row lg:gap-4'>
          <aside className='border-border bg-card flex h-[min(40vh,22rem)] min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border lg:h-auto lg:w-[min(22rem,34%)]'>
            <div className='space-y-3 border-b p-3'>
              <div>
                <h3 className='text-sm font-medium'>{t('Models')}</h3>
                <p className='text-muted-foreground text-xs'>
                  {t('Models available on enabled channels')}
                </p>
              </div>
              <div className='relative'>
                <Search
                  className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2'
                  aria-hidden='true'
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('Search models...')}
                  className='ps-8'
                  aria-label={t('Search models...')}
                />
              </div>
              <div
                className='bg-muted/50 flex flex-wrap gap-1 rounded-lg p-1'
                role='tablist'
                aria-label={t('Price status filter')}
              >
                {statusOptions.map((option) => {
                  const active = statusFilter === option.value
                  return (
                    <button
                      key={option.value}
                      type='button'
                      role='tab'
                      aria-selected={active}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        active
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setStatusFilter(option.value)}
                    >
                      {option.label}
                      <span className='text-muted-foreground ms-1 tabular-nums'>
                        {option.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className='min-h-0 flex-1'>
              {query.isLoading && (
                <div className='space-y-2 p-3'>
                  {[
                    'sk-a',
                    'sk-b',
                    'sk-c',
                    'sk-d',
                    'sk-e',
                    'sk-f',
                    'sk-g',
                    'sk-h',
                  ].map((id) => (
                    <Skeleton key={id} className='h-10 w-full' />
                  ))}
                </div>
              )}
              {query.isError && (
                <div className='text-destructive p-4 text-sm'>
                  {t('Failed to load model pricing')}
                </div>
              )}
              {!query.isLoading && !query.isError && (
                <ModelList
                  models={filteredModels}
                  selectedName={selectedName}
                  onSelect={handleSelect}
                  emptyLabel={
                    search.trim() || statusFilter !== 'all'
                      ? t('No models match your filters')
                      : t('No channel models available')
                  }
                />
              )}
            </div>
          </aside>

          <section className='border-border bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border'>
            {!selectedModel || !editData ? (
              <Empty className='h-full border-0'>
                <EmptyHeader>
                  <EmptyTitle>{t('Select a model to edit pricing')}</EmptyTitle>
                  <EmptyDescription>
                    {t(
                      'Choose a model from the list to view and edit its price.'
                    )}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <div className='flex flex-wrap items-start justify-between gap-3 border-b p-4'>
                  <div className='min-w-0 space-y-2'>
                    <h3 className='truncate font-mono text-base font-medium'>
                      {selectedModel.model_name}
                    </h3>
                    <div className='flex flex-wrap items-center gap-1.5'>
                      <Badge
                        variant={
                          selectedModel.configured ? 'secondary' : 'outline'
                        }
                      >
                        {selectedModel.configured
                          ? t('Configured')
                          : t('Unconfigured')}
                      </Badge>
                      {selectedModel.completion_ratio_locked && (
                        <Badge variant='outline'>
                          <LockKeyhole data-icon='inline-start' />
                          {t('Output ratio locked')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {selectedModel.configured && (
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={isBusy}
                      onClick={() => setUnsetConfirmOpen(true)}
                    >
                      {t('Remove custom price')}
                    </Button>
                  )}
                </div>

                {selectedModel.completion_ratio_locked && (
                  <div className='px-4 pt-3'>
                    <Alert>
                      <LockKeyhole data-icon='inline-start' />
                      <AlertDescription>
                        {t(
                          'Output completion ratio is locked for this model and cannot be changed.'
                        )}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                <div className='min-h-0 flex-1 overflow-hidden'>
                  <ModelPricingEditorPanel
                    key={selectedModel.model_name}
                    ref={editorRef}
                    editData={editData}
                    onSave={handleSave}
                    isSaving={isBusy}
                    embedded
                    className='h-full min-h-0 rounded-none border-0'
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </SectionPageLayout.Content>

      <ConfirmDialog
        open={unsetConfirmOpen}
        onOpenChange={setUnsetConfirmOpen}
        title={t('Remove custom price')}
        desc={t(
          'This model will return to an unconfigured price. You can set a price again later.'
        )}
        confirmText={t('Remove custom price')}
        destructive
        isLoading={save.isPending}
        handleConfirm={() => {
          void handleUnset()
        }}
      />

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
              const payload = Object.entries(resolutions).flatMap(
                ([model_name, selected]) => {
                  const merged = mergeReferenceResolution(
                    models.find((model) => model.model_name === model_name)
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
              if (payload.length !== Object.keys(resolutions).length) {
                throw new Error(
                  t('Input price is required before saving dependent prices.')
                )
              }
              if (payload.length === 0) {
                throw new Error(
                  t('Input price is required before saving dependent prices.')
                )
              }
              if (selectedName) preferredNameRef.current = selectedName
              return bulk.mutateAsync(payload)
            }}
          />
        </DialogContent>
      </Dialog>
    </SectionPageLayout>
  )
}

function ModelList(props: {
  models: PricingModelRecord[]
  selectedName: string | null
  onSelect: (name: string) => void
  emptyLabel: string
}) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)

  if (props.models.length === 0) {
    return (
      <div className='text-muted-foreground p-6 text-center text-sm'>
        {props.emptyLabel}
      </div>
    )
  }

  const focusIndex = (index: number) => {
    const root = listRef.current
    if (!root) return
    const items = root.querySelectorAll<HTMLButtonElement>('[data-model-item]')
    const target = items[index]
    target?.focus()
  }

  return (
    <ScrollArea className='h-full'>
      <div
        ref={listRef}
        role='listbox'
        aria-label={t('Models')}
        className='flex flex-col gap-0.5 p-2'
      >
        {props.models.map((model, index) => {
          const selected = props.selectedName === model.model_name
          return (
            <button
              key={model.model_name}
              type='button'
              role='option'
              data-model-item
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={cn(
                'hover:bg-muted/70 focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2',
                selected && 'bg-muted'
              )}
              onClick={() => props.onSelect(model.model_name)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  const nextIndex = Math.min(index + 1, props.models.length - 1)
                  focusIndex(nextIndex)
                  const nextModel = props.models.at(nextIndex)
                  if (nextModel) props.onSelect(nextModel.model_name)
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  const nextIndex = Math.max(index - 1, 0)
                  focusIndex(nextIndex)
                  const nextModel = props.models.at(nextIndex)
                  if (nextModel) props.onSelect(nextModel.model_name)
                } else if (event.key === 'Home') {
                  event.preventDefault()
                  focusIndex(0)
                  const first = props.models.at(0)
                  if (first) props.onSelect(first.model_name)
                } else if (event.key === 'End') {
                  event.preventDefault()
                  const lastIndex = props.models.length - 1
                  focusIndex(lastIndex)
                  const last = props.models.at(lastIndex)
                  if (last) props.onSelect(last.model_name)
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  props.onSelect(model.model_name)
                }
              }}
            >
              <span className='min-w-0 flex-1 truncate font-mono text-sm'>
                {model.model_name}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase',
                  model.configured
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {model.configured ? t('Set') : t('Unset')}
              </span>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
