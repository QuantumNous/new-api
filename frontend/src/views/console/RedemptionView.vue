<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import {
  AlertTriangle,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Download,
  LoaderCircle,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FieldVisibilityMenu from '@/components/common/FieldVisibilityMenu.vue'
import FilterSelect, {
  type SelectOption,
} from '@/components/common/FilterSelect.vue'
import IconButton from '@/components/common/IconButton.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import Breadcrumb from '@/components/console/Breadcrumb.vue'
import RedemptionCodeCell from '@/components/console/redemption/RedemptionCodeCell.vue'
import RedemptionGenerateModal from '@/components/console/redemption/RedemptionGenerateModal.vue'
import RedemptionSuccessModal from '@/components/console/redemption/RedemptionSuccessModal.vue'
import { useAdminRedemption } from '@/composables/useAdminRedemption'
import {
  ADMIN_REDEMPTION_DEFAULT_VISIBLE_FIELDS,
  ADMIN_REDEMPTION_OPTIONAL_FIELDS,
  ADMIN_REDEMPTION_SORT_FIELDS,
  ADMIN_REDEMPTION_VISIBLE_FIELDS_STORAGE_KEY,
  type AdminRedemptionOptionalField,
  adminRedemptionStatusLabelKey,
  adminRedemptionStatusTone,
  adminRedemptionTypeLabelKey,
  adminRedemptionTypeTone,
  formatRedemptionValue,
  sanitizeAdminRedemptionVisibleFields,
} from '@/constants/adminRedemption'
import type {
  AdminRedemptionCode,
  AdminRedemptionCreateInput,
  AdminRedemptionSortBy,
  AdminRedemptionSortOrder,
} from '@/types/console'
import { formatTime } from '@/utils/format'

const { t } = useI18n()

const {
  rows,
  total,
  typeCounts,
  statusCounts,
  page,
  pageSize,
  keyword,
  typeFilter,
  statusFilter,
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
  toggleStatus,
  createCodes,
  deleteCode,
  deleteSelected,
} = useAdminRedemption()

const generateOpen = ref(false)
const successCodes = ref<string[]>([])
const successOpen = ref(false)
const deleting = ref<AdminRedemptionCode | null>(null)
const deletingBulk = ref<AdminRedemptionCode[]>([])
const selectedIds = ref<number[]>([])

const storedVisibleFields = useStorage<string[]>(
  ADMIN_REDEMPTION_VISIBLE_FIELDS_STORAGE_KEY,
  [...ADMIN_REDEMPTION_DEFAULT_VISIBLE_FIELDS]
)

watch(
  storedVisibleFields,
  (fields) => {
    const sanitized = sanitizeAdminRedemptionVisibleFields(fields)
    if (
      sanitized.length !== fields.length ||
      sanitized.some((f, i) => f !== fields[i])
    ) {
      storedVisibleFields.value = sanitized
    }
  },
  { immediate: true }
)

const visibleFields = computed<AdminRedemptionOptionalField[]>({
  get: () => sanitizeAdminRedemptionVisibleFields(storedVisibleFields.value),
  set: (fields) => {
    storedVisibleFields.value = sanitizeAdminRedemptionVisibleFields(fields)
  },
})

function isFieldVisible(field: AdminRedemptionOptionalField): boolean {
  return visibleFields.value.includes(field)
}

function fieldLabel(field: AdminRedemptionOptionalField): string {
  return t(`redemption.col${field.charAt(0).toUpperCase()}${field.slice(1)}`)
}

// Selection management
const selectedCodes = computed(() =>
  rows.value.filter((c) => selectedIds.value.includes(c.id))
)

watch(rows, (next) => {
  const ids = new Set(next.map((c) => c.id))
  selectedIds.value = selectedIds.value.filter((id) => ids.has(id))
})

function updateSelected(keys: Array<string | number>) {
  selectedIds.value = keys.filter((k): k is number => typeof k === 'number')
}

function clearSelection() {
  selectedIds.value = []
}

// Columns
const allColumns = computed<
  Array<TableColumn & { optional?: AdminRedemptionOptionalField }>
>(() => [
  { key: 'code', label: t('redemption.colCode'), width: '240px' },
  {
    key: 'name',
    label: t('redemption.name'),
    width: '100px',
    optional: 'name',
  },
  {
    key: 'type',
    label: t('redemption.colType'),
    width: '100px',
    optional: 'type',
  },
  { key: 'value', label: t('redemption.colValue'), width: '88px' },
  { key: 'status', label: t('redemption.colStatus'), width: '100px' },
  { key: 'redeemer', label: t('redemption.colRedeemer'), width: '180px' },
  { key: 'usedTime', label: t('redemption.colUsedTime'), width: '150px' },
  {
    key: 'createdTime',
    label: t('redemption.colCreatedTime'),
    width: '150px',
    optional: 'createdTime',
  },
  {
    key: 'expiry',
    label: t('redemption.colExpiry'),
    width: '100px',
    optional: 'expiry',
  },
  {
    key: 'actions',
    label: t('redemption.colActions'),
    width: '80px',
    align: 'right',
  },
])

const columns = computed<TableColumn[]>(() =>
  allColumns.value.filter(
    (col) => !col.optional || isFieldVisible(col.optional)
  )
)

const minTableWidth = computed(() => {
  const w = columns.value.reduce(
    (sum, col) => sum + Number.parseInt(col.width ?? '120', 10),
    0
  )
  return `${Math.max(800, w + 40)}px`
})

// Filter options
const typeOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('redemption.allTypes') },
  ...(['quota', 'concurrency', 'subscription', 'invite'] as const)
    .filter((tp) => (typeCounts.value[tp] ?? 0) > 0)
    .map((tp): SelectOption => {
      const rawTone = adminRedemptionTypeTone(tp)
      return {
        value: tp,
        label: `${t(adminRedemptionTypeLabelKey(tp))} (${typeCounts.value[tp] ?? 0})`,
        tone:
          rawTone === 'neutral'
            ? undefined
            : rawTone === 'info'
              ? 'info'
              : rawTone === 'accent'
                ? 'accent'
                : 'success',
      }
    }),
])

const statusOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('redemption.allStatuses') },
  ...(['unused', 'used', 'expired', 'disabled'] as const)
    .filter((st) => (statusCounts.value[st] ?? 0) > 0)
    .map((st): SelectOption => {
      const rawTone = adminRedemptionStatusTone(st)
      return {
        value: st,
        label: `${t(adminRedemptionStatusLabelKey(st))} (${statusCounts.value[st] ?? 0})`,
        tone: rawTone === 'neutral' ? undefined : rawTone,
      }
    }),
])

const sortOptions = computed(() =>
  ADMIN_REDEMPTION_SORT_FIELDS.map((field) => ({
    value: field,
    label: t(`redemption.sort.${field}`),
  }))
)

const sortModel = computed({
  get: () => sortBy.value,
  set: (v: string) => {
    sortBy.value = v as AdminRedemptionSortBy
  },
})

function toggleSortOrder() {
  sortOrder.value = (
    sortOrder.value === 'asc' ? 'desc' : 'asc'
  ) as AdminRedemptionSortOrder
}

// Actions
function openGenerate() {
  if (!canManage.value) return
  generateOpen.value = true
}

async function handleGenerate(input: AdminRedemptionCreateInput) {
  const result = await createCodes(input)
  if (result) {
    generateOpen.value = false
    successCodes.value = result.codes
    successOpen.value = true
  }
}

function requestDelete(code: AdminRedemptionCode) {
  deleting.value = code
}

async function confirmDelete() {
  if (!deleting.value) return
  const ok = await deleteCode(deleting.value)
  if (ok) {
    deleting.value = null
    clearSelection()
  }
}

function cancelDelete() {
  if (!isCrudActionBusy('delete')) {
    deleting.value = null
  }
}

function requestBulkDelete() {
  deletingBulk.value = [...selectedCodes.value]
}

async function confirmBulkDelete() {
  const ok = await deleteSelected(deletingBulk.value)
  if (ok) {
    deletingBulk.value = []
    clearSelection()
  }
}

function cancelBulkDelete() {
  if (!isBulkActionBusy('delete')) {
    deletingBulk.value = []
  }
}

