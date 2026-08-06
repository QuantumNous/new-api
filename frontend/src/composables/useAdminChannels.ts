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
  AdminChannelPage,
  AdminChannelSortBy,
  AdminChannelSortOrder,
  AdminChannelUpdateInput,
} from '@/types/console'

type ChannelAction = 'priority' | 'weight' | 'status' | 'balance' | 'test'
type ChannelBatchAction = Extract<ChannelAction, 'balance' | 'test'>
type ChannelCrudAction = 'create' | 'edit' | 'delete'
type ChannelBatchScope = 'page' | 'supplier'
type ChannelBulkAction = 'delete' | 'enable' | 'disable' | 'reset'

interface ChannelBatchProgress {
  action: ChannelBatchAction
  scope: ChannelBatchScope
  supplier?: string
  total: number
  processed: number
  succeeded: number
  failed: number
}

const CHANNEL_BATCH_SIZE = 5

export function useAdminChannels() {
  const { t } = useI18n()
  const toast = useToast()
  const { readOnly } = useFeatureAccess('admin', 'prototype')

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

  function setBatchRowsBusy(
    channels: AdminChannel[],
    action: ChannelBatchAction | null
  ) {
    const next = new Map(busy.value)
    channels.forEach((channel) => {
      if (action) next.set(channel.id, action)
      else next.delete(channel.id)
    })
    busy.value = next
  }

  function replaceChannel(channel: AdminChannel) {
    const index = rows.value.findIndex((item) => item.id === channel.id)
    if (index < 0) return
    rows.value.splice(index, 1, channel)
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

    const endpoint = keyword.value.trim()
      ? '/api/channel/search'
      : '/api/channel/'
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
    request: () => Promise<AdminChannel>,
    successKey: string
  ): Promise<boolean> {
    if (isRowBusy(id)) return false
    setBusy(id, action)
    try {
      const channel = await request()
      replaceChannel(channel)
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
        api.put<AdminChannel>('/api/channel/', {
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
        api.post<AdminChannel>(`/api/channel/${channel.id}/status`, {
          status: nextStatus,
        }),
      nextStatus === 1 ? 'channels.enabled' : 'channels.disabled'
    )
  }

  function refreshBalance(channel: AdminChannel): Promise<boolean> {
    return runChannelAction(
      channel.id,
      'balance',
      () => api.get<AdminChannel>(`/api/channel/update_balance/${channel.id}`),
      'channels.balanceUpdated'
    )
  }

  function testChannel(channel: AdminChannel): Promise<boolean> {
    return runChannelAction(
      channel.id,
      'test',
      () => api.get<AdminChannel>(`/api/channel/test/${channel.id}`),
      'channels.testCompleted'
    )
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

  function createChannel(input: AdminChannelCreateInput): Promise<boolean> {
    return runCrudAction('create', null, async (signal) => {
      await api.post<AdminChannel>(
        '/api/channel/',
        { mode: 'single', channel: input },
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
      const updated = await api.put<AdminChannel>(
        '/api/channel/',
        { id: channel.id, ...input },
        { signal }
      )
      replaceChannel(updated)
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
    channels: AdminChannel[]
  ): Promise<boolean> {
    const ids = channels.map((channel) => channel.id)
    return runCrudAction('delete', null, async (signal) => {
      const deleted = await api.post<number>(
        '/api/channel/batch',
        { ids },
        { signal }
      )
      toast.success(t('channels.supplierCleared', { supplier, count: deleted }))
      if (rows.value.length === ids.length && page.value > 1) page.value -= 1
      else await load({ background: true })
    })
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
        '/api/channel/status/batch',
        { ids: targets.map((channel) => channel.id), status },
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
        { ids },
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

  function batchRequest(
    action: ChannelBatchAction,
    channel: AdminChannel,
    signal: AbortSignal
  ): Promise<AdminChannel> {
    const endpoint =
      action === 'balance'
        ? `/api/channel/update_balance/${channel.id}`
        : `/api/channel/test/${channel.id}`
    return api.get<AdminChannel>(endpoint, undefined, { signal })
  }

  function batchActionLabelKey(action: ChannelBatchAction): string {
    return action === 'balance'
      ? 'channels.batchBalanceAction'
      : 'channels.batchTestAction'
  }

  async function runBatch(
    action: ChannelBatchAction,
    scope: ChannelBatchScope,
    channels: AdminChannel[],
    supplier?: string
  ): Promise<void> {
    if (!canMutate.value || channels.length === 0) return

    const targets = channels.map((channel) => ({ ...channel }))
    const controller = new AbortController()
    batchController = controller
    batchProgress.value = {
      action,
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
        setBatchRowsBusy(batch, action)

        const results = await Promise.allSettled(
          batch.map((channel) =>
            batchRequest(action, channel, controller.signal)
          )
        )
        if (controller.signal.aborted) return

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            succeeded++
            replaceChannel(result.value)
          } else {
            failed++
          }
        })
        setBatchRowsBusy(batch, null)
        batchProgress.value = {
          action,
          scope,
          supplier,
          total: targets.length,
          processed: succeeded + failed,
          succeeded,
          failed,
        }
      }

      const actionLabel = t(batchActionLabelKey(action))
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
    } finally {
      setBatchRowsBusy(targets, null)
      if (batchController === controller) batchController = null
      batchProgress.value = null
    }
  }

  function runVisibleBatch(action: ChannelBatchAction): Promise<void> {
    return runBatch(action, 'page', rows.value)
  }

  function runSupplierBatch(
    action: ChannelBatchAction,
    supplier: string,
    channels: AdminChannel[]
  ): Promise<void> {
    return runBatch(action, 'supplier', channels, supplier)
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
    testChannel,
    createChannel,
    updateChannelDetails,
    deleteChannel,
    deleteSupplierChannels,
    updateChannelsStatus,
    deleteSelectedChannels,
    runVisibleBatch,
    runSupplierBatch,
  }
}
