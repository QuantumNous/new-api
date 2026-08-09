<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError, type PageResult } from '@/api/types'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import {
  adminOrderMethodLabelKey,
  adminOrderStatusLabelKey,
  adminOrderStatusTone,
  formatAdminOrderAmount,
} from '@/constants/adminOrders'
import type { AdminOrder } from '@/types/console'
import { formatQuota, formatTime } from '@/utils/format'

const refreshKey = defineModel<number>('refreshKey', { default: 0 })

const { t } = useI18n()
const toast = useToast()

const rows = ref<AdminOrder[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(6)
const loading = ref(true)
const listRequest = useLatestRequest()

async function load() {
  loading.value = true
  const result = await listRequest.run((signal) =>
    api.get<PageResult<AdminOrder>>(
      '/api/next/wallet/topups',
      { p: page.value, page_size: pageSize.value },
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

function reloadFromFirstPage() {
  if (page.value === 1) void load()
  else page.value = 1
}

watch(pageSize, reloadFromFirstPage)
watch(page, load)
watch(refreshKey, load)
onMounted(load)
</script>

<template>
  <ConsoleCard :title="t('wallet.records')" :padded="false">
    <ul class="divide-y divide-[var(--border-subtle)] px-5">
      <li
        v-for="row in rows"
        :key="row.id"
        class="flex items-center justify-between gap-3 py-3.5"
      >
        <div class="min-w-0">
          <p class="truncate font-mono text-xs text-[var(--text-secondary)]">
            {{ row.order_no }}
          </p>
          <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
            {{ t(adminOrderMethodLabelKey(row.method)) }} ·
            {{ formatTime(row.created) }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-sm font-bold text-[var(--text-primary)]">
            {{ formatAdminOrderAmount(row.amount, row.currency) }}
          </p>
          <p class="text-[11px] text-[var(--text-tertiary)]">
            {{
              row.quota > 0 ? formatQuota(row.quota) : t('orders.notCredited')
            }}
          </p>
          <StatusChip :tone="adminOrderStatusTone(row.status)" class="mt-1">
            {{ t(adminOrderStatusLabelKey(row.status)) }}
          </StatusChip>
        </div>
      </li>
      <li
        v-if="!loading && rows.length === 0"
        class="py-10 text-center text-sm text-[var(--text-tertiary)]"
      >
        {{ t('common.none') }}
      </li>
    </ul>
    <div class="border-t border-[var(--border-subtle)] px-3">
      <TablePagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[6, 12, 24]"
      />
    </div>
  </ConsoleCard>
</template>
