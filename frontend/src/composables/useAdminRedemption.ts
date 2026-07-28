import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
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

  const isCrudBusy = computed(() => crudAction.value !== null)
  const isBulkBusy = computed(() => bulkAction.value !== null)
  const canMutate = computed(
    () =>
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
  const canManage = computed(() => auth.isAdmin)

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
    if (opts.background) {
      refreshing.value = true
    } else {
      loading.value = true
      initialError.value = ''
    }

    try {
      const isSearch = keyword.value.trim().length > 0
      const url = isSearch ? '/api/redemption/search' : '/api/redemption/'
      const result = await api.get<AdminRedemptionPage>(url, {
        keyword: keyword.value || undefined,
        type: typeFilter.value || undefined,
        status: statusFilter.value || undefined,
        sort_by: sortBy.value,
        sort_order: sortOrder.value,
        p: page.value,
        page_size: pageSize.value,
      })
      rows.value = result.items
      total.value = result.total
      typeCounts.value = result.type_counts
      statusCounts.value = result.status_counts
    } catch (err) {
      if (!opts.background) {
        initialError.value =
          err instanceof ApiError ? err.message : t('redemption.loadFailed')
      }
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  // Reload on filter / sort / page changes.
  watch(
    [keyword, typeFilter, statusFilter, sortBy, sortOrder, pageSize],
    () => {
      page.value = 1
      load()
    }
  )
  watch(page, () => load())

  onMounted(() => load())

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
      rows.value = rows.value.filter((c) => c.id !== code.id)
      total.value = Math.max(0, total.value - 1)
      toast.success(t('redemption.deleted'))
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
      const deletedIds = new Set(codes.map((c) => c.id))
      rows.value = rows.value.filter((c) => !deletedIds.has(c.id))
      total.value = Math.max(0, total.value - (deleted ?? codes.length))
      toast.success(
        t('redemption.bulkDeleted', { count: deleted ?? codes.length })
      )
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
