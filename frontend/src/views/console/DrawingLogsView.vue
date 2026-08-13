<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { parseDrawingLogPage } from '@/api/liveContracts'
import { ApiError, type PageResult } from '@/api/types'
import type { DrawingLogItem } from '@/types/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import EmptyState from '@/components/common/EmptyState.vue'
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

const rows = ref<DrawingLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(true)

const taskId = ref('')
const startDate = ref('')
const endDate = ref('')

const detailRow = ref<DrawingLogItem | null>(null)

const columns = computed<TableColumn[]>(() => [
  { key: 'submitted', label: t('relayLogs.colSubmitted'), width: '170px' },
  { key: 'task', label: t('relayLogs.colTask'), width: '190px' },
  { key: 'prompt', label: t('relayLogs.colPrompt') },
  { key: 'progress', label: t('relayLogs.colProgress'), width: '130px' },
  { key: 'result', label: t('relayLogs.colResult'), width: '110px' },
  {
    key: 'cost',
    label: t('relayLogs.colCost'),
    width: '100px',
    align: 'right',
  },
])

function currentParams() {
  // /api/mj filters compare against millisecond submit_time values.
  const startTimestamp = startDate.value
    ? new Date(startDate.value).getTime()
    : 0
  const endTimestamp = endDate.value
    ? new Date(endDate.value).getTime() + 86_399_999
    : 0
  return {
    p: page.value,
    page_size: pageSize.value,
    mj_id: taskId.value.trim(),
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
  }
}

const listRequest = useLatestRequest()

