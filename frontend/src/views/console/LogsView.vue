<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError, type PageResult } from '@/api/types'
import type { LogItem, LogType } from '@/types/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import FormField from '@/components/common/FormField.vue'
import IconButton from '@/components/common/IconButton.vue'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import LogMobileCard from '@/components/console/log-ui/LogMobileCard.vue'
import LogReasoningEffort from '@/components/console/log-ui/LogReasoningEffort.vue'
import {
  getLogExportValues,
  LOG_EXPORT_HEADERS,
} from '@/components/console/log-ui/logExport'
import LogPerformanceCell from '@/components/console/log-ui/LogPerformanceCell.vue'
import LogUsageCell from '@/components/console/log-ui/LogUsageCell.vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import { formatNumber, formatQuota, formatTime } from '@/utils/format'
import { serializeSpreadsheet } from '@/utils/spreadsheetExport'

const { t } = useI18n()
const toast = useToast()

interface LogStat {
  total_requests: number
  total_quota: number
  today_requests: number
  today_quota: number
}

const rows = ref<LogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(true)
const stat = ref<LogStat | null>(null)

const keyword = ref('')
const type = ref('')
const startDate = ref('')
const endDate = ref('')
const exportOpen = ref(false)
const exportType = ref('csv')
const detailLog = ref<LogItem | null>(null)

function openLogDetails(log: LogItem): void {
  detailLog.value = log
}

function closeLogDetails(): void {
  detailLog.value = null
}

// ---------- column visibility ----------

type ColKey =
  | 'created'
  | 'identity'
  | 'route'
  | 'reasoning'
  | 'performance'
  | 'usage'
  | 'cost'
  | 'content'

const ALL_COL_KEYS: ColKey[] = [
  'created',
  'identity',
  'route',
  'reasoning',
  'performance',
  'usage',
  'cost',
  'content',
]

const visibleCols = ref<Set<ColKey>>(new Set(ALL_COL_KEYS))

const colSettingsOpen = ref(false)
const colSettingsRef = ref<HTMLElement | null>(null)
const colSettingsTriggerRef = ref<InstanceType<typeof IconButton> | null>(null)
const colSettingsPanelRef = ref<HTMLElement | null>(null)
const colSettingsPanelId = useId()
const colSettingsTitleId = useId()
const colSettingsPanelStyle = ref({
  maxHeight: 'min(22rem, calc(100dvh - 2rem))',
})

function updateColSettingsPanelMetrics() {
  const trigger = colSettingsRef.value?.querySelector<HTMLElement>(
    'button[aria-haspopup="dialog"]'
  )
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const viewportBottom = window.visualViewport
    ? window.visualViewport.offsetTop + window.visualViewport.height
    : window.innerHeight
  const availableHeight = Math.max(
    0,
    Math.floor(viewportBottom - rect.bottom - 12)
  )
  colSettingsPanelStyle.value = {
    maxHeight: `${Math.min(352, availableHeight)}px`,
  }
}

async function openColSettings() {
  colSettingsOpen.value = true
  await nextTick()
  updateColSettingsPanelMetrics()
  colSettingsPanelRef.value?.querySelector<HTMLButtonElement>('button')?.focus()
}

function closeColSettings({ restoreFocus = false } = {}) {
  colSettingsOpen.value = false
  if (restoreFocus) nextTick(() => colSettingsTriggerRef.value?.focus())
}

function toggleColSettings() {
  if (colSettingsOpen.value) closeColSettings({ restoreFocus: true })
  else void openColSettings()
}

function isLastVisibleCol(key: ColKey) {
  return visibleCols.value.size === 1 && visibleCols.value.has(key)
}

function toggleCol(key: ColKey) {
  if (isLastVisibleCol(key)) return
  const s = new Set(visibleCols.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  visibleCols.value = s
}

function onColSettingsKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !colSettingsOpen.value) return
  e.preventDefault()
  e.stopPropagation()
  closeColSettings({ restoreFocus: true })
}

function onColSettingsFocusout() {
  window.requestAnimationFrame(() => {
    if (colSettingsRef.value?.contains(document.activeElement)) return
    closeColSettings()
  })
}

function updateOpenColSettingsPanelMetrics() {
  if (colSettingsOpen.value) updateColSettingsPanelMetrics()
}

onClickOutside(colSettingsRef, () => closeColSettings())