// CSV export (client-side, current filtered dataset)
function exportCsv() {
  const header = [
    'ID',
    'Code',
    'Type',
    'Value',
    'Status',
    'Redeemer',
    'UsedTime',
    'CreatedTime',
    'ExpiredTime',
  ].join(',')
  const lines = rows.value.map((c) =>
    [
      c.id,
      c.code,
      c.type,
      formatRedemptionValue(c),
      c.status,
      c.redeemer_email || '',
      c.used_time > 0 ? formatTime(c.used_time) : '',
      formatTime(c.created_time),
      c.expired_time === -1 ? 'never' : formatTime(c.expired_time),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `redemption-codes-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Mock plans for the generate form
const mockPlans = [
  { id: 1, name: '轻量版' },
  { id: 2, name: '专业版' },
  { id: 3, name: '旗舰版' },
]
</script>

<template>
  <div>
    <!-- Page header -->
    <header
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="min-w-0">
        <Breadcrumb
          :crumbs="[t('nav.groupAdmin'), t('nav.redemptionManagement')]"
          spacing="mb-2"
        />
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">
          {{ t('redemption.title') }}
        </h1>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]" aria-live="polite">
          {{ t('redemption.resultCount', { count: total }) }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ConsoleButton
          variant="secondary"
          :loading="refreshing"
          :disabled="isCrudBusy || isBulkBusy"
          @click="load({ background: true })"
        >
          <RefreshCw v-if="!refreshing" :size="15" aria-hidden="true" />
          {{ t('redemption.refreshList') }}
        </ConsoleButton>
        <ConsoleButton
          variant="secondary"
          :disabled="rows.length === 0"
          @click="exportCsv"
        >
          <Download :size="15" aria-hidden="true" />
          {{ t('redemption.exportCsv') }}
        </ConsoleButton>
        <ConsoleButton :disabled="!canManage" @click="openGenerate">
          <Plus :size="16" aria-hidden="true" />
          {{ t('redemption.generateCodes') }}
        </ConsoleButton>
      </div>
    </header>

    <ConsoleCard :padded="false">
      <!-- Toolbar -->
      <div
        class="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-4 xl:flex-row xl:items-center"
      >
        <SearchInput
          v-model="keyword"
          :placeholder="t('redemption.searchPlaceholder')"
          :aria-label="t('redemption.searchPlaceholder')"
          name="admin-redemption-search"
          class="w-full xl:w-72"
        />
        <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:flex-1">
          <FilterSelect
            v-model="typeFilter"
            :options="typeOptions"
            :label="t('redemption.allTypes')"
            class="w-full"
          />
          <FilterSelect
            v-model="statusFilter"
            :options="statusOptions"
            :label="t('redemption.allStatuses')"
            class="w-full"
          />
          <div class="flex min-w-0 gap-2">
            <FilterSelect
              v-model="sortModel"
              :options="sortOptions"
              :label="t('redemption.sortLabel')"
              class="min-w-0 flex-1"
            />
            <IconButton
              :label="
                sortOrder === 'asc'
                  ? t('redemption.sortAscending')
                  : t('redemption.sortDescending')
              "
              class="h-10 w-10 shrink-0 rounded-xl bg-[var(--surface-muted)]"
              @click="toggleSortOrder"
            >
              <ArrowUpNarrowWide v-if="sortOrder === 'asc'" :size="17" />
              <ArrowDownNarrowWide v-else :size="17" />
            </IconButton>
            <FieldVisibilityMenu
              v-model="visibleFields"
              :all-fields="ADMIN_REDEMPTION_OPTIONAL_FIELDS"
              :default-fields="ADMIN_REDEMPTION_DEFAULT_VISIBLE_FIELDS"
              :label-for="fieldLabel"
              :title="t('redemption.fieldSettings')"
              :reset-label="t('redemption.resetFields')"
            />
          </div>
        </div>
      </div>

      <!-- Bulk action bar -->
      <div
        v-if="selectedIds.length > 0"
        class="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-2.5"
      >
        <span
          class="mr-auto text-xs font-semibold text-[var(--text-secondary)]"
          aria-live="polite"
        >
          {{ t('redemption.selectedCount', { count: selectedIds.length }) }}
        </span>
        <IconButton
          :label="t('redemption.deleteSelected')"
          tone="danger"
          :disabled="!canMutate"
          @click="requestBulkDelete"
        >
          <Trash2 :size="16" />
        </IconButton>
        <IconButton
          :label="t('redemption.clearSelection')"
          :disabled="!canMutate"
          @click="clearSelection"
        >
          <X :size="16" />
        </IconButton>
      </div>

      <!-- Error state -->
      <div
        v-if="initialError"
        class="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center"
        role="alert"
      >
        <AlertTriangle :size="28" class="text-[var(--status-danger-text)]" />
        <p class="mt-3 font-semibold text-[var(--text-primary)]">
          {{ t('redemption.loadFailed') }}
        </p>
        <p class="mt-1 max-w-md text-sm text-[var(--text-tertiary)]">
          {{ initialError }}
        </p>
        <ConsoleButton class="mt-5" variant="secondary" @click="load()">
          {{ t('redemption.retry') }}
        </ConsoleButton>
      </div>

      <template v-else>
        <DataTable
          :columns="columns"
          :rows="rows"
          row-key="id"
          selectable
          checkbox-shape="round"
          :selected="selectedIds"
          :loading="loading"
          :skeleton-rows="pageSize"
          adaptive-scroll
          :page-size="pageSize"
          :min-table-width="minTableWidth"
          :scroll-region-label="t('redemption.title')"
          :empty-title="t('redemption.emptyTitle')"
          :empty-hint="t('redemption.emptyHint')"
          @update:selected="updateSelected"
        >
          <!-- code cell -->
          <template #cell-code="{ row }">
            <RedemptionCodeCell :code="(row as AdminRedemptionCode).code" />
          </template>

          <!-- name cell (optional) -->
          <template #cell-name="{ row }">
            <span class="text-xs text-[var(--text-secondary)]">
              {{ (row as AdminRedemptionCode).name || '—' }}
            </span>
          </template>

          <!-- type cell (optional) -->
          <template #cell-type="{ row }">
            <StatusChip
              :tone="adminRedemptionTypeTone((row as AdminRedemptionCode).type)"
            >
              {{
                t(
                  adminRedemptionTypeLabelKey((row as AdminRedemptionCode).type)
                )
              }}
            </StatusChip>
          </template>

          <!-- value cell -->
          <template #cell-value="{ row }">
            <span class="text-sm font-medium text-[var(--text-primary)]">
              {{ formatRedemptionValue(row as AdminRedemptionCode) }}
            </span>
          </template>

          <!-- status cell -->
          <template #cell-status="{ row }">
            <StatusChip
              :tone="
                adminRedemptionStatusTone((row as AdminRedemptionCode).status)
              "
            >
              {{
                t(
                  adminRedemptionStatusLabelKey(
                    (row as AdminRedemptionCode).status
                  )
                )
              }}
            </StatusChip>
          </template>

          <!-- redeemer cell -->
          <template #cell-redeemer="{ row }">
            <span
              class="max-w-[160px] truncate text-xs text-[var(--text-secondary)]"
              :title="(row as AdminRedemptionCode).redeemer_email"
            >
              {{
                (row as AdminRedemptionCode).redeemer_email ||
                t('redemption.notRedeemed')
              }}
            </span>
          </template>

          <!-- used time cell -->
          <template #cell-usedTime="{ row }">
            <span class="text-xs tabular-nums text-[var(--text-secondary)]">
              {{
                (row as AdminRedemptionCode).used_time > 0
                  ? formatTime((row as AdminRedemptionCode).used_time)
                  : t('redemption.notRedeemed')
              }}
            </span>
          </template>

          <!-- created time cell (optional) -->
          <template #cell-createdTime="{ row }">
            <span class="text-xs tabular-nums text-[var(--text-secondary)]">
              {{ formatTime((row as AdminRedemptionCode).created_time) }}
            </span>
          </template>

          <!-- expiry cell (optional) -->
          <template #cell-expiry="{ row }">
            <span class="text-xs tabular-nums text-[var(--text-secondary)]">
              {{
                (row as AdminRedemptionCode).expired_time === -1
                  ? t('redemption.neverExpired')
                  : formatTime((row as AdminRedemptionCode).expired_time)
              }}
            </span>
          </template>

          <!-- actions cell -->
          <template #cell-actions="{ row }">
            <div class="flex items-center justify-end gap-0.5">
              <!-- toggle status (disabled / unused) -->
              <IconButton
                :label="
                  (row as AdminRedemptionCode).status === 'disabled'
                    ? t('redemption.enableCode')
                    : t('redemption.disableCode')
                "
                :tone="
                  (row as AdminRedemptionCode).status !== 'disabled' &&
                  (row as AdminRedemptionCode).status !== 'used' &&
                  (row as AdminRedemptionCode).status !== 'expired'
                    ? 'danger'
                    : 'default'
                "
                :disabled="
                  !canManage ||
                  isRowBusy((row as AdminRedemptionCode).id) ||
                  (row as AdminRedemptionCode).status === 'used' ||
                  (row as AdminRedemptionCode).status === 'expired'
                "
                @click="toggleStatus(row as AdminRedemptionCode)"
              >
                <LoaderCircle
                  v-if="isBusy((row as AdminRedemptionCode).id, 'status')"
                  :size="15"
                  class="animate-spin"
                />
                <PowerOff
                  v-else-if="(row as AdminRedemptionCode).status !== 'disabled'"
                  :size="15"
                />
                <Power v-else :size="15" />
              </IconButton>
              <!-- delete -->
              <IconButton
                :label="t('redemption.deleteCode')"
                tone="danger"
                :disabled="
                  !canManage || isRowBusy((row as AdminRedemptionCode).id)
                "
                @click="requestDelete(row as AdminRedemptionCode)"
              >
                <LoaderCircle
                  v-if="
                    isCrudActionBusy('delete', (row as AdminRedemptionCode).id)
                  "
                  :size="15"
                  class="animate-spin"
                />
                <Trash2 v-else :size="15" />
              </IconButton>
            </div>
          </template>

          <template #footer>
            <TablePagination
              v-model:page="page"
              v-model:page-size="pageSize"
              :total="total"
              :page-sizes="[20, 50, 100]"
            />
          </template>
        </DataTable>

        <!-- Mobile placeholder (list without DataTable) -->
        <div class="md:hidden">
          <div
            v-if="loading"
            class="divide-y divide-[var(--border-subtle)]"
            aria-hidden="true"
          >
            <div v-for="i in 5" :key="i" class="space-y-3 p-4">
              <div
                class="h-4 w-1/2 animate-pulse rounded bg-[var(--surface-muted)]"
              />
              <div
                class="h-10 animate-pulse rounded bg-[var(--surface-muted)]"
              />
            </div>
          </div>
          <EmptyState
            v-else-if="rows.length === 0"
            :title="t('redemption.emptyTitle')"
            :hint="t('redemption.emptyHint')"
            illustration="empty-search"
          />
          <template v-else>
            <div
              v-for="code in rows"
              :key="code.id"
              class="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3"
            >
              <div class="min-w-0 flex-1">
                <RedemptionCodeCell :code="code.code" />
                <div class="mt-1 flex items-center gap-2">
                  <StatusChip
                    :tone="adminRedemptionTypeTone(code.type)"
                    class="text-[10px]"
                  >
                    {{ t(adminRedemptionTypeLabelKey(code.type)) }}
                  </StatusChip>
                  <span class="text-xs font-medium text-[var(--text-primary)]">
                    {{ formatRedemptionValue(code) }}
                  </span>
                  <StatusChip
                    :tone="adminRedemptionStatusTone(code.status)"
                    class="text-[10px]"
                  >
                    {{ t(adminRedemptionStatusLabelKey(code.status)) }}
                  </StatusChip>
                </div>
              </div>
              <div class="flex items-center gap-0.5 pl-2">
                <IconButton
                  :label="t('redemption.deleteCode')"
                  tone="danger"
                  :disabled="!canManage || isRowBusy(code.id)"
                  @click="requestDelete(code)"
                >
                  <Trash2 :size="15" />
                </IconButton>
              </div>
            </div>
            <TablePagination
              v-model:page="page"
              v-model:page-size="pageSize"
              :total="total"
              :page-sizes="[20, 50, 100]"
            />
          </template>
        </div>
      </template>
    </ConsoleCard>

    <!-- Generate modal -->
    <RedemptionGenerateModal
      :open="generateOpen"
      :loading="isCrudActionBusy('create')"
      :plans="mockPlans"
      @close="generateOpen = false"
      @submit="handleGenerate"
    />

    <!-- Success modal -->
    <RedemptionSuccessModal
      :open="successOpen"
      :codes="successCodes"
      @close="successOpen = false"
    />

    <!-- Delete confirm dialog (single) -->
    <ConfirmDialog
      :open="deleting !== null"
      :title="t('redemption.deleteTitle')"
      :message="t('redemption.deleteMessage')"
      :confirm-text="t('common.delete')"
      :loading="isCrudActionBusy('delete')"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- Bulk delete confirm dialog -->
    <ConfirmDialog
      :open="deletingBulk.length > 0"
      :title="t('redemption.bulkDeleteTitle')"
      :message="
        t('redemption.bulkDeleteMessage', { count: deletingBulk.length })
      "
      :confirm-text="t('common.delete')"
      :loading="isBulkActionBusy('delete')"
      @confirm="confirmBulkDelete"
      @cancel="cancelBulkDelete"
    />
  </div>
</template>
