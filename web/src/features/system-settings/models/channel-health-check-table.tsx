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
import { Search } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table/static/static-data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  batchUpdateChannelHealthCheck,
  getChannels,
  searchChannels,
} from '@/features/channels/api'
import { CHANNEL_TYPES } from '@/features/channels/constants'
import { parseChannelOtherSettings } from '@/features/channels/lib/channel-utils'
import type {
  Channel,
  ChannelHealthCheckBatchItem,
  ChannelHealthCheckSettings,
} from '@/features/channels/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20
const HEALTH_CHECK_BATCH_LIMIT = 200
const FOLLOW = 'follow'
const FORCE_TRUE = 'true'
const FORCE_FALSE = 'false'

// Endpoint labels stay as fixed technical names (not i18n keys) so this feature
// does not introduce a large set of protocol-name translations.
const ENDPOINT_OPTIONS = [
  { value: FOLLOW, label: 'Auto detect', path: '' },
  { value: 'openai', label: 'OpenAI', path: '/v1/chat/completions' },
  {
    value: 'openai-response',
    label: 'OpenAI Responses',
    path: '/v1/responses',
  },
  {
    value: 'openai-response-compact',
    label: 'OpenAI Response Compaction',
    path: '/v1/responses/compact',
  },
  { value: 'anthropic', label: 'Anthropic', path: '/v1/messages' },
  {
    value: 'gemini',
    label: 'Gemini',
    path: '/v1beta/models/{model}:generateContent',
  },
  { value: 'jina-rerank', label: 'Jina Rerank', path: '/v1/rerank' },
  {
    value: 'image-generation',
    label: 'Image Generation',
    path: '/v1/images/generations',
  },
  { value: 'embeddings', label: 'Embeddings', path: '/v1/embeddings' },
] as const

const endpointSelectContentClass =
  'w-[min(28rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]'
const endpointSelectItemClass =
  'items-start py-2 [&_[data-slot=select-item-text]]:min-w-0 [&_[data-slot=select-item-text]]:shrink [&_[data-slot=select-item-text]]:whitespace-normal'

type TriState = typeof FOLLOW | typeof FORCE_TRUE | typeof FORCE_FALSE

type DraftRow = {
  enabled: boolean
  autoBan: boolean
  thresholdMode: TriState
  thresholdSeconds: string
  enableOnSuccess: TriState
  endpointType: string
  stream: TriState
}

export type ChannelHealthCheckTableHandle = {
  /** Returns false when validation fails or save is aborted. */
  save: () => Promise<boolean>
  validate: () => boolean
  isDirty: boolean
  isSaving: boolean
}

type ChannelHealthCheckTableProps = {
  onStateChange?: (state: {
    isDirty: boolean
    isSaving: boolean
  }) => void
}

function channelStatusLabel(status: number, t: (key: string) => string) {
  if (status === 1) return t('Enabled')
  if (status === 2) return t('Manually disabled')
  if (status === 3) return t('Auto disabled')
  return t('Unknown')
}

function channelTypeLabel(type: number) {
  return CHANNEL_TYPES[type as keyof typeof CHANNEL_TYPES] || String(type)
}

function triStateFromOptionalBool(value: boolean | undefined): TriState {
  if (value === undefined) return FOLLOW
  if (value) return FORCE_TRUE
  return FORCE_FALSE
}

function draftFromChannel(channel: Channel): DraftRow {
  const health = parseChannelOtherSettings(channel.settings).health_check
  const hasCustomThreshold =
    health?.disable_threshold_seconds !== undefined &&
    health?.disable_threshold_seconds !== null
  return {
    enabled: health?.enabled !== false,
    autoBan: (channel.auto_ban ?? 1) === 1,
    thresholdMode: hasCustomThreshold ? FORCE_TRUE : FOLLOW,
    thresholdSeconds: hasCustomThreshold
      ? String(health?.disable_threshold_seconds)
      : '',
    enableOnSuccess: triStateFromOptionalBool(health?.enable_on_success),
    endpointType: health?.endpoint_type?.trim() || FOLLOW,
    stream: triStateFromOptionalBool(health?.stream),
  }
}

