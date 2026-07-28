import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import {
  ADMIN_ORDER_DEFAULT_RANGE,
  canRefundAdminOrder,
} from '@/constants/adminOrders'
import type {
  AdminOrder,
  AdminOrderPage,
  AdminOrderRange,
  AdminOrderStats,
} from '@/types/console'

/**
 * Rows per request while sweeping for an export. Pinned to the mock's own
 * `page_size` ceiling: asking for more would silently return 100 anyway, and the
 * sweep's page arithmetic would then skip rows.
 */
const EXPORT_PAGE_SIZE = 100

/** Upper bound on an export, so one click cannot walk an unbounded ledger. */
export const ORDER_EXPORT_MAX_ROWS = 10_000

/**
 * Orders are a read-mostly ledger: the only mutation is a refund, so this
 * composable carries two independent request chains (list and stats) instead of
 * the create/edit/delete machinery in useAdminUsers. Each chain owns its own
 * AbortController plus a sequence guard, because filter changes and range
 * switches can both overlap in flight.
 */
export function useAdminOrders() {
  const { t } = useI18n()
  const toast = useToast()

  const rows = ref<AdminOrder[]>([])
  const total = ref(0)
  const statusCounts = ref<Record<string, number>>({})
  const methodCounts = ref<Record<string, number>>({})
  const typeCounts = ref<Record<string, number>>({})
  /** Paid revenue across the whole filtered set, so it survives pagination. */
  const filteredRevenue = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const status = ref('')
  const method = ref('')
  const type = ref('')
  const loading = ref(true)
  const refreshing = ref(false)
  const initialError = ref('')

  const stats = ref<AdminOrderStats | null>(null)
  const range = ref<AdminOrderRange>(ADMIN_ORDER_DEFAULT_RANGE)
  const statsLoading = ref(true)
  const statsRefreshing = ref(false)
  const statsError = ref('')

  const refundingId = ref<number | null>(null)
  const isRefundBusy = computed(() => refundingId.value !== null)

  let listController: AbortController | null = null
  let statsController: AbortController | null = null
  let refundController: AbortController | null = null
  let listSequence = 0
  let statsSequence = 0
  let searchTimer = 0

  function isRefunding(id: number): boolean {
    return refundingId.value === id
  }

  /**
   * The active filter set, without paging. Shared by the table load and the
   * export sweep so an export can never disagree with what is on screen.
   */
  function filterParams(): Record<string, string | undefined> {
    const trimmed = keyword.value.trim()
    return {
      status: status.value || undefined,
      method: method.value || undefined,
      type: type.value || undefined,
      keyword: trimmed || undefined,
    }
  }

  /** The search route only exists to carry a keyword. */
  function listPath(): string {
    return keyword.value.trim() ? '/api/order/search' : '/api/order/'
  }

  /** UI affordance only; the mock and the real server re-check independently. */
  function canRefund(order: AdminOrder): boolean {
    return canRefundAdminOrder(order) && !isRefundBusy.value
  }

  async function load(options: { background?: boolean } = {}) {
    listController?.abort()
    const controller = new AbortController()
    listController = controller
    const sequence = ++listSequence
    const background = options.background === true && rows.value.length > 0

    if (background) refreshing.value = true
    else loading.value = true
    if (rows.value.length === 0) initialError.value = ''

    try {
      const data = await api.get<AdminOrderPage>(
        listPath(),
        { ...filterParams(), p: page.value, page_size: pageSize.value },
        { signal: controller.signal }
      )
      if (sequence !== listSequence) return
      rows.value = data.items
      total.value = data.total
      statusCounts.value = data.status_counts
      methodCounts.value = data.method_counts
      typeCounts.value = data.type_counts
      filteredRevenue.value = data.filtered_revenue
      initialError.value = ''
    } catch (error) {
      if (controller.signal.aborted || sequence !== listSequence) return
      const message = error instanceof ApiError ? error.message : String(error)
      if (rows.value.length === 0) initialError.value = message
      else toast.error(message)
    } finally {
      if (sequence === listSequence) {
        loading.value = false
        refreshing.value = false
      }
    }
  }

  async function loadStats(options: { background?: boolean } = {}) {
    statsController?.abort()
    const controller = new AbortController()
    statsController = controller
    const sequence = ++statsSequence
    const background = options.background === true && stats.value !== null

    if (background) statsRefreshing.value = true
    else statsLoading.value = true
    if (!stats.value) statsError.value = ''

    try {
      const data = await api.get<AdminOrderStats>(
        '/api/order/stats',
        { range: range.value },
        { signal: controller.signal }
      )
      if (sequence !== statsSequence) return
      stats.value = data
      statsError.value = ''
    } catch (error) {
      if (controller.signal.aborted || sequence !== statsSequence) return
      const message = error instanceof ApiError ? error.message : String(error)
      if (!stats.value) statsError.value = message
      else toast.error(message)
    } finally {
      if (sequence === statsSequence) {
        statsLoading.value = false
        statsRefreshing.value = false
      }
    }
  }

  function reloadFromFirstPage() {
    if (page.value === 1) void load()
    else page.value = 1
  }

  watch(keyword, () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(reloadFromFirstPage, 300)
  })
  watch([status, method, type], reloadFromFirstPage)
  watch([page, pageSize], () => void load())
  watch(range, () => void loadStats())

  /**
   * Walks the current filter set page by page. The ledger can outgrow any
   * single response, so the sweep is capped and reports whether it truncated —
   * silently exporting a prefix would misrepresent the books.
   */
  async function fetchAllForExport(
    signal: AbortSignal
  ): Promise<{ items: AdminOrder[]; truncated: boolean }> {
    const filters = filterParams()
    const path = listPath()

    const first = await api.get<AdminOrderPage>(
      path,
      { ...filters, p: 1, page_size: EXPORT_PAGE_SIZE },
      { signal }
    )

    const items = [...first.items]
    const reachable = Math.min(first.total, ORDER_EXPORT_MAX_ROWS)
    const pages = Math.ceil(reachable / EXPORT_PAGE_SIZE)

    for (let p = 2; p <= pages; p++) {
      const next = await api.get<AdminOrderPage>(
        path,
        { ...filters, p, page_size: EXPORT_PAGE_SIZE },
        { signal }
      )
      items.push(...next.items)
    }

    return {
      items: items.slice(0, ORDER_EXPORT_MAX_ROWS),
      truncated: first.total > ORDER_EXPORT_MAX_ROWS,
    }
  }

  /**
   * A refund moves money, so the row is reconciled from the server's response
   * rather than patched locally, and the stats are refreshed because revenue and
   * the payment split both shift.
   */
  async function refundOrder(order: AdminOrder): Promise<boolean> {
    if (!canRefund(order)) return false
    refundController?.abort()
    const controller = new AbortController()
    refundController = controller
    refundingId.value = order.id

    try {
      const updated = await api.post<AdminOrder>(
        `/api/order/${order.id}/refund`,
        undefined,
        { signal: controller.signal }
      )
      const index = rows.value.findIndex((item) => item.id === updated.id)
      if (index >= 0) rows.value.splice(index, 1, updated)
      toast.success(t('orders.refundSucceeded'))
      await loadStats({ background: true })
      return true
    } catch (error) {
      if (controller.signal.aborted) return false
      toast.error(error instanceof ApiError ? error.message : String(error))
      return false
    } finally {
      if (refundController === controller) refundController = null
      refundingId.value = null
    }
  }

  function refreshAll() {
    void load({ background: true })
    void loadStats({ background: true })
  }

  onMounted(() => {
    void load()
    void loadStats()
  })

  onBeforeUnmount(() => {
    listController?.abort()
    statsController?.abort()
    refundController?.abort()
    window.clearTimeout(searchTimer)
  })

  return {
    rows,
    total,
    statusCounts,
    methodCounts,
    typeCounts,
    filteredRevenue,
    page,
    pageSize,
    keyword,
    status,
    method,
    type,
    loading,
    refreshing,
    initialError,
    stats,
    range,
    statsLoading,
    statsRefreshing,
    statsError,
    isRefundBusy,
    isRefunding,
    canRefund,
    load,
    loadStats,
    fetchAllForExport,
    refundOrder,
    refreshAll,
  }
}
