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
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Play,
  Plus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  createPricingSyncTask,
  getUpstreamChannels,
  listSystemTasks,
} from '../api'
import { getOptionValue, useSystemOptions } from '../hooks/use-system-options'
import { useUpdateOption } from '../hooks/use-update-option'
import type { SystemTask, UpstreamChannel } from '../types'
import { ChannelSelectorDialog } from './channel-selector-dialog'
import {
  DEFAULT_ENDPOINT,
  MODELS_DEV_PRESET_ENDPOINT,
  MODELS_DEV_PRESET_ID,
  MODELS_DEV_PRESET_NAME,
  OFFICIAL_CHANNEL_ENDPOINT,
  OFFICIAL_CHANNEL_ID,
  OFFICIAL_CHANNEL_NAME,
  OPENROUTER_CHANNEL_TYPE,
  OPENROUTER_ENDPOINT,
} from './constants'
import { getSyncFieldLabel } from './upstream-ratio-sync-helpers'

// Mirrors pricingSyncNumericFieldOrder in controller/ratio_sync_task.go: the
// fields the scheduled sync may write. billing_mode/billing_expr are excluded
// on purpose — the backend never flips billing categories automatically.
const AUTO_SYNC_FIELDS = [
  'model_ratio',
  'completion_ratio',
  'cache_ratio',
  'create_cache_ratio',
  'image_ratio',
  'audio_ratio',
  'audio_completion_ratio',
  'model_price',
] as const

const AUTO_SYNC_DEFAULTS = {
  'ratio_sync_setting.enabled': false,
  'ratio_sync_setting.interval_minutes': 1440,
  'ratio_sync_setting.upstreams': '',
  'ratio_sync_setting.sync_fields': '',
  'ratio_sync_setting.model_allow_list': '',
  'ratio_sync_setting.model_block_list': '',
  'ratio_sync_setting.increase_threshold_percent': 100,
  'ratio_sync_setting.add_new_models': false,
}

type AutoSyncSettings = typeof AUTO_SYNC_DEFAULTS

type UpstreamRow = {
  id: number
  name?: string
  endpoint: string
}

const TASK_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
}

type PricingSyncTaskResult = {
  applied_count?: number
  skipped_count?: number
  skipped_reasons?: Record<string, number>
}

function getDefaultEndpointForChannel(channel: UpstreamChannel): string {
  if (channel.id === MODELS_DEV_PRESET_ID) return MODELS_DEV_PRESET_ENDPOINT
  if (channel.id === OFFICIAL_CHANNEL_ID) return OFFICIAL_CHANNEL_ENDPOINT
  if (channel.type === OPENROUTER_CHANNEL_TYPE) return OPENROUTER_ENDPOINT
  return DEFAULT_ENDPOINT
}

function parseUpstreamRows(raw: string): UpstreamRow[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is { id: number; endpoint?: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.id === 'number' &&
          entry.id !== 0
      )
      .map((entry) => ({ id: entry.id, endpoint: entry.endpoint ?? '' }))
  } catch {
    return []
  }
}

function serializeUpstreamRows(rows: UpstreamRow[]): string {
  if (rows.length === 0) return ''
  return JSON.stringify(
    rows.map((row) =>
      row.endpoint ? { id: row.id, endpoint: row.endpoint } : { id: row.id }
    )
  )
}

function parseSelectedFields(raw: string): Set<string> {
  const trimmed = raw.trim()
  if (!trimmed) return new Set(AUTO_SYNC_FIELDS)
  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) return new Set(AUTO_SYNC_FIELDS)
    const valid = parsed.filter((field): field is string =>
      AUTO_SYNC_FIELDS.includes(field as (typeof AUTO_SYNC_FIELDS)[number])
    )
    return valid.length > 0 ? new Set(valid) : new Set(AUTO_SYNC_FIELDS)
  } catch {
    return new Set(AUTO_SYNC_FIELDS)
  }
}

function serializeSelectedFields(fields: Set<string>): string {
  if (fields.size >= AUTO_SYNC_FIELDS.length) return ''
  return JSON.stringify(AUTO_SYNC_FIELDS.filter((field) => fields.has(field)))
}

