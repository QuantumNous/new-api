<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { parseTaskLogPage } from '@/api/liveContracts'
import { ApiError, type PageResult } from '@/api/types'
import type { RelayTaskLogItem } from '@/types/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterSelect, {
  type SelectOption,
} from '@/components/common/FilterSelect.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import LogsNavTabs from '@/components/console/log-ui/LogsNavTabs.vue'
import {
  relayTaskDurationSeconds,
  relayTaskStatusMeta,
} from '@/components/console/log-ui/relayTaskStatus'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import { formatQuota, formatTime } from '@/utils/format'
import { safeExternalUrl } from '@/utils/safeUrl'

const { t } = useI18n()
const toast = useToast()

const rows = ref<RelayTaskLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(true)

const taskId = ref('')
const platform = ref('')
const startDate = ref('')
const endDate = ref('')

const failureRow = ref<RelayTaskLogItem | null>(null)

// Mirrors the platform filter of the React usage-logs page; the backend
// accepts any value, so an unlisted platform still renders via fallbacks.
const platformOptions = computed<SelectOption[]>(() => [
  { value: 'suno', label: 'suno' },
  { value: 'kling', label: 'kling' },
  { value: 'runway', label: 'runway' },
  { value: 'luma', label: 'luma' },
  { value: 'viggle', label: 'viggle' },
])

const columns = computed<TableColumn[]>(() => [
  { key: 'submitted', label: t('relayLogs.colSubmitted'), width: '170px' },
  { key: 'task', label: t('relayLogs.colTask'), width: '210px' },
  { key: 'platform', label: t('relayLogs.colPlatform'), width: '110px' },
  { key: 'progress', label: t('relayLogs.colProgress'), width: '130px' },
  { key: 'result', label: t('relayLogs.colResult') },
  {
    key: 'cost',
    label: t('relayLogs.colCost'),
    width: '100px',
    align: 'right',
  },
])

function currentParams() {
  // /api/task filters compare against second-precision submit_time values.
  const startTimestamp = startDate.value
    ? Math.floor(new Date(startDate.value).getTime() / 1000)
    : 0
  const endTimestamp = endDate.value
    ? Math.floor(new Date(endDate.value).getTime() / 1000) + 86_399
    : 0
  return {
    p: page.value,
    page_size: pageSize.value,
    task_id: taskId.value.trim(),
    platform: platform.value,
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
  }
}

const listRequest = useLatestRequest()

async function load() {
  loading.value = true
  const result = await listRequest.run((signal) =>
    api.get<PageResult<RelayTaskLogItem>>('/api/task/self', currentParams(), {
      signal,
    })
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
  const pageResult = parseTaskLogPage(result.value as unknown)
  rows.value = pageResult.items
  total.value = pageResult.total
}

let searchTimer = 0
function reload() {
  window.clearTimeout(searchTimer)
  if (page.value === 1) load()
  else page.value = 1
}
watch(taskId, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(reload, 300)
})
watch([platform, startDate, endDate], reload)
watch(pageSize, reload)
watch(page, load)
onMounted(load)

function formatDuration(row: RelayTaskLogItem): string {
  const seconds = relayTaskDurationSeconds(
    row.submit_time,
    row.finish_time,
    'seconds'
  )
  return seconds === null ? '-' : `${seconds.toFixed(0)}s`
}

function resultUrl(row: RelayTaskLogItem): string | null {
  return safeExternalUrl(row.result_url)
}

