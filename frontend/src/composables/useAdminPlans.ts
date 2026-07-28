import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
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
    if (opts.background) {
      refreshing.value = true
    } else {
      loading.value = true
      initialError.value = ''
    }

    try {
      const result = await api.get<AdminPlanPage>('/api/plan/', {
        keyword: keyword.value || undefined,
        status: statusFilter.value || undefined,
        kind: kindFilter.value || undefined,
        sort_by: sortBy.value,
        sort_order: sortOrder.value,
        p: page.value,
        page_size: pageSize.value,
      })
      rows.value = result.items
      total.value = result.total
      statusCounts.value = result.status_counts
      kindCounts.value = result.kind_counts
      filteredSubscribers.value = result.filtered_subscribers
      filteredRevenue.value = result.filtered_revenue
    } catch (err) {
      if (!opts.background) {
        initialError.value =
          err instanceof ApiError ? err.message : t('planManagement.loadFailed')
      }
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  watch(
    [keyword, statusFilter, kindFilter, sortBy, sortOrder, pageSize],
    () => {
      page.value = 1
      load()
    }
  )
  watch(page, () => load())

  onMounted(() => load())

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
      rows.value = rows.value.filter((p) => p.id !== plan.id)
      total.value = Math.max(0, total.value - 1)
      toast.success(t('planManagement.deleted'))
      await load({ background: true })
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
      await load({ background: true })
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
