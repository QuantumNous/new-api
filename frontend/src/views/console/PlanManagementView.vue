<script setup lang="ts">
import {
  AlertTriangle,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterSelect, {
  type SelectOption,
} from '@/components/common/FilterSelect.vue'
import IconButton from '@/components/common/IconButton.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import Breadcrumb from '@/components/console/Breadcrumb.vue'
import PlanFormModal from '@/components/console/plans/PlanFormModal.vue'
import { useAdminPlans } from '@/composables/useAdminPlans'
import {
  ADMIN_PLAN_SORT_FIELDS,
  ADMIN_PLAN_STATUSES,
  PLAN_KINDS,
  adminPlanSortLabelKey,
  adminPlanStatusLabelKey,
  adminPlanStatusTone,
  durationUnitLabelKey,
  planAccentColor,
  planKindLabelKey,
  planKindTone,
  planLifetimeQuota,
  planUnitPrice,
  subscriptionMeterLabelKey,
} from '@/constants/adminPlans'
import type {
  AdminChannelPage,
  AdminPlan,
  AdminPlanCreateInput,
  AdminPlanSortBy,
  AdminPlanStatus,
  Duration,
} from '@/types/console'
import { formatMoney, formatNumber, formatTime } from '@/utils/format'

const { t } = useI18n()

const {
  rows,
  total,
  statusCounts,
  kindCounts,
  filteredSubscribers,
  filteredRevenue,
  page,
  pageSize,
  keyword,
  statusFilter,
  kindFilter,
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
  setStatus,
  createPlan,
  updatePlan,
  deletePlan,
  deleteSelected,
} = useAdminPlans()

/**
 * Channel id → name, for the exclusive-channel column. Loaded once here rather
 * than joined server-side so a deleted channel stays visible as a dangling
 * reference instead of silently rendering as "none".
 */
const channelNames = ref<Map<number, string>>(new Map())

async function loadChannelNames(): Promise<void> {
  try {
    const page = await api.get<AdminChannelPage>('/api/channel/', {
      page_size: 100,
    })
    channelNames.value = new Map(
      page.items.map((channel) => [channel.id, channel.name])
    )
  } catch {
    // Non-fatal: the column falls back to showing the raw id.
  }
}

const formOpen = ref(false)
const editing = ref<AdminPlan | null>(null)
const deleting = ref<AdminPlan | null>(null)
const deletingBulk = ref<AdminPlan[]>([])
const archiving = ref<AdminPlan | null>(null)
const selectedIds = ref<number[]>([])

const selectedPlans = computed(() =>
  rows.value.filter((plan) => selectedIds.value.includes(plan.id))
)

// Drop stale ids whenever the page contents change, so a bulk action can never
// act on a row the user can no longer see.
watch(rows, (next) => {
  const ids = new Set(next.map((plan) => plan.id))
  selectedIds.value = selectedIds.value.filter((id) => ids.has(id))
})

function updateSelected(keys: Array<string | number>): void {
  selectedIds.value = keys.filter((k): k is number => typeof k === 'number')
}

function clearSelection(): void {
  selectedIds.value = []
}

/** A plan with live subscribers is never deletable — billing resolves by id. */
function isDeletable(plan: AdminPlan): boolean {
  return plan.subscribers === 0
}

/**
 * FilterSelect has no neutral dot, so an archived plan simply shows no swatch
 * rather than borrowing a status colour it does not have.
 */
function statusDotTone(status: AdminPlanStatus): SelectOption['tone'] {
  const tone = adminPlanStatusTone(status)
  return tone === 'neutral' ? undefined : tone
}

const statusOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('planManagement.allStatuses') },
  ...ADMIN_PLAN_STATUSES.map((status) => ({
    value: status,
    label: `${t(adminPlanStatusLabelKey(status))} (${statusCounts.value[status] ?? 0})`,
    tone: statusDotTone(status),
  })),
])

const kindOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('planManagement.allKinds') },
  ...PLAN_KINDS.map((kind) => ({
    value: kind,
    label: `${t(planKindLabelKey(kind))} (${kindCounts.value[kind] ?? 0})`,
    tone: planKindTone(kind),
  })),
])

function duration(value: Duration): string {
  return t(durationUnitLabelKey(value.unit), value.value, {
    named: { n: value.value },
  })
}

/** Quota cell text, which means different things per kind. */
function quotaLabel(plan: AdminPlan): string {
  if (plan.kind === 'traffic') return formatNumber(plan.quota)
  return t('planManagement.perPeriodQuota', {
    value: formatNumber(plan.period_quota),
    period: duration(plan.period),
  })
}

/** Duration cell: validity for a pack, term for a subscription. */
function durationLabel(plan: AdminPlan): string {
  if (plan.kind === 'traffic') {
    return plan.validity === null
      ? t('planManagement.forever')
      : duration(plan.validity)
  }
  return duration(plan.term)
}

function channelLabel(plan: AdminPlan): string {
  if (plan.exclusive_channel_id === null) return '—'
  const channel = channelNames.value.get(plan.exclusive_channel_id)
  return (
    channel ??
    t('planManagement.channelRemoved', { id: plan.exclusive_channel_id })
  )
}

function channelMissing(plan: AdminPlan): boolean {
  return (
    plan.exclusive_channel_id !== null &&
    channelNames.value.size > 0 &&
    !channelNames.value.has(plan.exclusive_channel_id)
  )
}

const sortOptions = computed<SelectOption[]>(() =>
  ADMIN_PLAN_SORT_FIELDS.map((field) => ({
    value: field,
    label: t(adminPlanSortLabelKey(field)),
  }))
)

const sortModel = computed<string>({
  get: () => sortBy.value,
  set: (value) => {
    sortBy.value = value as AdminPlanSortBy
  },
})

function toggleSortOrder(): void {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('planManagement.colName'), width: '210px' },
  { key: 'kind', label: t('planManagement.colKind'), width: '104px' },
  { key: 'price', label: t('planManagement.colPrice'), width: '92px' },
  { key: 'quota', label: t('planManagement.colQuota'), width: '170px' },
  { key: 'duration', label: t('planManagement.colDuration'), width: '96px' },
  { key: 'unitPrice', label: t('planManagement.colUnitPrice'), width: '104px' },
  { key: 'channel', label: t('planManagement.colChannel'), width: '140px' },
  { key: 'status', label: t('planManagement.colStatus'), width: '100px' },
  {
    key: 'subscribers',
    label: t('planManagement.colSubscribers'),
    width: '100px',
    align: 'right',
  },
  {
    key: 'revenue',
    label: t('planManagement.colRevenue'),
    width: '120px',
    align: 'right',
  },
  { key: 'updated', label: t('planManagement.colUpdated'), width: '150px' },
  {
    key: 'actions',
    label: t('planManagement.colActions'),
    width: '150px',
    align: 'right',
  },
])

const statCards = computed(() => [
  {
    label: t('planManagement.statActive'),
    value: formatNumber(statusCounts.value.active ?? 0),
  },
  {
    label: t('planManagement.statSplit'),
    value: `${kindCounts.value.traffic ?? 0} / ${kindCounts.value.subscription ?? 0}`,
  },
  {
    label: t('planManagement.statSubscribers'),
    value: formatNumber(filteredSubscribers.value),
  },
  {
    label: t('planManagement.statRevenue'),
    value: formatMoney(filteredRevenue.value, 0),
  },
])

function openCreate(): void {
  editing.value = null
  formOpen.value = true
}

function openEdit(plan: AdminPlan): void {
  editing.value = plan
  formOpen.value = true
}

async function handleSubmit(input: AdminPlanCreateInput): Promise<void> {
  const target = editing.value
  // `status` and `kind` are stripped for the edit path: shelf state belongs to
  // the status route, and kind is immutable once the plan exists.
  const { status: _status, ...rest } = input
  const ok = target
    ? await updatePlan(target.id, rest)
    : await createPlan(input)
  if (ok) {
    formOpen.value = false
    editing.value = null
    // Sort order or the exclusive channel may have changed the joined labels.
    await loadChannelNames()
  }
}

