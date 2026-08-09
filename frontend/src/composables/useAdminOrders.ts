import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import { ADMIN_ORDER_DEFAULT_RANGE } from '@/constants/adminOrders'
import type {
  AdminOrder,
  AdminOrderPage,
  AdminOrderRange,
  AdminOrderStats,
} from '@/types/console'

const EXPORT_PAGE_SIZE = 100

export const ORDER_EXPORT_MAX_ROWS = 10_000

/** Read-only recharge ledger backed by the Vue facade endpoints. */
export function useAdminOrders() {
  const toast = useToast()

  const rows = ref<AdminOrder[]>([])
  const total = ref(0)
  const statusCounts = ref<Record<string, number>>({})
  const methodCounts = ref<Record<string, number>>({})
  const filteredEpayRevenue = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const status = ref('')
  const method = ref('')
  const loading = ref(true)
  const refreshing = ref(false)
  const initialError = ref('')

  const stats = ref<AdminOrderStats | null>(null)
  const range = ref<AdminOrderRange>(ADMIN_ORDER_DEFAULT_RANGE)
  const statsLoading = ref(true)
  const statsRefreshing = ref(false)
  const statsError = ref('')

  let listController: AbortController | null = null
  let statsController: AbortController | null = null
  let listSequence = 0
  let statsSequence = 0
  let searchTimer = 0

  function filterParams(): Record<string, string | undefined> {
    const trimmed = keyword.value.trim()
    return {
      status: status.value || undefined,
      method: method.value || undefined,
      keyword: trimmed || undefined,
    }
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
        '/api/next/admin/orders',
        { ...filterParams(), p: page.value, page_size: pageSize.value },
        { signal: controller.signal }
      )
      if (sequence !== listSequence) return
      rows.value = data.items
      total.value = data.total
      statusCounts.value = data.status_counts
      methodCounts.value = data.method_counts
      filteredEpayRevenue.value = data.filtered_epay_revenue
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
        '/api/next/admin/orders/stats',
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
    window.clearTimeout(searchTimer)
    if (page.value === 1) void load()
    else page.value = 1
  }

  watch(keyword, () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(reloadFromFirstPage, 300)
  })
  watch([status, method], reloadFromFirstPage)
  watch(pageSize, reloadFromFirstPage)
  watch(page, () => void load())
  watch(range, () => void loadStats())

  async function fetchAllForExport(
    signal: AbortSignal
  ): Promise<{ items: AdminOrder[]; truncated: boolean }> {
    const filters = filterParams()
    const first = await api.get<AdminOrderPage>(
      '/api/next/admin/orders',
      { ...filters, p: 1, page_size: EXPORT_PAGE_SIZE },
      { signal }
    )

    const items = [...first.items]
    const reachable = Math.min(first.total, ORDER_EXPORT_MAX_ROWS)
    const pages = Math.ceil(reachable / EXPORT_PAGE_SIZE)

    for (let p = 2; p <= pages; p++) {
      const next = await api.get<AdminOrderPage>(
        '/api/next/admin/orders',
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
    window.clearTimeout(searchTimer)
  })

  return {
    rows,
    total,
    statusCounts,
    methodCounts,
    filteredEpayRevenue,
    page,
    pageSize,
    keyword,
    status,
    method,
    loading,
    refreshing,
    initialError,
    stats,
    range,
    statsLoading,
    statsRefreshing,
    statsError,
    load,
    loadStats,
    fetchAllForExport,
    refreshAll,
  }
}
