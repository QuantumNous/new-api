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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMediaQuery } from '@/hooks'
import { Edit, Info, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { hasValue } from './model-pricing-core'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
  ModelPricingSheet,
  type ModelRatioData,
} from './model-pricing-sheet'
import { UnpricedModelCard } from './unpriced-model-card'
import { useUpdateModelRatios } from './use-update-model-ratios'

type UnpricedModelsEditorProps = {
  modelRatios: Record<string, string>
}

type EnabledModel = {
  name: string
}

async function fetchEnabledModels(): Promise<EnabledModel[]> {
  const res = await api.get<{
    success: boolean
    message?: string
    data?: string[]
  }>('/api/channel/models_enabled')
  const response = res.data

  if (!response.success) {
    throw new Error(response.message || 'Failed to fetch enabled models')
  }

  return (response.data || []).map((name) => ({ name }))
}

function parseRatioOption(value: string): Record<string, unknown> {
  if (!value || value.trim() === '') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function UnpricedModelsEditor({
  modelRatios,
}: UnpricedModelsEditorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModel, setSelectedModel] = useState<ModelRatioData | null>(
    null
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const editorRef = useRef<ModelPricingEditorPanelHandle>(null)

  const {
    data: enabledModels = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['enabled-models'],
    queryFn: fetchEnabledModels,
    staleTime: 30_000,
    retry: 2,
  })

  useEffect(() => {
    if (error) {
      console.error('Failed to load enabled models:', error)
      toast.error(t('Failed to load enabled models'))
    }
  }, [error, t])

  const parsedRatios = useMemo(() => {
    return {
      ModelPrice: parseRatioOption(modelRatios.ModelPrice || '{}'),
      ModelRatio: parseRatioOption(modelRatios.ModelRatio || '{}'),
      CompletionRatio: parseRatioOption(modelRatios.CompletionRatio || '{}'),
      CacheRatio: parseRatioOption(modelRatios.CacheRatio || '{}'),
      CreateCacheRatio: parseRatioOption(modelRatios.CreateCacheRatio || '{}'),
      ImageRatio: parseRatioOption(modelRatios.ImageRatio || '{}'),
      AudioRatio: parseRatioOption(modelRatios.AudioRatio || '{}'),
      AudioCompletionRatio: parseRatioOption(
        modelRatios.AudioCompletionRatio || '{}'
      ),
      BillingMode: parseRatioOption(
        modelRatios['billing_setting.billing_mode'] || '{}'
      ),
      BillingExpr: parseRatioOption(
        modelRatios['billing_setting.billing_expr'] || '{}'
      ),
    }
  }, [modelRatios])

  // 过滤未定价的模型：在已启用列表中 && 未设置价格
  const unpricedModels = useMemo(() => {
    return enabledModels.filter((model) => {
      const modelName = model.name
      const fixedPrice = parsedRatios.ModelPrice[modelName]
      const inputPrice = parsedRatios.ModelRatio[modelName]
      const billingMode = parsedRatios.BillingMode[modelName]

      // 表达式计费的模型被视为已定价
      if (billingMode === 'tiered_expr') {
        return false
      }

      // 模型既没有固定价格也没有基础倍率时为未定价
      return !hasValue(fixedPrice) && !hasValue(inputPrice)
    })
  }, [enabledModels, parsedRatios])

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return unpricedModels

    const query = searchQuery.toLowerCase().trim()
    return unpricedModels.filter((model) =>
      model.name.toLowerCase().includes(query)
    )
  }, [unpricedModels, searchQuery])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setSelectedModel(null)
    setSheetOpen(false)
  }, [])

  const handleEditModel = useCallback(
    (modelName: string) => {
      const editData: ModelRatioData = {
        name: modelName,
        billingMode: 'per-token',
        price: '',
        ratio: '',
        cacheRatio: '',
        createCacheRatio: '',
        completionRatio: '',
        imageRatio: '',
        audioRatio: '',
        audioCompletionRatio: '',
      }

      setSelectedModel(editData)
      if (isMobile) {
        setSheetOpen(true)
      }
    },
    [isMobile]
  )

  const { mutateAsync: updateModelRatios, isPending: isUpdatingModelRatios } =
    useUpdateModelRatios()

  const handleSave = useCallback(async () => {
    const draft = await editorRef.current?.commitDraft()
    if (!draft) return

    await updateModelRatios(draft)

    setSheetOpen(false)
    setSelectedModel(null)
    await queryClient.invalidateQueries({ queryKey: ['system-options'] })
    toast.success(t('Model pricing saved successfully'))
  }, [queryClient, t, updateModelRatios])

  useEffect(() => {
    if (!sheetOpen) {
      setSelectedModel(null)
    }
  }, [sheetOpen])

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-12 w-full rounded-lg' />
        <div className='grid h-[clamp(720px,calc(100vh-12rem),900px)] min-h-0 gap-4 md:grid-cols-[minmax(300px,0.72fr)_minmax(520px,1.28fr)] xl:grid-cols-[minmax(320px,0.68fr)_minmax(640px,1.32fr)]'>
          <div className='rounded-xl border p-3'>
            <Skeleton className='mb-3 h-10 w-full' />
            <div className='space-y-2'>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className='h-14 w-full rounded-lg' />
              ))}
            </div>
          </div>
          <Skeleton className='hidden h-full rounded-xl md:block' />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className='flex flex-col gap-4'>
        <Alert>
          <Info data-icon='inline-start' />
          <AlertDescription>
            {t(
              'This page only shows models without base pricing. After saving, configured models will be removed from this list automatically.'
            )}
          </AlertDescription>
        </Alert>

        <div className='grid h-[clamp(720px,calc(100vh-12rem),900px)] min-h-0 gap-4 md:grid-cols-[minmax(300px,0.72fr)_minmax(520px,1.28fr)] xl:grid-cols-[minmax(320px,0.68fr)_minmax(640px,1.32fr)]'>
          <aside className='flex min-h-0 min-w-0 flex-col rounded-xl border p-3'>
            <div className='mb-3 flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <h3 className='text-foreground text-sm font-bold'>
                  {t('Unpriced models')}
                </h3>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {searchQuery.trim()
                    ? t('{{count}} matching models', {
                        count: filteredModels.length,
                      })
                    : t('{{count}} unpriced models', {
                        count: unpricedModels.length,
                      })}
                </p>
              </div>
            </div>

            <div className='relative mb-3'>
              <Search
                className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
                aria-hidden
              />
              <Input
                type='search'
                placeholder={t('Search model name...')}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className='pl-9'
              />
            </div>

            {filteredModels.length === 0 ? (
              <div className='text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center'>
                <h3 className='text-foreground mb-2 text-base font-medium'>
                  {searchQuery.trim()
                    ? t('No matching models')
                    : t('No unpriced models')}
                </h3>
                <p className='text-sm'>
                  {searchQuery.trim()
                    ? t('Try adjusting your search query')
                    : t('All enabled models have been priced')}
                </p>
              </div>
            ) : (
              <div className='hover-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
                {filteredModels.map((model) => (
                  <UnpricedModelCard
                    key={model.name}
                    modelName={model.name}
                    active={selectedModel?.name === model.name}
                    onEdit={() => handleEditModel(model.name)}
                  />
                ))}
              </div>
            )}
          </aside>

          <div className='hidden min-h-0 min-w-0 md:block'>
            {selectedModel ? (
              <ModelPricingEditorPanel
                ref={editorRef}
                editData={selectedModel}
                onSave={handleSave}
                isSaving={isUpdatingModelRatios}
                className='h-full min-h-0'
              />
            ) : (
              <div className='bg-card text-muted-foreground flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center'>
                <div className='text-foreground text-base font-medium'>
                  {t('Select a model to edit pricing')}
                </div>
                <p className='max-w-sm text-sm'>
                  {t(
                    "Update model configuration and click save when you're done."
                  )}
                </p>
                {filteredModels.length > 0 && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => handleEditModel(filteredModels[0].name)}
                  >
                    <Edit data-icon='inline-start' />
                    {t('Set price')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobile && (
        <ModelPricingSheet
          ref={editorRef}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editData={selectedModel}
          onSave={handleSave}
          isSaving={isUpdatingModelRatios}
        />
      )}
    </>
  )
}