function requestArchive(plan: AdminPlan): void {
  archiving.value = plan
}

async function confirmArchive(): Promise<void> {
  const plan = archiving.value
  if (!plan) return
  const ok = await setStatus(plan, 'archived')
  if (ok) archiving.value = null
}

async function confirmDelete(): Promise<void> {
  const plan = deleting.value
  if (!plan) return
  const ok = await deletePlan(plan)
  if (ok) deleting.value = null
}

async function confirmBulkDelete(): Promise<void> {
  const plans = deletingBulk.value
  if (plans.length === 0) return
  const ok = await deleteSelected(plans)
  if (ok) {
    deletingBulk.value = []
    clearSelection()
  }
}

onMounted(() => void loadChannelNames())
</script>

<template>
  <div>
    <!-- Page header -->
    <header
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="min-w-0">
        <Breadcrumb
          :crumbs="[t('nav.groupAdmin'), t('nav.planManagement')]"
          spacing="mb-2"
        />
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">
          {{ t('planManagement.title') }}
        </h1>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]" aria-live="polite">
          {{ t('planManagement.resultCount', { count: total }) }}
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
          {{ t('planManagement.refreshList') }}
        </ConsoleButton>
        <ConsoleButton :disabled="!canManage" @click="openCreate">
          <Plus :size="16" aria-hidden="true" />
          {{ t('planManagement.createPlan') }}
        </ConsoleButton>
      </div>
    </header>

    <!-- Commercial summary -->
    <ConsoleCard :padded="false" class="mb-6">
      <div
        class="grid grid-cols-2 divide-x divide-y divide-[var(--border-subtle)] lg:grid-cols-4 lg:divide-y-0"
      >
        <div v-for="card in statCards" :key="card.label" class="px-5 py-4">
          <p class="text-xs text-[var(--text-tertiary)]">{{ card.label }}</p>
          <p
            class="display-number mt-1 font-mono text-2xl tabular-nums text-[var(--text-primary)]"
          >
            {{ card.value }}
          </p>
        </div>
      </div>
    </ConsoleCard>

    <ConsoleCard :padded="false">
      <!-- Toolbar -->
      <div
        class="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-4 xl:flex-row xl:items-center"
      >
        <SearchInput
          v-model="keyword"
          :placeholder="t('planManagement.searchPlaceholder')"
          :aria-label="t('planManagement.searchPlaceholder')"
          name="admin-plan-search"
          class="w-full xl:w-72"
        />
        <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:flex-1">
          <FilterSelect
            v-model="kindFilter"
            :options="kindOptions"
            :label="t('planManagement.allKinds')"
            class="w-full"
          />
          <FilterSelect
            v-model="statusFilter"
            :options="statusOptions"
            :label="t('planManagement.allStatuses')"
            class="w-full"
          />
          <div class="flex min-w-0 gap-2">
            <FilterSelect
              v-model="sortModel"
              :options="sortOptions"
              :label="t('planManagement.sortLabel')"
              class="min-w-0 flex-1"
            />
            <IconButton
              :label="
                sortOrder === 'asc'
                  ? t('planManagement.sortAscending')
                  : t('planManagement.sortDescending')
              "
              class="h-10 w-10 shrink-0 rounded-xl bg-[var(--surface-muted)]"
              @click="toggleSortOrder"
            >
              <ArrowUpNarrowWide v-if="sortOrder === 'asc'" :size="17" />
              <ArrowDownNarrowWide v-else :size="17" />
            </IconButton>
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
          {{ t('planManagement.selectedCount', { count: selectedIds.length }) }}
        </span>
        <IconButton
          :label="t('planManagement.deleteSelected')"
          tone="danger"
          :disabled="!canMutate || !canManage"
          @click="deletingBulk = selectedPlans"
        >
          <Trash2 :size="16" />
        </IconButton>
        <IconButton
          :label="t('planManagement.clearSelection')"
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
          {{ t('planManagement.loadFailed') }}
        </p>
        <p class="mt-1 max-w-md text-sm text-[var(--text-tertiary)]">
          {{ initialError }}
        </p>
        <ConsoleButton class="mt-5" variant="secondary" @click="load()">
          {{ t('planManagement.retry') }}
        </ConsoleButton>
      </div>

      <template v-else>
        <DataTable
          class="hidden md:block"
          :columns="columns"
          :rows="rows"
          row-key="id"
          selectable
          checkbox-shape="round"
          :selected="selectedIds"
          :row-selectable="isDeletable"
          :loading="loading"
          :skeleton-rows="pageSize"
          adaptive-scroll
          :page-size="pageSize"
          min-table-width="1180px"
          :scroll-region-label="t('planManagement.title')"
          :empty-title="t('planManagement.emptyTitle')"
          :empty-hint="t('planManagement.emptyHint')"
          @update:selected="updateSelected"
        >
          <!-- name: accent swatch + recommended marker -->
          <template #cell-name="{ row }">
            <div class="flex min-w-0 items-center gap-2.5">
              <span
                class="h-8 w-1 shrink-0 rounded-full"
                :style="{
                  background: planAccentColor((row as AdminPlan).accent),
                }"
                aria-hidden="true"
              />
              <div class="min-w-0">
                <p
                  class="truncate text-sm font-semibold text-[var(--text-primary)]"
                >
                  {{ (row as AdminPlan).name }}
                </p>
                <p class="mt-0.5 flex items-center gap-1.5">
                  <span class="text-[11px] text-[var(--text-tertiary)]">
                    #{{ (row as AdminPlan).id }} ·
                    {{ t('planManagement.colSortOrder') }}
                    {{ (row as AdminPlan).sort_order }}
                  </span>
                  <StatusChip
                    v-if="(row as AdminPlan).recommended"
                    tone="accent"
                    class="text-[10px]"
                  >
                    {{ t('planManagement.recommendedBadge') }}
                  </StatusChip>
                </p>
              </div>
            </div>
          </template>

          <template #cell-kind="{ row }">
            <div class="flex flex-col items-start gap-1">
              <StatusChip :tone="planKindTone((row as AdminPlan).kind)">
                {{ t(planKindLabelKey((row as AdminPlan).kind)) }}
              </StatusChip>
              <span
                v-if="(row as AdminPlan).kind === 'subscription'"
                class="text-[10px] text-[var(--text-tertiary)]"
              >
                {{
                  t(
                    subscriptionMeterLabelKey(
                      (row as AdminPlan).meter as 'refill' | 'cap'
                    )
                  )
                }}
              </span>
            </div>
          </template>

          <template #cell-price="{ row }">
            <span
              class="font-mono text-sm tabular-nums text-[var(--text-primary)]"
            >
              {{ formatMoney((row as AdminPlan).price, 2) }}
            </span>
          </template>

          <!-- quota means a one-off grant for a pack, an allowance for a plan -->
          <template #cell-quota="{ row }">
            <div class="min-w-0">
              <span
                class="font-mono text-xs tabular-nums text-[var(--text-secondary)]"
              >
                {{ quotaLabel(row as AdminPlan) }}
              </span>
              <p
                v-if="(row as AdminPlan).kind === 'subscription'"
                class="mt-0.5 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]"
              >
                {{
                  t('planManagement.lifetimeTotal', {
                    value: formatNumber(planLifetimeQuota(row as AdminPlan)),
                  })
                }}
              </p>
            </div>
          </template>

          <template #cell-duration="{ row }">
            <span
              class="font-mono text-xs tabular-nums text-[var(--text-secondary)]"
            >
              {{ durationLabel(row as AdminPlan) }}
            </span>
          </template>

          <template #cell-channel="{ row }">
            <span
              class="truncate text-xs"
              :class="
                channelMissing(row as AdminPlan)
                  ? 'text-[var(--status-warning-text)]'
                  : 'text-[var(--text-secondary)]'
              "
              :title="channelLabel(row as AdminPlan)"
            >
              {{ channelLabel(row as AdminPlan) }}
            </span>
          </template>

          <template #cell-unitPrice="{ row }">
            <span
              class="font-mono text-xs tabular-nums text-[var(--text-secondary)]"
            >
              {{
                t('planManagement.ratePerMillion', {
                  value: planUnitPrice(row as AdminPlan).toFixed(2),
                })
              }}
            </span>
          </template>

          <template #cell-status="{ row }">
            <StatusChip :tone="adminPlanStatusTone((row as AdminPlan).status)">
              {{ t(adminPlanStatusLabelKey((row as AdminPlan).status)) }}
            </StatusChip>
          </template>

          <template #cell-subscribers="{ row }">
            <span
              class="font-mono text-sm tabular-nums"
              :class="
                (row as AdminPlan).subscribers > 0
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)]'
              "
            >
              {{ formatNumber((row as AdminPlan).subscribers) }}
            </span>
          </template>

          <template #cell-revenue="{ row }">
            <span
              class="font-mono text-xs tabular-nums text-[var(--text-secondary)]"
            >
              {{ formatMoney((row as AdminPlan).revenue, 0) }}
            </span>
          </template>

          <template #cell-updated="{ row }">
            <span class="text-xs tabular-nums text-[var(--text-secondary)]">
              {{ formatTime((row as AdminPlan).updated_time) }}
            </span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex items-center justify-end gap-0.5">
              <!-- publish / delist. Always rendered so the action column keeps
                   a fixed shape; archived rows are restored via the next
                   button instead, so this one is inert there. -->
              <IconButton
                :label="
                  (row as AdminPlan).status === 'active'
                    ? t('planManagement.unpublishPlan')
                    : t('planManagement.publishPlan')
                "
                :disabled="
                  !canManage ||
                  isRowBusy((row as AdminPlan).id) ||
                  (row as AdminPlan).status === 'archived'
                "
                @click="
                  setStatus(
                    row as AdminPlan,
                    (row as AdminPlan).status === 'active' ? 'hidden' : 'active'
                  )
                "
              >
                <LoaderCircle
                  v-if="isBusy((row as AdminPlan).id, 'status')"
                  :size="15"
                  class="animate-spin"
                />
                <EyeOff
                  v-else-if="(row as AdminPlan).status === 'active'"
                  :size="15"
                />
                <Eye v-else :size="15" />
              </IconButton>

              <!-- archive / restore -->
              <IconButton
                :label="
                  (row as AdminPlan).status === 'archived'
                    ? t('planManagement.restorePlan')
                    : (row as AdminPlan).subscribers > 0
                      ? t('planManagement.hasSubscribersArchive')
                      : t('planManagement.archivePlan')
                "
                :disabled="
                  !canManage ||
                  isRowBusy((row as AdminPlan).id) ||
                  ((row as AdminPlan).status !== 'archived' &&
                    (row as AdminPlan).subscribers > 0)
                "
                @click="
                  (row as AdminPlan).status === 'archived'
                    ? setStatus(row as AdminPlan, 'active')
                    : requestArchive(row as AdminPlan)
                "
              >
                <ArchiveRestore
                  v-if="(row as AdminPlan).status === 'archived'"
                  :size="15"
                />
                <Archive v-else :size="15" />
              </IconButton>

              <!-- edit -->
              <IconButton
                :label="t('planManagement.editPlan')"
                :disabled="!canManage || isRowBusy((row as AdminPlan).id)"
                @click="openEdit(row as AdminPlan)"
              >
                <Pencil :size="15" />
              </IconButton>

              <!-- delete -->
              <IconButton
                :label="
                  isDeletable(row as AdminPlan)
                    ? t('planManagement.deletePlan')
                    : t('planManagement.hasSubscribers')
                "
                tone="danger"
                :disabled="
                  !canManage ||
                  isRowBusy((row as AdminPlan).id) ||
                  !isDeletable(row as AdminPlan)
                "
                @click="deleting = row as AdminPlan"
              >
                <LoaderCircle
                  v-if="isCrudActionBusy('delete', (row as AdminPlan).id)"
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

        <!-- Mobile list -->
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
            :title="t('planManagement.emptyTitle')"
            :hint="t('planManagement.emptyHint')"
          />
          <template v-else>
            <div data-handdrawn="ledger-list">
              <div
                v-for="plan in rows"
                :key="plan.id"
                class="border-b border-[var(--border-subtle)] px-4 py-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2.5">
                    <span
                      class="h-8 w-1 shrink-0 rounded-full"
                      :style="{ background: planAccentColor(plan.accent) }"
                      aria-hidden="true"
                    />
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <p
                          class="truncate text-sm font-semibold text-[var(--text-primary)]"
                        >
                          {{ plan.name }}
                        </p>
                        <StatusChip
                          :tone="planKindTone(plan.kind)"
                          class="text-[10px]"
                        >
                          {{ t(planKindLabelKey(plan.kind)) }}
                        </StatusChip>
                      </div>
                      <p
                        class="mt-0.5 font-mono text-xs tabular-nums text-[var(--text-tertiary)]"
                      >
                        {{ formatMoney(plan.price, 2) }} ·
                        {{ durationLabel(plan) }} ·
                        {{ formatNumber(plan.subscribers) }}
                      </p>
                    </div>
                  </div>
                  <StatusChip
                    :tone="adminPlanStatusTone(plan.status)"
                    class="shrink-0 text-[10px]"
                  >
                    {{ t(adminPlanStatusLabelKey(plan.status)) }}
                  </StatusChip>
                </div>
                <div class="mt-2 flex items-center justify-end gap-0.5">
                  <IconButton
                    :label="t('planManagement.editPlan')"
                    :disabled="!canManage || isRowBusy(plan.id)"
                    @click="openEdit(plan)"
                  >
                    <Pencil :size="15" />
                  </IconButton>
                  <IconButton
                    :label="
                      isDeletable(plan)
                        ? t('planManagement.deletePlan')
                        : t('planManagement.hasSubscribers')
                    "
                    tone="danger"
                    :disabled="
                      !canManage || isRowBusy(plan.id) || !isDeletable(plan)
                    "
                    @click="deleting = plan"
                  >
                    <Trash2 :size="15" />
                  </IconButton>
                </div>
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

    <!-- Create / edit modal -->
    <PlanFormModal
      :open="formOpen"
      :plan="editing"
      :loading="isCrudActionBusy('create') || isCrudBusy"
      @close="formOpen = false"
      @submit="handleSubmit"
    />

    <!-- Archive confirm -->
    <ConfirmDialog
      :open="archiving !== null"
      :title="t('planManagement.archiveTitle')"
      :message="t('planManagement.archiveMessage')"
      :confirm-text="t('planManagement.archivePlan')"
      :loading="archiving !== null && isBusy(archiving.id, 'status')"
      @confirm="confirmArchive"
      @cancel="archiving = null"
    />

    <!-- Delete confirm (single) -->
    <ConfirmDialog
      :open="deleting !== null"
      :title="t('planManagement.deleteTitle')"
      :message="t('planManagement.deleteMessage')"
      :confirm-text="t('common.delete')"
      :loading="isCrudActionBusy('delete')"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    />

    <!-- Bulk delete confirm -->
    <ConfirmDialog
      :open="deletingBulk.length > 0"
      :title="t('planManagement.bulkDeleteTitle')"
      :message="
        t('planManagement.bulkDeleteMessage', { count: deletingBulk.length })
      "
      :confirm-text="t('common.delete')"
      :loading="isBulkActionBusy('delete')"
      @confirm="confirmBulkDelete"
      @cancel="deletingBulk = []"
    />
  </div>
</template>
