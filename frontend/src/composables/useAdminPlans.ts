import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import type {
  AdminPlan,
  AdminPlanCreateInput,
  AdminPlanPage,
  AdminPlanSortBy,
  AdminPlanSortOrder,
  AdminPlanStatus,
  AdminPlanUpdateInput,
} from '@/types/console'

type PlanRowAction = 'status'
type PlanCrudAction = 'create' | 'update' | 'delete'
type PlanBulkAction = 'delete'

export function useAdminPlans() {
  const { t } = useI18n()
  const toast = useToast()
  const auth = useAuthStore()

  const rows = ref<AdminPlan[]>([])
  const total = ref(0)
  const statusCounts = ref<Record<string, number>>({})
  const kindCounts = ref<Record<string, number>>({})
  const filteredSubscribers = ref(0)
  const filteredRevenue = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const statusFilter = ref('')
  const kindFilter = ref('')
  const sortBy = ref<AdminPlanSortBy>('sort_order')
  const sortOrder = ref<AdminPlanSortOrder>('asc')
  const loading = ref(true)
  const refreshing = ref(false)
  const initialError = ref('')
  const busy = ref<Map<number, PlanRowAction>>(new Map())
  const crudAction = ref<{ action: PlanCrudAction; id: number | null } | null>(
    null
  )
  const bulkAction = ref<PlanBulkAction | null>(null)
  const listRequest = useLatestRequest()
  let searchTimer = 0

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

  /** The catalogue is admin-owned; there is no per-plan authority split. */
  const canManage = computed(() => auth.isAdmin)

  function isBusy(id: number, action: PlanRowAction): boolean {
    return busy.value.get(id) === action
  }

  function isRowBusy(id: number): boolean {
    return busy.value.has(id)
  }

  function isCrudActionBusy(
    action: PlanCrudAction,
    id: number | null = null
  ): boolean {
    if (!crudAction.value) return false
    return (
      crudAction.value.action === action &&
      (id === null || crudAction.value.id === id)
    )
  }

  function isBulkActionBusy(action: PlanBulkAction): boolean {
    return bulkAction.value === action
  }

  async function load(opts: { background?: boolean } = {}): Promise<void> {
    const background = opts.background === true && rows.value.length > 0
    if (background) refreshing.value = true
    else loading.value = true
    if (rows.value.length === 0) initialError.value = ''

    const result = await listRequest.run((signal) =>
      api.get<AdminPlanPage>(
        '/api/plan/',
        {
          keyword: keyword.value.trim() || undefined,
          status: statusFilter.value || undefined,
          kind: kindFilter.value || undefined,
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
          : t('planManagement.loadFailed')
      if (rows.value.length === 0) initialError.value = message
      else toast.error(message)
      return
    }

    rows.value = result.value.items
    total.value = result.value.total
    statusCounts.value = result.value.status_counts
    kindCounts.value = result.value.kind_counts
    filteredSubscribers.value = result.value.filtered_subscribers
    filteredRevenue.value = result.value.filtered_revenue
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
  watch([statusFilter, kindFilter, sortBy, sortOrder], reloadFromFirstPage)
  watch(pageSize, reloadFromFirstPage)
  watch(page, () => void load())

  onMounted(() => void load())
  onBeforeUnmount(() => window.clearTimeout(searchTimer))

  async function setStatus(
    plan: AdminPlan,
    status: AdminPlanStatus
  ): Promise<boolean> {
    if (busy.value.has(plan.id)) return false
    const next = new Map(busy.value)
    next.set(plan.id, 'status')
    busy.value = next
    try {
      const updated = await api.post<AdminPlan>(`/api/plan/${plan.id}/status`, {
        status,
      })
      const index = rows.value.findIndex((p) => p.id === plan.id)
      if (index >= 0) rows.value[index] = updated
      toast.success(t(`planManagement.statusChanged.${updated.status}`))
      // The status facet counts shift with every transition.
      await load({ background: true })
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err))
      return false
    } finally {
      const cleared = new Map(busy.value)
      cleared.delete(plan.id)
      busy.value = cleared
    }
  }

  async function createPlan(input: AdminPlanCreateInput): Promise<boolean> {
    crudAction.value = { action: 'create', id: null }
    try {
      await api.post<AdminPlan>('/api/plan/', input)
      toast.success(t('planManagement.created'))
      await load({ background: true })
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err))
      return false
    } finally {
      crudAction.value = null
    }
  }

  async function updatePlan(
    id: number,
    input: AdminPlanUpdateInput
  ): Promise<boolean> {
    crudAction.value = { action: 'update', id }
    try {
      const updated = await api.put<AdminPlan>(`/api/plan/${id}`, input)
      const index = rows.value.findIndex((p) => p.id === id)
      if (index >= 0) rows.value[index] = updated
      toast.success(t('planManagement.updated'))
      // Sort order may have changed, so re-read rather than patching in place.
      await load({ background: true })
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err))
      return false
    } finally {
      crudAction.value = null
    }
  }

  async function deletePlan(plan: AdminPlan): Promise<boolean> {
    crudAction.value = { action: 'delete', id: plan.id }
    try {
      await api.delete(`/api/plan/${plan.id}`)
      toast.success(t('planManagement.deleted'))
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

  async function deleteSelected(plans: AdminPlan[]): Promise<boolean> {
    if (plans.length === 0) return false
    bulkAction.value = 'delete'
    try {
      const deleted = await api.post<number>('/api/plan/batch', {
        ids: plans.map((p) => p.id),
      })
      toast.success(
        t('planManagement.bulkDeleted', { count: deleted ?? plans.length })
      )
      const deletedIds = new Set(plans.map((plan) => plan.id))
      const clearsPage = rows.value.every((plan) => deletedIds.has(plan.id))
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
    statusCounts,
    kindCounts,
    filteredSubscribers,
    filteredRevenue,
    page,
    pageSize,
    keyword,
    statusFilter,
    kindFilter,
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
    setStatus,
    createPlan,
    updatePlan,
    deletePlan,
    deleteSelected,
  }
}
