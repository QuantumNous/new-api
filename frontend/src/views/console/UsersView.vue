<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import {
  AlertTriangle,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Coins,
  LoaderCircle,
  Pencil,
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
import FilterSelect from '@/components/common/FilterSelect.vue'
import IconButton from '@/components/common/IconButton.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import Breadcrumb from '@/components/console/Breadcrumb.vue'
import UserAvatar from '@/components/console/users/UserAvatar.vue'
import UserFormModal from '@/components/console/users/UserFormModal.vue'
import UserInviteCell from '@/components/console/users/UserInviteCell.vue'
import UserMobileList from '@/components/console/users/UserMobileList.vue'
import UserQuotaCell from '@/components/console/users/UserQuotaCell.vue'
import UserQuotaModal from '@/components/console/users/UserQuotaModal.vue'
import { useAdminUsers } from '@/composables/useAdminUsers'
import {
  ADMIN_USER_DEFAULT_VISIBLE_FIELDS,
  ADMIN_USER_OPTIONAL_FIELDS,
  ADMIN_USER_ROLES,
  ADMIN_USER_SORT_FIELDS,
  ADMIN_USER_VISIBLE_FIELDS_STORAGE_KEY,
  type AdminUserOptionalField,
  adminUserRoleLabelKey,
  adminUserRoleTone,
  adminUserStatusLabelKey,
  adminUserStatusTone,
  sanitizeAdminUserVisibleFields,
} from '@/constants/adminUsers'
import type {
  AdminUser,
  AdminUserCreateInput,
  AdminUserSortBy,
  AdminUserSortOrder,
  AdminUserUpdateInput,
} from '@/types/console'
import { formatTime, relativeTime } from '@/utils/format'

type DeleteTarget =
  { kind: 'single'; user: AdminUser } | { kind: 'bulk'; users: AdminUser[] }

const { t, locale } = useI18n()
const {
  rows,
  total,
  roleCounts,
  statusCounts,
  page,
  pageSize,
  keyword,
  role,
  status,
  sortBy,
  sortOrder,
  loading,
  refreshing,
  initialError,
  isCrudBusy,
  isBulkBusy,
  canMutate,
  operatorLevel,
  canManage,
  isSelf,
  load,
  isBusy,
  isRowBusy,
  isCrudActionBusy,
  isBulkActionBusy,
  toggleStatus,
  adjustQuota,
  createUser,
  updateUserDetails,
  deleteUser,
  updateUsersStatus,
  deleteSelectedUsers,
} = useAdminUsers()

const formOpen = ref(false)
const editing = ref<AdminUser | null>(null)
const quotaTarget = ref<AdminUser | null>(null)
const deleting = ref<DeleteTarget | null>(null)
const selectedIds = ref<number[]>([])
const storedVisibleFields = useStorage<string[]>(
  ADMIN_USER_VISIBLE_FIELDS_STORAGE_KEY,
  [...ADMIN_USER_DEFAULT_VISIBLE_FIELDS]
)

watch(
  storedVisibleFields,
  (fields) => {
    const sanitized = sanitizeAdminUserVisibleFields(fields)
    if (
      sanitized.length !== fields.length ||
      sanitized.some((field, index) => field !== fields[index])
    ) {
      storedVisibleFields.value = sanitized
    }
  },
  { immediate: true }
)

const visibleFields = computed<AdminUserOptionalField[]>({
  get: () => sanitizeAdminUserVisibleFields(storedVisibleFields.value),
  set: (fields) => {
    storedVisibleFields.value = sanitizeAdminUserVisibleFields(fields)
  },
})

function isFieldVisible(field: AdminUserOptionalField): boolean {
  return visibleFields.value.includes(field)
}

function fieldLabel(field: AdminUserOptionalField): string {
  return t(`users.${field}`)
}

/** Only manageable rows are selectable, so a bulk action can never half-apply. */
const selectableIds = computed(() =>
  rows.value.filter((user) => canManage(user)).map((user) => user.id)
)
const selectedUsers = computed(() =>
  rows.value.filter((user) => selectedIds.value.includes(user.id))
)
const allPageSelected = computed(
  () =>
    selectableIds.value.length > 0 &&
    selectableIds.value.every((id) => selectedIds.value.includes(id))
)

function updateSelected(keys: Array<string | number>) {
  const allowed = new Set(selectableIds.value)
  selectedIds.value = keys.filter(
    (key): key is number => typeof key === 'number' && allowed.has(key)
  )
}

function toggleSelected(user: AdminUser) {
  if (!canManage(user)) return
  selectedIds.value = selectedIds.value.includes(user.id)
    ? selectedIds.value.filter((id) => id !== user.id)
    : [...selectedIds.value, user.id]
}

function toggleAllSelected() {
  selectedIds.value = allPageSelected.value ? [] : [...selectableIds.value]
}

function clearSelection() {
  selectedIds.value = []
}

watch(rows, (nextRows) => {
  const ids = new Set(nextRows.map((user) => user.id))
  selectedIds.value = selectedIds.value.filter((id) => ids.has(id))
})

const allColumns = computed<
  Array<TableColumn & { optional?: AdminUserOptionalField }>
>(() => [
  { key: 'user', label: t('users.user'), width: '220px' },
  { key: 'id', label: t('users.id'), width: '72px', optional: 'id' },
  {
    key: 'status',
    label: t('users.status'),
    width: '100px',
    optional: 'status',
  },
  { key: 'role', label: t('users.role'), width: '116px', optional: 'role' },
  { key: 'quota', label: t('users.quota'), width: '132px', optional: 'quota' },
  {
    key: 'invite',
    label: t('users.invite'),
    width: '118px',
    optional: 'invite',
  },
  {
    key: 'lastLogin',
    label: t('users.lastLogin'),
    width: '112px',
    optional: 'lastLogin',
  },
  {
    key: 'createdTime',
    label: t('users.createdTime'),
    width: '150px',
    optional: 'createdTime',
  },
  // Four 32px icon buttons + gaps + the cell's px-3 padding.
  { key: 'actions', label: t('users.actions'), width: '166px', align: 'right' },
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

const roleOptions = computed(() => [
  { value: '', label: t('users.allRoles') },
  ...ADMIN_USER_ROLES.filter(
    (item) => (roleCounts.value[String(item)] ?? 0) > 0
  ).map((item) => {
    const tone = adminUserRoleTone(item)
    return {
      value: String(item),
      label: `${t(adminUserRoleLabelKey(item))} (${roleCounts.value[String(item)] ?? 0})`,
      tone: tone === 'neutral' ? undefined : tone,
    }
  }),
])

const statusOptions = computed(() => [
  { value: '', label: t('users.allStatuses') },
  {
    value: 'enabled',
    label: `${t('users.statusEnabled')} (${statusCounts.value.enabled ?? 0})`,
    tone: 'success' as const,
  },
  {
    value: 'disabled',
    label: `${t('users.statusDisabled')} (${statusCounts.value.disabled ?? 0})`,
    tone: 'danger' as const,
  },
])

const sortOptions = computed(() =>
  ADMIN_USER_SORT_FIELDS.map((field) => ({
    value: field,
    label: t(`users.sort.${field}`),
  }))
)

const sortModel = computed({
  get: () => sortBy.value,
  set: (value: string) => {
    sortBy.value = value as AdminUserSortBy
  },
})

function toggleSortOrder() {
  sortOrder.value = (
    sortOrder.value === 'asc' ? 'desc' : 'asc'
  ) as AdminUserSortOrder
}

function rowClass(user: AdminUser): string | undefined {
  return user.status === 1 ? undefined : 'opacity-75'
}

function openCreate() {
  if (!canMutate.value) return
  editing.value = null
  formOpen.value = true
}

function openEdit(user: AdminUser) {
  if (!canManage(user) || !canMutate.value) return
  editing.value = user
  formOpen.value = true
}

function saveForm(
  input: AdminUserCreateInput | AdminUserUpdateInput
): Promise<boolean> {
  return editing.value
    ? updateUserDetails(editing.value, input as AdminUserUpdateInput)
    : createUser(input as AdminUserCreateInput)
}

function openQuota(user: AdminUser) {
  if (!canManage(user) || !canMutate.value) return
  quotaTarget.value = user
}

function saveQuota(delta: number): Promise<boolean> {
  const target = quotaTarget.value
  if (!target) return Promise.resolve(false)
  return adjustQuota(target, delta)
}

function requestDelete(user: AdminUser) {
  if (!canManage(user) || !canMutate.value) return
  deleting.value = { kind: 'single', user }
}

function requestBulkDelete() {
  if (!canMutate.value || selectedUsers.value.length === 0) return
  deleting.value = {
    kind: 'bulk',
    users: selectedUsers.value.map((user) => ({ ...user })),
  }
}

async function confirmDelete() {
  const target = deleting.value
  if (!target) return
  const deleted =
    target.kind === 'single'
      ? await deleteUser(target.user)
      : await deleteSelectedUsers(target.users)
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
  deleting.value?.kind === 'bulk'
    ? t('users.bulkDeleteTitle')
    : t('users.deleteTitle')
)

const deleteDialogMessage = computed(() => {
  const target = deleting.value
  if (!target) return ''
  return target.kind === 'single'
    ? t('users.deleteMessage', { name: target.user.username })
    : t('users.bulkDeleteMessage', { count: target.users.length })
})

async function runBulkStatus(action: 'enable' | 'disable'): Promise<void> {
  if (!canMutate.value) return
  if (await updateUsersStatus(action, selectedUsers.value)) clearSelection()
}
</script>

<template>
  <div>
    <header
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="min-w-0">
        <Breadcrumb
          :crumbs="[t('nav.groupAdmin'), t('nav.userManagement')]"
          spacing="mb-2"
        />
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">
          {{ t('users.title') }}
        </h1>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]" aria-live="polite">
          {{ t('users.resultCount', { count: total }) }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ConsoleButton
          variant="secondary"
          :loading="refreshing"
          :disabled="isCrudBusy || isBulkBusy"
          @click="load({ background: true })"
        >
          <RefreshCw v-if="!refreshing" :size="15" />
          {{ t('users.refreshList') }}
        </ConsoleButton>
        <ConsoleButton :disabled="!canMutate" @click="openCreate">
          <Plus :size="16" />
          {{ t('users.createUser') }}
        </ConsoleButton>
      </div>
    </header>

    <ConsoleCard :padded="false">
      <div
        class="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-4 xl:flex-row xl:items-center"
      >
        <SearchInput
          v-model="keyword"
          :placeholder="t('users.searchPlaceholder')"
          :aria-label="t('users.searchPlaceholder')"
          name="admin-user-search"
          class="w-full xl:w-72"
        />
        <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:flex-1">
          <FilterSelect
            v-model="role"
            :options="roleOptions"
            :label="t('users.roleFilter')"
            class="w-full"
          />
          <FilterSelect
            v-model="status"
            :options="statusOptions"
            :label="t('users.statusFilter')"
            class="w-full"
          />
          <div class="flex min-w-0 gap-2">
            <FilterSelect
              v-model="sortModel"
              :options="sortOptions"
              :label="t('users.sortLabel')"
              class="min-w-0 flex-1"
            />
            <IconButton
              :label="
                sortOrder === 'asc'
                  ? t('users.sortAscending')
                  : t('users.sortDescending')
              "
              class="h-10 w-10 shrink-0 rounded-xl bg-[var(--surface-muted)]"
              @click="toggleSortOrder"
            >
              <ArrowUpNarrowWide v-if="sortOrder === 'asc'" :size="17" />
              <ArrowDownNarrowWide v-else :size="17" />
            </IconButton>
            <FieldVisibilityMenu
              v-model="visibleFields"
              :all-fields="ADMIN_USER_OPTIONAL_FIELDS"
              :default-fields="ADMIN_USER_DEFAULT_VISIBLE_FIELDS"
              :label-for="fieldLabel"
              :title="t('users.fieldSettings')"
              :reset-label="t('users.resetFields')"
            />
          </div>
        </div>
      </div>
      <div
        v-if="selectedIds.length > 0"
        data-user-bulk-actions
        class="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-2.5"
      >
        <span
          class="mr-auto text-xs font-semibold text-[var(--text-secondary)]"
          aria-live="polite"
        >
          {{ t('users.selectedCount', { count: selectedIds.length }) }}
        </span>
        <IconButton
          :label="t('users.bulkEnable')"
          :disabled="
            !canMutate || selectedUsers.every((user) => user.status === 1)
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
          :label="t('users.bulkDisable')"
          :disabled="
            !canMutate || selectedUsers.every((user) => user.status === 2)
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
          :label="t('users.bulkDelete')"
          tone="danger"
          :disabled="!canMutate"
          @click="requestBulkDelete"
        >
          <Trash2 :size="16" />
        </IconButton>
        <IconButton
          :label="t('users.clearSelection')"
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
          {{ t('users.loadFailed') }}
        </p>
        <p class="mt-1 max-w-md text-sm text-[var(--text-tertiary)]">
          {{ initialError }}
        </p>
        <ConsoleButton class="mt-5" variant="secondary" @click="load()">
          {{ t('users.retry') }}
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
          :selection-keys="selectableIds"
          :selection-disabled="!canMutate"
          :row-selectable="(row) => canManage(row as AdminUser)"
          :loading="loading"
          :skeleton-rows="pageSize"
          adaptive-scroll
          :page-size="pageSize"
          :min-table-width="minTableWidth"
          :scroll-region-label="t('users.title')"
          :empty-title="t('users.emptyTitle')"
          :empty-hint="t('users.emptyHint')"
          :row-class="(row) => rowClass(row as AdminUser)"
          class="hidden md:block"
          @update:selected="updateSelected"
        >
          <template #cell-user="{ row }">
            <div class="flex min-w-0 items-center gap-2.5">
              <UserAvatar
                :username="(row as AdminUser).username"
                :display-name="(row as AdminUser).display_name"
                :size="32"
              />
              <div class="min-w-0">
                <p
                  class="truncate font-semibold text-[var(--text-primary)]"
                  :title="(row as AdminUser).username"
                >
                  {{ (row as AdminUser).username }}
                </p>
                <p
                  class="truncate text-xs text-[var(--text-tertiary)]"
                  :title="
                    (row as AdminUser).display_name || (row as AdminUser).email
                  "
                >
                  {{
                    (row as AdminUser).display_name ||
                    (row as AdminUser).email ||
                    '—'
                  }}
                </p>
              </div>
              <span
                v-if="isSelf(row as AdminUser)"
                class="shrink-0 text-[10px] text-[var(--text-tertiary)]"
              >
                {{ t('users.selfHint') }}
              </span>
            </div>
          </template>

          <template #cell-id="{ row }">
            <span class="font-mono text-xs text-[var(--text-secondary)]">
              #{{ (row as AdminUser).id }}
            </span>
          </template>

          <template #cell-status="{ row }">
            <StatusChip :tone="adminUserStatusTone((row as AdminUser).status)">
              {{ t(adminUserStatusLabelKey((row as AdminUser).status)) }}
            </StatusChip>
          </template>

          <template #cell-role="{ row }">
            <StatusChip :tone="adminUserRoleTone((row as AdminUser).role)">
              {{ t(adminUserRoleLabelKey((row as AdminUser).role)) }}
            </StatusChip>
          </template>
          <template #cell-quota="{ row }">
            <UserQuotaCell :user="row as AdminUser" />
          </template>

          <template #cell-invite="{ row }">
            <UserInviteCell :user="row as AdminUser" />
          </template>

          <template #cell-lastLogin="{ row }">
            <span class="text-xs text-[var(--text-secondary)]">
              {{
                (row as AdminUser).last_login_time > 0
                  ? relativeTime((row as AdminUser).last_login_time, locale)
                  : t('users.neverLoggedIn')
              }}
            </span>
          </template>

          <template #cell-createdTime="{ row }">
            <span class="text-xs tabular-nums text-[var(--text-secondary)]">
              {{ formatTime((row as AdminUser).created_time) }}
            </span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex items-center justify-end gap-0.5">
              <IconButton
                :label="t('users.editUser')"
                :disabled="
                  !canManage(row as AdminUser) ||
                  isRowBusy((row as AdminUser).id)
                "
                @click="openEdit(row as AdminUser)"
              >
                <Pencil :size="15" />
              </IconButton>
              <IconButton
                :label="t('users.adjustQuota')"
                :disabled="
                  !canManage(row as AdminUser) ||
                  isRowBusy((row as AdminUser).id)
                "
                @click="openQuota(row as AdminUser)"
              >
                <LoaderCircle
                  v-if="isBusy((row as AdminUser).id, 'quota')"
                  :size="15"
                  class="animate-spin"
                />
                <Coins v-else :size="15" />
              </IconButton>
              <IconButton
                :label="
                  (row as AdminUser).status === 1
                    ? t('users.disableUser')
                    : t('users.enableUser')
                "
                :tone="(row as AdminUser).status === 1 ? 'danger' : 'default'"
                :disabled="
                  !canManage(row as AdminUser) ||
                  isRowBusy((row as AdminUser).id)
                "
                @click="toggleStatus(row as AdminUser)"
              >
                <LoaderCircle
                  v-if="isBusy((row as AdminUser).id, 'status')"
                  :size="15"
                  class="animate-spin"
                />
                <PowerOff
                  v-else-if="(row as AdminUser).status === 1"
                  :size="15"
                />
                <Power v-else :size="15" />
              </IconButton>
              <IconButton
                :label="t('users.deleteUser')"
                tone="danger"
                :disabled="
                  !canManage(row as AdminUser) ||
                  isRowBusy((row as AdminUser).id)
                "
                @click="requestDelete(row as AdminUser)"
              >
                <LoaderCircle
                  v-if="isCrudActionBusy('delete', (row as AdminUser).id)"
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
            :title="t('users.emptyTitle')"
            :hint="t('users.emptyHint')"
            illustration="empty-search"
          />
          <UserMobileList
            v-else
            :users="rows"
            :visible-fields="visibleFields"
            :selected-ids="selectedIds"
            :all-selected="allPageSelected"
            :selection-disabled="!canMutate"
            :toggle-all-selected="toggleAllSelected"
            :toggle-selected="toggleSelected"
            :can-manage="canManage"
            :is-self="isSelf"
            :is-busy="isBusy"
            :is-row-busy="isRowBusy"
            :toggle-status="toggleStatus"
            :edit-user="openEdit"
            :adjust-quota="openQuota"
            :delete-user="requestDelete"
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
    <UserFormModal
      :open="formOpen"
      :editing="editing"
      :operator-level="operatorLevel"
      :save="saveForm"
      @close="formOpen = false"
    />

    <UserQuotaModal
      :open="quotaTarget !== null"
      :target="quotaTarget"
      :save="saveQuota"
      @close="quotaTarget = null"
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