export function AutoRatioSyncSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const updateOption = useUpdateOption()

  const [expanded, setExpanded] = useState(false)
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)

  const { data: optionsData } = useSystemOptions()
  const settings = useMemo(
    () => getOptionValue(optionsData?.data, AUTO_SYNC_DEFAULTS),
    [optionsData?.data]
  )

  const [enabled, setEnabled] = useState(false)
  const [intervalMinutes, setIntervalMinutes] = useState('1440')
  const [thresholdPercent, setThresholdPercent] = useState('100')
  const [addNewModels, setAddNewModels] = useState(false)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    () => new Set(AUTO_SYNC_FIELDS)
  )
  const [allowList, setAllowList] = useState('')
  const [blockList, setBlockList] = useState('')
  const [upstreamRows, setUpstreamRows] = useState<UpstreamRow[]>([])
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([])
  const [channelEndpoints, setChannelEndpoints] = useState<
    Record<number, string>
  >({})

  // Rehydrate the form whenever the stored options change (initial load or a
  // save from another tab).
  useEffect(() => {
    setEnabled(settings['ratio_sync_setting.enabled'])
    setIntervalMinutes(String(settings['ratio_sync_setting.interval_minutes']))
    setThresholdPercent(
      String(settings['ratio_sync_setting.increase_threshold_percent'])
    )
    setAddNewModels(settings['ratio_sync_setting.add_new_models'])
    setSelectedFields(
      parseSelectedFields(settings['ratio_sync_setting.sync_fields'])
    )
    setAllowList(settings['ratio_sync_setting.model_allow_list'])
    setBlockList(settings['ratio_sync_setting.model_block_list'])
    setUpstreamRows(parseUpstreamRows(settings['ratio_sync_setting.upstreams']))
  }, [settings])

  const { data: channelsData } = useQuery({
    queryKey: ['upstream-channels'],
    queryFn: getUpstreamChannels,
    enabled: channelDialogOpen,
  })
  const channels = useMemo(() => channelsData?.data ?? [], [channelsData?.data])
  const channelNameById = useMemo(() => {
    const names: Record<number, string> = {}
    for (const channel of channels) {
      names[channel.id] = channel.name
    }
    return names
  }, [channels])

  useEffect(() => {
    if (channels.length === 0) return
    setChannelEndpoints((prev) => {
      let mutated = false
      const next = { ...prev }
      for (const channel of channels) {
        if (!next[channel.id]) {
          next[channel.id] = getDefaultEndpointForChannel(channel)
          mutated = true
        }
      }
      return mutated ? next : prev
    })
  }, [channels])

  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ['system-tasks', 'pricing_sync'],
    queryFn: () => listSystemTasks(50),
    enabled: expanded,
    refetchInterval: (query) => {
      const tasks = query.state.data?.data ?? []
      const latest = tasks.find((task) => task.type === 'pricing_sync')
      return latest?.status === 'pending' || latest?.status === 'running'
        ? 5000
        : false
    },
  })
  const latestTask = useMemo(
    () =>
      (tasksData?.data ?? []).find(
        (task): task is SystemTask => task.type === 'pricing_sync'
      ),
    [tasksData?.data]
  )

  const runNowMutation = useMutation({
    mutationFn: createPricingSyncTask,
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.message || t('Failed to start pricing sync'))
        return
      }
      toast.success(t('Pricing sync task started'))
      refetchTasks()
      queryClient.invalidateQueries({ queryKey: ['system-tasks'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to start pricing sync'))
    },
  })

  const handleOpenChannelDialog = () => {
    setSelectedChannelIds(upstreamRows.map((row) => row.id))
    setChannelEndpoints((prev) => {
      const next = { ...prev }
      for (const row of upstreamRows) {
        if (row.endpoint) next[row.id] = row.endpoint
      }
      return next
    })
    setChannelDialogOpen(true)
  }

  const handleConfirmChannelSelection = (selectedIds: number[]) => {
    setUpstreamRows((prev) => {
      const kept = prev.filter((row) => selectedIds.includes(row.id))
      const existingIds = new Set(kept.map((row) => row.id))
      const added = selectedIds
        .filter((id) => !existingIds.has(id))
        .map((id) => ({
          id,
          name: channelNameById[id],
          endpoint: channelEndpoints[id] ?? '',
        }))
      return [...kept, ...added]
    })
    setChannelDialogOpen(false)
  }

  const moveUpstreamRow = (index: number, offset: -1 | 1) => {
    setUpstreamRows((prev) => {
      const target = index + offset
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const upstreamRowLabel = (row: UpstreamRow) => {
    if (row.id === OFFICIAL_CHANNEL_ID) return OFFICIAL_CHANNEL_NAME
    if (row.id === MODELS_DEV_PRESET_ID) return MODELS_DEV_PRESET_NAME
    return channelNameById[row.id] ?? row.name ?? `#${row.id}`
  }

  const handleSave = async () => {
    const interval = Number(intervalMinutes)
    if (!Number.isInteger(interval) || interval < 5) {
      toast.error(t('Sync interval must be at least 5 minutes'))
      return
    }
    const threshold = Number(thresholdPercent)
    if (Number.isNaN(threshold) || threshold < 0) {
      toast.error(t('Increase threshold must be a non-negative number'))
      return
    }
    if (selectedFields.size === 0) {
      toast.error(t('Select at least one field to sync'))
      return
    }
    if (enabled && upstreamRows.length === 0) {
      toast.error(t('Select at least one sync upstream'))
      return
    }

    const nextValues: AutoSyncSettings = {
      'ratio_sync_setting.enabled': enabled,
      'ratio_sync_setting.interval_minutes': interval,
      'ratio_sync_setting.upstreams': serializeUpstreamRows(upstreamRows),
      'ratio_sync_setting.sync_fields': serializeSelectedFields(selectedFields),
      'ratio_sync_setting.model_allow_list': allowList.trim(),
      'ratio_sync_setting.model_block_list': blockList.trim(),
      'ratio_sync_setting.increase_threshold_percent': threshold,
      'ratio_sync_setting.add_new_models': addNewModels,
    }

    const changedKeys = (
      Object.keys(nextValues) as Array<keyof AutoSyncSettings>
    ).filter((key) => nextValues[key] !== settings[key])
    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    // Options are persisted one key at a time (the option API has no batch
    // endpoint). On the first failure, stop; useUpdateOption already reported
    // the error and invalidated the system-options query, so the form re-syncs
    // to whatever was actually persisted.
    try {
      for (const key of changedKeys) {
        await updateOption.mutateAsync({ key, value: nextValues[key] })
      }
    } catch {
      /* handled by useUpdateOption */
    }
  }

  const latestTaskResult = latestTask?.result as
    | PricingSyncTaskResult
    | undefined

  return (
    <div className='shrink-0 rounded-md border'>
      <button
        type='button'
        className='flex w-full items-center justify-between gap-2 px-4 py-3 text-left'
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className='flex items-center gap-2 text-sm font-medium'>
          {expanded ? (
            <ChevronDown className='h-4 w-4' />
          ) : (
            <ChevronRight className='h-4 w-4' />
          )}
          {t('Scheduled auto sync')}
        </span>
        <span className='text-muted-foreground text-xs'>
          {settings['ratio_sync_setting.enabled']
            ? t('Enabled')
            : t('Disabled')}
        </span>
      </button>

      {expanded && (
        <div className='flex flex-col gap-4 border-t px-4 py-4'>
          <div className='grid gap-4 lg:grid-cols-3'>
            <div className='flex items-center justify-between gap-2 rounded-md border px-3 py-2'>
              <div className='flex flex-col'>
                <Label htmlFor='ratio-sync-enabled'>
                  {t('Enable scheduled sync')}
                </Label>
                <span className='text-muted-foreground text-xs'>
                  {t(
                    'Periodically fetch upstream prices and apply safe changes automatically'
                  )}
                </span>
              </div>
              <Switch
                id='ratio-sync-enabled'
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className='flex flex-col gap-1'>
              <Label>{t('Sync interval (minutes)')}</Label>
              <Input
                type='number'
                min={5}
                step={1}
                value={intervalMinutes}
                onChange={(event) => setIntervalMinutes(event.target.value)}
              />
              <span className='text-muted-foreground text-xs'>
                {t('Minimum 5 minutes')}
              </span>
            </div>

            <div className='flex flex-col gap-1'>
              <Label>{t('Price increase threshold (%)')}</Label>
              <Input
                type='number'
                min={0}
                step={1}
                value={thresholdPercent}
                onChange={(event) => setThresholdPercent(event.target.value)}
              />
              <span className='text-muted-foreground text-xs'>
                {t(
                  'Skip increases beyond this percentage; decreases always apply'
                )}
              </span>
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between'>
              <Label>{t('Sync upstreams (priority order)')}</Label>
              <Button
                variant='outline'
                size='sm'
                onClick={handleOpenChannelDialog}
              >
                <Plus className='mr-1 h-4 w-4' />
                {t('Select Sync Channels')}
              </Button>
            </div>
            {upstreamRows.length === 0 ? (
              <span className='text-muted-foreground text-xs'>
                {t('No sync upstream selected')}
              </span>
            ) : (
              <div className='flex flex-col gap-1'>
                {upstreamRows.map((row, index) => (
                  <div
                    key={row.id}
                    className='flex items-center gap-2 rounded-md border px-2 py-1'
                  >
                    <span className='text-muted-foreground w-6 shrink-0 text-center text-xs'>
                      {index + 1}
                    </span>
                    <span className='min-w-0 flex-1 truncate text-sm'>
                      {upstreamRowLabel(row)}
                    </span>
                    <Input
                      className='h-8 w-64'
                      placeholder={DEFAULT_ENDPOINT}
                      value={row.endpoint}
                      onChange={(event) =>
                        setUpstreamRows((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, endpoint: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      disabled={index === 0}
                      onClick={() => moveUpstreamRow(index, -1)}
                      aria-label={t('Move up')}
                    >
                      <ArrowUp className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      disabled={index === upstreamRows.length - 1}
                      onClick={() => moveUpstreamRow(index, 1)}
                      aria-label={t('Move down')}
                    >
                      <ArrowDown className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      onClick={() =>
                        setUpstreamRows((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      aria-label={t('Remove')}
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
                <span className='text-muted-foreground text-xs'>
                  {t(
                    'When upstreams disagree on a value, the first one providing it wins'
                  )}
                </span>
              </div>
            )}
          </div>

          <div className='flex flex-col gap-2'>
            <Label>{t('Fields to sync')}</Label>
            <div className='flex flex-wrap gap-x-4 gap-y-2'>
              {AUTO_SYNC_FIELDS.map((field) => (
                <label
                  key={field}
                  className='flex items-center gap-1.5 text-sm'
                >
                  <Checkbox
                    checked={selectedFields.has(field)}
                    onCheckedChange={(checked) =>
                      setSelectedFields((prev) => {
                        const next = new Set(prev)
                        if (checked) {
                          next.add(field)
                        } else {
                          next.delete(field)
                        }
                        return next
                      })
                    }
                  />
                  {getSyncFieldLabel(field, t)}
                </label>
              ))}
            </div>
          </div>

          <div className='grid gap-4 lg:grid-cols-2'>
            <div className='flex flex-col gap-1'>
              <Label>{t('Model allow list')}</Label>
              <Textarea
                rows={4}
                placeholder={t('one model name per line; empty = all models')}
                value={allowList}
                onChange={(event) => setAllowList(event.target.value)}
              />
            </div>
            <div className='flex flex-col gap-1'>
              <Label>{t('Model block list')}</Label>
              <Textarea
                rows={4}
                placeholder={t('one model name per line')}
                value={blockList}
                onChange={(event) => setBlockList(event.target.value)}
              />
            </div>
          </div>

          <div className='flex items-center justify-between gap-2 rounded-md border px-3 py-2'>
            <div className='flex flex-col'>
              <Label htmlFor='ratio-sync-add-new-models'>
                {t('Add new models')}
              </Label>
              <span className='text-muted-foreground text-xs'>
                {t(
                  'Allow the sync to add models that do not exist locally yet'
                )}
              </span>
            </div>
            <Switch
              id='ratio-sync-add-new-models'
              checked={addNewModels}
              onCheckedChange={setAddNewModels}
            />
          </div>

          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-2'>
              <Button onClick={handleSave} disabled={updateOption.isPending}>
                {t('Save')}
              </Button>
              <Button
                variant='secondary'
                onClick={() => runNowMutation.mutate()}
                disabled={runNowMutation.isPending}
              >
                <Play className='mr-1 h-4 w-4' />
                {t('Run now')}
              </Button>
            </div>
            {latestTask && (
              <span className='text-muted-foreground text-xs'>
                {t('Last run')}: {t(TASK_STATUS_LABEL[latestTask.status])}
                {' · '}
                {new Date(latestTask.updated_at * 1000).toLocaleString()}
                {latestTaskResult?.applied_count !== undefined && (
                  <>
                    {' · '}
                    {t('{{applied}} applied, {{skipped}} skipped', {
                      applied: latestTaskResult.applied_count,
                      skipped: latestTaskResult.skipped_count ?? 0,
                    })}
                  </>
                )}
                {latestTask.status === 'failed' && latestTask.error && (
                  <> · {latestTask.error}</>
                )}
              </span>
            )}
          </div>
        </div>
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
    </div>
  )
}
