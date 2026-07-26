<script setup lang="ts">
import {
  AlertTriangle,
  BadgeDollarSign,
  CreditCard,
  Download,
  Eye,
  LoaderCircle,
  Receipt,
  RefreshCw,
  RotateCcw,
  TrendingUp,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiError } from '@/api/types'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
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
import Breadcrumb from '@/components/console/Breadcrumb.vue'
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
  ADMIN_ORDER_TYPES,
  adminOrderMethodLabelKey,
  adminOrderStatusLabelKey,
  adminOrderStatusTone,
  adminOrderTypeLabelKey,
  isAdminOrderRange,
} from '@/constants/adminOrders'
import type { AdminOrder, AdminOrderRange } from '@/types/console'
import { formatMoney, formatTime } from '@/utils/format'

const { t } = useI18n()
const toast = useToast()
const {
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
} = useAdminOrders()

const activeTab = ref('overview')
const detailOrder = ref<AdminOrder | null>(null)
const refundTarget = ref<AdminOrder | null>(null)
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
      tone: tone === 'neutral' ? undefined : tone,
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

const typeOptions = computed(() =>
  facetOptions(
    ADMIN_ORDER_TYPES,
    typeCounts.value,
    adminOrderTypeLabelKey,
    t('orders.allTypes')
  )
)

function requestRefund(order: AdminOrder) {
  if (!canRefund(order)) return
  // Close the detail sheet first so the confirmation is not a second modal
  // stacked on top of it.
  detailOrder.value = null
  refundTarget.value = order
}

async function confirmRefund() {
  const target = refundTarget.value
  if (!target) return
  if (await refundOrder(target)) refundTarget.value = null
}

function cancelRefund() {
  if (!isRefundBusy.value) refundTarget.value = null
}

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
    const esc = (value: unknown) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    const head = `<tr>${ORDER_EXPORT_HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr>`
    const body = items
      .map(
        (order) =>
          `<tr>${getOrderExportValues(order)
            .map((value) => `<td>${esc(value)}</td>`)
            .join('')}</tr>`
      )
      .join('')
    return [
      `<html><head><meta charset="utf-8"></head><body><table>${head}${body}</table></body></html>`,
      'application/vnd.ms-excel;charset=utf-8',
      'xls',
    ]
  }
  const csvRow = (values: readonly unknown[]) =>
    values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')
  // Leading BOM so Excel reads the UTF-8 order numbers and emails correctly.
  const csv = [
    csvRow(ORDER_EXPORT_HEADERS),
    ...items.map((order) => csvRow(getOrderExportValues(order))),
  ].join('\n')
  return ['﻿' + csv, 'text/csv;charset=utf-8', 'csv']
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
    <header
      class="mb-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="min-w-0">
        <Breadcrumb
          :crumbs="[t('nav.groupAdmin'), t('nav.orderManagement')]"
          spacing="mb-2"
        />
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">
          {{ t('orders.title') }}
        </h1>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]" aria-live="polite">
          {{
            activeTab === 'list'
              ? t('orders.resultCount', {
                  count: total,
                  revenue: formatMoney(filteredRevenue),
                })
              : t('orders.rangeSummary', {
                  days: range,
                  revenue: formatMoney(stats?.total_revenue ?? 0),
                })
          }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Export follows the list's filters, so it is only offered there. -->
        <ConsoleButton
          v-if="activeTab === 'list'"
          variant="secondary"
          :disabled="loading || total === 0"
          @click="exportOpen = true"
        >
          <Download :size="15" />
          {{ t('orders.export') }}
        </ConsoleButton>
        <ConsoleButton
          variant="secondary"
          :loading="refreshing || statsRefreshing"
          :disabled="isRefundBusy"
          @click="refreshAll"
        >
          <RefreshCw v-if="!refreshing && !statsRefreshing" :size="15" />
          {{ t('orders.refresh') }}
        </ConsoleButton>
      </div>
    </header>

    <!-- 7/30/90-day range toggle — right-aligned, between header and tabs -->
    <div class="mb-0 flex justify-end">
      <SegmentedToggle
        v-model="rangeModel"
        :options="rangeOptions"
        :label="t('orders.rangeLabel')"
        size="sm"
      />
    </div>

    <ConsoleTabs v-model="activeTab" :items="tabs" class="-mt-3 mb-6" />

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
            :value="formatMoney(stats?.today_revenue ?? 0)"
            :hint="t('orders.orderCount', { count: stats?.today_orders ?? 0 })"
            tone="success"
            :loading="statsLoading"
          >
            <template #icon><BadgeDollarSign :size="20" /></template>
          </OrderStatCard>
          <OrderStatCard
            :label="t('orders.totalRevenue')"
            :value="formatMoney(stats?.total_revenue ?? 0)"
            :hint="t('orders.orderCount', { count: stats?.total_orders ?? 0 })"
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
            :value="formatMoney(stats?.average_amount ?? 0)"
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
        <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:flex-1">
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
          <FilterSelect
            v-model="type"
            :options="typeOptions"
            :label="t('orders.typeFilter')"
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
            :can-refund="canRefund"
            :is-refunding="isRefunding"
            :view-order="(order) => (detailOrder = order)"
            :refund-order="requestRefund"
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
                {{ formatMoney((row as AdminOrder).amount) }}
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
                <IconButton
                  v-if="canRefund(row as AdminOrder)"
                  :label="t('orders.refundOrder')"
                  tone="danger"
                  :disabled="isRefundBusy"
                  @click="requestRefund(row as AdminOrder)"
                >
                  <LoaderCircle
                    v-if="isRefunding((row as AdminOrder).id)"
                    :size="16"
                    class="animate-spin"
                  />
                  <RotateCcw v-else :size="16" />
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

    <OrderDetailModal
      :order="detailOrder"
      :can-refund="detailOrder ? canRefund(detailOrder) : false"
      @close="detailOrder = null"
      @refund="requestRefund"
    />

    <ConfirmDialog
      :open="refundTarget !== null"
      :title="t('orders.refundTitle')"
      :message="
        refundTarget
          ? t('orders.refundMessage', {
              no: refundTarget.order_no,
              amount: formatMoney(refundTarget.amount),
            })
          : ''
      "
      :confirm-text="t('orders.refundConfirm')"
      :loading="isRefundBusy"
      @confirm="confirmRefund"
      @cancel="cancelRefund"
    />

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
