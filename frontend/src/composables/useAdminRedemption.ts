import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useFeatureAccess } from '@/composables/useFeatureAccess'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import type {
  AdminRedemptionCode,
  AdminRedemptionCreateInput,
  AdminRedemptionPage,
  AdminRedemptionSortBy,
  AdminRedemptionSortOrder,
} from '@/types/console'

type RedemptionRowAction = 'status'
type RedemptionCrudAction = 'create' | 'delete'
type RedemptionBulkAction = 'delete'

export function useAdminRedemption() {
  const { t } = useI18n()
  const toast = useToast()
  const auth = useAuthStore()
  const { readOnly } = useFeatureAccess('admin', 'prototype')

  const rows = ref<AdminRedemptionCode[]>([])
  const total = ref(0)
  const typeCounts = ref<Record<string, number>>({})
  const statusCounts = ref<Record<string, number>>({})
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const typeFilter = ref('')
  const statusFilter = ref('')
  const sortBy = ref<AdminRedemptionSortBy>('id')
  const sortOrder = ref<AdminRedemptionSortOrder>('desc')
  const loading = ref(true)
  const refreshing = ref(false)
  const initialError = ref('')
  const busy = ref<Map<number, RedemptionRowAction>>(new Map())
  const crudAction = ref<{
    action: RedemptionCrudAction
    id: number | null
  } | null>(null)
  const bulkAction = ref<RedemptionBulkAction | null>(null)
  const listRequest = useLatestRequest()
  let searchTimer = 0

  const isCrudBusy = computed(() => crudAction.value !== null)
  const isBulkBusy = computed(() => bulkAction.value !== null)
  const canMutate = computed(
    () =>
      !readOnly.value &&
      !loading.value &&
      !refreshing.value &&
      !isCrudBusy.value &&
      !isBulkBusy.value &&
      busy.value.size === 0
  )

  /**
   * Admins own all redemption codes; no per-row authority check needed.
   * Root-only codes would need a separate guard, but the current schema has none.
   */
  const canManage = computed(() => !readOnly.value && auth.isAdmin)

  function isBusy(id: number, action: RedemptionRowAction): boolean {
    return busy.value.get(id) === action
  }

  function isRowBusy(id: number): boolean {
    return busy.value.has(id)
  }

  function isCrudActionBusy(
    action: RedemptionCrudAction,
    id: number | null = null
  ): boolean {
    if (!crudAction.value) return false
    return (
      crudAction.value.action === action &&
      (id === null || crudAction.value.id === id)
    )
  }

  function isBulkActionBusy(action: RedemptionBulkAction): boolean {
    return bulkAction.value === action
  }

  async function load(opts: { background?: boolean } = {}): Promise<void> {
    const background = opts.background === true && rows.value.length > 0
    if (background) refreshing.value = true
    else loading.value = true
    if (rows.value.length === 0) initialError.value = ''

    const trimmed = keyword.value.trim()
    const url = trimmed ? '/api/redemption/search' : '/api/redemption/'
    const result = await listRequest.run((signal) =>
      api.get<AdminRedemptionPage>(
        url,
        {
          keyword: trimmed || undefined,
          type: typeFilter.value || undefined,
          status: statusFilter.value || undefined,
          sort_by: sortBy.value,
          sort_order: sortOrder.value,
          p: page.value,
          page_size: pageSize.value,
        },
        { signal }
      )
    )
    if (result.stale) return

    loading.value = false
    refreshing.value = false
    if (!result.ok) {
      const message =
        result.error instanceof ApiError
          ? result.error.message
          : t('redemption.loadFailed')
      if (rows.value.length === 0) initialError.value = message
      else toast.error(message)
      return
    }

    rows.value = result.value.items
    total.value = result.value.total
    typeCounts.value = result.value.type_counts
    statusCounts.value = result.value.status_counts
    initialError.value = ''
  }

  function reloadFromFirstPage(): void {
    window.clearTimeout(searchTimer)
    if (page.value === 1) void load()
    else page.value = 1
  }

  watch(keyword, () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(reloadFromFirstPage, 300)
  })
  watch([typeFilter, statusFilter, sortBy, sortOrder], reloadFromFirstPage)
  watch(pageSize, reloadFromFirstPage)
  watch(page, () => void load())

  onMounted(() => void load())
  onBeforeUnmount(() => window.clearTimeout(searchTimer))

  async function toggleStatus(code: AdminRedemptionCode): Promise<void> {
    if (busy.value.has(code.id)) return
    const next = new Map(busy.value)
    next.set(code.id, 'status')
    busy.value = next
    try {
      const updated = await api.post<AdminRedemptionCode>(
        `/api/redemption/${code.id}/status`,
        {}
      )
      const index = rows.value.findIndex((c) => c.id === code.id)
      if (index >= 0) rows.value[index] = updated
      toast.success(
        updated.status === 'disabled'
          ? t('redemption.disabled')
          : t('redemption.enabled')
      )
      await load({ background: true })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err))
    } finally {
      const next2 = new Map(busy.value)
      next2.delete(code.id)
      busy.value = next2
    }
  }

  async function createCodes(
    input: AdminRedemptionCreateInput
  ): Promise<{ codes: string[]; items: AdminRedemptionCode[] } | null> {
    crudAction.value = { action: 'create', id: null }
    try {
      const result = await api.post<{
        codes: string[]
        items: AdminRedemptionCode[]
      }>('/api/redemption/', input)
      toast.success(t('redemption.created'))
      await load({ background: true })
      return result
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err))
      return null
    } finally {
      crudAction.value = null
    }
  }

  async function deleteCode(code: AdminRedemptionCode): Promise<boolean> {
    crudAction.value = { action: 'delete', id: code.id }
    try {
      await api.delete(`/api/redemption/${code.id}`)
      toast.success(t('redemption.deleted'))
      if (rows.value.length === 1 && page.value > 1) page.value -= 1
      else await load({ background: true })
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err))
      return false
    } finally {
      crudAction.value = null
    }
  }

  async function deleteSelected(
    codes: AdminRedemptionCode[]
  ): Promise<boolean> {
    if (codes.length === 0) return false
    bulkAction.value = 'delete'
    try {
      const deleted = await api.post<number>('/api/redemption/batch', {
        ids: codes.map((c) => c.id),
      })
      toast.success(
        t('redemption.bulkDeleted', { count: deleted ?? codes.length })
      )
      const deletedIds = new Set(codes.map((code) => code.id))
      const clearsPage = rows.value.every((code) => deletedIds.has(code.id))
      if (clearsPage && page.value > 1) page.value -= 1
      else await load({ background: true })
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err))
      return false
    } finally {
      bulkAction.value = null
    }
  }

  return {
    rows,
    total,
    typeCounts,
    statusCounts,
    page,
    pageSize,
    keyword,
    typeFilter,
    statusFilter,
    sortBy,
    sortOrder,
    loading,
    refreshing,
    initialError,
    isCrudBusy,
    isBulkBusy,
    canMutate,
    canManage,
    load,
    isBusy,
    isRowBusy,
    isCrudActionBusy,
    isBulkActionBusy,
    toggleStatus,
    createCodes,
    deleteCode,
    deleteSelected,
  }
}
