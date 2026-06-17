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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Info, Plus, Search } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { ModelPricingSheet, type ModelRatioData } from './model-pricing-sheet'
import { hasValue } from './model-pricing-core'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModel, setSelectedModel] = useState<ModelRatioData | null>(
    null
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const editorRef = useRef<{ commitDraft: () => Promise<ModelRatioData | null> }>(
    null
  )

  const { data: enabledModels = [], isLoading, error } = useQuery({
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
      setSheetOpen(true)
    },
    []
  )

  const updateModelRatios = useUpdateModelRatios()

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
        <Skeleton className='h-10 w-full' />
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-24 w-full' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className='space-y-4'>
        <Alert>
          <Info data-icon='inline-start' />
          <AlertDescription>
            {t(
              'This page only shows models without base pricing. After saving, configured models will be removed from this list automatically.'
            )}
          </AlertDescription>
        </Alert>

        <div className='flex items-center gap-3'>
          <div className='relative flex-1'>
            <Search
              className='text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2'
              aria-hidden
            />
            <Input
              type='search'
              placeholder={t('Search model name...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>
        </div>

        {filteredModels.length === 0 ? (
          <div className='bg-muted/20 flex min-h-[240px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center'>
            <h3 className='mb-2 text-base font-medium'>
              {searchQuery.trim()
                ? t('No matching models')
                : t('No unpriced models')}
            </h3>
            <p className='text-muted-foreground text-sm'>
              {searchQuery.trim()
                ? t('Try adjusting your search query')
                : t('All enabled models have been priced')}
            </p>
          </div>
        ) : (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {filteredModels.map((model) => (
              <UnpricedModelCard
                key={model.name}
                modelName={model.name}
                onEdit={() => handleEditModel(model.name)}
              />
            ))}
          </div>
        )}

        <div className='text-muted-foreground flex items-center justify-between text-sm'>
          <span>
            {searchQuery.trim()
              ? t('{{count}} matching models', {
                  count: filteredModels.length,
                })
              : t('{{count}} unpriced models', {
                  count: unpricedModels.length,
                })}
          </span>
        </div>
      </div>

      <ModelPricingSheet
        ref={editorRef}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editData={selectedModel}
        onSave={handleSave}
        isSaving={updateModelRatios.isPending}
      />
    </>
  )
}