async function copyResultUrl(row: RelayTaskLogItem): Promise<void> {
  try {
    await navigator.clipboard.writeText(row.result_url)
    toast.success(t('common.copied'))
  } catch {
    toast.error(t('common.copyFailed'))
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1276px]">
    <PageBreadcrumb
      :crumbs="[t('logs.breadcrumb.0'), t('relayLogs.tasksBreadcrumb')]"
    >
      <template #action>
        <LogsNavTabs active="tasks" />
      </template>
    </PageBreadcrumb>

    <!-- filter toolbar -->
    <div
      class="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4 shadow-[var(--card-shadow)]"
    >
      <SearchInput
        v-model="taskId"
        :placeholder="t('relayLogs.taskIdPlaceholder')"
        :aria-label="t('relayLogs.taskIdPlaceholder')"
        name="task-log-search"
        class="w-full sm:w-64"
      />
      <FilterSelect
        v-model="platform"
        :options="platformOptions"
        :label="t('relayLogs.platformLabel')"
        :placeholder="t('relayLogs.platformAll')"
        :prefix-label="t('relayLogs.platformLabel') + ':'"
        class="w-full sm:w-48"
      />
      <DateRangePicker
        v-model:start="startDate"
        v-model:end="endDate"
        class="w-full sm:w-64"
      />
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
        min-table-width="900px"
        :scroll-region-label="t('relayLogs.tasksBreadcrumb')"
        :empty-title="t('relayLogs.emptyTitle')"
        :empty-hint="t('relayLogs.emptyHint')"
        empty-illustration="empty-logs"
      >
        <template #cell-submitted="{ row }">
          <div class="flex min-w-0 flex-col items-start gap-1.5">
            <span class="whitespace-nowrap text-xs text-[var(--text-tertiary)]">
              {{ formatTime((row as RelayTaskLogItem).submit_time) }}
            </span>
            <StatusChip
              :tone="relayTaskStatusMeta((row as RelayTaskLogItem).status).tone"
            >
              {{
                t(
                  relayTaskStatusMeta((row as RelayTaskLogItem).status).labelKey
                )
              }}
            </StatusChip>
          </div>
        </template>
        <template #cell-task="{ row }">
          <div class="flex min-w-0 flex-col items-start gap-1">
            <span
              class="text-xs font-semibold text-[var(--text-primary)]"
              :title="(row as RelayTaskLogItem).action"
            >
              {{ (row as RelayTaskLogItem).action || '-' }}
            </span>
            <span
              class="block max-w-full truncate font-mono text-xs text-[var(--text-tertiary)]"
              :title="(row as RelayTaskLogItem).task_id"
            >
              {{ (row as RelayTaskLogItem).task_id || '-' }}
            </span>
          </div>
        </template>
        <template #cell-platform="{ row }">
          <StatusChip tone="info">
            {{ (row as RelayTaskLogItem).platform || '-' }}
          </StatusChip>
        </template>
        <template #cell-progress="{ row }">
          <div class="flex min-w-0 flex-col items-start gap-1">
            <span class="text-xs text-[var(--text-secondary)]">
              {{ (row as RelayTaskLogItem).progress || '-' }}
            </span>
            <span class="text-xs text-[var(--text-tertiary)]">
              {{ formatDuration(row as RelayTaskLogItem) }}
            </span>
          </div>
        </template>
        <template #cell-result="{ row }">
          <button
            v-if="(row as RelayTaskLogItem).fail_reason"
            type="button"
            class="block max-w-[280px] truncate text-left text-xs text-[var(--status-danger-text)] underline-offset-2 hover:underline"
            :title="t('relayLogs.viewDetails')"
            @click="failureRow = row as RelayTaskLogItem"
          >
            {{ (row as RelayTaskLogItem).fail_reason }}
          </button>
          <a
            v-else-if="resultUrl(row as RelayTaskLogItem)"
            :href="resultUrl(row as RelayTaskLogItem) ?? undefined"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-[var(--accent-text)] underline-offset-2 hover:underline"
          >
            {{ t('relayLogs.viewResult') }}
          </a>
          <button
            v-else-if="(row as RelayTaskLogItem).result_url"
            type="button"
            class="text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline"
            @click="copyResultUrl(row as RelayTaskLogItem)"
          >
            {{ t('relayLogs.copyResultLink') }}
          </button>
          <span v-else class="text-xs text-[var(--text-tertiary)]">-</span>
        </template>
        <template #cell-cost="{ row }">
          <span
            class="whitespace-nowrap text-sm font-semibold tabular-nums text-[var(--text-primary)]"
          >
            {{ formatQuota((row as RelayTaskLogItem).quota) }}
          </span>
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

    <!-- mobile cards -->
    <section class="lg:hidden" :aria-label="t('relayLogs.tasksBreadcrumb')">
      <div v-if="loading" class="space-y-3" aria-busy="true">
        <div
          v-for="index in Math.min(pageSize, 5)"
          :key="index"
          class="h-36 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
        />
      </div>

      <div v-else-if="rows.length" class="space-y-3">
        <article
          v-for="row in rows"
          :key="row.id"
          class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4"
        >
          <div class="flex items-center justify-between gap-2">
            <StatusChip :tone="relayTaskStatusMeta(row.status).tone">
              {{ t(relayTaskStatusMeta(row.status).labelKey) }}
            </StatusChip>
            <span class="text-xs text-[var(--text-tertiary)]">
              {{ formatTime(row.submit_time) }}
            </span>
          </div>
          <p
            class="mt-2 truncate font-mono text-xs text-[var(--text-tertiary)]"
          >
            {{ row.platform || '-' }} · {{ row.action || '-' }} ·
            {{ row.task_id || '-' }}
          </p>
          <button
            v-if="row.fail_reason"
            type="button"
            class="mt-2 block w-full truncate text-left text-sm text-[var(--status-danger-text)]"
            @click="failureRow = row"
          >
            {{ row.fail_reason }}
          </button>
          <div class="mt-3 flex items-center justify-between gap-2">
            <span class="text-xs text-[var(--text-tertiary)]">
              {{ row.progress || '-' }} · {{ formatDuration(row) }}
            </span>
            <span class="text-sm font-semibold tabular-nums">
              {{ formatQuota(row.quota) }}
            </span>
          </div>
          <div v-if="row.result_url && !row.fail_reason" class="mt-2">
            <a
              v-if="resultUrl(row)"
              :href="resultUrl(row) ?? undefined"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-[var(--accent-text)] underline-offset-2 hover:underline"
            >
              {{ t('relayLogs.viewResult') }}
            </a>
            <button
              v-else
              type="button"
              class="text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline"
              @click="copyResultUrl(row)"
            >
              {{ t('relayLogs.copyResultLink') }}
            </button>
          </div>
        </article>
      </div>

      <div
        v-else
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
      >
        <EmptyState
          :title="t('relayLogs.emptyTitle')"
          :hint="t('relayLogs.emptyHint')"
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

    <!-- failure details -->
    <ConsoleModal
      :open="failureRow !== null"
      :title="t('relayLogs.failReason')"
      size="md"
      @close="failureRow = null"
    >
      <p
        class="whitespace-pre-wrap break-words text-sm text-[var(--status-danger-text)]"
      >
        {{ failureRow?.fail_reason }}
      </p>
      <template #footer>
        <div class="flex justify-end">
          <ConsoleButton variant="secondary" @click="failureRow = null">
            {{ t('common.close') }}
          </ConsoleButton>
        </div>
      </template>
    </ConsoleModal>
  </div>
</template>