function draftsEqual(a: DraftRow, b: DraftRow) {
  return (
    a.enabled === b.enabled &&
    a.autoBan === b.autoBan &&
    a.thresholdMode === b.thresholdMode &&
    a.thresholdSeconds === b.thresholdSeconds &&
    a.enableOnSuccess === b.enableOnSuccess &&
    a.endpointType === b.endpointType &&
    a.stream === b.stream
  )
}

function healthDraftsEqual(a: DraftRow, b: DraftRow) {
  return (
    a.enabled === b.enabled &&
    a.thresholdMode === b.thresholdMode &&
    a.thresholdSeconds === b.thresholdSeconds &&
    a.enableOnSuccess === b.enableOnSuccess &&
    a.endpointType === b.endpointType &&
    a.stream === b.stream
  )
}

function buildHealthCheckPayload(draft: DraftRow): ChannelHealthCheckSettings {
  const payload: ChannelHealthCheckSettings = {}
  if (!draft.enabled) {
    payload.enabled = false
  }
  if (draft.thresholdMode === FORCE_TRUE && draft.thresholdSeconds.trim()) {
    payload.disable_threshold_seconds = Number(draft.thresholdSeconds)
  }
  if (draft.enableOnSuccess === FORCE_TRUE) {
    payload.enable_on_success = true
  } else if (draft.enableOnSuccess === FORCE_FALSE) {
    payload.enable_on_success = false
  }
  if (draft.endpointType !== FOLLOW) {
    payload.endpoint_type = draft.endpointType
  }
  if (draft.stream === FORCE_TRUE) {
    payload.stream = true
  } else if (draft.stream === FORCE_FALSE) {
    payload.stream = false
  }
  return payload
}

export const ChannelHealthCheckTable = forwardRef<
  ChannelHealthCheckTableHandle,
  ChannelHealthCheckTableProps
