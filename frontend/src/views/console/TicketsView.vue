<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { api } from '@/api/console'
import { ApiError, type PageResult } from '@/api/types'
import type { TicketItem } from '@/types/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import IconButton from '@/components/common/IconButton.vue'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import TicketFormModal from '@/components/console/tickets/TicketFormModal.vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import { ticketStatusTone } from '@/constants/console'
import { relativeTime } from '@/utils/format'

// The list endpoint omits the message thread from each row.
type TicketRow = Omit<TicketItem, 'messages'>

const { t, locale } = useI18n()
const router = useRouter()
const toast = useToast()

const rows = ref<TicketRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(true)
const keyword = ref('')
const status = ref('')
const formOpen = ref(false)

const statusOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'open', label: t('tickets.status.open') },
  { value: 'replied', label: t('tickets.status.replied') },
  { value: 'closed', label: t('tickets.status.closed') },
])

const columns = computed<TableColumn[]>(() => [
  { key: 'title', label: t('tickets.colTitle') },
  { key: 'category', label: t('tickets.colCategory'), width: '110px' },
  { key: 'created', label: t('tickets.colCreated'), width: '150px' },
  { key: 'updated', label: t('tickets.colUpdated'), width: '150px' },
  { key: 'status', label: t('tickets.colStatus'), width: '110px' },
  { key: 'actions', label: '', width: '80px', align: 'right' },
])

const listRequest = useLatestRequest()

async function load() {
  loading.value = true
  const result = await listRequest.run((signal) =>
    api.get<PageResult<TicketRow>>(
      '/api/ticket/',
      {
        page: page.value,
        page_size: pageSize.value,
        keyword: keyword.value,
        status: status.value,
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
watch(status, reload)
watch(pageSize, reload)
watch(page, load)

function openDetail(id: number) {
  router.push({ name: 'ticket-detail', params: { id } })
}

onMounted(load)
onBeforeUnmount(() => window.clearTimeout(searchTimer))
</script>

<template>
  <div>
    <PageBreadcrumb
      :crumbs="[t('tickets.breadcrumb.0'), t('tickets.breadcrumb.1')]"
    />

    <ConsoleCard :padded="false">
      <!-- toolbar -->
      <div class="flex flex-wrap items-center gap-3 p-4">
        <SearchInput
          v-model="keyword"
          :placeholder="t('tickets.searchPlaceholder')"
          :aria-label="t('tickets.searchPlaceholder')"
          name="ticket-search"
          class="w-full sm:w-64"
        />
        <FilterSelect
          v-model="status"
          :options="statusOptions"
          :label="t('tickets.filterStatus')"
          class="w-full sm:w-40"
        />
        <div class="sm:ml-auto">
          <ConsoleButton @click="formOpen = true">
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
            {{ t('tickets.newTicket') }}
          </ConsoleButton>
        </div>
      </div>

      <DataTable
        :columns="columns"
        :rows="rows"
        row-key="id"
        :loading="loading"
        :skeleton-rows="pageSize"
        adaptive-scroll
        :page-size="pageSize"
        :scroll-region-label="t('tickets.breadcrumb.1')"
        :empty-title="t('tickets.emptyTitle')"
        :empty-hint="t('tickets.emptyHint')"
        empty-illustration="empty-tickets"
      >
        <template #cell-title="{ row }">
          <button
            type="button"
            class="display-title max-w-xs truncate text-left font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent-text)]"
            @click="openDetail((row as TicketRow).id)"
          >
            {{ (row as TicketRow).title }}
          </button>
        </template>
        <template #cell-category="{ row }">
          <span class="text-xs text-[var(--text-secondary)]">
            {{ t(`tickets.category.${(row as TicketRow).category}`) }}
          </span>
        </template>
        <template #cell-status="{ row }">
          <StatusChip :tone="ticketStatusTone[(row as TicketRow).status]">
            {{ t(`tickets.status.${(row as TicketRow).status}`) }}
          </StatusChip>
        </template>
        <template #cell-created="{ row }">
          <span class="text-xs text-[var(--text-tertiary)]">
            {{ relativeTime((row as TicketRow).created, locale) }}
          </span>
        </template>
        <template #cell-updated="{ row }">
          <span class="text-xs text-[var(--text-tertiary)]">
            {{ relativeTime((row as TicketRow).updated, locale) }}
          </span>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end">
            <IconButton
              :label="t('tickets.viewTicket')"
              @click="openDetail((row as TicketRow).id)"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 6l6 6-6 6" />
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
    </ConsoleCard>

    <TicketFormModal
      :open="formOpen"
      @close="formOpen = false"
      @saved="reload"
    />
  </div>
</template>