// ---------- type options (6 types) ----------

const typeOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'consume', label: t('logs.typeConsume'), tone: 'accent' as const },
  { value: 'topup', label: t('logs.typeTopup'), tone: 'success' as const },
  { value: 'refund', label: t('logs.typeRefund'), tone: 'warning' as const },
  { value: 'manage', label: t('logs.typeManage'), tone: 'info' as const },
  { value: 'error', label: t('logs.typeError'), tone: 'danger' as const },
  { value: 'system', label: t('logs.typeSystem'), tone: 'info' as const },
])

// ---------- columns (dynamic, driven by visibleCols) ----------

const COL_META: Record<
  ColKey,
  { labelKey: string; width?: string; align?: 'left' | 'right' | 'center' }
> = {
  created: { labelKey: 'logs.colTime', width: '130px' },
  identity: { labelKey: 'logs.colIdentity', width: '155px' },
  route: { labelKey: 'logs.colRoute', width: '165px' },
  reasoning: { labelKey: 'logs.colReasoning', width: '104px' },
  performance: { labelKey: 'logs.colPerformance', width: '200px' },
  usage: { labelKey: 'logs.colUsage', width: '180px' },
  cost: { labelKey: 'logs.colCost', width: '96px', align: 'right' },
  content: { labelKey: 'logs.colContent' },
}

const columns = computed<TableColumn[]>(() =>
  ALL_COL_KEYS.filter((k) => visibleCols.value.has(k)).map((k) => {
    const m = COL_META[k]
    return {
      key: k,
      label: t(m.labelKey),
      ...(m.width ? { width: m.width } : {}),
      ...(m.align ? { align: m.align } : {}),
    }
  })
)

// ---------- type tones ----------

const typeTone: Record<
  LogType,
  'accent' | 'success' | 'warning' | 'info' | 'danger'
> = {
  consume: 'accent',
  topup: 'success',
  refund: 'warning',
  manage: 'info',
  error: 'danger',
  system: 'info',
}

const typeLabelKey: Record<LogType, string> = {
  consume: 'logs.typeConsume',
  topup: 'logs.typeTopup',
  refund: 'logs.typeRefund',
  manage: 'logs.typeManage',
  error: 'logs.typeError',
  system: 'logs.typeSystem',
}

function quotaPrefix(type: LogType): string {
  return ['topup', 'refund', 'manage', 'system'].includes(type) ? '+' : '-'
}

// ---------- data fetching ----------

function currentParams() {
  return {
    page: page.value,
    page_size: pageSize.value,
    keyword: keyword.value,
    type: type.value,
    start: startDate.value
      ? Math.floor(new Date(startDate.value).getTime() / 1000)
      : 0,
    end: endDate.value
      ? Math.floor(new Date(endDate.value).getTime() / 1000) + 86_399
      : 0,
  }
}

const listRequest = useLatestRequest()
const statsRequest = useLatestRequest()

async function load() {
  loading.value = true
  const result = await listRequest.run((signal) =>
    api.get<PageResult<LogItem>>('/api/log/self', currentParams(), { signal })
  )
  if (result.stale) return
  loading.value = false
  if (!result.ok) {
    toast.error(
      result.error instanceof ApiError
        ? result.error.message
        : t('common.failed')
    )
    return
  }
  rows.value = result.value.items
  total.value = result.value.total
}

let searchTimer = 0
function reload() {
  window.clearTimeout(searchTimer)
  if (page.value === 1) load()
  else page.value = 1
}
watch(keyword, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(reload, 300)
})
watch([type, startDate, endDate], reload)
watch(pageSize, reload)
watch(page, load)

// ---------- export ----------

const exporting = ref(false)
let exportController: AbortController | null = null

const EXPORT_PAGE_SIZE = 100
/**
 * Hard ceiling on an export. Without it a filter matching the whole ledger
 * fans out into thousands of sequential requests and hangs the tab; the user is
 * told plainly when the file is truncated rather than silently getting part of
 * the data.
 */
const EXPORT_MAX_ROWS = 10_000

