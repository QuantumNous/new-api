<script setup lang="ts">
import {
  AlertTriangle,
  BadgeDollarSign,
  CreditCard,
  Download,
  Eye,
  Receipt,
  RefreshCw,
  TrendingUp,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiError } from '@/api/types'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import ConsoleTabs, { type TabItem } from '@/components/common/ConsoleTabs.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import FormField from '@/components/common/FormField.vue'
import IconButton from '@/components/common/IconButton.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import SegmentedToggle from '@/components/common/SegmentedToggle.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import OrderDetailModal from '@/components/console/orders/OrderDetailModal.vue'
import {
  getOrderExportValues,
  ORDER_EXPORT_HEADERS,
} from '@/components/console/orders/orderExport'
import OrderMobileList from '@/components/console/orders/OrderMobileList.vue'
import OrderRevenueChart from '@/components/console/orders/OrderRevenueChart.vue'
import OrderStatCard from '@/components/console/orders/OrderStatCard.vue'
import PaymentMethodShare from '@/components/console/orders/PaymentMethodShare.vue'
import TopSpenders from '@/components/console/orders/TopSpenders.vue'
import {
  ORDER_EXPORT_MAX_ROWS,
  useAdminOrders,
} from '@/composables/useAdminOrders'
import { useToast } from '@/composables/useToast'
import {
  ADMIN_ORDER_METHODS,
  ADMIN_ORDER_RANGES,
  ADMIN_ORDER_STATUSES,
  adminOrderMethodLabelKey,
  adminOrderStatusLabelKey,
  adminOrderStatusTone,
  formatAdminOrderAmount,
  isAdminOrderRange,
} from '@/constants/adminOrders'
import type { AdminOrder, AdminOrderRange } from '@/types/console'
import { formatTime } from '@/utils/format'
import { serializeSpreadsheet } from '@/utils/spreadsheetExport'

const { t } = useI18n()
const toast = useToast()
const {
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
} = useAdminOrders()

const activeTab = ref('overview')
const ordersPanelId = 'orders-tab-panel'
const detailOrder = ref<AdminOrder | null>(null)
const exportOpen = ref(false)
const exportFormat = ref('csv')
const exporting = ref(false)
let exportController: AbortController | null = null

const tabs = computed<TabItem[]>(() => [
  { key: 'overview', label: t('orders.tabOverview') },
  { key: 'list', label: t('orders.tabList') },
])

/* ---------------- overview ---------------- */

// SegmentedToggle speaks strings; the range is a numeric day count.
const rangeModel = computed<string>({
  get: () => String(range.value),
  set: (value) => {
    if (isAdminOrderRange(value)) range.value = Number(value) as AdminOrderRange
  },
})

const rangeOptions = computed(() =>
  ADMIN_ORDER_RANGES.map((days) => ({
    value: String(days),
    label: t('orders.rangeDays', { days }),
  }))
)

const daily = computed(() => stats.value?.daily ?? [])

/* ---------------- list ---------------- */

const columns = computed<TableColumn[]>(() => [
  { key: 'id', label: t('orders.id'), width: '84px' },
  { key: 'order_no', label: t('orders.orderNo'), width: '210px' },
  { key: 'user', label: t('orders.user'), width: '200px' },
  { key: 'amount', label: t('orders.amount'), width: '104px', align: 'right' },
  { key: 'method', label: t('orders.method.label'), width: '112px' },
  { key: 'status', label: t('orders.status.label'), width: '104px' },
  { key: 'created', label: t('orders.created'), width: '150px' },
  { key: 'actions', label: t('common.actions'), width: '96px', align: 'right' },
])

/** Facets hide values the current keyword set has no rows for. */
function facetOptions<T extends string>(
  values: readonly T[],
  counts: Record<string, number>,
  labelKey: (value: T) => string,
  allLabel: string
) {
  return [
    { value: '', label: allLabel },
    ...values
      .filter((value) => (counts[value] ?? 0) > 0)
      .map((value) => ({
        value,
        label: `${t(labelKey(value))} (${counts[value] ?? 0})`,
      })),
  ]
}

