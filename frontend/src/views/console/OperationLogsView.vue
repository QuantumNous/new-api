<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, Eye } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { parseOperationLogPage } from '@/api/liveContracts'
import { ApiError, type PageResult } from '@/api/types'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import FormField from '@/components/common/FormField.vue'
import IconButton from '@/components/common/IconButton.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import LogsNavTabs from '@/components/console/log-ui/LogsNavTabs.vue'
import {
  operationLogAuthMethodKey,
  operationLogKindKey,
  operationLogKindTone,
  operationLogParamLabel,
  operationLogParamValue,
  operationLogRequestText,
  operationLogResultKey,
  operationLogResultTone,
  operationLogRoleKey,
  operationLogSummary,
} from '@/components/console/log-ui/operationLog'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import type { OperationLogItem, OperationLogKind } from '@/types/console'
import { dateInputValue, formatTime } from '@/utils/format'
import { serializeSpreadsheet } from '@/utils/spreadsheetExport'

const { t } = useI18n()
const toast = useToast()

const rows = ref<OperationLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(true)
const loadError = ref(false)

const keyword = ref('')
const kind = ref<'all' | OperationLogKind>('all')
const startDate = ref(dateInputValue(-29))
const endDate = ref(dateInputValue())

const detailLog = ref<OperationLogItem | null>(null)
const exportOpen = ref(false)
const exportType = ref('csv')
const exporting = ref(false)

const columns = computed<TableColumn[]>(() => [
  { key: 'created', label: t('operationLogs.columns.time'), width: '150px' },
  { key: 'actor', label: t('operationLogs.columns.actor'), width: '170px' },
  {
    key: 'result',
    label: t('operationLogs.columns.kindResult'),
    width: '150px',
  },
  { key: 'summary', label: t('operationLogs.columns.summary') },
  { key: 'source', label: t('operationLogs.columns.source'), width: '150px' },
  { key: 'request', label: t('operationLogs.columns.request'), width: '220px' },
  {
    key: 'detail',
    label: t('operationLogs.columns.detail'),
    width: '72px',
    align: 'right',
  },
])

const kindOptions = computed(() => [
  { value: 'all', label: t('operationLogs.kind.all') },
  {
    value: 'manage',
    label: t('operationLogs.kind.manage'),
    tone: 'accent' as const,
  },
  {
    value: 'system',
    label: t('operationLogs.kind.system'),
    tone: 'warning' as const,
  },
  {
    value: 'login',
    label: t('operationLogs.kind.login'),
    tone: 'info' as const,
  },
])

const detailParams = computed(() =>
  Object.entries(detailLog.value?.params ?? {}).filter(
    ([, value]) => value !== undefined
  )
)

function currentParams() {
  return {
    p: page.value,
    page_size: pageSize.value,
    kind: kind.value,
    keyword: keyword.value.trim(),
    start_timestamp: startDate.value
      ? Math.floor(new Date(startDate.value).getTime() / 1000)
      : 0,
    end_timestamp: endDate.value
      ? Math.floor(new Date(endDate.value).getTime() / 1000) + 86_399
      : 0,
  }
}

const listRequest = useLatestRequest()

async function load(): Promise<void> {
  loading.value = true
  loadError.value = false
  const result = await listRequest.run((signal) =>
    api.get<PageResult<OperationLogItem>>(
      '/api/next/admin/operation-logs',
      currentParams(),
      { signal }
    )
  )
  if (result.stale) return
  loading.value = false
  if (!result.ok) {
    rows.value = []
    total.value = 0
    loadError.value = true
    toast.error(
      result.error instanceof ApiError
        ? result.error.message
        : t('operationLogs.loadFailed')
    )
    return
  }
  const resultPage = parseOperationLogPage(result.value as unknown)
  rows.value = resultPage.items
  total.value = resultPage.total
}

let searchTimer = 0
function reload(): void {
  window.clearTimeout(searchTimer)
  if (page.value === 1) void load()
  else page.value = 1
}

