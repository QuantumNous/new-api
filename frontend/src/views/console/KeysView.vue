<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError, type PageResult } from '@/api/types'
import type { TokenSummary } from '@/types/console'
import KeyChannelsModal from '@/components/console/keys/KeyChannelsModal.vue'
import KeyInlineChannels from '@/components/console/keys/KeyInlineChannels.vue'
import KeyFormModal from '@/components/console/keys/KeyFormModal.vue'
import KeyEndpointStrip from '@/components/console/keys/KeyEndpointStrip.vue'
import KeyMobileList from '@/components/console/keys/KeyMobileList.vue'
import KeyRevealModal from '@/components/console/keys/KeyRevealModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import IconButton from '@/components/common/IconButton.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useSidebarCollapsed } from '@/composables/useSidebarCollapsed'
import { useToast } from '@/composables/useToast'
import { formatDate, formatQuota } from '@/utils/format'

const { t } = useI18n()
const toast = useToast()

// Mirror the sidebar collapsed state so the overlay / drawer left-edge tracks
// the actual sidebar width reactively.
const sidebarCollapsed = useSidebarCollapsed()
const sidebarLeft = computed(() => (sidebarCollapsed.value ? '64px' : '220px'))

const rows = ref<TokenSummary[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(true)
const keyword = ref('')
const selected = ref<Array<string | number>>([])

const models = ref<string[]>([])

const formOpen = ref(false)
const editing = ref<TokenSummary | null>(null)
const deleting = ref<TokenSummary | null>(null)
const batchDeleting = ref(false)
const deleteLoading = ref(false)
const channelsToken = ref<TokenSummary | null>(null)

// Inline channel-routing panel (double-click a row). null = collapsed.
const expandedToken = ref<TokenSummary | null>(null)
const revealTokenId = ref<number | null>(null)

const clickHint = ref<{ x: number; y: number } | null>(null)
let clickTimer = 0
let clickHintTimer = 0
const lastClickPos = ref({ x: 0, y: 0 })

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('keys.colName') },
  { key: 'type', label: t('keys.colType'), width: '110px' },
  { key: 'key', label: t('keys.colKey') },
  { key: 'status', label: t('keys.colStatus') },
  { key: 'usage', label: t('keys.colUsage'), align: 'right' },
  { key: 'expired_time', label: t('keys.colExpired') },
  {
    key: 'actions',
    label: t('keys.colActions'),
    align: 'right',
    width: '140px',
  },
])

const typeTone = (type: TokenSummary['type']) =>
  type === 'auto' ? 'info' : 'accent'

const allPageSelected = computed(
  () =>
    rows.value.length > 0 &&
    rows.value.every((row) => selected.value.includes(row.id))
)

function toggleAllSelected() {
  selected.value = allPageSelected.value ? [] : rows.value.map((row) => row.id)
}

function toggleSelected(row: TokenSummary) {
  selected.value = selected.value.includes(row.id)
    ? selected.value.filter((id) => id !== row.id)
    : [...selected.value, row.id]
}

const listRequest = useLatestRequest()

async function load() {
  loading.value = true
  const result = await listRequest.run((signal) =>
    api.get<PageResult<TokenSummary>>(
      '/api/token/',
      {
        page: page.value,
        page_size: pageSize.value,
        keyword: keyword.value,
      },
      { signal }
    )
  )
  if (result.stale) return
  loading.value = false
  if (!result.ok) {
    toast.error(
      result.error instanceof ApiError
        ? result.error.message
        : String(result.error)
    )
    return
  }
  rows.value = result.value.items
  total.value = result.value.total
  selected.value = []
}

let searchTimer = 0
// Reset to page 1 without firing load() twice (see LogsView for the rationale).
function reload() {
  if (page.value === 1) load()
  else page.value = 1
}
watch(keyword, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(reload, 300)
})
watch([page, pageSize], load)

const togglingIds = ref<Set<number>>(new Set())

async function toggleStatus(row: TokenSummary) {
  if (togglingIds.value.has(row.id)) return // ignore double-clicks in flight
  togglingIds.value = new Set(togglingIds.value).add(row.id)
  try {
    await api.put(`/api/token/${row.id}`, { status: row.status === 1 ? 2 : 1 })
    toast.success(t('keys.updated'))
    load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    const next = new Set(togglingIds.value)
    next.delete(row.id)
    togglingIds.value = next
  }
}

function openCreate() {
  editing.value = null
  formOpen.value = true
}

function openEdit(row: TokenSummary) {
  editing.value = row
  formOpen.value = true
}

function captureClick(event: MouseEvent) {
  lastClickPos.value = { x: event.clientX, y: event.clientY }
}

function onRowClick() {
  window.clearTimeout(clickTimer)
  clickTimer = window.setTimeout(() => {
    window.clearTimeout(clickHintTimer)
    clickHint.value = { ...lastClickPos.value }
    clickHintTimer = window.setTimeout(() => {
      clickHint.value = null
    }, 1800)
  }, 250)
}