/** Status keeps a tone dot so the control echoes the table's StatusChip. */
const statusOptions = computed(() => [
  { value: '', label: t('orders.allStatuses') },
  ...ADMIN_ORDER_STATUSES.filter(
    (value) => (statusCounts.value[value] ?? 0) > 0
  ).map((value) => {
    const tone = adminOrderStatusTone(value)
    return {
      value,
      label: `${t(adminOrderStatusLabelKey(value))} (${statusCounts.value[value] ?? 0})`,
      tone,
    }
  }),
])

const methodOptions = computed(() =>
  facetOptions(
    ADMIN_ORDER_METHODS,
    methodCounts.value,
    adminOrderMethodLabelKey,
    t('orders.allMethods')
  )
)

/* ---------------- export ---------------- */

function download(content: string, mime: string, ext: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ren2hub-orders-${new Date().toISOString().slice(0, 10)}.${ext}`
  anchor.click()
  URL.revokeObjectURL(url)
}

function serialize(
  items: AdminOrder[],
  format: string
): [string, string, string] {
  if (format === 'json') {
    return [
      JSON.stringify(items, null, 2),
      'application/json;charset=utf-8',
      'json',
    ]
  }
  if (format === 'excel') {
    return serializeSpreadsheet(
      ORDER_EXPORT_HEADERS,
      items.map(getOrderExportValues),
      'excel'
    )
  }
  return serializeSpreadsheet(
    ORDER_EXPORT_HEADERS,
    items.map(getOrderExportValues),
    'csv'
  )
}

async function doExport() {
  exportController?.abort()
  const controller = new AbortController()
  exportController = controller
  exporting.value = true
  try {
    const { items, truncated } = await fetchAllForExport(controller.signal)
    download(...serialize(items, exportFormat.value))
    exportOpen.value = false
    if (truncated) {
      toast.warning(
        t('orders.exportTruncated', {
          count: items.length,
          limit: ORDER_EXPORT_MAX_ROWS,
        })
      )
    } else {
      toast.success(t('orders.exported', { count: items.length }))
    }
  } catch (error) {
    // An unmount mid-export is a cancellation, not a failure to report.
    if (controller.signal.aborted) return
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    if (exportController === controller) exportController = null
    exporting.value = false
  }
}

onBeforeUnmount(() => exportController?.abort())
</script>

<template>
  <div>
    <PageBreadcrumb :crumbs="[t('nav.groupAdmin'), t('nav.orderManagement')]">
      <template #action>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            class="hidden text-xs tabular-nums text-[var(--text-tertiary)] sm:inline"
            aria-live="polite"
          >
            {{
              activeTab === 'list'
                ? t('orders.resultCount', {
                    count: total,
                    revenue: formatAdminOrderAmount(filteredEpayRevenue, 'CNY'),
                  })
                : t('orders.rangeSummary', {
                    days: range,
                    revenue: formatAdminOrderAmount(
                      stats?.total_revenue ?? 0,
                      'CNY'
                    ),
                  })
            }}
          </span>
          <div class="flex items-center gap-2">
            <!-- Export follows the list's filters, so it is only offered there. -->
            <ConsoleButton
              v-if="activeTab === 'list'"
              variant="secondary"
              size="sm"
              :disabled="loading || total === 0"
              @click="exportOpen = true"
            >
              <Download :size="14" />
              {{ t('orders.export') }}
            </ConsoleButton>
            <ConsoleButton
              variant="secondary"
              size="sm"
              :loading="refreshing || statsRefreshing"
              @click="refreshAll"
            >
              <RefreshCw v-if="!refreshing && !statsRefreshing" :size="14" />
              {{ t('orders.refresh') }}
            </ConsoleButton>
          </div>
        </div>
      </template>
    </PageBreadcrumb>

    <!-- 7/30/90-day range toggle — right-aligned, between header and tabs -->
    <div class="mb-0 flex justify-end">
      <SegmentedToggle
        v-model="rangeModel"
        :options="rangeOptions"
        :label="t('orders.rangeLabel')"
        size="sm"
      />
    </div>

    <ConsoleTabs
      v-model="activeTab"
      :items="tabs"
      :panel-id="ordersPanelId"
      class="-mt-3 mb-6"
    />

    <div
      :id="ordersPanelId"
      role="tabpanel"
      :aria-labelledby="`${ordersPanelId}-tab-${activeTab}`"
    >
      <!-- ============ overview ============ -->
      <div v-if="activeTab === 'overview'">
        <div
          v-if="statsError"
          class="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-6 py-16 text-center"
          role="alert"
        >
          <AlertTriangle :size="28" class="text-[var(--status-danger-text)]" />
          <p class="mt-3 font-semibold text-[var(--text-primary)]">
            {{ t('orders.statsFailed') }}
          </p>
          <p class="mt-1 max-w-md text-sm text-[var(--text-tertiary)]">
            {{ statsError }}
          </p>
          <ConsoleButton class="mt-5" variant="secondary" @click="loadStats()">
            {{ t('common.retry') }}
          </ConsoleButton>
        </div>

        <template v-else>
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OrderStatCard
              :label="t('orders.todayRevenue')"
              :value="formatAdminOrderAmount(stats?.today_revenue ?? 0, 'CNY')"
              :hint="
                t('orders.orderCount', { count: stats?.today_orders ?? 0 })
              "
              tone="success"
              :loading="statsLoading"
            >
              <template #icon><BadgeDollarSign :size="20" /></template>
            </OrderStatCard>
            <OrderStatCard
              :label="t('orders.totalRevenue')"
              :value="formatAdminOrderAmount(stats?.total_revenue ?? 0, 'CNY')"
              :hint="
                t('orders.orderCount', { count: stats?.total_orders ?? 0 })
              "
              tone="info"
              :loading="statsLoading"
            >
              <template #icon><CreditCard :size="20" /></template>
            </OrderStatCard>
            <OrderStatCard
              :label="t('orders.todayOrders')"
              :value="String(stats?.today_orders ?? 0)"
              :hint="t('orders.settledOnly')"
              tone="accent"
              :loading="statsLoading"
            >
              <template #icon><Receipt :size="20" /></template>
            </OrderStatCard>
            <OrderStatCard
              :label="t('orders.averageAmount')"
              :value="formatAdminOrderAmount(stats?.average_amount ?? 0, 'CNY')"
              :hint="t('orders.rangeDays', { days: range })"
              tone="warning"
              :loading="statsLoading"
            >
              <template #icon><TrendingUp :size="20" /></template>
            </OrderStatCard>
          </div>

          <OrderRevenueChart
            class="mt-5"
            :points="daily"
            :loading="statsLoading"
          />

          <div class="mt-5 grid gap-5 lg:grid-cols-2">
            <PaymentMethodShare
              :items="stats?.payment_share ?? []"
              :loading="statsLoading"
            />
            <TopSpenders
              :items="stats?.top_spenders ?? []"
              :loading="statsLoading"
            />
          </div>
        </template>
      </div>

      <!-- ============ order list ============ -->
      <ConsoleCard v-else :padded="false">
        <div
          class="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-4 xl:flex-row xl:items-center"
        >
          <SearchInput
            v-model="keyword"
            :placeholder="t('orders.searchPlaceholder')"
            :aria-label="t('orders.searchPlaceholder')"
            name="admin-order-search"
            class="w-full xl:w-72"
          />
          <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:flex-1">
            <FilterSelect
              v-model="status"
              :options="statusOptions"
              :label="t('orders.statusFilter')"
              class="w-full"
            />
            <FilterSelect
              v-model="method"
              :options="methodOptions"
              :label="t('orders.methodFilter')"
              class="w-full"
            />
          </div>
        </div>

        <div
          v-if="initialError"
          class="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center"
          role="alert"
        >
          <AlertTriangle :size="28" class="text-[var(--status-danger-text)]" />
          <p class="mt-3 font-semibold text-[var(--text-primary)]">
            {{ t('orders.loadFailed') }}
          </p>
          <p class="mt-1 max-w-md text-sm text-[var(--text-tertiary)]">
            {{ initialError }}
          </p>
          <ConsoleButton class="mt-5" variant="secondary" @click="load()">
            {{ t('common.retry') }}
          </ConsoleButton>
        </div>

        <template v-else>
          <!-- mobile -->
          <div class="lg:hidden">
            <OrderMobileList
              :orders="rows"
              :loading="loading"
              :view-order="(order) => (detailOrder = order)"
            />
          </div>

          <!-- desktop -->
          <div class="hidden lg:block">
            <DataTable
              :columns="columns"
              :rows="rows"
              row-key="id"
              :loading="loading"
              :skeleton-rows="pageSize"
              adaptive-scroll
              :page-size="pageSize"
              :scroll-region-label="t('orders.tableRows')"
              min-table-width="1060px"
              :empty-title="t('orders.emptyTitle')"
              :empty-hint="t('orders.emptyHint')"
              row-dblclickable
              @row-dblclick="(order) => (detailOrder = order as AdminOrder)"
            >
              <template #cell-id="{ row }">
                <span class="font-mono text-xs text-[var(--text-tertiary)]">
                  #{{ (row as AdminOrder).id }}
                </span>
              </template>

              <template #cell-order_no="{ row }">
                <span
                  class="block truncate font-mono text-xs text-[var(--text-secondary)]"
                  :title="(row as AdminOrder).order_no"
                >
                  {{ (row as AdminOrder).order_no }}
                </span>
              </template>

              <template #cell-user="{ row }">
                <span
                  class="block truncate text-xs text-[var(--text-secondary)]"
                  :title="(row as AdminOrder).email"
                >
                  {{ (row as AdminOrder).email }}
                </span>
              </template>

              <template #cell-amount="{ row }">
                <span class="font-semibold">
                  {{
                    formatAdminOrderAmount(
                      (row as AdminOrder).amount,
                      (row as AdminOrder).currency
                    )
                  }}
                </span>
              </template>

              <template #cell-method="{ row }">
                <span class="text-xs text-[var(--text-secondary)]">
                  {{ t(adminOrderMethodLabelKey((row as AdminOrder).method)) }}
                </span>
              </template>

              <template #cell-status="{ row }">
                <StatusChip
                  :tone="adminOrderStatusTone((row as AdminOrder).status)"
                >
                  {{ t(adminOrderStatusLabelKey((row as AdminOrder).status)) }}
                </StatusChip>
              </template>

              <template #cell-created="{ row }">
                <span class="text-xs text-[var(--text-tertiary)]">
                  {{ formatTime((row as AdminOrder).created) }}
                </span>
              </template>

              <template #cell-actions="{ row }">
                <div
                  class="flex items-center justify-end gap-1"
                  @click.stop
                  @dblclick.stop
                >
                  <IconButton
                    :label="t('orders.viewOrder')"
                    @click="detailOrder = row as AdminOrder"
                  >
                    <Eye :size="16" />
                  </IconButton>
                </div>
              </template>

              <template #footer>
                <div class="border-t border-[var(--border-subtle)]">
                  <TablePagination
                    v-model:page="page"
                    v-model:page-size="pageSize"
                    :total="total"
                  />
                </div>
              </template>
            </DataTable>
          </div>

          <div class="border-t border-[var(--border-subtle)] lg:hidden">
            <TablePagination
              v-model:page="page"
              v-model:page-size="pageSize"
              :total="total"
            />
          </div>
        </template>
      </ConsoleCard>
    </div>

    <OrderDetailModal :order="detailOrder" @close="detailOrder = null" />

    <ConsoleModal
      :open="exportOpen"
      :title="t('orders.exportTitle')"
      :subtitle="t('orders.exportSubtitle')"
      size="sm"
      @close="exportOpen = false"
    >
      <FormField :label="t('orders.exportFormat')">
        <FilterSelect
          v-model="exportFormat"
          :options="[
            { value: 'csv', label: 'CSV' },
            { value: 'excel', label: 'Excel' },
            { value: 'json', label: 'JSON' },
          ]"
          :label="t('orders.exportFormat')"
        />
      </FormField>
      <template #footer>
        <ConsoleButton size="lg" block :loading="exporting" @click="doExport">
          {{ t('common.confirm') }}
        </ConsoleButton>
      </template>
    </ConsoleModal>
  </div>
</template>
