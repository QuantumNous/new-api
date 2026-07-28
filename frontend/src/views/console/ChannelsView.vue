<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import {
  Activity,
  AlertTriangle,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CapacityMeter from '@/components/common/CapacityMeter.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FieldVisibilityMenu from '@/components/common/FieldVisibilityMenu.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import IconButton from '@/components/common/IconButton.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import Breadcrumb from '@/components/console/Breadcrumb.vue'
import ChannelFormModal from '@/components/console/channels/ChannelFormModal.vue'
import ChannelInlineNumber from '@/components/console/channels/ChannelInlineNumber.vue'
import ChannelMobileList from '@/components/console/channels/ChannelMobileList.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import { useAdminChannels } from '@/composables/useAdminChannels'
import {
  ADMIN_CHANNEL_DEFAULT_VISIBLE_FIELDS,
  ADMIN_CHANNEL_OPTIONAL_FIELDS,
  ADMIN_CHANNEL_SORT_FIELDS,
  ADMIN_CHANNEL_VISIBLE_FIELDS_STORAGE_KEY,
  type AdminChannelOptionalField,
  adminChannelResponseText,
  adminChannelResponseTone,
  adminChannelStatusLabelKey,
  adminChannelStatusTone,
  adminChannelTypeMeta,
  sanitizeAdminChannelVisibleFields,
} from '@/constants/adminChannels'
import type {
  AdminChannel,
  AdminChannelCreateInput,
  AdminChannelSortBy,
  AdminChannelSortOrder,
  AdminChannelUpdateInput,
} from '@/types/console'
import { formatMoney, formatQuota, relativeTime } from '@/utils/format'

interface SupplierGroup {
  supplier: string
  channels: AdminChannel[]
}

interface SupplierTableRow extends Record<string, unknown> {
  key: string | number
  kind: 'supplier'
  supplier: string
  count: number
  channels: AdminChannel[]
}

interface ChannelTableRow extends Record<string, unknown> {
  key: number
  kind: 'channel'
  channel: AdminChannel
}

type AdminChannelTableRow = SupplierTableRow | ChannelTableRow
type DeleteTarget =
  | { kind: 'channel'; channel: AdminChannel }
  | { kind: 'supplier'; supplier: string; channels: AdminChannel[] }
  | { kind: 'bulk'; channels: AdminChannel[] }

const { t, locale } = useI18n()
const {
  rows,
  total,
  typeCounts,
  page,
  pageSize,
  keyword,
  type,
  status,
  sortBy,
  sortOrder,
  loading,
  refreshing,
  initialError,
  batchProgress,
  isBatchBusy,
  isCrudBusy,
  isBulkBusy,
  canMutate,
  canRunBatch,
  load,
  isBusy,
  isRowBusy,
  isCrudActionBusy,
  isBulkActionBusy,
  updateNumber,
  toggleStatus,
  refreshBalance,
  testChannel,
  createChannel,
  updateChannelDetails,
  deleteChannel,
  deleteSupplierChannels,
  updateChannelsStatus,
  deleteSelectedChannels,
  runVisibleBatch,
  runSupplierBatch,
} = useAdminChannels()

const formOpen = ref(false)
const editing = ref<AdminChannel | null>(null)
const deleting = ref<DeleteTarget | null>(null)
const selectedIds = ref<number[]>([])
const collapsedSuppliers = ref<string[]>([])
const storedVisibleFields = useStorage<string[]>(
  ADMIN_CHANNEL_VISIBLE_FIELDS_STORAGE_KEY,
  [...ADMIN_CHANNEL_DEFAULT_VISIBLE_FIELDS]
)

watch(
  storedVisibleFields,
  (fields) => {
    const sanitized = sanitizeAdminChannelVisibleFields(fields)
    if (
      sanitized.length !== fields.length ||
      sanitized.some((field, index) => field !== fields[index])
    ) {
      storedVisibleFields.value = sanitized
    }
  },
  { immediate: true }
)

const visibleFields = computed<AdminChannelOptionalField[]>({
  get: () => sanitizeAdminChannelVisibleFields(storedVisibleFields.value),
  set: (fields) => {
    storedVisibleFields.value = sanitizeAdminChannelVisibleFields(fields)
  },
})

const selectedChannels = computed(() =>
  rows.value.filter((channel) => selectedIds.value.includes(channel.id))
)
const pageChannelIds = computed(() => rows.value.map((channel) => channel.id))
const allPageSelected = computed(
  () =>
    rows.value.length > 0 &&
    rows.value.every((channel) => selectedIds.value.includes(channel.id))
)
const resettableSelectedCount = computed(
  () => selectedChannels.value.filter((channel) => channel.status === 3).length
)

function updateSelected(keys: Array<string | number>) {
  selectedIds.value = keys.filter(
    (key): key is number => typeof key === 'number'
  )
}

function toggleSelected(channel: AdminChannel) {
  selectedIds.value = selectedIds.value.includes(channel.id)
    ? selectedIds.value.filter((id) => id !== channel.id)
    : [...selectedIds.value, channel.id]
}

function toggleAllSelected() {
  selectedIds.value = allPageSelected.value
    ? []
    : rows.value.map((channel) => channel.id)
}

function clearSelection() {
  selectedIds.value = []
}

watch(rows, (nextRows) => {
  const ids = new Set(nextRows.map((channel) => channel.id))
  selectedIds.value = selectedIds.value.filter((id) => ids.has(id))
})

function isFieldVisible(field: AdminChannelOptionalField): boolean {
  return visibleFields.value.includes(field)
}

/** Field labels for the visibility menu; a few keys don't match 1:1. */
function fieldLabel(field: AdminChannelOptionalField): string {
  if (field === 'usage') return t('channels.usageAndRatio')
  if (field === 'upstream') return t('channels.upstreamAndRatio')
  if (field === 'rowUpstreamAction') return t('channels.rowUpstreamAction')
  if (field === 'rowResponseAction') return t('channels.rowResponseAction')
  return t(`channels.${field}`)
}

const allColumns = computed<
  Array<TableColumn & { optional?: AdminChannelOptionalField }>
>(() => [
  { key: 'id', label: t('channels.id'), width: '72px', optional: 'id' },
  { key: 'name', label: t('channels.name'), width: '190px' },
  {
    key: 'type',
    label: t('channels.type'),
    width: '145px',
    optional: 'type',
  },
  {
    key: 'status',
    label: t('channels.status'),
    width: '118px',
    optional: 'status',
  },
  {
    key: 'priority',
    label: t('channels.priority'),
    width: '96px',
    optional: 'priority',
  },
  {
    key: 'weight',
    label: t('channels.weight'),
    width: '96px',
    optional: 'weight',
  },
  {
    key: 'capacity',
    label: t('channels.capacity'),
    width: '130px',
    optional: 'capacity',
  },
  {
    key: 'usage',
    label: t('channels.usageAndRatio'),
    width: '158px',
    optional: 'usage',
  },
  {
    key: 'upstream',
    label: t('channels.upstreamAndRatio'),
    width: '178px',
    optional: 'upstream',
  },
  {
    key: 'response',
    label: t('channels.response'),
    width: '138px',
    optional: 'response',
  },
  {
    key: 'actions',
    label: t('channels.actions'),
    width: '120px',
    align: 'right',
  },
])

const columns = computed<TableColumn[]>(() =>
  allColumns.value.filter(
    (column) => !column.optional || isFieldVisible(column.optional)
  )
)

const minTableWidth = computed(() => {
  const width = columns.value.reduce(
    (totalWidth, column) =>
      totalWidth + Number.parseInt(column.width ?? '120', 10),
    0
  )
  return `${Math.max(860, width + 40)}px`
})

const supplierGroups = computed<SupplierGroup[]>(() => {
  const groups = new Map<string, AdminChannel[]>()
  rows.value.forEach((channel) => {
    const channels = groups.get(channel.supplier)
    if (channels) channels.push(channel)
    else groups.set(channel.supplier, [channel])
  })
  return Array.from(groups, ([supplier, channels]) => ({ supplier, channels }))
})

const tableRows = computed<AdminChannelTableRow[]>(() =>
  supplierGroups.value.flatMap((group) => {
    const groupRow: SupplierTableRow = {
      key: `supplier:${group.supplier}`,
      kind: 'supplier',
      supplier: group.supplier,
      count: group.channels.length,
      channels: group.channels,
    }
    if (collapsedSuppliers.value.includes(group.supplier)) return [groupRow]
    return [
      groupRow,
      ...group.channels.map<ChannelTableRow>((channel) => ({
        key: channel.id,
        kind: 'channel',
        channel,
      })),
    ]
  })
)

const typeOptions = computed(() => {
  const ids = Object.entries(typeCounts.value)
    .filter(([, count]) => count > 0)
    .map(([id]) => Number(id))
  const selected = Number(type.value)
  if (type.value && !ids.includes(selected)) ids.push(selected)
  return [
    { value: '', label: t('channels.allTypes') },
    ...ids
      .sort((left, right) =>
        adminChannelTypeMeta(left).label.localeCompare(
          adminChannelTypeMeta(right).label
        )
      )
      .map((id) => ({
        value: String(id),
        label: `${adminChannelTypeMeta(id).label} (${typeCounts.value[id] ?? 0})`,
      })),
  ]
})

const statusOptions = computed(() => [
  { value: '', label: t('channels.allStatuses') },
  {
    value: 'enabled',
    label: t('channels.enabledOnly'),
    tone: 'success' as const,
  },
  {
    value: 'disabled',
    label: t('channels.disabledOnly'),
    tone: 'danger' as const,
  },
])

const sortOptions = computed(() =>
  ADMIN_CHANNEL_SORT_FIELDS.map((field) => ({
    value: field,
    label: t(`channels.sort.${field}`),
  }))
)

const sortModel = computed({
  get: () => sortBy.value,
  set: (value: string) => {
    sortBy.value = value as AdminChannelSortBy
  },
})

function toggleSortOrder() {
  sortOrder.value = (
    sortOrder.value === 'asc' ? 'desc' : 'asc'
  ) as AdminChannelSortOrder
}

function isSupplierRow(row: AdminChannelTableRow): boolean {
  return row.kind === 'supplier'
}

function channelFromRow(row: AdminChannelTableRow): AdminChannel {
  if (row.kind !== 'channel') throw new Error('Expected a channel table row')
  return row.channel
}

function channelRowClass(row: AdminChannelTableRow): string | undefined {
  if (row.kind !== 'channel' || row.channel.status === 1) return undefined
  return 'opacity-75'
}

function isSupplierCollapsed(supplier: string): boolean {
  return collapsedSuppliers.value.includes(supplier)
}

function toggleSupplier(supplier: string) {
  collapsedSuppliers.value = collapsedSuppliers.value.includes(supplier)
    ? collapsedSuppliers.value.filter((item) => item !== supplier)
    : [...collapsedSuppliers.value, supplier]
}

function batchButtonLabel(action: 'balance' | 'test'): string {
  if (
    batchProgress.value?.scope === 'page' &&
    batchProgress.value.action === action
  ) {
    return t('channels.batchProgressLabel', {
      action:
        action === 'balance'
          ? t('channels.batchBalanceAction')
          : t('channels.batchTestAction'),
      processed: batchProgress.value.processed,
      total: batchProgress.value.total,
    })
  }
  return t(
    action === 'balance'
      ? 'channels.batchBalanceLabel'
      : 'channels.batchTestLabel',
    { count: rows.value.length }
  )
}

function isPageBatch(action: 'balance' | 'test'): boolean {
  return (
    batchProgress.value?.scope === 'page' &&
    batchProgress.value.action === action
  )
}

function isSupplierBatch(
  action: 'balance' | 'test',
  supplier: string
): boolean {
  return (
    batchProgress.value?.scope === 'supplier' &&
    batchProgress.value.action === action &&
    batchProgress.value.supplier === supplier
  )
}

function batchProgressText(): string {
  const progress = batchProgress.value
  if (!progress) return ''
  return `${progress.processed}/${progress.total}`
}

function supplierBatchLabel(
  action: 'balance' | 'test',
  supplier: string
): string {
  if (isSupplierBatch(action, supplier) && batchProgress.value) {
    return t('channels.batchProgressLabel', {
      action:
        action === 'balance'
          ? t('channels.batchBalanceAction')
          : t('channels.batchTestAction'),
      processed: batchProgress.value.processed,
      total: batchProgress.value.total,
    })
  }
  return t(
    action === 'balance' ? 'channels.syncSupplier' : 'channels.testSupplier',
    { supplier }
  )
}

function openCreate() {
  if (!canMutate.value) return
  editing.value = null
  formOpen.value = true
}

function openEdit(channel: AdminChannel) {
  if (!canMutate.value) return
  editing.value = channel
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
}

function saveForm(
  input: AdminChannelCreateInput | AdminChannelUpdateInput
): Promise<boolean> {
  return editing.value
    ? updateChannelDetails(editing.value, input as AdminChannelUpdateInput)
    : createChannel(input as AdminChannelCreateInput)
}

function requestDelete(channel: AdminChannel) {
  if (!canMutate.value) return
  deleting.value = { kind: 'channel', channel }
}

function requestBulkDelete() {
  if (!canMutate.value || selectedChannels.value.length === 0) return
  deleting.value = {
    kind: 'bulk',
    channels: selectedChannels.value.map((channel) => ({ ...channel })),
  }
}

function requestClearSupplier(group: SupplierGroup) {
  if (!canMutate.value) return
  deleting.value = {
    kind: 'supplier',
    supplier: group.supplier,
    channels: group.channels.map((channel) => ({ ...channel })),
  }
}

async function confirmDelete() {
  const target = deleting.value
  if (!target) return
  const deleted =
    target.kind === 'channel'
      ? await deleteChannel(target.channel)
      : target.kind === 'supplier'
        ? await deleteSupplierChannels(target.supplier, target.channels)
        : await deleteSelectedChannels(target.channels)
  if (deleted) {
    deleting.value = null
    clearSelection()
  }
}

function cancelDelete() {
  if (!isCrudActionBusy('delete') && !isBulkActionBusy('delete')) {
    deleting.value = null
  }
}

const deleteDialogTitle = computed(() =>
  deleting.value?.kind === 'supplier'
    ? t('channels.clearSupplierTitle')
    : deleting.value?.kind === 'bulk'
      ? t('channels.bulkDeleteTitle')
      : t('channels.deleteTitle')
)

const deleteDialogMessage = computed(() => {
  const target = deleting.value
  if (!target) return ''
  if (target.kind === 'channel') {
    return t('channels.deleteMessage', { name: target.channel.name })
  }
  if (target.kind === 'bulk') {
    return t('channels.bulkDeleteMessage', { count: target.channels.length })
  }
  return t('channels.clearSupplierMessage', {
    supplier: target.supplier,
    count: target.channels.length,
  })
})

async function runBulkStatus(
  action: 'enable' | 'disable' | 'reset'
): Promise<void> {
  if (!canMutate.value) return
  if (await updateChannelsStatus(action, selectedChannels.value)) {
    clearSelection()
  }
}
</script>

<template>
  <div>
    <header
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="min-w-0">
        <Breadcrumb
          :crumbs="[t('nav.groupAdmin'), t('nav.channelManagement')]"
          spacing="mb-2"
        />
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">
          {{ t('channels.title') }}
        </h1>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]" aria-live="polite">
          {{ t('channels.resultCount', { count: total }) }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ConsoleButton
          variant="secondary"
          :loading="refreshing"
          :disabled="isBatchBusy || isCrudBusy || isBulkBusy"
          @click="load({ background: true })"
        >
          <RefreshCw v-if="!refreshing" :size="15" />
          {{ t('channels.refreshList') }}
        </ConsoleButton>
        <ConsoleButton :disabled="!canMutate" @click="openCreate">
          <Plus :size="16" />
          {{ t('channels.createChannel') }}
        </ConsoleButton>
      </div>
    </header>

    <ConsoleCard :padded="false">
      <div
        class="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-4 xl:flex-row xl:items-center"
      >
        <SearchInput
          v-model="keyword"
          :placeholder="t('channels.searchPlaceholder')"
          :aria-label="t('channels.searchPlaceholder')"
          name="admin-channel-search"
          class="w-full xl:w-72"
        />
        <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:flex-1">
          <FilterSelect
            v-model="type"
            :options="typeOptions"
            :label="t('channels.typeFilter')"
            class="w-full"
          />
          <FilterSelect
            v-model="status"
            :options="statusOptions"
            :label="t('channels.statusFilter')"
            class="w-full"
          />
          <div class="flex min-w-0 gap-2">
            <FilterSelect
              v-model="sortModel"
              :options="sortOptions"
              :label="t('channels.sortLabel')"
              class="min-w-0 flex-1"
            />
            <IconButton
              :label="
                sortOrder === 'asc'
                  ? t('channels.sortAscending')
                  : t('channels.sortDescending')
              "
              class="h-10 w-10 shrink-0 rounded-xl bg-[var(--surface-muted)]"
              @click="toggleSortOrder"
            >
              <ArrowUpNarrowWide v-if="sortOrder === 'asc'" :size="17" />
              <ArrowDownNarrowWide v-else :size="17" />
            </IconButton>
            <FieldVisibilityMenu
              v-model="visibleFields"
              :all-fields="ADMIN_CHANNEL_OPTIONAL_FIELDS"
              :default-fields="ADMIN_CHANNEL_DEFAULT_VISIBLE_FIELDS"
              :label-for="fieldLabel"
              :title="t('channels.fieldSettings')"
              :reset-label="t('channels.resetFields')"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 md:hidden">
          <ConsoleButton
            variant="secondary"
            size="sm"
            block
            :disabled="!canRunBatch"
            :aria-label="batchButtonLabel('balance')"
            @click="runVisibleBatch('balance')"
          >
            <LoaderCircle
              v-if="isPageBatch('balance')"
              :size="14"
              class="animate-spin"
            />
            <RefreshCw v-else :size="14" />
            <span class="min-w-0 truncate">
              {{
                isPageBatch('balance')
                  ? batchProgressText()
                  : t('channels.batchBalancePage')
              }}
            </span>
          </ConsoleButton>
          <ConsoleButton
            variant="secondary"
            size="sm"
            block
            :disabled="!canRunBatch"
            :aria-label="batchButtonLabel('test')"
            @click="runVisibleBatch('test')"
          >
            <LoaderCircle
              v-if="isPageBatch('test')"
              :size="14"
              class="animate-spin"
            />
            <Activity v-else :size="14" />
            <span class="min-w-0 truncate">
              {{
                isPageBatch('test')
                  ? batchProgressText()
                  : t('channels.batchTestPage')
              }}
            </span>
          </ConsoleButton>
        </div>
      </div>

      <div
        v-if="selectedIds.length > 0"
        data-channel-bulk-actions
        class="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-2.5"
      >
        <span
          class="mr-auto text-xs font-semibold text-[var(--text-secondary)]"
          aria-live="polite"
        >
          {{ t('channels.selectedCount', { count: selectedIds.length }) }}
        </span>
        <IconButton
          :label="t('channels.bulkEnable')"
          :disabled="
            !canMutate ||
            selectedChannels.every((channel) => channel.status === 1)
          "
          :class="isBulkActionBusy('enable') ? 'text-[var(--accent)]' : ''"
          @click="runBulkStatus('enable')"
        >
          <LoaderCircle
            v-if="isBulkActionBusy('enable')"
            :size="16"
            class="animate-spin"
          />
          <Power v-else :size="16" />
        </IconButton>
        <IconButton
          :label="t('channels.bulkDisable')"
          :disabled="
            !canMutate ||
            selectedChannels.every((channel) => channel.status === 2)
          "
          :class="isBulkActionBusy('disable') ? 'text-[var(--accent)]' : ''"
          @click="runBulkStatus('disable')"
        >
          <LoaderCircle
            v-if="isBulkActionBusy('disable')"
            :size="16"
            class="animate-spin"
          />
          <PowerOff v-else :size="16" />
        </IconButton>
        <IconButton
          :label="t('channels.bulkReset')"
          :disabled="!canMutate || resettableSelectedCount === 0"
          :class="isBulkActionBusy('reset') ? 'text-[var(--accent)]' : ''"
          @click="runBulkStatus('reset')"
        >
          <LoaderCircle
            v-if="isBulkActionBusy('reset')"
            :size="16"
            class="animate-spin"
          />
          <RotateCcw v-else :size="16" />
        </IconButton>
        <IconButton
          :label="t('channels.bulkDelete')"
          tone="danger"
          :disabled="!canMutate"
          @click="requestBulkDelete"
        >
          <Trash2 :size="16" />
        </IconButton>
        <IconButton
          :label="t('channels.clearSelection')"
          :disabled="!canMutate"
          @click="clearSelection"
        >
          <X :size="16" />
        </IconButton>
      </div>

      <div
        v-if="initialError"
        class="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center"
        role="alert"
      >
        <AlertTriangle :size="28" class="text-[var(--status-danger-text)]" />
        <p class="mt-3 font-semibold text-[var(--text-primary)]">
          {{ t('channels.loadFailed') }}
        </p>
        <p class="mt-1 max-w-md text-sm text-[var(--text-tertiary)]">
          {{ initialError }}
        </p>
        <ConsoleButton class="mt-5" variant="secondary" @click="load()">
          {{ t('channels.retry') }}
        </ConsoleButton>
      </div>

      <template v-else>
        <DataTable
          :columns="columns"
          :rows="tableRows"
          row-key="key"
          selectable
          checkbox-shape="round"
          :selected="selectedIds"
          :selection-keys="pageChannelIds"
          :selection-disabled="!canMutate"
          :is-group-row="isSupplierRow"
          :loading="loading"
          :skeleton-rows="pageSize"
          adaptive-scroll
          :page-size="pageSize"
          :min-table-width="minTableWidth"
          :scroll-region-label="t('channels.title')"
          :empty-title="t('channels.emptyTitle')"
          :empty-hint="t('channels.emptyHint')"
          :row-class="channelRowClass"
          class="hidden md:block"
          @update:selected="updateSelected"
        >
          <template #group-row="{ row }">
            <div class="flex min-w-0 items-center justify-between gap-3">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 text-left focus-ring"
                :aria-label="
                  isSupplierCollapsed((row as SupplierTableRow).supplier)
                    ? t('channels.expandSupplier', {
                        supplier: (row as SupplierTableRow).supplier,
                      })
                    : t('channels.collapseSupplier', {
                        supplier: (row as SupplierTableRow).supplier,
                      })
                "
                :aria-expanded="
                  !isSupplierCollapsed((row as SupplierTableRow).supplier)
                "
                @click="toggleSupplier((row as SupplierTableRow).supplier)"
              >
                <ChevronRight
                  v-if="isSupplierCollapsed((row as SupplierTableRow).supplier)"
                  :size="15"
                  class="shrink-0 text-[var(--text-tertiary)]"
                />
                <ChevronDown
                  v-else
                  :size="15"
                  class="shrink-0 text-[var(--text-tertiary)]"
                />
                <VendorLogo
                  :vendor="(row as SupplierTableRow).supplier"
                  :size="24"
                />
                <span class="truncate font-semibold">
                  {{ (row as SupplierTableRow).supplier }}
                </span>
                <span
                  class="shrink-0 text-xs font-normal text-[var(--text-tertiary)]"
                >
                  {{
                    t('channels.supplierGroupCount', {
                      count: (row as SupplierTableRow).count,
                    })
                  }}
                </span>
              </button>
              <div class="flex shrink-0 items-center gap-0.5">
                <span
                  v-if="
                    batchProgress?.scope === 'supplier' &&
                    batchProgress.supplier ===
                      (row as SupplierTableRow).supplier
                  "
                  class="mr-1 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]"
                >
                  {{ batchProgressText() }}
                </span>
                <IconButton
                  :label="
                    supplierBatchLabel(
                      'balance',
                      (row as SupplierTableRow).supplier
                    )
                  "
                  :disabled="!canRunBatch"
                  class="h-7 w-7"
                  @click="
                    runSupplierBatch(
                      'balance',
                      (row as SupplierTableRow).supplier,
                      (row as SupplierTableRow).channels
                    )
                  "
                >
                  <LoaderCircle
                    v-if="
                      isSupplierBatch(
                        'balance',
                        (row as SupplierTableRow).supplier
                      )
                    "
                    :size="14"
                    class="animate-spin"
                  />
                  <RefreshCw v-else :size="14" />
                </IconButton>
                <IconButton
                  :label="
                    supplierBatchLabel(
                      'test',
                      (row as SupplierTableRow).supplier
                    )
                  "
                  :disabled="!canRunBatch"
                  class="h-7 w-7"
                  @click="
                    runSupplierBatch(
                      'test',
                      (row as SupplierTableRow).supplier,
                      (row as SupplierTableRow).channels
                    )
                  "
                >
                  <LoaderCircle
                    v-if="
                      isSupplierBatch(
                        'test',
                        (row as SupplierTableRow).supplier
                      )
                    "
                    :size="14"
                    class="animate-spin"
                  />
                  <Activity v-else :size="14" />
                </IconButton>
                <IconButton
                  :label="
                    t('channels.clearSupplier', {
                      supplier: (row as SupplierTableRow).supplier,
                    })
                  "
                  tone="danger"
                  :disabled="!canMutate"
                  class="h-7 w-7"
                  @click="
                    requestClearSupplier({
                      supplier: (row as SupplierTableRow).supplier,
                      channels: (row as SupplierTableRow).channels,
                    })
                  "
                >
                  <Trash2 :size="14" />
                </IconButton>
              </div>
            </div>
          </template>

          <template #header-upstream="{ column }">
            <div class="flex items-center justify-between gap-1">
              <span aria-hidden="true">{{ column.label }}</span>
              <span class="flex shrink-0 items-center gap-0.5">
                <span
                  v-if="isPageBatch('balance')"
                  class="font-mono text-[9px] tabular-nums text-[var(--text-tertiary)]"
                >
                  {{ batchProgressText() }}
                </span>
                <IconButton
                  :label="batchButtonLabel('balance')"
                  :disabled="!canRunBatch"
                  class="h-6 w-6 rounded-md"
                  @click="runVisibleBatch('balance')"
                >
                  <LoaderCircle
                    v-if="isPageBatch('balance')"
                    :size="13"
                    class="animate-spin"
                  />
                  <RefreshCw v-else :size="13" />
                </IconButton>
              </span>
            </div>
          </template>
          <template #header-response="{ column }">
            <div class="flex items-center justify-between gap-1">
              <span aria-hidden="true">{{ column.label }}</span>
              <span class="flex shrink-0 items-center gap-0.5">
                <span
                  v-if="isPageBatch('test')"
                  class="font-mono text-[9px] tabular-nums text-[var(--text-tertiary)]"
                >
                  {{ batchProgressText() }}
                </span>
                <IconButton
                  :label="batchButtonLabel('test')"
                  :disabled="!canRunBatch"
                  class="h-6 w-6 rounded-md"
                  @click="runVisibleBatch('test')"
                >
                  <LoaderCircle
                    v-if="isPageBatch('test')"
                    :size="13"
                    class="animate-spin"
                  />
                  <Activity v-else :size="13" />
                </IconButton>
              </span>
            </div>
          </template>

          <template #cell-id="{ row }">
            <span class="font-mono text-xs text-[var(--text-secondary)]">
              #{{ channelFromRow(row as AdminChannelTableRow).id }}
            </span>
          </template>
          <template #cell-name="{ row }">
            <span
              class="block truncate font-semibold"
              :class="
                channelFromRow(row as AdminChannelTableRow).status === 1
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)]'
              "
              :title="channelFromRow(row as AdminChannelTableRow).name"
            >
              {{ channelFromRow(row as AdminChannelTableRow).name }}
            </span>
          </template>
          <template #cell-type="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <VendorLogo
                :vendor="channelFromRow(row as AdminChannelTableRow).supplier"
                :size="28"
              />
              <span
                class="truncate text-xs text-[var(--text-secondary)]"
                :title="
                  adminChannelTypeMeta(
                    channelFromRow(row as AdminChannelTableRow).type
                  ).label
                "
              >
                {{
                  adminChannelTypeMeta(
                    channelFromRow(row as AdminChannelTableRow).type
                  ).label
                }}
              </span>
            </div>
          </template>
          <template #cell-status="{ row }">
            <StatusChip
              :tone="
                adminChannelStatusTone(
                  channelFromRow(row as AdminChannelTableRow).status
                )
              "
            >
              {{
                t(
                  adminChannelStatusLabelKey(
                    channelFromRow(row as AdminChannelTableRow).status
                  )
                )
              }}
            </StatusChip>
          </template>
          <template #cell-priority="{ row }">
            <ChannelInlineNumber
              :value="channelFromRow(row as AdminChannelTableRow).priority"
              :label="
                t('channels.priorityFor', {
                  name: channelFromRow(row as AdminChannelTableRow).name,
                })
              "
              :busy="isRowBusy(channelFromRow(row as AdminChannelTableRow).id)"
              :commit="
                (value) =>
                  updateNumber(
                    channelFromRow(row as AdminChannelTableRow),
                    'priority',
                    value
                  )
              "
            />
          </template>
          <template #cell-weight="{ row }">
            <ChannelInlineNumber
              :value="channelFromRow(row as AdminChannelTableRow).weight"
              :label="
                t('channels.weightFor', {
                  name: channelFromRow(row as AdminChannelTableRow).name,
                })
              "
              :busy="isRowBusy(channelFromRow(row as AdminChannelTableRow).id)"
              :commit="
                (value) =>
                  updateNumber(
                    channelFromRow(row as AdminChannelTableRow),
                    'weight',
                    value
                  )
              "
            />
          </template>
          <template #cell-capacity="{ row }">
            <CapacityMeter
              :used="channelFromRow(row as AdminChannelTableRow).capacity_used"
              :total="
                channelFromRow(row as AdminChannelTableRow).capacity_total
              "
            />
          </template>
          <template #cell-usage="{ row }">
            <div class="space-y-0.5 text-xs">
              <p class="font-semibold tabular-nums">
                {{
                  formatQuota(
                    channelFromRow(row as AdminChannelTableRow).used_quota
                  )
                }}
              </p>
              <p class="text-[11px] text-[var(--text-tertiary)]">
                {{
                  t('channels.channelRatioValue', {
                    ratio: channelFromRow(
                      row as AdminChannelTableRow
                    ).channel_ratio.toFixed(2),
                  })
                }}
              </p>
            </div>
          </template>
          <template #cell-upstream="{ row }">
            <div class="flex items-center justify-between gap-1">
              <div class="min-w-0 space-y-0.5 text-xs">
                <p class="font-semibold tabular-nums">
                  {{
                    formatMoney(
                      channelFromRow(row as AdminChannelTableRow).balance
                    )
                  }}
                </p>
                <p class="truncate text-[11px] text-[var(--text-tertiary)]">
                  {{
                    t('channels.upstreamRatioValue', {
                      ratio: channelFromRow(
                        row as AdminChannelTableRow
                      ).upstream_ratio.toFixed(2),
                    })
                  }}
                </p>
              </div>
              <IconButton
                v-if="isFieldVisible('rowUpstreamAction')"
                :label="t('channels.refreshBalance')"
                :disabled="
                  isRowBusy(channelFromRow(row as AdminChannelTableRow).id)
                "
                class="h-7 w-7 shrink-0"
                @click="
                  refreshBalance(channelFromRow(row as AdminChannelTableRow))
                "
              >
                <LoaderCircle
                  v-if="
                    isBusy(
                      channelFromRow(row as AdminChannelTableRow).id,
                      'balance'
                    )
                  "
                  :size="14"
                  class="animate-spin"
                />
                <RefreshCw v-else :size="14" />
              </IconButton>
            </div>
          </template>
          <template #cell-response="{ row }">
            <div class="flex items-center justify-between gap-1">
              <StatusChip
                :tone="
                  adminChannelResponseTone(
                    channelFromRow(row as AdminChannelTableRow).response_time
                  )
                "
                :title="
                  channelFromRow(row as AdminChannelTableRow).test_time
                    ? t('channels.testedAt', {
                        time: relativeTime(
                          channelFromRow(row as AdminChannelTableRow).test_time,
                          locale
                        ),
                      })
                    : t('channels.notTested')
                "
              >
                {{
                  adminChannelResponseText(
                    channelFromRow(row as AdminChannelTableRow).response_time,
                    t('channels.notTested')
                  )
                }}
              </StatusChip>
              <IconButton
                v-if="isFieldVisible('rowResponseAction')"
                :label="t('channels.testChannel')"
                :disabled="
                  isRowBusy(channelFromRow(row as AdminChannelTableRow).id)
                "
                class="h-7 w-7 shrink-0"
                @click="
                  testChannel(channelFromRow(row as AdminChannelTableRow))
                "
              >
                <LoaderCircle
                  v-if="
                    isBusy(
                      channelFromRow(row as AdminChannelTableRow).id,
                      'test'
                    )
                  "
                  :size="14"
                  class="animate-spin"
                />
                <Activity v-else :size="14" />
              </IconButton>
            </div>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex items-center justify-end gap-0.5">
              <IconButton
                :label="t('channels.editChannel')"
                :disabled="
                  isRowBusy(channelFromRow(row as AdminChannelTableRow).id)
                "
                @click="openEdit(channelFromRow(row as AdminChannelTableRow))"
              >
                <Pencil :size="15" />
              </IconButton>
              <IconButton
                :label="
                  channelFromRow(row as AdminChannelTableRow).status === 1
                    ? t('channels.disableChannel')
                    : t('channels.enableChannel')
                "
                :tone="
                  channelFromRow(row as AdminChannelTableRow).status === 1
                    ? 'danger'
                    : 'default'
                "
                :disabled="
                  isRowBusy(channelFromRow(row as AdminChannelTableRow).id)
                "
                @click="
                  toggleStatus(channelFromRow(row as AdminChannelTableRow))
                "
              >
                <LoaderCircle
                  v-if="
                    isBusy(
                      channelFromRow(row as AdminChannelTableRow).id,
                      'status'
                    )
                  "
                  :size="15"
                  class="animate-spin"
                />
                <PowerOff
                  v-else-if="
                    channelFromRow(row as AdminChannelTableRow).status === 1
                  "
                  :size="15"
                />
                <Power v-else :size="15" />
              </IconButton>
              <IconButton
                :label="t('channels.deleteChannel')"
                tone="danger"
                :disabled="
                  isRowBusy(channelFromRow(row as AdminChannelTableRow).id)
                "
                @click="
                  requestDelete(channelFromRow(row as AdminChannelTableRow))
                "
              >
                <LoaderCircle
                  v-if="
                    isCrudActionBusy(
                      'delete',
                      channelFromRow(row as AdminChannelTableRow).id
                    )
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
              :page-sizes="[10, 20, 50]"
            />
          </template>
        </DataTable>

        <div class="md:hidden">
          <div
            v-if="loading"
            class="divide-y divide-[var(--border-subtle)]"
            aria-hidden="true"
          >
            <div v-for="index in 5" :key="index" class="space-y-4 p-4">
              <div
                class="h-5 w-2/3 animate-pulse rounded bg-[var(--surface-muted)]"
              />
              <div class="grid grid-cols-2 gap-3">
                <div
                  class="h-14 animate-pulse rounded bg-[var(--surface-muted)]"
                />
                <div
                  class="h-14 animate-pulse rounded bg-[var(--surface-muted)]"
                />
              </div>
            </div>
          </div>
          <EmptyState
            v-else-if="rows.length === 0"
            :title="t('channels.emptyTitle')"
            :hint="t('channels.emptyHint')"
            illustration="empty-search"
          />
          <ChannelMobileList
            v-else
            :groups="supplierGroups"
            :visible-fields="visibleFields"
            :selected-ids="selectedIds"
            :all-selected="allPageSelected"
            :selection-disabled="!canMutate"
            :toggle-all-selected="toggleAllSelected"
            :toggle-selected="toggleSelected"
            :is-supplier-collapsed="isSupplierCollapsed"
            :toggle-supplier="toggleSupplier"
            :batch-progress="batchProgress"
            :can-run-batch="canRunBatch"
            :can-mutate="canMutate"
            :run-supplier-batch="runSupplierBatch"
            :clear-supplier="requestClearSupplier"
            :is-busy="isBusy"
            :is-row-busy="isRowBusy"
            :update-number="updateNumber"
            :toggle-status="toggleStatus"
            :refresh-balance="refreshBalance"
            :test-channel="testChannel"
            :edit-channel="openEdit"
            :delete-channel="requestDelete"
          />
          <TablePagination
            v-if="!loading"
            v-model:page="page"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50]"
          />
        </div>
      </template>
    </ConsoleCard>

    <ChannelFormModal
      :open="formOpen"
      :editing="editing"
      :save="saveForm"
      @close="closeForm"
    />

    <ConfirmDialog
      :open="deleting !== null"
      :title="deleteDialogTitle"
      :message="deleteDialogMessage"
      :confirm-text="t('common.delete')"
      :loading="isCrudActionBusy('delete') || isBulkActionBusy('delete')"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
