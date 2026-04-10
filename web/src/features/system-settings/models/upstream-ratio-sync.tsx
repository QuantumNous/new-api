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
import { UpstreamRatioSyncTable } from './upstream-ratio-sync-table'

type UpstreamRatioSyncProps = {
  modelRatios: {
    ModelPrice: string
    ModelRatio: string
    CompletionRatio: string
    CacheRatio: string
  }
}

function isOfficialChannel(channel: UpstreamChannel): boolean {
  return (
    channel.id === OFFICIAL_CHANNEL_ID ||
    channel.base_url === OFFICIAL_CHANNEL_BASE_URL ||
    channel.name === OFFICIAL_CHANNEL_NAME
  )
}

function getBillingCategory(ratioType: RatioType): 'price' | 'ratio' {
  return ratioType === 'model_price' ? 'price' : 'ratio'
}

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
  const [resolutions, setResolutions] = useState<
    Record<string, Record<RatioType, number>>
  >({})
  const [conflictItems, setConflictItems] = useState<ConflictItem[]>([])

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
        toast.error(data.message || t('Failed to fetch upstream ratios'))
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
        toast.success(t('No ratio differences found'))
      } else {
        toast.success(t('Upstream ratios fetched successfully'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to fetch upstream ratios'))
    },
  })

  const syncMutation = useMutation({
    mutationFn: async (updates: Array<{ key: string; value: string }>) => {
      for (const update of updates) {
        await updateSystemOption(update)
      }
    },
    onSuccess: () => {
      toast.success(t('Ratios synced successfully'))
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
      setConflictDialogOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to sync ratios'))
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

    fetchMutation.mutate({
      upstreams,
      timeout: 10,
    })
  }

  const handleSelectValue = useCallback(
    (model: string, ratioType: RatioType, value: number) => {
      const category = getBillingCategory(ratioType)

      setResolutions((prev) => {
        const newModelRes = { ...(prev[model] || {}) }

        Object.keys(newModelRes).forEach((rt) => {
          if (getBillingCategory(rt as RatioType) !== category) {
            delete newModelRes[rt as RatioType]
          }
        })

        newModelRes[ratioType] = value

        return {
          ...prev,
          [model]: newModelRes,
        }
      })
    },
    []
  )

  const handleUnselectValue = useCallback(
    (model: string, ratioType: RatioType) => {
      setResolutions((prev) => {
        const newRes = { ...prev }
        if (newRes[model]) {
          delete newRes[model][ratioType]
          if (Object.keys(newRes[model]).length === 0) {
            delete newRes[model]
          }
        }
        return newRes
      })
    },
    []
  )

  const findSourceChannel = (
    model: string,
    ratioType: RatioType,
    value: number
  ): string => {
    if (differences[model]?.[ratioType]) {
      const upMap = differences[model][ratioType].upstreams
      const entry = Object.entries(upMap).find(([_, v]) => v === value)
      if (entry) return entry[0]
    }
    return 'Unknown'
  }

  const handleApplySync = () => {
    const currentRatios = {
      ModelRatio: JSON.parse(modelRatios.ModelRatio || '{}'),
      CompletionRatio: JSON.parse(modelRatios.CompletionRatio || '{}'),
      CacheRatio: JSON.parse(modelRatios.CacheRatio || '{}'),
      ModelPrice: JSON.parse(modelRatios.ModelPrice || '{}'),
    }

    const conflicts: ConflictItem[] = []

    const getLocalBillingCategory = (
      model: string
    ): 'price' | 'ratio' | null => {
      if (currentRatios.ModelPrice[model] !== undefined) return 'price'
      if (
        currentRatios.ModelRatio[model] !== undefined ||
        currentRatios.CompletionRatio[model] !== undefined ||
        currentRatios.CacheRatio[model] !== undefined
      )
        return 'ratio'
      return null
    }

    Object.entries(resolutions).forEach(([model, ratios]) => {
      const localCat = getLocalBillingCategory(model)
      const newCat = 'model_price' in ratios ? 'price' : 'ratio'

      if (localCat && localCat !== newCat) {
        const currentDesc =
          localCat === 'price'
            ? `Fixed Price: ${currentRatios.ModelPrice[model]}`
            : `Model Ratio: ${currentRatios.ModelRatio[model] ?? '-'}\nCompletion Ratio: ${currentRatios.CompletionRatio[model] ?? '-'}`

        let newDesc = ''
        if (newCat === 'price') {
          newDesc = `Fixed Price: ${ratios.model_price}`
        } else {
          const newModelRatio = ratios.model_ratio ?? '-'
          const newCompRatio = ratios.completion_ratio ?? '-'
          newDesc = `Model Ratio: ${newModelRatio}\nCompletion Ratio: ${newCompRatio}`
        }

        const channelNames = Object.entries(ratios)
          .map(([rt, val]) => findSourceChannel(model, rt as RatioType, val))
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

    performSync(currentRatios)
  }

  const performSync = (currentRatios: {
    ModelRatio: Record<string, number>
    CompletionRatio: Record<string, number>
    CacheRatio: Record<string, number>
    ModelPrice: Record<string, number>
  }) => {
    const finalRatios = {
      ModelRatio: { ...currentRatios.ModelRatio },
      CompletionRatio: { ...currentRatios.CompletionRatio },
      CacheRatio: { ...currentRatios.CacheRatio },
      ModelPrice: { ...currentRatios.ModelPrice },
    }

    Object.entries(resolutions).forEach(([model, ratios]) => {
      const selectedTypes = Object.keys(ratios)
      const hasPrice = selectedTypes.includes('model_price')
      const hasRatio = selectedTypes.some((rt) => rt !== 'model_price')

      if (hasPrice) {
        delete finalRatios.ModelRatio[model]
        delete finalRatios.CompletionRatio[model]
        delete finalRatios.CacheRatio[model]
      }
      if (hasRatio) {
        delete finalRatios.ModelPrice[model]
      }

      Object.entries(ratios).forEach(([ratioType, value]) => {
        const optionKey = ratioType
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join('') as keyof typeof finalRatios

        finalRatios[optionKey][model] = value
      })
    })

    const updates = Object.entries(finalRatios).map(([key, value]) => ({
      key,
      value: JSON.stringify(value, null, 2),
    }))

    syncMutation.mutate(updates)
  }

  const handleConfirmConflict = () => {
    const currentRatios = {
      ModelRatio: JSON.parse(modelRatios.ModelRatio || '{}'),
      CompletionRatio: JSON.parse(modelRatios.CompletionRatio || '{}'),
      CacheRatio: JSON.parse(modelRatios.CacheRatio || '{}'),
      ModelPrice: JSON.parse(modelRatios.ModelPrice || '{}'),
    }
    performSync(currentRatios)
  }

  const hasSelections = Object.keys(resolutions).length > 0

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button
            onClick={handleOpenChannelDialog}
            disabled={fetchMutation.isPending}
          >
            <RefreshCcw className='mr-2 h-4 w-4' />
            {t('Select Sync Channels')}
          </Button>
          <Button
            variant='secondary'
            onClick={handleApplySync}
            disabled={!hasSelections || syncMutation.isPending}
          >
            <CheckSquare className='mr-2 h-4 w-4' />
            {t('Apply Sync')}
          </Button>
        </div>
      </div>

      {fetchMutation.isPending && (
        <div className='flex h-64 items-center justify-center rounded-md border'>
          <div className='text-center'>
            <p className='text-muted-foreground text-sm'>
              {t('Fetching upstream ratios...')}
            </p>
          </div>
        </div>
      )}

      {!fetchMutation.isPending && (
        <UpstreamRatioSyncTable
          differences={differences}
          resolutions={resolutions}
          onSelectValue={handleSelectValue}
          onUnselectValue={handleUnselectValue}
        />
      )}

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
        isLoading={syncMutation.isPending}
      />
    </div>
  )
}