watch(keyword, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(reload, 300)
})
watch([kind, startDate, endDate], reload)
watch(pageSize, reload)
watch(page, load)

function actorName(log: OperationLogItem): string {
  return (
    log.actor.username ||
    (log.actor.id ? t('operationLogs.actorId', { id: log.actor.id }) : '-')
  )
}

function authMethod(log: OperationLogItem): string {
  if (!log.actor.auth_method) return '-'
  const key = operationLogAuthMethodKey(log.actor.auth_method)
  if (!key) return log.actor.auth_method
  const provider = log.actor.auth_method.startsWith('oauth:')
    ? log.actor.auth_method.slice(6)
    : ''
  return t(key, { provider })
}

function statusText(log: OperationLogItem): string {
  const status = log.request?.status
  return status === null || status === undefined ? '-' : String(status)
}

const EXPORT_PAGE_SIZE = 100
const EXPORT_MAX_ROWS = 10_000
let exportController: AbortController | null = null

async function fetchAllLogs(
  signal: AbortSignal
): Promise<{ items: OperationLogItem[]; truncated: boolean }> {
  const { p: _page, page_size: _pageSize, ...filters } = currentParams()
  const firstRaw = await api.get<PageResult<OperationLogItem>>(
    '/api/next/admin/operation-logs',
    { ...filters, p: 1, page_size: EXPORT_PAGE_SIZE },
    { signal }
  )
  const first = parseOperationLogPage(firstRaw as unknown)
  const items = [...first.items]
  const reachable = Math.min(first.total, EXPORT_MAX_ROWS)
  const pages = Math.ceil(reachable / EXPORT_PAGE_SIZE)

  for (let nextPage = 2; nextPage <= pages; nextPage++) {
    const nextRaw = await api.get<PageResult<OperationLogItem>>(
      '/api/next/admin/operation-logs',
      { ...filters, p: nextPage, page_size: EXPORT_PAGE_SIZE },
      { signal }
    )
    const next = parseOperationLogPage(nextRaw as unknown)
    items.push(...next.items)
  }

  return {
    items: items.slice(0, EXPORT_MAX_ROWS),
    truncated: first.total > EXPORT_MAX_ROWS,
  }
}

function exportValues(log: OperationLogItem): readonly unknown[] {
  return [
    formatTime(log.created_at),
    actorName(log),
    t(operationLogRoleKey(log.actor.role)),
    t(operationLogKindKey(log.kind)),
    t(operationLogResultKey(log)),
    operationLogSummary(log, t),
    log.ip,
    authMethod(log),
    log.user_agent,
    log.request?.method ?? '',
    log.request?.route || log.request?.path || '',
    statusText(log),
    Object.entries(log.params)
      .map(
        ([key, value]) =>
          `${operationLogParamLabel(key, t)}: ${operationLogParamValue(value)}`
      )
      .join('; '),
  ]
}

