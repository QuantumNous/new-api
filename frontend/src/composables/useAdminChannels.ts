import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useFeatureAccess } from '@/composables/useFeatureAccess'
import { useToast } from '@/composables/useToast'
import type {
  AdminChannel,
  AdminChannelCreateInput,
  AdminChannelFetchModelsParams,
  AdminChannelPage,
  AdminChannelSortBy,
  AdminChannelSortOrder,
  AdminChannelUpdateInput,
} from '@/types/console'

type ChannelAction = 'priority' | 'weight' | 'status' | 'balance'
type ChannelCrudAction = 'create' | 'edit' | 'delete'
type ChannelBatchScope = 'page' | 'supplier'
type ChannelBulkAction = 'delete' | 'enable' | 'disable' | 'reset'

/** Batch runs are balance-only; model testing lives in the test modal. */
interface ChannelBatchProgress {
  scope: ChannelBatchScope
  supplier?: string
  total: number
  processed: number
  succeeded: number
  failed: number
}

export interface ChannelModelTestOptions {
  endpointType?: string
  stream?: boolean
}

export interface ChannelModelTestResult {
  ok: boolean
  timeMs?: number
  message?: string
}

const CHANNEL_BATCH_SIZE = 5

export function useAdminChannels() {
  const { t } = useI18n()
  const toast = useToast()
  const { readOnly } = useFeatureAccess('admin', 'disabled')

  const rows = ref<AdminChannel[]>([])
  const total = ref(0)
  const typeCounts = ref<Record<string, number>>({})
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const type = ref('')
  const status = ref('')
  const sortBy = ref<AdminChannelSortBy>('id')
  const sortOrder = ref<AdminChannelSortOrder>('desc')
  const loading = ref(true)
  const refreshing = ref(false)
  const initialError = ref('')
  const busy = ref<Map<number, ChannelAction>>(new Map())
  const batchProgress = ref<ChannelBatchProgress | null>(null)
  const crudAction = ref<{
    action: ChannelCrudAction
    id: number | null
  } | null>(null)
  const bulkAction = ref<ChannelBulkAction | null>(null)
  const isBatchBusy = computed(() => batchProgress.value !== null)
  const isCrudBusy = computed(() => crudAction.value !== null)
  const isBulkBusy = computed(() => bulkAction.value !== null)
  const canMutate = computed(
    () =>
      !readOnly.value &&
      !loading.value &&
      !refreshing.value &&
      !isBatchBusy.value &&
      !isCrudBusy.value &&
      !isBulkBusy.value &&
      busy.value.size === 0
  )
  const canRunBatch = computed(() => rows.value.length > 0 && canMutate.value)

  let batchController: AbortController | null = null
  let crudController: AbortController | null = null
  let bulkController: AbortController | null = null
  const listRequest = useLatestRequest()
  let searchTimer = 0

  function isBusy(id: number, action: ChannelAction): boolean {
    return busy.value.get(id) === action
  }

  function isRowBusy(id: number): boolean {
    return (
      isBatchBusy.value ||
      isCrudBusy.value ||
      isBulkBusy.value ||
      busy.value.has(id)
    )
  }

  function isCrudActionBusy(action: ChannelCrudAction, id?: number): boolean {
    return (
      crudAction.value?.action === action &&
      (id === undefined || crudAction.value.id === id)
    )
  }

  function isBulkActionBusy(action: ChannelBulkAction): boolean {
    return bulkAction.value === action
  }

  function setBusy(id: number, action: ChannelAction | null) {
    const next = new Map(busy.value)
    if (action) next.set(id, action)
    else next.delete(id)
    busy.value = next
  }

  function setBatchRowsBusy(channels: AdminChannel[], busyNow: boolean) {
    const next = new Map(busy.value)
    channels.forEach((channel) => {
      if (busyNow) next.set(channel.id, 'balance')
      else next.delete(channel.id)
    })
    busy.value = next
  }

  function buildLabAudit(
    channels: AdminChannel[],
    groupSlug?: string
  ): Record<string, unknown> {
    const labs = new Set<string>()
    const models = new Set<string>()
    const sources = new Set<string>()
    let unresolvedCount = 0
    let catalogVersion = ''
    channels.forEach((channel) => {
      for (const match of channel.lab_matches ?? []) {
        labs.add(match.slug)
      }
      for (const match of channel.lab_models ?? []) {
        const model = match.canonical_id || match.real_model
        if (model) models.add(model)
        if (match.source) sources.add(match.source)
      }
      unresolvedCount += channel.lab_unresolved_count ?? 0
      if (!catalogVersion && channel.lab_catalog_version) {
        catalogVersion = channel.lab_catalog_version
      }
    })
    const matchedLabs = [...labs].sort()
    const resolvedGroupSlug =
      groupSlug ||
      (matchedLabs.length === 1
        ? matchedLabs[0]
        : matchedLabs.length > 1
          ? 'mixed'
          : 'unknown')
    const groupKind =
      resolvedGroupSlug === 'mixed'
        ? 'mixed'
        : resolvedGroupSlug === 'unknown'
          ? 'unknown'
          : 'single'
    return {
      group_slug: resolvedGroupSlug,
      group_kind: groupKind,
      channel_ids: channels.map((channel) => channel.id),
      matched_labs: matchedLabs,
      matched_models: [...models].sort(),
      match_sources: [...sources].sort(),
      catalog_version: catalogVersion,
      unresolved_count: unresolvedCount,
    }
  }

  async function recordLabAudit(
    action: 'channel.lab_balance_sync' | 'channel.lab_model_test',
    channels: AdminChannel[],
    groupSlug?: string
  ): Promise<void> {
    if (channels.length === 0) return
    await api.post<unknown>('/api/next/admin/channels/lab-audit', {
      action,
      ...buildLabAudit(channels, groupSlug),
    })
  }

  function currentParams() {
    return {
      p: page.value,
      page_size: pageSize.value,
      type: type.value || undefined,
      status: status.value || undefined,
      sort_by: sortBy.value,
      sort_order: sortOrder.value,
      keyword: keyword.value.trim() || undefined,
    }
  }

  async function load(options: { background?: boolean } = {}) {
    const background = options.background === true && rows.value.length > 0

    if (background) refreshing.value = true
    else loading.value = true
    if (rows.value.length === 0) initialError.value = ''

    const endpoint = '/api/next/admin/channels'
    const result = await listRequest.run((signal) =>
      api.get<AdminChannelPage>(endpoint, currentParams(), { signal })
    )
    if (result.stale) return
    loading.value = false
    refreshing.value = false
    if (!result.ok) {
      const message =
        result.error instanceof ApiError
          ? result.error.message
          : String(result.error)
      if (rows.value.length === 0) initialError.value = message
      else toast.error(message)
      return
    }
    rows.value = result.value.items
    total.value = result.value.total
    typeCounts.value = result.value.type_counts
    initialError.value = ''
  }

  function reloadFromFirstPage() {
    window.clearTimeout(searchTimer)
    if (page.value === 1) void load()
    else page.value = 1
  }

  watch(keyword, () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(reloadFromFirstPage, 300)
  })
  watch([type, status, sortBy, sortOrder], reloadFromFirstPage)
  watch(pageSize, reloadFromFirstPage)
  watch(page, () => void load())

  async function runChannelAction(
    id: number,
    action: ChannelAction,
    request: () => Promise<unknown>,
    successKey: string
  ): Promise<boolean> {
    if (isRowBusy(id)) return false
    setBusy(id, action)
    try {
      await request()
      await load({ background: true })
      toast.success(t(successKey))
      return true
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : String(error))
      return false
    } finally {
      setBusy(id, null)
    }
  }

  function updateNumber(
    channel: AdminChannel,
    field: 'priority' | 'weight',
    value: number
  ): Promise<boolean> {
    return runChannelAction(
      channel.id,
      field,
      () =>
        api.put<unknown>('/api/next/admin/channels', {
          id: channel.id,
          [field]: value,
        }),
      'channels.updated'
    )
  }

  function toggleStatus(channel: AdminChannel): Promise<boolean> {
    const nextStatus = channel.status === 1 ? 2 : 1
    return runChannelAction(
      channel.id,
      'status',
      () =>
        api.post<unknown>(`/api/next/admin/channels/${channel.id}/status`, {
          status: nextStatus,
        }),
      nextStatus === 1 ? 'channels.enabled' : 'channels.disabled'
    )
  }

  function refreshBalance(channel: AdminChannel): Promise<boolean> {
    return runChannelAction(
      channel.id,
      'balance',
      () => api.get<unknown>(`/api/next/admin/channels/balance/${channel.id}`),
      'channels.balanceUpdated'
    )
  }

  /**
   * Test one model on a channel, optionally overriding the endpoint and
   * stream mode. Failures come back as a result (not a throw) so the test
   * modal can render per-model outcomes; only aborts reject.
   */
  async function testChannelModel(
    channel: AdminChannel,
    model: string,
    options: ChannelModelTestOptions = {},
    signal?: AbortSignal
  ): Promise<ChannelModelTestResult> {
    try {
      const data = await api.get<{ time?: number }>(
        `/api/next/admin/channels/test/${channel.id}`,
        {
          model,
          ...(options.endpointType
            ? { endpoint_type: options.endpointType }
            : {}),
          ...(options.stream ? { stream: 'true' } : {}),
        },
        { signal }
      )
      const seconds = typeof data?.time === 'number' ? data.time : 0
      return { ok: true, timeMs: Math.round(seconds * 1000) }
    } catch (error) {
      if (signal?.aborted) throw error
      return {
        ok: false,
        message: error instanceof ApiError ? error.message : String(error),
      }
    }
  }

  /**
   * Strip the given models from a channel's published list (used by the test
   * modal's "remove failed models"). Refuses to empty the list because the
   * backend treats an empty models update as "unchanged".
   */
  function removeChannelModels(
    channel: AdminChannel,
    modelsToRemove: string[]
  ): Promise<boolean> {
    const removal = new Set(modelsToRemove)
    const remaining = channel.models
      .split(',')
      .map((model) => model.trim())
      .filter((model) => model.length > 0 && !removal.has(model))
    if (remaining.length === 0) {
      toast.error(t('channels.removeFailedBlocked'))
      return Promise.resolve(false)
    }
    return runCrudAction('edit', channel.id, async (signal) => {
      await api.put<unknown>(
        '/api/next/admin/channels',
        { id: channel.id, models: remaining.join(',') },
        { signal }
      )
      toast.success(
        t('channels.modelsRemoved', { count: modelsToRemove.length })
      )
      await load({ background: true })
    })
  }

  async function runCrudAction(
    action: ChannelCrudAction,
    id: number | null,
    request: (signal: AbortSignal) => Promise<void>
  ): Promise<boolean> {
    if (!canMutate.value) return false

    const controller = new AbortController()
    crudController = controller
    crudAction.value = { action, id }
    try {
      await request(controller.signal)
      return true
    } catch (error) {
      if (controller.signal.aborted) return false
      toast.error(error instanceof ApiError ? error.message : String(error))
      return false
    } finally {
      if (crudController === controller) crudController = null
      crudAction.value = null
    }
  }

  function createChannel(
    input: AdminChannelCreateInput,
    options?: { batchKeys?: boolean }
  ): Promise<boolean> {
    return runCrudAction('create', null, async (signal) => {
      await api.post<AdminChannel>(
        '/api/next/admin/channels',
        { mode: options?.batchKeys ? 'batch' : 'single', channel: input },
        { signal }
      )
      toast.success(t('channels.created'))
      if (page.value !== 1) page.value = 1
      else await load({ background: true })
    })
  }

  function updateChannelDetails(
    channel: AdminChannel,
    input: AdminChannelUpdateInput
  ): Promise<boolean> {
    return runCrudAction('edit', channel.id, async (signal) => {
      await api.put<unknown>(
        '/api/next/admin/channels',
        { id: channel.id, ...input },
        { signal }
      )
      toast.success(t('channels.updated'))
      await load({ background: true })
    })
  }

  function deleteChannel(channel: AdminChannel): Promise<boolean> {
    return runCrudAction('delete', channel.id, async (signal) => {
      await api.delete<{ id: number }>(
        `/api/channel/${channel.id}`,
        undefined,
        { signal }
      )
      toast.success(t('channels.deleted'))
      if (rows.value.length === 1 && page.value > 1) page.value -= 1
      else await load({ background: true })
    })
  }

  function deleteSupplierChannels(
    supplier: string,
    channels: AdminChannel[],
    groupSlug?: string
  ): Promise<boolean> {
    const ids = channels.map((channel) => channel.id)
    return runCrudAction('delete', null, async (signal) => {
      const deleted = await api.post<number>(
        '/api/channel/batch',
        { ids, lab_audit: buildLabAudit(channels, groupSlug) },
        { signal }
      )
      toast.success(t('channels.supplierCleared', { supplier, count: deleted }))
      if (rows.value.length === ids.length && page.value > 1) page.value -= 1
      else await load({ background: true })
    })
  }

  /**
   * Discover the upstream model list, either for a saved channel (by id) or
   * from in-form credentials before the channel exists. Used by the
   * "从上游获取" quick action in the channel form. Throws ApiError on failure.
   */
  async function fetchUpstreamModels(
    params: AdminChannelFetchModelsParams
  ): Promise<string[]> {
    const models =
      'channelId' in params
        ? await api.get<string[]>(
            `/api/next/admin/channels/fetch_models/${params.channelId}`
          )
        : await api.post<string[]>('/api/next/admin/channels/fetch_models', {
            type: params.type,
            key: params.key,
            base_url: params.baseUrl,
          })
    return Array.isArray(models) ? models.filter(Boolean) : []
  }

  async function runBulkAction(
    action: ChannelBulkAction,
    request: (signal: AbortSignal) => Promise<void>
  ): Promise<boolean> {
    if (!canMutate.value) return false

    const controller = new AbortController()
    bulkController = controller
    bulkAction.value = action
    try {
      await request(controller.signal)
      return true
    } catch (error) {
      if (controller.signal.aborted) return false
      toast.error(error instanceof ApiError ? error.message : String(error))
      return false
    } finally {
      if (bulkController === controller) bulkController = null
      bulkAction.value = null
    }
  }

  function bulkStatusTargets(
    action: Extract<ChannelBulkAction, 'enable' | 'disable' | 'reset'>,
    channels: AdminChannel[]
  ): AdminChannel[] {
    if (action === 'enable') {
      return channels.filter((channel) => channel.status !== 1)
    }
    if (action === 'disable') {
      return channels.filter((channel) => channel.status !== 2)
    }
    return channels.filter((channel) => channel.status === 3)
  }

  function updateChannelsStatus(
    action: Extract<ChannelBulkAction, 'enable' | 'disable' | 'reset'>,
    channels: AdminChannel[]
  ): Promise<boolean> {
    const targets = bulkStatusTargets(action, channels)
    if (targets.length === 0) return Promise.resolve(false)
    const status = action === 'disable' ? 2 : 1

    return runBulkAction(action, async (signal) => {
      const changed = await api.post<number>(
        '/api/next/admin/channels/status/batch',
        {
          ids: targets.map((channel) => channel.id),
          status,
          lab_audit: buildLabAudit(targets),
        },
        { signal }
      )
      toast.success(
        t(
          action === 'enable'
            ? 'channels.bulkEnabled'
            : action === 'disable'
              ? 'channels.bulkDisabled'
              : 'channels.bulkResetDone',
          { count: changed }
        )
      )
      await load({ background: true })
    })
  }

  function deleteSelectedChannels(channels: AdminChannel[]): Promise<boolean> {
    const ids = channels.map((channel) => channel.id)
    if (ids.length === 0) return Promise.resolve(false)

    return runBulkAction('delete', async (signal) => {
      const deleted = await api.post<number>(
        '/api/channel/batch',
        { ids, lab_audit: buildLabAudit(channels) },
        { signal }
      )
      toast.success(t('channels.bulkDeleted', { count: deleted }))
      const removesCurrentPage = rows.value.every((channel) =>
        ids.includes(channel.id)
      )
      if (removesCurrentPage && page.value > 1) page.value -= 1
      else await load({ background: true })
    })
  }

  async function runBalanceBatch(
    scope: ChannelBatchScope,
    channels: AdminChannel[],
    supplier?: string,
    groupSlug?: string
  ): Promise<void> {
    if (!canMutate.value || channels.length === 0) return

    const targets = channels.map((channel) => ({ ...channel }))
    try {
      await recordLabAudit('channel.lab_balance_sync', targets, groupSlug)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : String(error))
      return
    }
    const controller = new AbortController()
    batchController = controller
    batchProgress.value = {
      scope,
      supplier,
      total: targets.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
    }

    let succeeded = 0
    let failed = 0

    try {
      for (let start = 0; start < targets.length; start += CHANNEL_BATCH_SIZE) {
        if (controller.signal.aborted) return
        const batch = targets.slice(start, start + CHANNEL_BATCH_SIZE)
        setBatchRowsBusy(batch, true)

        const results = await Promise.allSettled(
          batch.map((channel) =>
            api.get<unknown>(
              `/api/next/admin/channels/balance/${channel.id}`,
              undefined,
              {
                signal: controller.signal,
              }
            )
          )
        )
        if (controller.signal.aborted) return

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            succeeded++
          } else {
            failed++
          }
        })
        setBatchRowsBusy(batch, false)
        batchProgress.value = {
          scope,
          supplier,
          total: targets.length,
          processed: succeeded + failed,
          succeeded,
          failed,
        }
      }

      const actionLabel = t('channels.batchBalanceAction')
      if (failed === 0) {
        toast.success(
          t('channels.batchCompleted', {
            action: actionLabel,
            count: succeeded,
          })
        )
      } else if (succeeded === 0) {
        toast.error(
          t('channels.batchFailed', {
            action: actionLabel,
            count: failed,
          })
        )
      } else {
        toast.warning(
          t('channels.batchPartial', {
            action: actionLabel,
            succeeded,
            total: targets.length,
            failed,
          })
        )
      }
      await load({ background: true })
    } finally {
      setBatchRowsBusy(targets, false)
      if (batchController === controller) batchController = null
      batchProgress.value = null
    }
  }

  function runVisibleBalance(): Promise<void> {
    return runBalanceBatch('page', rows.value)
  }

  function runSupplierBalance(
    supplier: string,
    channels: AdminChannel[],
    groupSlug?: string
  ): Promise<void> {
    return runBalanceBatch('supplier', channels, supplier, groupSlug)
  }

  onMounted(() => void load())
  onBeforeUnmount(() => {
    batchController?.abort()
    crudController?.abort()
    bulkController?.abort()
    window.clearTimeout(searchTimer)
  })

  return {
    rows,
    total,
    typeCounts,
    page,
    pageSize,
    keyword,
    type,
    status,
    sortBy,
    sortOrder,
    loading,
    refreshing,
    initialError,
    batchProgress,
    isBatchBusy,
    isCrudBusy,
    isBulkBusy,
    canMutate,
    canRunBatch,
    load,
    isBusy,
    isRowBusy,
    isCrudActionBusy,
    isBulkActionBusy,
    updateNumber,
    toggleStatus,
    refreshBalance,
    testChannelModel,
    recordLabAudit,
    removeChannelModels,
    createChannel,
    updateChannelDetails,
    deleteChannel,
    deleteSupplierChannels,
    fetchUpstreamModels,
    updateChannelsStatus,
    deleteSelectedChannels,
    runVisibleBalance,
    runSupplierBalance,
  }
}