function onRowDblclick(row: TokenSummary) {
  window.clearTimeout(clickTimer)
  clickHint.value = null
  // Toggle: double-click the same row again collapses the panel.
  expandedToken.value = expandedToken.value?.id === row.id ? null : row
}

function copyKey(row: TokenSummary) {
  revealTokenId.value = row.id
}

function closeDelete() {
  deleting.value = null
  batchDeleting.value = false
}

async function confirmDelete() {
  deleteLoading.value = true
  try {
    if (batchDeleting.value) {
      await api.post('/api/token/batch', { ids: selected.value })
      toast.success(t('keys.deleted'))
    } else if (deleting.value) {
      await api.delete(`/api/token/${deleting.value.id}`)
      toast.success(t('keys.deleted'))
    }
    deleting.value = null
    batchDeleting.value = false
    load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    deleteLoading.value = false
  }
}

onMounted(async () => {
  void load()
  try {
    const meta = await api.get<{ models: string[] }>('/api/models/available')
    models.value = meta.models
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  window.clearTimeout(clickTimer)
  window.clearTimeout(clickHintTimer)
})
</script>

<template>
  <div @click.capture="captureClick">
    <PageBreadcrumb :crumbs="[t('keys.breadcrumb.0'), t('keys.breadcrumb.1')]">
      <template #action>
        <KeyEndpointStrip />
      </template>
    </PageBreadcrumb>
    <ConsoleCard :padded="false">
      <!-- toolbar -->
      <div class="flex flex-wrap items-center gap-3 p-4">
        <SearchInput
          v-model="keyword"
          :placeholder="t('keys.searchPlaceholder')"
          :aria-label="t('keys.searchPlaceholder')"
          name="token-search"
          class="w-full sm:w-72"
        />
        <div class="flex w-full items-center gap-2.5 sm:ml-auto sm:w-auto">
          <ConsoleButton
            v-if="selected.length > 0"
            variant="danger"
            class="animate-fade-in"
            @click="batchDeleting = true"
          >
            {{ t('keys.batchDelete') }} ({{ selected.length }})
          </ConsoleButton>
          <ConsoleButton class="ml-auto sm:ml-0" @click="openCreate">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {{ t('keys.createKey') }}
          </ConsoleButton>
        </div>
      </div>

      <DataTable
        v-model:selected="selected"
        class="hidden md:block"
        :columns="columns"
        :rows="rows"
        row-key="id"
        :loading="loading"
        :skeleton-rows="pageSize"
        adaptive-scroll
        :page-size="pageSize"
        :scroll-region-label="t('keys.breadcrumb.1')"
        selectable
        checkbox-shape="round"
        row-clickable
        row-dblclickable
        :empty-title="t('keys.emptyTitle')"
        :empty-hint="t('keys.emptyHint')"
        empty-illustration="empty-keys"
        @row-click="onRowClick"
        @row-dblclick="onRowDblclick($event as TokenSummary)"
      >
        <template #cell-name="{ row }">
          <span class="font-medium">{{ (row as TokenSummary).name }}</span>
        </template>

        <template #cell-type="{ row }">
          <StatusChip :tone="typeTone((row as TokenSummary).type)">
            {{ t(`keys.type.${(row as TokenSummary).type}`) }}
          </StatusChip>
        </template>

        <template #cell-key="{ row }">
          <div
            class="flex min-w-0 items-center gap-1.5"
            @click.stop
            @dblclick.stop
          >
            <span
              class="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]"
              :title="(row as TokenSummary).key_preview"
            >
              {{ (row as TokenSummary).key_preview }}
            </span>
            <IconButton
              :label="t('common.copy')"
              @click="copyKey(row as TokenSummary)"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                />
              </svg>
            </IconButton>
          </div>
        </template>

        <!-- status: click to toggle -->
        <template #cell-status="{ row }">
          <button
            type="button"
            class="rounded transition-opacity hover:opacity-70 focus-ring"
            :disabled="togglingIds.has((row as TokenSummary).id)"
            :aria-label="t('keys.toggleKey')"
            @click.stop="toggleStatus(row as TokenSummary)"
          >
            <StatusChip
              :tone="(row as TokenSummary).status === 1 ? 'success' : 'neutral'"
            >
              {{
                (row as TokenSummary).status === 1
                  ? t('common.enabled')
                  : t('common.disabled')
              }}
            </StatusChip>
          </button>
        </template>

        <template #cell-usage="{ row }">
          <span class="text-xs">
            {{ formatQuota((row as TokenSummary).used_quota) }} /
            <span class="font-semibold">
              {{
                (row as TokenSummary).unlimited
                  ? t('common.unlimited')
                  : formatQuota((row as TokenSummary).remain_quota)
              }}
            </span>
          </span>
        </template>

        <template #cell-expired_time="{ row }">
          <span class="text-xs text-[var(--text-tertiary)]">
            {{
              (row as TokenSummary).expired_time < 0
                ? t('common.never')
                : formatDate((row as TokenSummary).expired_time)
            }}
          </span>
        </template>

        <template #cell-actions="{ row }">
          <!-- Action buttons must not trigger the inline panel. -->
          <div
            class="flex items-center justify-end gap-1"
            @click.stop
            @dblclick.stop
          >
            <IconButton
              :label="t('keys.manageChannels')"
              @click="channelsToken = row as TokenSummary"
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
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
                <circle
                  cx="20"
                  cy="6"
                  r="2"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="4"
                  cy="12"
                  r="2"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="20"
                  cy="18"
                  r="2"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            </IconButton>
            <IconButton
              :label="t('keys.editKey')"
              @click="openEdit(row as TokenSummary)"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
              </svg>
            </IconButton>
            <IconButton
              :label="t('keys.toggleKey')"
              :disabled="togglingIds.has((row as TokenSummary).id)"
              @click="toggleStatus(row as TokenSummary)"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2v9" />
              </svg>
            </IconButton>
            <IconButton
              :label="t('keys.deleteKey')"
              tone="danger"
              @click="deleting = row as TokenSummary"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
              </svg>
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

      <div class="md:hidden">
        <div
          v-if="loading"
          data-key-mobile-loading
          class="divide-y divide-[var(--border-subtle)]"
          aria-hidden="true"
        >
          <div
            v-for="index in pageSize"
            :key="index"
            data-key-mobile-skeleton-row
            class="space-y-4 p-4"
          >
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
          :title="t('keys.emptyTitle')"
          :hint="t('keys.emptyHint')"
          illustration="empty-keys"
        />
        <KeyMobileList
          v-else
          :tokens="rows"
          :selected-ids="selected"
          :all-selected="allPageSelected"
          :toggle-all-selected="toggleAllSelected"
          :toggle-selected="toggleSelected"
          :is-toggling="(row) => togglingIds.has(row.id)"
          :toggle-status="toggleStatus"
          :view-key="copyKey"
          :manage-channels="(row) => (channelsToken = row)"
          :edit-key="openEdit"
          :delete-key="(row) => (deleting = row)"
        />
        <div data-key-mobile-pagination :aria-busy="loading">
          <TablePagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :total="total"
          />
        </div>
      </div>
    </ConsoleCard>

    <!-- overlay backdrop + bottom-up drawer — teleported to body so fixed covers full viewport -->
    <Teleport to="body">
      <!-- overlay (click to dismiss) -->
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="expandedToken"
          class="fixed top-0 bottom-0 right-0 z-40 bg-black/40 backdrop-blur-[1px]"
          :style="{ left: sidebarLeft }"
          aria-hidden="true"
          @click="expandedToken = null"
        />
      </Transition>

      <!-- bottom-up channel routing drawer -->
      <Transition
        enter-active-class="transition-transform duration-250 ease-out"
        enter-from-class="translate-y-full"
        enter-to-class="translate-y-0"
        leave-active-class="transition-transform duration-200 ease-in"
        leave-from-class="translate-y-0"
        leave-to-class="translate-y-full"
      >
        <div
          v-if="expandedToken"
          class="fixed bottom-0 right-0 z-50"
          :style="{ left: sidebarLeft }"
        >
          <KeyInlineChannels
            :token="expandedToken"
            @close="expandedToken = null"
            @saved="load"
          />
        </div>
      </Transition>
    </Teleport>

    <!-- create / edit -->
    <KeyFormModal
      :open="formOpen"
      :editing="editing"
      :models="models"
      @close="formOpen = false"
      @saved="load"
    />

    <!-- channel management modal (action-column button) -->
    <KeyChannelsModal
      :open="channelsToken !== null"
      :token="channelsToken"
      @close="channelsToken = null"
      @saved="load"
    />

    <KeyRevealModal
      :open="revealTokenId !== null"
      :token-id="revealTokenId"
      @close="revealTokenId = null"
    />

    <!-- delete confirm -->
    <ConfirmDialog
      :open="deleting !== null || batchDeleting"
      :title="t('keys.deleteTitle')"
      :message="
        batchDeleting
          ? t('keys.batchDeleteMessage', { count: selected.length })
          : t('keys.deleteMessage', { name: deleting?.name ?? '' })
      "
      :confirm-text="t('common.delete')"
      :cancel-text="t('keys.thinkAgain')"
      :loading="deleteLoading"
      @confirm="confirmDelete"
      @cancel="closeDelete"
    />

    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 scale-90"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-300 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <div
        v-if="clickHint"
        class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-[var(--text-secondary)] shadow-md ring-1 ring-[var(--border-subtle)]"
        :style="{ left: `${clickHint.x}px`, top: `${clickHint.y - 10}px` }"
        aria-hidden="true"
      >
        {{ t('keys.dblclickHint') }}
      </div>
    </Transition>
  </div>
</template>