async function load() {
  loading.value = true
  const result = await listRequest.run((signal) =>
    api.get<PageResult<DrawingLogItem>>('/api/mj/self', currentParams(), {
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
  const pageResult = parseDrawingLogPage(result.value as unknown)
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
watch([startDate, endDate], reload)
watch(pageSize, reload)
watch(page, load)
onMounted(load)

function formatDuration(row: DrawingLogItem): string {
  const seconds = relayTaskDurationSeconds(
    row.submit_time,
    row.finish_time,
    'milliseconds'
  )
  return seconds === null ? '-' : `${seconds.toFixed(1)}s`
}

function resultUrl(row: DrawingLogItem): string | null {
  return safeExternalUrl(row.image_url || row.video_url)
}

function rawResultUrl(row: DrawingLogItem): string {
  return row.image_url || row.video_url
}

async function copyResultUrl(row: DrawingLogItem): Promise<void> {
  try {
    await navigator.clipboard.writeText(rawResultUrl(row))
    toast.success(t('common.copied'))
  } catch {
    toast.error(t('common.copyFailed'))
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1276px]">
    <PageBreadcrumb
      :crumbs="[t('logs.breadcrumb.0'), t('relayLogs.drawingBreadcrumb')]"
    >
      <template #action>
        <LogsNavTabs active="drawing" />
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
        name="drawing-task-search"
        class="w-full sm:w-64"
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
        :scroll-region-label="t('relayLogs.drawingBreadcrumb')"
        :empty-title="t('relayLogs.emptyTitle')"
        :empty-hint="t('relayLogs.emptyHint')"
        empty-illustration="empty-logs"
      >
        <template #cell-submitted="{ row }">
          <div class="flex min-w-0 flex-col items-start gap-1.5">
            <span class="whitespace-nowrap text-xs text-[var(--text-tertiary)]">
              {{
                formatTime(
                  Math.floor((row as DrawingLogItem).submit_time / 1000)
                )
              }}
            </span>
            <StatusChip
              :tone="relayTaskStatusMeta((row as DrawingLogItem).status).tone"
            >
              {{
                t(relayTaskStatusMeta((row as DrawingLogItem).status).labelKey)
              }}
            </StatusChip>
          </div>
        </template>
        <template #cell-task="{ row }">
          <div class="flex min-w-0 flex-col items-start gap-1">
            <span
              class="text-xs font-semibold text-[var(--text-primary)]"
              :title="(row as DrawingLogItem).action"
            >
              {{ (row as DrawingLogItem).action || '-' }}
            </span>
            <span
              class="block max-w-full truncate font-mono text-xs text-[var(--text-tertiary)]"
              :title="(row as DrawingLogItem).mj_id"
            >
              {{ (row as DrawingLogItem).mj_id || '-' }}
            </span>
          </div>
        </template>
        <template #cell-prompt="{ row }">
          <button
            v-if="(row as DrawingLogItem).prompt"
            type="button"
            class="block max-w-[300px] truncate text-left text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline"
            :title="t('relayLogs.viewDetails')"
            @click="detailRow = row as DrawingLogItem"
          >
            {{ (row as DrawingLogItem).prompt }}
          </button>
          <span v-else class="text-xs text-[var(--text-tertiary)]">-</span>
        </template>
        <template #cell-progress="{ row }">
          <div class="flex min-w-0 flex-col items-start gap-1">
            <span class="text-xs text-[var(--text-secondary)]">
              {{ (row as DrawingLogItem).progress || '-' }}
            </span>
            <span class="text-xs text-[var(--text-tertiary)]">
              {{ formatDuration(row as DrawingLogItem) }}
            </span>
          </div>
        </template>
        <template #cell-result="{ row }">
          <a
            v-if="resultUrl(row as DrawingLogItem)"
            :href="resultUrl(row as DrawingLogItem) ?? undefined"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-[var(--accent-text)] underline-offset-2 hover:underline"
          >
            {{ t('relayLogs.viewResult') }}
          </a>
          <button
            v-else-if="rawResultUrl(row as DrawingLogItem)"
            type="button"
            class="text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline"
            @click="copyResultUrl(row as DrawingLogItem)"
          >
            {{ t('relayLogs.copyResultLink') }}
          </button>
          <span v-else class="text-xs text-[var(--text-tertiary)]">-</span>
        </template>
        <template #cell-cost="{ row }">
          <span
            class="whitespace-nowrap text-sm font-semibold tabular-nums text-[var(--text-primary)]"
          >
            {{ formatQuota((row as DrawingLogItem).quota) }}
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
    <section class="lg:hidden" :aria-label="t('relayLogs.drawingBreadcrumb')">
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
              {{ formatTime(Math.floor(row.submit_time / 1000)) }}
            </span>
          </div>
          <p
            class="mt-2 truncate font-mono text-xs text-[var(--text-tertiary)]"
          >
            {{ row.action || '-' }} · {{ row.mj_id || '-' }}
          </p>
          <button
            v-if="row.prompt"
            type="button"
            class="mt-2 block w-full truncate text-left text-sm text-[var(--text-secondary)]"
            @click="detailRow = row"
          >
            {{ row.prompt }}
          </button>
          <div class="mt-3 flex items-center justify-between gap-2">
            <span class="text-xs text-[var(--text-tertiary)]">
              {{ row.progress || '-' }} · {{ formatDuration(row) }}
            </span>
            <span class="text-sm font-semibold tabular-nums">
              {{ formatQuota(row.quota) }}
            </span>
          </div>
          <div v-if="rawResultUrl(row)" class="mt-2">
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

    <!-- prompt / failure details -->
    <ConsoleModal
      :open="detailRow !== null"
      :title="t('relayLogs.detailTitle')"
      size="md"
      @close="detailRow = null"
    >
      <div v-if="detailRow" class="space-y-4">
        <div>
          <p class="mb-1 text-xs font-semibold text-[var(--text-tertiary)]">
            {{ t('relayLogs.colPrompt') }}
          </p>
          <p
            class="whitespace-pre-wrap break-words text-sm text-[var(--text-primary)]"
          >
            {{ detailRow.prompt || '-' }}
          </p>
        </div>
        <div
          v-if="detailRow.prompt_en && detailRow.prompt_en !== detailRow.prompt"
        >
          <p class="mb-1 text-xs font-semibold text-[var(--text-tertiary)]">
            {{ t('relayLogs.promptEn') }}
          </p>
          <p
            class="whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]"
          >
            {{ detailRow.prompt_en }}
          </p>
        </div>
        <div v-if="detailRow.fail_reason">
          <p class="mb-1 text-xs font-semibold text-[var(--text-tertiary)]">
            {{ t('relayLogs.failReason') }}
          </p>
          <p
            class="whitespace-pre-wrap break-words text-sm text-[var(--status-danger-text)]"
          >
            {{ detailRow.fail_reason }}
          </p>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <ConsoleButton variant="secondary" @click="detailRow = null">
            {{ t('common.close') }}
          </ConsoleButton>
        </div>
      </template>
    </ConsoleModal>
  </div>
</template>