>(function ChannelHealthCheckTable(props, ref) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [enabledFilter, setEnabledFilter] = useState('all')
  const [drafts, setDrafts] = useState<Record<number, DraftRow>>({})
  // Keep baselines across pages so dirty edits on page N remain saveable after navigating away.
  const [baselineById, setBaselineById] = useState<
    Record<number, DraftRow>
  >({})

  const queryKey = [
    'channel-health-check-table',
    page,
    keyword,
    statusFilter,
  ] as const

  const channelsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const params = {
        p: page + 1,
        page_size: PAGE_SIZE,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      }
      if (keyword.trim()) {
        return searchChannels({
          ...params,
          keyword: keyword.trim(),
        })
      }
      return getChannels(params)
    },
  })

  const channels = useMemo(
    () => channelsQuery.data?.data?.items ?? [],
    [channelsQuery.data?.data?.items]
  )
  const total = channelsQuery.data?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (channels.length === 0) return
    setBaselineById((prev) => {
      let changed = false
      const next = { ...prev }
      for (const channel of channels) {
        // Keep baselines for rows with unsaved drafts; refresh all others from
        // the latest server payload so external updates are not stuck forever.
        // Newly drafted rows still seed their baseline synchronously in updateDraft.
        if (drafts[channel.id]) continue
        const baseline = draftFromChannel(channel)
        const existing = next[channel.id]
        if (!existing || !draftsEqual(existing, baseline)) {
          next[channel.id] = baseline
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [channels, drafts])

  const visibleChannels = useMemo(() => {
    if (enabledFilter === 'all') return channels
    return channels.filter((channel) => {
      const draft =
        drafts[channel.id] ??
        baselineById[channel.id] ??
        draftFromChannel(channel)
      if (enabledFilter === 'enabled') return draft.enabled
      return !draft.enabled
    })
  }, [baselineById, channels, drafts, enabledFilter])

  const isDraftThresholdValid = (draft: DraftRow) => {
    if (draft.thresholdMode !== FORCE_TRUE) return true
    const seconds = Number(draft.thresholdSeconds)
    return (
      draft.thresholdSeconds.trim() !== '' &&
      !Number.isNaN(seconds) &&
      seconds >= 0 &&
      seconds <= 86400
    )
  }

  const invalidThresholdChannelIds = useMemo(() => {
    const ids: number[] = []
    for (const [idText, draft] of Object.entries(drafts)) {
      const id = Number(idText)
      const baseline = baselineById[id]
      if (!baseline || draftsEqual(baseline, draft)) continue
      if (!isDraftThresholdValid(draft)) {
        ids.push(id)
      }
    }
    return ids
  }, [baselineById, drafts])

  const dirtyItems = useMemo(() => {
    const items: ChannelHealthCheckBatchItem[] = []
    const channelById = new Map(channels.map((channel) => [channel.id, channel]))
    for (const [idText, draft] of Object.entries(drafts)) {
      const id = Number(idText)
      const channel = channelById.get(id)
      // Prefer stored baseline; if a draft raced ahead of the page-load effect,
      // rebuild baseline from the current channel row when available.
      const baseline =
        baselineById[id] ?? (channel ? draftFromChannel(channel) : undefined)
      if (!baseline || draftsEqual(baseline, draft)) continue
      if (!isDraftThresholdValid(draft)) continue
      const item: ChannelHealthCheckBatchItem = { id }
      if (draft.autoBan !== baseline.autoBan) {
        item.auto_ban = draft.autoBan ? 1 : 0
      }
      if (!healthDraftsEqual(baseline, draft)) {
        item.health_check = buildHealthCheckPayload(draft)
      }
      if (item.auto_ban === undefined && item.health_check === undefined) {
        continue
      }
      items.push(item)
    }
    return items
  }, [baselineById, channels, drafts])

  const isDirty = useMemo(() => {
    for (const [idText, draft] of Object.entries(drafts)) {
      const baseline = baselineById[Number(idText)]
      if (!baseline || !draftsEqual(baseline, draft)) {
        return true
      }
    }
    return false
  }, [baselineById, drafts])

  const applySucceededDrafts = async (
    succeededIds: Set<number>,
    draftsSnapshot: Record<number, DraftRow>
  ) => {
    if (succeededIds.size === 0) return

    // Advance baseline for every successfully submitted row. Only clear a draft
    // when it still matches the submitted snapshot so newer in-flight edits stay.
    setDrafts((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of succeededIds) {
        const submitted = draftsSnapshot[id]
        const current = prev[id]
        if (!submitted || !current) continue
        if (draftsEqual(current, submitted)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setBaselineById((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of succeededIds) {
        const submitted = draftsSnapshot[id]
        if (!submitted) continue
        if (!prev[id] || !draftsEqual(prev[id], submitted)) {
          next[id] = submitted
          changed = true
        }
      }
      return changed ? next : prev
    })
    await queryClient.invalidateQueries({
      queryKey: ['channel-health-check-table'],
    })
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      items: ChannelHealthCheckBatchItem[]
      draftsSnapshot: Record<number, DraftRow>
    }) => {
      const results: Array<{ id: number; success: boolean; message?: string }> =
        []
      let succeeded = 0
      let failed = 0

      // Backend rejects payloads larger than HEALTH_CHECK_BATCH_LIMIT; chunk on the client.
      // Network / 5xx errors on a later chunk must not discard earlier successes.
      for (
        let offset = 0;
        offset < payload.items.length;
        offset += HEALTH_CHECK_BATCH_LIMIT
      ) {
        const chunk = payload.items.slice(
          offset,
          offset + HEALTH_CHECK_BATCH_LIMIT
        )

        try {
          const response = await batchUpdateChannelHealthCheck(chunk)
          const chunkResults = response.data?.results ?? []

          if (chunkResults.length > 0) {
            for (const item of chunkResults) {
              results.push(item)
              if (item.success) {
                succeeded += 1
              } else {
                failed += 1
              }
            }
            continue
          }

          // Fallback when the backend returns only aggregate counts.
          if (response.success) {
            for (const item of chunk) {
              results.push({ id: item.id, success: true })
              succeeded += 1
            }
          } else {
            for (const item of chunk) {
              results.push({
                id: item.id,
                success: false,
                message:
                  response.message ||
                  t('Failed to save channel health check settings'),
              })
              failed += 1
            }
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t('Failed to save channel health check settings')
          for (const item of chunk) {
            results.push({
              id: item.id,
              success: false,
              message,
            })
            failed += 1
          }
          // Continue remaining chunks so one failed batch does not block the rest.
        }
      }

      return {
        payload,
        summary: {
          success: failed === 0,
          succeeded,
          failed,
          results,
        },
      }
    },
    onSuccess: async ({ payload, summary }) => {
      const succeededIds = new Set(
        summary.results.filter((item) => item.success).map((item) => item.id)
      )

      await applySucceededDrafts(succeededIds, payload.draftsSnapshot)

      const failed = summary.results.filter((item) => !item.success)
      if (summary.success) {
        toast.success(t('Channel health check settings saved'))
        return
      }

      if (succeededIds.size > 0 && failed.length > 0) {
        toast.error(
          t(
            'Saved {{succeeded}} channels, but {{failed}} failed: {{message}}',
            {
              succeeded: succeededIds.size,
              failed: failed.length,
              message:
                failed[0]?.message ||
                t('Failed to save channel health check settings'),
            }
          )
        )
        return
      }

      toast.error(
        failed[0]?.message || t('Failed to save channel health check settings')
      )
    },
    onError: (error: Error) => {
      // mutationFn is written to return partial summaries instead of throwing;
      // keep this path only for unexpected failures before chunking starts.
      toast.error(
        error.message || t('Failed to save channel health check settings')
      )
    },
  })

  const isSaving = saveMutation.isPending

  const onStateChange = props.onStateChange
  useEffect(() => {
    onStateChange?.({ isDirty, isSaving })
  }, [isDirty, isSaving, onStateChange])

  useImperativeHandle(
    ref,
    () => ({
      isDirty,
      isSaving,
      validate: () => {
        if (invalidThresholdChannelIds.length > 0) {
          toast.error(
            t(
              'Disable threshold must be between 0 and 86400 seconds for all edited channels'
            )
          )
          return false
        }
        return true
      },
      save: async () => {
        if (invalidThresholdChannelIds.length > 0) {
          toast.error(
            t(
              'Disable threshold must be between 0 and 86400 seconds for all edited channels'
            )
          )
          return false
        }
        if (dirtyItems.length === 0) {
          return true
        }
        try {
          const result = await saveMutation.mutateAsync({
            items: dirtyItems,
            draftsSnapshot: drafts,
          })
          // Partial success still returns false so callers know not everything saved.
          return result.summary.success
        } catch {
          return false
        }
      },
    }),
    [
      dirtyItems,
      drafts,
      invalidThresholdChannelIds,
      isDirty,
      isSaving,
      saveMutation,
      t,
    ]
  )

  const getDraft = (channel: Channel): DraftRow =>
    drafts[channel.id] ?? baselineById[channel.id] ?? draftFromChannel(channel)

  const updateDraft = (channel: Channel, patch: Partial<DraftRow>) => {
    // Ensure a stable baseline exists before the first draft is created, so a
    // race with the page-load effect cannot leave a draft without baseline and
    // silently drop it from dirtyItems.
    setBaselineById((prev) => {
      if (prev[channel.id]) return prev
      return {
        ...prev,
        [channel.id]: draftFromChannel(channel),
      }
    })
    setDrafts((prev) => {
      const current =
        prev[channel.id] ??
        baselineById[channel.id] ??
        draftFromChannel(channel)
      return {
        ...prev,
        [channel.id]: {
          ...current,
          ...patch,
        },
      }
    })
  }

  const enableOnSuccessItems = useMemo(
    () => [
      { value: FOLLOW, label: t('Follow global') },
      { value: FORCE_TRUE, label: t('Enable') },
      { value: FORCE_FALSE, label: t('Disable') },
    ],
    [t]
  )
  const streamItems = useMemo(
    () => [
      { value: FOLLOW, label: t('Auto detect') },
      { value: FORCE_TRUE, label: t('Streaming') },
      { value: FORCE_FALSE, label: t('Non-streaming') },
    ],
    [t]
  )
  const thresholdModeItems = useMemo(
    () => [
      { value: FOLLOW, label: t('Follow global') },
      { value: FORCE_TRUE, label: t('Custom') },
    ],
    [t]
  )
  const statusItems = useMemo(
    () => [
      { value: 'all', label: t('All statuses') },
      { value: 'enabled', label: t('Enabled') },
      { value: 'disabled', label: t('Disabled') },
    ],
    [t]
  )
  const enabledItems = useMemo(
    () => [
      { value: 'all', label: t('All scheduled-test states') },
      { value: 'enabled', label: t('Scheduled test enabled (this page)') },
      { value: 'disabled', label: t('Scheduled test disabled (this page)') },
    ],
    [t]
  )
  const endpointItems = useMemo(
    () =>
      ENDPOINT_OPTIONS.map((option) => ({
        value: option.value,
        label: option.path ? `${option.label} (${option.path})` : option.label,
        shortLabel:
          option.value === FOLLOW ? t('Auto detect') : option.label,
      })),
    [t]
  )

  const columns = useMemo<StaticDataTableColumn<Channel>[]>(
    () => [
      {
        id: 'channel',
        header: t('Channel'),
        cellClassName: 'min-w-[10rem]',
        cell: (channel) => {
          const draft = getDraft(channel)
          const dirty =
            !!drafts[channel.id] &&
            !draftsEqual(
              draft,
              baselineById[channel.id] ?? draftFromChannel(channel)
            )
          return (
            <div
              className={cn(
                'flex flex-col gap-0.5',
                dirty && 'font-medium'
              )}
            >
              <span>
                #{channel.id} {channel.name}
              </span>
              <span className='text-muted-foreground text-xs'>
                {channelTypeLabel(channel.type)} ·{' '}
                {channelStatusLabel(channel.status, t)}
              </span>
            </div>
          )
        },
      },
      {
        id: 'scheduled',
        header: t('Scheduled test'),
        cell: (channel) => {
          const draft = getDraft(channel)
          return (
            <Switch
              checked={draft.enabled}
              aria-label={`${t('Scheduled test')}: #${channel.id} ${channel.name}`}
              onCheckedChange={(checked) =>
                updateDraft(channel, { enabled: checked })
              }
            />
          )
        },
      },
      {
        id: 'auto_ban',
        header: t('Auto ban'),
        cell: (channel) => {
          const draft = getDraft(channel)
          return (
            <Switch
              checked={draft.autoBan}
              aria-label={`${t('Auto ban')}: #${channel.id} ${channel.name}`}
              onCheckedChange={(checked) =>
                updateDraft(channel, { autoBan: checked })
              }
            />
          )
        },
      },
      {
        id: 'threshold',
        header: t('Disable threshold'),
        cellClassName: 'min-w-[14rem]',
        cell: (channel) => {
          const draft = getDraft(channel)
          // Only mark invalid after the user entered a value, or when switching
          // to custom leaves an empty/out-of-range value that cannot be saved.
          // Empty right after selecting "Custom" is treated as incomplete, not error,
          // until save is attempted (toast) or a non-empty invalid value is typed.
          const thresholdInvalid =
            !!drafts[channel.id] &&
            draft.thresholdMode === FORCE_TRUE &&
            draft.thresholdSeconds.trim() !== '' &&
            !isDraftThresholdValid(draft)
          return (
            <div className='flex min-w-[13rem] flex-col gap-1'>
              <div className='flex items-center gap-2'>
                <Select
                  items={thresholdModeItems}
                  value={draft.thresholdMode}
                  onValueChange={(value) =>
                    updateDraft(channel, {
                      thresholdMode: (value as TriState) || FOLLOW,
                      thresholdSeconds:
                        value === FOLLOW ? '' : draft.thresholdSeconds,
                    })
                  }
                >
                  <SelectTrigger
                    className='min-w-0 flex-1'
                    aria-label={`${t('Disable threshold')}: #${channel.id} ${channel.name}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {thresholdModeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {draft.thresholdMode === FORCE_TRUE && (
                  <Input
                    type='number'
                    min={0}
                    max={86400}
                    step='any'
                    value={draft.thresholdSeconds}
                    placeholder={t('Seconds')}
                    aria-label={`${t('Disable threshold')}: #${channel.id} ${channel.name}`}
                    aria-invalid={thresholdInvalid}
                    className={cn(
                      'w-20 shrink-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                      thresholdInvalid &&
                        'border-destructive focus-visible:ring-destructive/40'
                    )}
                    onChange={(event) =>
                      updateDraft(channel, {
                        thresholdSeconds: event.target.value,
                      })
                    }
                  />
                )}
              </div>
              {thresholdInvalid && (
                <span className='text-destructive text-xs'>
                  {t('Enter 0-86400 seconds')}
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: 'enable_on_success',
        header: t('Re-enable on success'),
        cellClassName: 'min-w-[10rem]',
        cell: (channel) => {
          const draft = getDraft(channel)
          return (
            <Select
              items={enableOnSuccessItems}
              value={draft.enableOnSuccess}
              onValueChange={(value) =>
                updateDraft(channel, {
                  enableOnSuccess: (value as TriState) || FOLLOW,
                })
              }
            >
              <SelectTrigger
                aria-label={`${t('Re-enable on success')}: #${channel.id} ${channel.name}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {enableOnSuccessItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )
        },
      },
      {
        id: 'endpoint',
        header: t('Endpoint type'),
        cellClassName: 'min-w-[11rem]',
        cell: (channel) => {
          const draft = getDraft(channel)
          const selectedEndpoint =
            endpointItems.find((item) => item.value === draft.endpointType) ??
            endpointItems[0]
          return (
            <Select
              items={endpointItems}
              value={draft.endpointType}
              onValueChange={(value) =>
                updateDraft(channel, {
                  endpointType: value || FOLLOW,
                })
              }
            >
              <SelectTrigger
                className='min-w-0'
                aria-label={`${t('Endpoint type')}: #${channel.id} ${channel.name}`}
              >
                <SelectValue>{selectedEndpoint.shortLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                className={endpointSelectContentClass}
              >
                <SelectGroup>
                  {endpointItems.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className={endpointSelectItemClass}
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )
        },
      },
      {
        id: 'stream',
        header: t('Stream'),
        cellClassName: 'min-w-[10rem]',
        cell: (channel) => {
          const draft = getDraft(channel)
          return (
            <Select
              items={streamItems}
              value={draft.stream}
              onValueChange={(value) =>
                updateDraft(channel, {
                  stream: (value as TriState) || FOLLOW,
                })
              }
            >
              <SelectTrigger
                aria-label={`${t('Stream')}: #${channel.id} ${channel.name}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {streamItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )
        },
      },
    ],
    // Draft helpers close over latest drafts/baselines intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      baselineById,
      drafts,
      enableOnSuccessItems,
      endpointItems,
      streamItems,
      t,
      thresholdModeItems,
    ]
  )

  let emptyContent: string
  if (channelsQuery.isLoading) {
    emptyContent = t('Loading channels...')
  } else {
    emptyContent = t('No channels found')
  }

  return (
    <div className='flex min-w-0 flex-col gap-4'>
      <div className='flex flex-col gap-1'>
        <h4 className='text-sm font-medium'>
          {t('Channel health check settings')}
        </h4>
      </div>

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <div className='relative min-w-0 flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2' />
          <Input
            value={keyword}
            placeholder={t('Search by name or ID')}
            className='ps-8'
            onChange={(event) => {
              setPage(0)
              setKeyword(event.target.value)
            }}
          />
        </div>
        <Select
          items={statusItems}
          value={statusFilter}
          onValueChange={(value) => {
            setPage(0)
            setStatusFilter(value ?? 'all')
          }}
        >
          <SelectTrigger className='w-full sm:w-44'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={enabledItems}
          value={enabledFilter}
          onValueChange={(value) => setEnabledFilter(value ?? 'all')}
        >
          <SelectTrigger className='w-full sm:w-56'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {enabledItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <StaticDataTable
        data={visibleChannels}
        columns={columns}
        getRowKey={(channel) => channel.id}
        getRowClassName={(channel) => {
          const draft = getDraft(channel)
          const dirty =
            !!drafts[channel.id] &&
            !draftsEqual(
              draft,
              baselineById[channel.id] ?? draftFromChannel(channel)
            )
          return dirty ? 'bg-muted/40' : undefined
        }}
        empty={channelsQuery.isLoading || visibleChannels.length === 0}
        emptyContent={emptyContent}
      />

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='text-muted-foreground flex min-w-0 flex-col gap-0.5 text-sm'>
          <span>
            {t('Page {{page}} of {{totalPages}} · {{total}} channels', {
              page: page + 1,
              totalPages,
              total,
            })}
          </span>
          {enabledFilter !== 'all' && (
            <span>
              {t(
                'Scheduled-test filter applies to the current page only ({{shown}} of {{pageSize}} shown)',
                {
                  shown: visibleChannels.length,
                  pageSize: channels.length,
                }
              )}
            </span>
          )}
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={page <= 0 || channelsQuery.isFetching}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            {t('Previous')}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={page + 1 >= totalPages || channelsQuery.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      </div>
    </div>
  )
})