function download(content: string, mime: string, ext: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ren2hub-operation-logs-${new Date().toISOString().slice(0, 10)}.${ext}`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function doExport(): Promise<void> {
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
    } else {
      const headers = [
        t('operationLogs.export.time'),
        t('operationLogs.export.actor'),
        t('operationLogs.export.role'),
        t('operationLogs.export.kind'),
        t('operationLogs.export.result'),
        t('operationLogs.export.summary'),
        t('operationLogs.export.ip'),
        t('operationLogs.export.authMethod'),
        t('operationLogs.export.userAgent'),
        t('operationLogs.export.method'),
        t('operationLogs.export.route'),
        t('operationLogs.export.status'),
        t('operationLogs.export.params'),
      ]
      download(
        ...serializeSpreadsheet(
          headers,
          items.map(exportValues),
          exportType.value === 'excel' ? 'excel' : 'csv'
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
    if (controller.signal.aborted) return
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    if (exportController === controller) exportController = null
    exporting.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  exportController?.abort()
})
</script>

<template>
  <div class="mx-auto max-w-[1276px]">
    <PageBreadcrumb
      :crumbs="[t('logs.breadcrumb.0'), t('operationLogs.breadcrumb')]"
    >
      <template #action>
        <LogsNavTabs active="operations" />
      </template>
    </PageBreadcrumb>

    <div
      class="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4 shadow-[var(--card-shadow)]"
    >
      <SearchInput
        v-model="keyword"
        maxlength="128"
        :placeholder="t('operationLogs.keywordPlaceholder')"
        :aria-label="t('operationLogs.keywordPlaceholder')"
        name="operation-log-search"
        class="w-full sm:w-64"
      />
      <FilterSelect
        v-model="kind"
        :options="kindOptions"
        :label="t('operationLogs.kindLabel')"
        :prefix-label="t('operationLogs.kindLabel') + ':'"
        class="w-full sm:w-48"
      />
      <DateRangePicker
        v-model:start="startDate"
        v-model:end="endDate"
        class="w-full sm:w-64"
      />
      <ConsoleButton
        class="ml-auto w-full sm:w-auto"
        variant="secondary"
        @click="exportOpen = true"
      >
        <Download :size="16" aria-hidden="true" />
        {{ t('common.export') }}
      </ConsoleButton>
    </div>

    <ConsoleCard v-if="loadError && !loading" :padded="false">
      <EmptyState
        :title="t('operationLogs.loadFailed')"
        :hint="t('operationLogs.loadFailedHint')"
        illustration="empty-logs"
      >
        <ConsoleButton class="mt-5" variant="secondary" @click="load">
          {{ t('common.retry') }}
        </ConsoleButton>
      </EmptyState>
    </ConsoleCard>

    <ConsoleCard v-else class="hidden lg:block" :padded="false">
      <DataTable
        :columns="columns"
        :rows="rows"
        row-key="id"
        :loading="loading"
        :skeleton-rows="pageSize"
        adaptive-scroll
        :page-size="pageSize"
        min-table-width="1120px"
        :scroll-region-label="t('operationLogs.breadcrumb')"
        :empty-title="t('operationLogs.emptyTitle')"
        :empty-hint="t('operationLogs.emptyHint')"
        empty-illustration="empty-logs"
      >
        <template #cell-created="{ row }">
          <span class="whitespace-nowrap text-xs text-[var(--text-tertiary)]">
            {{ formatTime((row as OperationLogItem).created_at) }}
          </span>
        </template>
        <template #cell-actor="{ row }">
          <div class="min-w-0">
            <p
              class="truncate text-sm font-semibold text-[var(--text-primary)]"
              :title="actorName(row as OperationLogItem)"
            >
              {{ actorName(row as OperationLogItem) }}
            </p>
            <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
              {{ t(operationLogRoleKey((row as OperationLogItem).actor.role)) }}
            </p>
          </div>
        </template>
        <template #cell-result="{ row }">
          <div class="flex flex-wrap items-center gap-1.5">
            <StatusChip
              :tone="operationLogKindTone((row as OperationLogItem).kind)"
            >
              {{ t(operationLogKindKey((row as OperationLogItem).kind)) }}
            </StatusChip>
            <StatusChip :tone="operationLogResultTone(row as OperationLogItem)">
              {{ t(operationLogResultKey(row as OperationLogItem)) }}
            </StatusChip>
          </div>
        </template>
        <template #cell-summary="{ row }">
          <p
            class="line-clamp-2 text-sm leading-5 text-[var(--text-secondary)]"
            :title="operationLogSummary(row as OperationLogItem, t)"
          >
            {{ operationLogSummary(row as OperationLogItem, t) }}
          </p>
        </template>
        <template #cell-source="{ row }">
          <span
            class="block truncate font-mono text-xs text-[var(--text-secondary)]"
            :title="(row as OperationLogItem).ip || '-'"
          >
            {{ (row as OperationLogItem).ip || '-' }}
          </span>
        </template>
        <template #cell-request="{ row }">
          <div class="min-w-0">
            <p
              class="truncate font-mono text-xs text-[var(--text-secondary)]"
              :title="operationLogRequestText(row as OperationLogItem) || '-'"
            >
              {{ operationLogRequestText(row as OperationLogItem) || '-' }}
            </p>
            <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
              {{
                t('operationLogs.httpStatus', {
                  status: statusText(row as OperationLogItem),
                })
              }}
            </p>
          </div>
        </template>
        <template #cell-detail="{ row }">
          <div class="flex justify-end">
            <IconButton
              :label="t('operationLogs.viewDetails')"
              @click="detailLog = row as OperationLogItem"
            >
              <Eye :size="16" aria-hidden="true" />
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
    </ConsoleCard>

    <section
      v-if="!loadError || loading"
      class="lg:hidden"
      :aria-label="t('operationLogs.breadcrumb')"
    >
      <div v-if="loading" class="space-y-3" aria-busy="true">
        <div
          v-for="index in Math.min(pageSize, 5)"
          :key="index"
          class="h-48 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
        />
      </div>
      <div v-else-if="rows.length" class="space-y-3">
        <article
          v-for="row in rows"
          :key="row.id"
          class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4 shadow-[var(--card-shadow)]"
          :aria-label="
            t('operationLogs.mobileCardLabel', {
              action: operationLogSummary(row, t),
            })
          "
        >
          <div class="flex flex-wrap items-center gap-1.5">
            <StatusChip :tone="operationLogKindTone(row.kind)">
              {{ t(operationLogKindKey(row.kind)) }}
            </StatusChip>
            <StatusChip :tone="operationLogResultTone(row)">
              {{ t(operationLogResultKey(row)) }}
            </StatusChip>
          </div>
          <div class="mt-3 min-w-0">
            <p
              class="truncate text-sm font-semibold text-[var(--text-primary)]"
            >
              {{ actorName(row) }}
            </p>
            <p
              class="mt-1 line-clamp-3 text-sm leading-5 text-[var(--text-secondary)]"
            >
              {{ operationLogSummary(row, t) }}
            </p>
          </div>
          <div
            class="mt-4 flex items-end justify-between gap-3 border-t border-[var(--border-subtle)] pt-3"
          >
            <div class="min-w-0 text-xs text-[var(--text-tertiary)]">
              <p class="truncate font-mono" :title="row.ip || '-'">
                {{ row.ip || '-' }}
              </p>
              <p class="mt-1">{{ formatTime(row.created_at) }}</p>
            </div>
            <ConsoleButton size="sm" variant="ghost" @click="detailLog = row">
              <Eye :size="15" aria-hidden="true" />
              {{ t('operationLogs.viewDetails') }}
            </ConsoleButton>
          </div>
        </article>
      </div>
      <div
        v-else
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
      >
        <EmptyState
          :title="t('operationLogs.emptyTitle')"
          :hint="t('operationLogs.emptyHint')"
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
      :title="t('operationLogs.detailTitle')"
      size="lg"
      @close="detailLog = null"
    >
      <div v-if="detailLog" class="space-y-6" data-operation-log-detail>
        <section>
          <h3 class="text-sm font-semibold text-[var(--text-primary)]">
            {{ t('operationLogs.sections.actor') }}
          </h3>
          <dl class="mt-3 grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg bg-[var(--surface-muted)] p-3">
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ t('operationLogs.fields.account') }}
              </dt>
              <dd class="mt-1 break-words text-sm text-[var(--text-primary)]">
                {{ actorName(detailLog) }}
              </dd>
            </div>
            <div class="rounded-lg bg-[var(--surface-muted)] p-3">
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ t('operationLogs.fields.role') }}
              </dt>
              <dd class="mt-1 text-sm text-[var(--text-primary)]">
                {{ t(operationLogRoleKey(detailLog.actor.role)) }}
              </dd>
            </div>
            <div class="rounded-lg bg-[var(--surface-muted)] p-3">
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ t('operationLogs.fields.authMethod') }}
              </dt>
              <dd class="mt-1 break-words text-sm text-[var(--text-primary)]">
                {{ authMethod(detailLog) }}
              </dd>
            </div>
            <div class="rounded-lg bg-[var(--surface-muted)] p-3">
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ t('operationLogs.fields.time') }}
              </dt>
              <dd class="mt-1 text-sm text-[var(--text-primary)]">
                {{ formatTime(detailLog.created_at) }}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3 class="text-sm font-semibold text-[var(--text-primary)]">
            {{ t('operationLogs.sections.operation') }}
          </h3>
          <p
            class="mt-3 break-words rounded-lg bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--text-primary)]"
          >
            {{ operationLogSummary(detailLog, t) }}
          </p>
          <dl v-if="detailParams.length" class="mt-3 grid gap-2 sm:grid-cols-2">
            <div
              v-for="[key, value] in detailParams"
              :key="key"
              class="min-w-0 rounded-lg border border-[var(--border-subtle)] p-3"
            >
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ operationLogParamLabel(key, t) }}
              </dt>
              <dd
                class="mt-1 break-words font-mono text-xs text-[var(--text-primary)]"
              >
                {{ operationLogParamValue(value) }}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3 class="text-sm font-semibold text-[var(--text-primary)]">
            {{ t('operationLogs.sections.source') }}
          </h3>
          <dl class="mt-3 space-y-3">
            <div class="rounded-lg bg-[var(--surface-muted)] p-3">
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ t('operationLogs.fields.ip') }}
              </dt>
              <dd
                class="mt-1 break-all font-mono text-xs text-[var(--text-primary)]"
              >
                {{ detailLog.ip || '-' }}
              </dd>
            </div>
            <div class="rounded-lg bg-[var(--surface-muted)] p-3">
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ t('operationLogs.fields.userAgent') }}
              </dt>
              <dd
                class="mt-1 break-words text-xs leading-5 text-[var(--text-primary)]"
              >
                {{ detailLog.user_agent || '-' }}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3 class="text-sm font-semibold text-[var(--text-primary)]">
            {{ t('operationLogs.sections.request') }}
          </h3>
          <dl class="mt-3 grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg bg-[var(--surface-muted)] p-3 sm:col-span-2">
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ t('operationLogs.fields.route') }}
              </dt>
              <dd
                class="mt-1 break-all font-mono text-xs text-[var(--text-primary)]"
              >
                {{ operationLogRequestText(detailLog) || '-' }}
              </dd>
            </div>
            <div class="rounded-lg bg-[var(--surface-muted)] p-3">
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ t('operationLogs.fields.httpStatus') }}
              </dt>
              <dd class="mt-1 text-sm text-[var(--text-primary)]">
                {{ statusText(detailLog) }}
              </dd>
            </div>
            <div class="rounded-lg bg-[var(--surface-muted)] p-3">
              <dt class="text-xs text-[var(--text-tertiary)]">
                {{ t('operationLogs.fields.result') }}
              </dt>
              <dd class="mt-1">
                <StatusChip :tone="operationLogResultTone(detailLog)">{{
                  t(operationLogResultKey(detailLog))
                }}</StatusChip>
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <ConsoleButton variant="secondary" @click="detailLog = null">
            {{ t('common.close') }}
          </ConsoleButton>
        </div>
      </template>
    </ConsoleModal>

    <ConsoleModal
      :open="exportOpen"
      :title="t('logs.exportTitle')"
      :subtitle="t('operationLogs.exportSubtitle', { limit: EXPORT_MAX_ROWS })"
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
        <ConsoleButton size="lg" block :loading="exporting" @click="doExport">
          {{ t('common.confirm') }}
        </ConsoleButton>
      </template>
    </ConsoleModal>
  </div>
</template>