async function fetchAllLogs(
  signal: AbortSignal
): Promise<{ items: LogItem[]; truncated: boolean }> {
  // page/page_size come from the export loop, not from the table's paging.
  const { page: _page, page_size: _pageSize, ...filters } = currentParams()

  const first = await api.get<PageResult<LogItem>>(
    '/api/log/self',
    { ...filters, page: 1, page_size: EXPORT_PAGE_SIZE },
    { signal }
  )

  const items = [...first.items]
  const reachable = Math.min(first.total, EXPORT_MAX_ROWS)
  const pages = Math.ceil(reachable / EXPORT_PAGE_SIZE)

  for (let p = 2; p <= pages; p++) {
    const next = await api.get<PageResult<LogItem>>(
      '/api/log/self',
      { ...filters, page: p, page_size: EXPORT_PAGE_SIZE },
      { signal }
    )
    items.push(...next.items)
  }

  return {
    items: items.slice(0, EXPORT_MAX_ROWS),
    truncated: first.total > EXPORT_MAX_ROWS,
  }
}

function download(content: string, mime: string, ext: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ren2hub-logs-${new Date().toISOString().slice(0, 10)}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

async function doExport() {
  exportController?.abort()
  const controller = new AbortController()
  exportController = controller
  exporting.value = true
  try {
    const { items, truncated } = await fetchAllLogs(controller.signal)
    if (exportType.value === 'json') {
      download(
        JSON.stringify(items, null, 2),
        'application/json;charset=utf-8',
        'json'
      )
    } else if (exportType.value === 'excel') {
      download(
        ...serializeSpreadsheet(
          LOG_EXPORT_HEADERS,
          items.map(getLogExportValues),
          'excel'
        )
      )
    } else {
      download(
        ...serializeSpreadsheet(
          LOG_EXPORT_HEADERS,
          items.map(getLogExportValues),
          'csv'
        )
      )
    }
    exportOpen.value = false
    if (truncated) {
      toast.warning(
        t('logs.exportTruncated', {
          count: items.length,
          limit: EXPORT_MAX_ROWS,
        })
      )
    } else {
      toast.success(t('logs.exported', { count: items.length }))
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

onMounted(async () => {
  window.addEventListener('resize', updateOpenColSettingsPanelMetrics, {
    passive: true,
  })
  window.visualViewport?.addEventListener(
    'resize',
    updateOpenColSettingsPanelMetrics,
    { passive: true }
  )
  void load()
  const result = await statsRequest.run((signal) =>
    api.get<LogStat>('/api/log/self/stat', undefined, { signal })
  )
  if (result.stale) return
  if (result.ok) stat.value = result.value
  else
    toast.error(
      result.error instanceof ApiError
        ? result.error.message
        : t('common.failed')
    )
})

onBeforeUnmount(() => {
  exportController?.abort()
  window.clearTimeout(searchTimer)
  window.removeEventListener('resize', updateOpenColSettingsPanelMetrics)
  window.visualViewport?.removeEventListener(
    'resize',
    updateOpenColSettingsPanelMetrics
  )
})
</script>

<template>
  <div data-log-page class="mx-auto max-w-[1276px]">
    <PageBreadcrumb
      :crumbs="[t('logs.breadcrumb.0'), t('logs.breadcrumb.1')]"
    />

    <!-- stat strip -->
    <ConsoleCard class="mb-5" :padded="false">
      <div class="flex divide-x divide-[var(--border-subtle)] overflow-x-auto">
        <div
          v-for="card in [
            {
              label: t('logs.statTotalRequests'),
              value: formatNumber(stat?.total_requests ?? 0),
              tone: 'var(--text-primary)',
            },
            {
              label: t('logs.statTotalQuota'),
              value: formatQuota(stat?.total_quota ?? 0),
              tone: 'var(--accent-text)',
            },
            {
              label: t('logs.statTodayRequests'),
              value: formatNumber(stat?.today_requests ?? 0),
              tone: 'var(--signal)',
            },
            {
              label: t('logs.statTodayQuota'),
              value: formatQuota(stat?.today_quota ?? 0),
              tone: 'var(--status-success)',
            },
          ]"
          :key="card.label"
          class="flex min-w-[180px] flex-1 items-center justify-between gap-4 px-5 py-4"
        >
          <p class="shrink-0 text-xs text-[var(--text-tertiary)]">
            {{ card.label }}
          </p>
          <p
            class="text-xl font-bold tracking-tight"
            :style="{ color: card.tone }"
          >
            {{ card.value }}
          </p>
        </div>
      </div>
    </ConsoleCard>

    <!-- filter toolbar -->
    <div
      class="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4 shadow-[var(--card-shadow)]"
    >
      <SearchInput
        v-model="keyword"
        :placeholder="t('logs.keywordPlaceholder')"
        :aria-label="t('logs.keywordPlaceholder')"
        name="log-search"
        class="w-full sm:w-56"
      />
      <FilterSelect
        v-model="type"
        :options="typeOptions"
        :label="t('logs.typeLabel')"
        :prefix-label="t('logs.typeLabel') + ':'"
        class="w-full sm:w-48"
      />
      <DateRangePicker
        v-model:start="startDate"
        v-model:end="endDate"
        class="w-full sm:w-64"
      />
      <div class="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
        <div
          ref="colSettingsRef"
          class="relative hidden lg:block"
          @keydown="onColSettingsKeydown"
          @focusout="onColSettingsFocusout"
        >
          <IconButton
            ref="colSettingsTriggerRef"
            :label="t('logs.colSettings')"
            class="h-11 w-11 border border-[var(--border-default)] sm:h-8 sm:w-8"
            :class="
              colSettingsOpen
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'bg-[var(--surface-solid)] text-[var(--text-secondary)]'
            "
            aria-haspopup="dialog"
            :aria-expanded="colSettingsOpen"
            :aria-controls="colSettingsPanelId"
            @click="toggleColSettings"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M4 6h3m4 0h9M4 12h9m4 0h3M4 18h4m4 0h8" />
              <circle cx="9" cy="6" r="2" />
              <circle cx="15" cy="12" r="2" />
              <circle cx="10" cy="18" r="2" />
            </svg>
          </IconButton>

          <Transition name="col-panel">
            <div
              v-if="colSettingsOpen"
              :id="colSettingsPanelId"
              ref="colSettingsPanelRef"
              class="subtle-scroll absolute right-0 top-full z-50 mt-2 w-44 overflow-y-auto rounded-xl border border-[var(--overlay-border)] bg-[var(--surface-overlay)] py-1.5 shadow-[var(--overlay-shadow)]"
              :style="colSettingsPanelStyle"
              role="dialog"
              aria-modal="false"
              :aria-labelledby="colSettingsTitleId"
            >
              <p
                :id="colSettingsTitleId"
                class="px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
              >
                {{ t('logs.colSettings') }}
              </p>
              <button
                v-for="key in ALL_COL_KEYS"
                :key="key"
                type="button"
                class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
                :class="[
                  visibleCols.has(key)
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)]',
                  isLastVisibleCol(key) ? 'cursor-not-allowed opacity-55' : '',
                ]"
                :aria-pressed="visibleCols.has(key)"
                :aria-disabled="isLastVisibleCol(key)"
                :title="
                  isLastVisibleCol(key) ? t('logs.keepOneColumn') : undefined
                "
                @click="toggleCol(key)"
              >
                <span
                  class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
                  :class="
                    visibleCols.has(key)
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                      : 'border-[var(--border-default)] bg-transparent'
                  "
                  aria-hidden="true"
                >
                  <svg
                    v-if="visibleCols.has(key)"
                    width="9"
                    height="9"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                </span>
                <span class="truncate">{{ t(COL_META[key].labelKey) }}</span>
              </button>
            </div>
          </Transition>
        </div>

        <ConsoleButton variant="secondary" @click="exportOpen = true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
            />
          </svg>
          {{ t('common.export') }}
        </ConsoleButton>
      </div>
    </div>

    <ConsoleCard class="hidden lg:block" :padded="false">
      <DataTable
        :columns="columns"
        :rows="rows"
        row-key="id"
        :loading="loading"
        :skeleton-rows="pageSize"
        adaptive-scroll
        :page-size="pageSize"
        min-table-width="clamp(1125px, 100%, 1276px)"
        :scroll-region-label="t('logs.breadcrumb.1')"
        :empty-title="t('logs.emptyTitle')"
        :empty-hint="t('logs.emptyHint')"
        empty-illustration="empty-logs"
      >
        <template #cell-created="{ row }">
          <span class="whitespace-nowrap text-xs text-[var(--text-tertiary)]">
            {{ formatTime((row as LogItem).created) }}
          </span>
        </template>
        <template #cell-identity="{ row }">
          <div class="flex min-w-0 flex-col items-start gap-1.5">
            <span
              class="block max-w-full truncate font-mono text-xs text-[var(--text-secondary)]"
              :title="(row as LogItem).token_name"
            >
              {{ (row as LogItem).token_name }}
            </span>
            <StatusChip :tone="typeTone[(row as LogItem).type]">
              {{ t(typeLabelKey[(row as LogItem).type]) }}
            </StatusChip>
          </div>
        </template>
        <template #cell-route="{ row }">
          <div class="min-w-0">
            <p
              data-log-model
              class="truncate font-mono text-sm font-semibold leading-5 text-[var(--text-primary)]"
              :title="(row as LogItem).model"
            >
              {{ (row as LogItem).model }}
            </p>
            <p
              class="mt-0.5 truncate text-xs text-[var(--text-tertiary)]"
              :title="(row as LogItem).channel"
            >
              {{ (row as LogItem).channel }}
            </p>
          </div>
        </template>
        <template #cell-reasoning="{ row }">
          <LogReasoningEffort :log="row as LogItem" />
        </template>
        <template #cell-performance="{ row }">
          <LogPerformanceCell :log="row as LogItem" />
        </template>
        <template #cell-usage="{ row }">
          <LogUsageCell :log="row as LogItem" />
        </template>
        <template #cell-cost="{ row }">
          <span
            data-log-cost
            class="whitespace-nowrap text-sm font-semibold tabular-nums"
            :class="
              ['topup', 'refund', 'manage', 'system'].includes(
                (row as LogItem).type
              )
                ? 'text-[var(--status-success-text)]'
                : 'text-[var(--text-primary)]'
            "
          >
            {{ quotaPrefix((row as LogItem).type)
            }}{{ formatQuota((row as LogItem).quota) }}
          </span>
        </template>
        <template #cell-content="{ row }">
          <button
            type="button"
            data-log-detail-trigger
            class="block w-full min-w-0 truncate text-left text-xs text-[var(--text-tertiary)] underline-offset-4 transition-colors hover:text-[var(--text-secondary)] hover:underline focus-visible:text-[var(--text-secondary)] focus-visible:underline focus-visible:outline-none"
            :title="(row as LogItem).content"
            :aria-label="t('logs.viewLogDetails')"
            @click="openLogDetails(row as LogItem)"
          >
            {{ (row as LogItem).content }}
          </button>
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
    </ConsoleCard>

    <section class="lg:hidden" :aria-label="t('logs.breadcrumb.1')">
      <div v-if="loading" class="space-y-3" aria-busy="true">
        <div
          v-for="index in Math.min(pageSize, 5)"
          :key="index"
          class="h-56 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
        />
      </div>

      <div v-else-if="rows.length" class="space-y-3">
        <LogMobileCard
          v-for="row in rows"
          :key="row.id"
          :log="row"
          @view-details="openLogDetails"
        />
      </div>

      <div
        v-else
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
      >
        <EmptyState
          :title="t('logs.emptyTitle')"
          :hint="t('logs.emptyHint')"
          illustration="empty-logs"
        />
      </div>

      <div
        class="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
      >
        <TablePagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="total"
        />
      </div>
    </section>

    <ConsoleModal
      :open="detailLog !== null"
      :title="t('logs.detailTitle')"
      size="md"
      @close="closeLogDetails"
    >
      <div data-log-detail-empty class="min-h-20" />
      <template #footer>
        <div class="flex justify-end">
          <ConsoleButton variant="secondary" @click="closeLogDetails">
            {{ t('common.close') }}
          </ConsoleButton>
        </div>
      </template>
    </ConsoleModal>

    <!-- export modal -->
    <ConsoleModal
      :open="exportOpen"
      :title="t('logs.exportTitle')"
      :subtitle="t('logs.exportSubtitle')"
      size="sm"
      @close="exportOpen = false"
    >
      <FormField :label="t('logs.docType')">
        <FilterSelect
          v-model="exportType"
          :options="[
            { value: 'csv', label: 'CSV' },
            { value: 'excel', label: 'Excel' },
            { value: 'json', label: 'JSON' },
          ]"
          :label="t('logs.docType')"
        />
      </FormField>
      <template #footer>
        <ConsoleButton size="lg" block :loading="exporting" @click="doExport">{{
          t('common.confirm')
        }}</ConsoleButton>
      </template>
    </ConsoleModal>
  </div>
</template>

<style scoped>
.col-panel-enter-active,
.col-panel-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.col-panel-enter-from,
.col-panel-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
</style>
