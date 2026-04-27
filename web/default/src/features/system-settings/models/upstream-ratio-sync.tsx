import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, RefreshCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  fetchUpstreamRatios,
  getUpstreamChannels,
  updateSystemOption,
} from '../api'
import type {
  DifferencesMap,
  RatioType,
  UpstreamChannel,
  UpstreamConfig,
} from '../types'
import { ChannelSelectorDialog } from './channel-selector-dialog'
import {
  ConflictConfirmDialog,
  type ConflictItem,
} from './conflict-confirm-dialog'
import {
  DEFAULT_ENDPOINT,
  OFFICIAL_CHANNEL_BASE_URL,
  OFFICIAL_CHANNEL_ENDPOINT,
  OFFICIAL_CHANNEL_ID,
  OFFICIAL_CHANNEL_NAME,
} from './constants'
import {
  NUMERIC_SYNC_FIELDS,
  RATIO_SYNC_FIELDS,
  getPreferredSyncField,
  type ResolutionsMap,
} from './upstream-ratio-sync-columns'
import { UpstreamRatioSyncTable } from './upstream-ratio-sync-table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UpstreamRatioSyncProps = {
  modelRatios: {
    ModelPrice: string
    ModelRatio: string
    CompletionRatio: string
    CacheRatio: string
    CreateCacheRatio: string
    ImageRatio: string
    AudioRatio: string
    AudioCompletionRatio: string
    'billing_setting.billing_mode': string
    'billing_setting.billing_expr': string
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOfficialChannel(channel: UpstreamChannel): boolean {
  return (
    channel.id === OFFICIAL_CHANNEL_ID ||
    channel.base_url === OFFICIAL_CHANNEL_BASE_URL ||
    channel.name === OFFICIAL_CHANNEL_NAME
  )
}

function getBillingCategory(ratioType: string): 'price' | 'ratio' | 'tiered' {
  if (ratioType === 'model_price') return 'price'
  if (ratioType === 'billing_mode' || ratioType === 'billing_expr')
    return 'tiered'
  return 'ratio'
}

function optionKeyBySyncField(ratioType: string): string {
  const explicit: Record<string, string> = {
    billing_mode: 'billing_setting.billing_mode',
    billing_expr: 'billing_setting.billing_expr',
  }
  if (explicit[ratioType]) return explicit[ratioType]
  return ratioType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

function deleteResolutionField(
  res: ResolutionsMap,
  model: string,
  ratioType: string
): ResolutionsMap {
  if (!res[model]) return res
  const newModelRes = { ...res[model] }
  delete newModelRes[ratioType]
  if (ratioType === 'billing_expr') delete newModelRes['billing_mode']
  if (ratioType === 'billing_mode') delete newModelRes['billing_expr']
  const next = { ...res }
  if (Object.keys(newModelRes).length === 0) {
    delete next[model]
  } else {
    next[model] = newModelRes
  }
  return next
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpstreamRatioSync({ modelRatios }: UpstreamRatioSyncProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([])
  const [channelEndpoints, setChannelEndpoints] = useState<
    Record<number, string>
  >({})
  const [differences, setDifferences] = useState<DifferencesMap>({})
  const [resolutions, setResolutions] = useState<ResolutionsMap>({})
  const [conflictItems, setConflictItems] = useState<ConflictItem[]>([])
  const [confirmLoading, setConfirmLoading] = useState(false)

  const { data: channelsData } = useQuery({
    queryKey: ['upstream-channels'],
    queryFn: getUpstreamChannels,
    enabled: channelDialogOpen,
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const channels = channelsData?.data || []

  useEffect(() => {
    if (channels.length > 0) {
      const newEndpoints: Record<number, string> = {}
      channels.forEach((channel) => {
        if (!channelEndpoints[channel.id]) {
          newEndpoints[channel.id] = isOfficialChannel(channel)
            ? OFFICIAL_CHANNEL_ENDPOINT
            : DEFAULT_ENDPOINT
        }
      })
      if (Object.keys(newEndpoints).length > 0) {
        setChannelEndpoints((prev) => ({ ...prev, ...newEndpoints }))
      }
    }
  }, [channels, channelEndpoints])

  const fetchMutation = useMutation({
    mutationFn: fetchUpstreamRatios,
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.message || t('Failed to fetch upstream prices'))
        return
      }

      const { differences: diffs, test_results } = data.data

      const errorResults = test_results.filter((r) => r.status === 'error')
      if (errorResults.length > 0) {
        const errorMsg = errorResults
          .map((r) => `${r.name}: ${r.error}`)
          .join(', ')
        toast.warning(t('Some channels failed: {{errorMsg}}', { errorMsg }))
      }

      setDifferences(diffs)
      setResolutions({})

      if (Object.keys(diffs).length === 0) {
        toast.success(t('No price differences found'))
      } else {
        toast.success(t('Upstream prices fetched successfully'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to fetch upstream prices'))
    },
  })

  const syncMutation = useMutation({
    mutationFn: async (updates: Array<{ key: string; value: string }>) => {
      for (const update of updates) {
        await updateSystemOption(update)
      }
    },
    onSuccess: () => {
      toast.success(t('Prices synced successfully'))
      queryClient.invalidateQueries({ queryKey: ['system-options'] })

      setDifferences((prevDiffs) => {
        const newDiffs = { ...prevDiffs }
        Object.entries(resolutions).forEach(([model, ratios]) => {
          Object.keys(ratios).forEach((ratioType) => {
            if (newDiffs[model]?.[ratioType as RatioType]) {
              delete newDiffs[model][ratioType as RatioType]
              if (Object.keys(newDiffs[model]).length === 0) {
                delete newDiffs[model]
              }
            }
          })
        })
        return newDiffs
      })

      setResolutions({})
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to sync prices'))
    },
  })

  const handleOpenChannelDialog = () => {
    setChannelDialogOpen(true)
  }

  const handleConfirmChannelSelection = (selectedIds: number[]) => {
    const selectedChannels = channels.filter((ch) =>
      selectedIds.includes(ch.id)
    )

    if (selectedChannels.length === 0) {
      toast.warning(t('Please select at least one channel'))
      return
    }

    const upstreams: UpstreamConfig[] = selectedChannels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      base_url: ch.base_url,
      endpoint: channelEndpoints[ch.id] || DEFAULT_ENDPOINT,
    }))

    fetchMutation.mutate({ upstreams, timeout: 10 })
  }

  const handleSelectValue = useCallback(
    (
      model: string,
      ratioType: RatioType,
      value: number | string,
      sourceName: string
    ) => {
      const modelDiffs = differences[model]

      // Prefer billing_expr over individual ratio fields when available
      const preferredType = sourceName
        ? getPreferredSyncField(modelDiffs || {}, ratioType, sourceName)
        : ratioType
      const preferredValue =
        preferredType === ratioType
          ? value
          : (modelDiffs?.[preferredType]?.upstreams?.[sourceName] ?? value)

      const finalType = preferredType
      const finalValue = preferredValue as number | string
      const category = getBillingCategory(finalType)

      setResolutions((prev) => {
        const newModelRes = { ...(prev[model] || {}) }

        // Clear conflicting categories
        Object.keys(newModelRes).forEach((rt) => {
          if (
            category !== 'tiered' &&
            getBillingCategory(rt) !== 'tiered' &&
            getBillingCategory(rt) !== category
          ) {
            delete newModelRes[rt]
          }
        })

        newModelRes[finalType] = finalValue

        // When selecting a tiered field, auto-populate paired fields from the same source
        if (category === 'tiered' && sourceName && modelDiffs) {
          const modeVal = modelDiffs.billing_mode?.upstreams?.[sourceName]
          const exprVal = modelDiffs.billing_expr?.upstreams?.[sourceName]
          if (modeVal !== undefined && modeVal !== null && modeVal !== 'same') {
            newModelRes['billing_mode'] = modeVal
          } else if (finalType === 'billing_expr') {
            newModelRes['billing_mode'] = 'tiered_expr'
          }
          if (exprVal !== undefined && exprVal !== null && exprVal !== 'same') {
            newModelRes['billing_expr'] = exprVal
          }
        }

        return { ...prev, [model]: newModelRes }
      })
    },
    [differences]
  )

  const handleUnselectValue = useCallback(
    (model: string, ratioType: RatioType) => {
      setResolutions((prev) => deleteResolutionField(prev, model, ratioType))
    },
    []
  )

  const parsedRatios = useCallback(() => {
    return {
      ModelRatio: JSON.parse(modelRatios.ModelRatio || '{}') as Record<
        string,
        number
      >,
      CompletionRatio: JSON.parse(
        modelRatios.CompletionRatio || '{}'
      ) as Record<string, number>,
      CacheRatio: JSON.parse(modelRatios.CacheRatio || '{}') as Record<
        string,
        number
      >,
      CreateCacheRatio: JSON.parse(
        modelRatios.CreateCacheRatio || '{}'
      ) as Record<string, number>,
      ImageRatio: JSON.parse(modelRatios.ImageRatio || '{}') as Record<
        string,
        number
      >,
      AudioRatio: JSON.parse(modelRatios.AudioRatio || '{}') as Record<
        string,
        number
      >,
      AudioCompletionRatio: JSON.parse(
        modelRatios.AudioCompletionRatio || '{}'
      ) as Record<string, number>,
      ModelPrice: JSON.parse(modelRatios.ModelPrice || '{}') as Record<
        string,
        number
      >,
      'billing_setting.billing_mode': JSON.parse(
        modelRatios['billing_setting.billing_mode'] || '{}'
      ) as Record<string, string>,
      'billing_setting.billing_expr': JSON.parse(
        modelRatios['billing_setting.billing_expr'] || '{}'
      ) as Record<string, string>,
    }
  }, [modelRatios])

  const getLocalBillingCategory = (
    model: string,
    currentRatios: ReturnType<typeof parsedRatios>
  ): 'price' | 'ratio' | null => {
    if (currentRatios.ModelPrice[model] !== undefined) return 'price'
    if (
      currentRatios.ModelRatio[model] !== undefined ||
      currentRatios.CompletionRatio[model] !== undefined ||
      currentRatios.CacheRatio[model] !== undefined ||
      currentRatios.CreateCacheRatio[model] !== undefined ||
      currentRatios.ImageRatio[model] !== undefined ||
      currentRatios.AudioRatio[model] !== undefined ||
      currentRatios.AudioCompletionRatio[model] !== undefined
    )
      return 'ratio'
    return null
  }

  const performSync = useCallback(
    async (
      currentRatios: ReturnType<typeof parsedRatios>
    ): Promise<boolean> => {
      const finalRatios: Record<string, Record<string, number | string>> = {
        ModelRatio: { ...currentRatios.ModelRatio },
        CompletionRatio: { ...currentRatios.CompletionRatio },
        CacheRatio: { ...currentRatios.CacheRatio },
        CreateCacheRatio: { ...currentRatios.CreateCacheRatio },
        ImageRatio: { ...currentRatios.ImageRatio },
        AudioRatio: { ...currentRatios.AudioRatio },
        AudioCompletionRatio: { ...currentRatios.AudioCompletionRatio },
        ModelPrice: { ...currentRatios.ModelPrice },
        'billing_setting.billing_mode': {
          ...currentRatios['billing_setting.billing_mode'],
        },
        'billing_setting.billing_expr': {
          ...currentRatios['billing_setting.billing_expr'],
        },
      }

      Object.entries(resolutions).forEach(([model, ratios]) => {
        const selectedTypes = Object.keys(ratios)
        const hasPrice = selectedTypes.includes('model_price')
        const hasRatio = selectedTypes.some((rt) =>
          RATIO_SYNC_FIELDS.includes(rt as RatioType)
        )

        if (hasPrice) {
          delete finalRatios.ModelRatio[model]
          delete finalRatios.CompletionRatio[model]
          delete finalRatios.CacheRatio[model]
          delete finalRatios.CreateCacheRatio[model]
          delete finalRatios.ImageRatio[model]
          delete finalRatios.AudioRatio[model]
          delete finalRatios.AudioCompletionRatio[model]
        }
        if (hasRatio) {
          delete finalRatios.ModelPrice[model]
        }

        Object.entries(ratios).forEach(([ratioType, value]) => {
          const optionKey = optionKeyBySyncField(ratioType)
          finalRatios[optionKey][model] = NUMERIC_SYNC_FIELDS.has(ratioType)
            ? Number(value)
            : value
        })
      })

      const updates = Object.entries(finalRatios).map(([key, value]) => ({
        key,
        value: JSON.stringify(value, null, 2),
      }))

      return new Promise<boolean>((resolve) => {
        syncMutation.mutate(updates, {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        })
      })
    },
    [resolutions, syncMutation]
  )

  const findSourceChannel = (
    model: string,
    ratioType: RatioType,
    value: number | string
  ): string => {
    const upMap = differences[model]?.[ratioType]?.upstreams
    if (!upMap) return 'Unknown'
    const entry = Object.entries(upMap).find(([, v]) => v === value)
    return entry ? entry[0] : 'Unknown'
  }

  const handleApplySync = () => {
    const currentRatios = parsedRatios()
    const conflicts: ConflictItem[] = []

    Object.entries(resolutions).forEach(([model, ratios]) => {
      const localCat = getLocalBillingCategory(model, currentRatios)
      const selectedTypes = Object.keys(ratios)
      const newCat =
        'model_price' in ratios
          ? 'price'
          : RATIO_SYNC_FIELDS.some((rt) => selectedTypes.includes(rt))
            ? 'ratio'
            : 'tiered'

      if (localCat && newCat !== 'tiered' && localCat !== newCat) {
        const currentDesc =
          localCat === 'price'
            ? `Fixed Price: ${currentRatios.ModelPrice[model]}`
            : `Model Ratio: ${currentRatios.ModelRatio[model] ?? '-'}\nCompletion Ratio: ${currentRatios.CompletionRatio[model] ?? '-'}`

        const newDesc =
          newCat === 'price'
            ? `Fixed Price: ${ratios.model_price}`
            : `Model Ratio: ${ratios.model_ratio ?? '-'}\nCompletion Ratio: ${ratios.completion_ratio ?? '-'}`

        const channelNames = selectedTypes
          .map((rt) => findSourceChannel(model, rt as RatioType, ratios[rt]))
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(', ')

        conflicts.push({
          channel: channelNames,
          model,
          current: currentDesc,
          newVal: newDesc,
        })
      }
    })

    if (conflicts.length > 0) {
      setConflictItems(conflicts)
      setConflictDialogOpen(true)
      return
    }

    toast.info(t('Syncing prices, please wait...'))
    performSync(currentRatios)
  }

  const handleConfirmConflict = async () => {
    setConfirmLoading(true)
    try {
      const success = await performSync(parsedRatios())
      if (success) {
        setConflictDialogOpen(false)
      }
    } finally {
      setConfirmLoading(false)
    }
  }

  const hasSelections = Object.keys(resolutions).length > 0
  const isLoading =
    fetchMutation.isPending || syncMutation.isPending || confirmLoading

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button onClick={handleOpenChannelDialog} disabled={isLoading}>
            <RefreshCcw className='mr-2 h-4 w-4' />
            {t('Select Sync Channels')}
          </Button>
          <Button
            variant='secondary'
            onClick={handleApplySync}
            disabled={!hasSelections || isLoading}
          >
            {(syncMutation.isPending || confirmLoading) && (
              <span className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
            )}
            <CheckSquare className='mr-2 h-4 w-4' />
            {t('Apply Sync')}
          </Button>
        </div>
      </div>

      <UpstreamRatioSyncTable
        differences={differences}
        resolutions={resolutions}
        isDisabled={isLoading}
        isSyncing={fetchMutation.isPending}
        onSelectValue={handleSelectValue}
        onUnselectValue={handleUnselectValue}
      />

      <ChannelSelectorDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        channels={channels}
        selectedChannelIds={selectedChannelIds}
        onSelectedChannelIdsChange={setSelectedChannelIds}
        channelEndpoints={channelEndpoints}
        onChannelEndpointsChange={setChannelEndpoints}
        onConfirm={handleConfirmChannelSelection}
      />

      <ConflictConfirmDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        conflicts={conflictItems}
        onConfirm={handleConfirmConflict}
        isLoading={confirmLoading}
      />
    </div>
  )
}
