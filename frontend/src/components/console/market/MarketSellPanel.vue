<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import type { ListingStatus, MarketListing } from '@/types/console'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import IconButton from '@/components/common/IconButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import ListingRating from './ListingRating.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatQuota } from '@/utils/format'

defineProps<{
  formatPrice: (usd: number) => string
}>()

const emit = defineEmits<{
  edit: [listing: MarketListing]
  create: []
}>()

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

interface SellStats {
  active: number
  totalSales: number
  pendingEarnings: number
  rating: number
}

const rows = ref<MarketListing[]>([])
const stats = ref<SellStats | null>(null)
const loading = ref(true)
const settling = ref(false)
const delisting = ref<MarketListing | null>(null)
const delistLoading = ref(false)
const togglingIds = ref<Set<number>>(new Set())

const columns = computed<TableColumn[]>(() => [
  { key: 'title', label: t('market.sell.colName') },
  { key: 'status', label: t('market.sell.colStatus') },
  { key: 'sales', label: t('market.sell.colSales'), align: 'right' },
  { key: 'rating', label: t('market.sell.colRating') },
  { key: 'earnings', label: t('market.sell.colEarnings'), align: 'right' },
  {
    key: 'actions',
    label: t('market.sell.colActions'),
    align: 'right',
    width: '150px',
  },
])

const statusTone: Record<ListingStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  reviewing: 'warning',
  delisted: 'neutral',
}

async function load() {
  loading.value = true
  try {
    const data = await api.get<{ listings: MarketListing[]; stats: SellStats }>(
      '/api/market/self/listings'
    )
    rows.value = data.listings
    stats.value = data.stats
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : t('common.failed'))
  } finally {
    loading.value = false
  }
}

async function toggleListed(row: MarketListing) {
  if (togglingIds.value.has(row.id)) return
  togglingIds.value = new Set(togglingIds.value).add(row.id)
  try {
    const next: ListingStatus = row.status === 'active' ? 'delisted' : 'active'
    await api.put(`/api/market/listing/${row.id}`, { status: next })
    toast.success(t('market.form.updated'))
    load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    const s = new Set(togglingIds.value)
    s.delete(row.id)
    togglingIds.value = s
  }
}

async function confirmDelist() {
  if (!delisting.value) return
  delistLoading.value = true
  try {
    await api.delete(`/api/market/listing/${delisting.value.id}`)
    toast.success(t('market.form.delisted'))
    delisting.value = null
    load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    delistLoading.value = false
  }
}

async function settle() {
  settling.value = true
  try {
    await api.post('/api/market/settle')
    await Promise.all([auth.fetchSelf(), load()])
    toast.success(t('market.sell.settled'))
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    settling.value = false
  }
}

const canSettle = computed(() => (stats.value?.pendingEarnings ?? 0) > 0)

defineExpose({ load })
onMounted(load)
</script>

<template>
  <div>
    <!-- stat cards -->
    <div class="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ConsoleCard>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('market.sell.statActive') }}
        </p>
        <p class="mt-1 text-2xl font-bold text-[var(--text-primary)]">
          {{ stats?.active ?? 0 }}
        </p>
      </ConsoleCard>
      <ConsoleCard>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('market.sell.statSales') }}
        </p>
        <p class="mt-1 text-2xl font-bold text-[var(--text-primary)]">
          {{ stats?.totalSales ?? 0 }}
        </p>
      </ConsoleCard>
      <ConsoleCard>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('market.sell.statEarnings') }}
        </p>
        <p class="mt-1 text-2xl font-bold text-[var(--accent-text)]">
          {{ formatQuota(stats?.pendingEarnings ?? 0) }}
        </p>
      </ConsoleCard>
      <ConsoleCard>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('market.sell.statRating') }}
        </p>
        <div class="mt-1">
          <ListingRating :value="stats?.rating ?? 0" :show-count="false" />
        </div>
      </ConsoleCard>
    </div>

    <ConsoleCard :padded="false">
      <!-- toolbar -->
      <div class="flex flex-wrap items-center gap-3 p-4">
        <h2 class="text-sm font-semibold text-[var(--text-primary)]">
          {{ t('market.sell.title') }}
        </h2>
        <div class="ml-auto flex items-center gap-2.5">
          <ConsoleButton
            variant="secondary"
            :disabled="!canSettle"
            :loading="settling"
            @click="settle"
          >
            {{ t('market.sell.settle') }}
          </ConsoleButton>
          <ConsoleButton @click="emit('create')">
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
            {{ t('market.sell.publish') }}
          </ConsoleButton>
        </div>
      </div>

      <DataTable
        :columns="columns"
        :rows="rows"
        row-key="id"
        :loading="loading"
        :skeleton-rows="4"
        :empty-title="t('market.sell.emptyTitle')"
        :empty-hint="t('market.sell.emptyHint')"
      >
        <template #cell-title="{ row }">
          <div class="min-w-0">
            <p class="truncate font-medium text-[var(--text-primary)]">
              {{ (row as MarketListing).title }}
            </p>
            <p class="truncate text-xs text-[var(--text-tertiary)]">
              {{ (row as MarketListing).source }} ·
              {{
                t('market.listedAt', {
                  date: formatDate((row as MarketListing).listedAt),
                })
              }}
            </p>
          </div>
        </template>

        <template #cell-status="{ row }">
          <StatusChip :tone="statusTone[(row as MarketListing).status]">
            {{ t(`market.sell.status.${(row as MarketListing).status}`) }}
          </StatusChip>
        </template>

        <template #cell-sales="{ row }">
          <span class="text-sm font-semibold text-[var(--text-primary)]">{{
            (row as MarketListing).reviewCount
          }}</span>
        </template>

        <template #cell-rating="{ row }">
          <ListingRating
            :value="(row as MarketListing).rating"
            :count="(row as MarketListing).reviewCount"
          />
        </template>

        <template #cell-earnings="{ row }">
          <span
            class="font-mono text-sm font-semibold text-[var(--accent-text)]"
          >
            {{ formatPrice((row as MarketListing).earningsUSD ?? 0) }}
          </span>
        </template>

        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-1">
            <IconButton
              :label="t('market.sell.edit')"
              @click="emit('edit', row as MarketListing)"
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
              :label="
                (row as MarketListing).status === 'active'
                  ? t('market.sell.delist')
                  : t('market.sell.relist')
              "
              :disabled="
                togglingIds.has((row as MarketListing).id) ||
                (row as MarketListing).status === 'reviewing'
              "
              @click="toggleListed(row as MarketListing)"
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
              :label="t('market.sell.delist')"
              tone="danger"
              @click="delisting = row as MarketListing"
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
      </DataTable>
    </ConsoleCard>

    <ConfirmDialog
      :open="delisting !== null"
      :title="t('market.sell.delistTitle')"
      :message="
        t('market.sell.delistMessage', { title: delisting?.title ?? '' })
      "
      :confirm-text="t('market.sell.delist')"
      :loading="delistLoading"
      @confirm="confirmDelist"
      @cancel="delisting = null"
    />
  </div>
</template>
