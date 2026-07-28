<script setup lang="ts">
import { Eye, LoaderCircle, RotateCcw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import EmptyState from '@/components/common/EmptyState.vue'
import IconButton from '@/components/common/IconButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import {
  adminOrderMethodLabelKey,
  adminOrderStatusLabelKey,
  adminOrderStatusTone,
  adminOrderTypeLabelKey,
} from '@/constants/adminOrders'
import type { AdminOrder } from '@/types/console'
import { formatMoney, formatTime } from '@/utils/format'

withDefaults(
  defineProps<{
    orders: AdminOrder[]
    loading?: boolean
    canRefund: (order: AdminOrder) => boolean
    isRefunding: (id: number) => boolean
    viewOrder: (order: AdminOrder) => void
    refundOrder: (order: AdminOrder) => void
  }>(),
  { loading: false }
)

const { t } = useI18n()
</script>

<template>
  <div v-if="loading" class="divide-y divide-[var(--border-subtle)]">
    <div v-for="i in 5" :key="i" class="px-4 py-4" :aria-hidden="true">
      <div class="h-24 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
    </div>
  </div>

  <EmptyState
    v-else-if="orders.length === 0"
    :title="t('orders.emptyTitle')"
    :hint="t('orders.emptyHint')"
    illustration="empty-search"
  />

  <div v-else class="divide-y divide-[var(--border-subtle)]">
    <article
      v-for="order in orders"
      :key="order.id"
      data-order-mobile-row
      class="min-w-0 px-4 py-4"
    >
      <header class="flex min-w-0 items-start justify-between gap-3">
        <div class="min-w-0">
          <p
            class="truncate font-mono text-xs text-[var(--text-secondary)]"
            :title="order.order_no"
          >
            {{ order.order_no }}
          </p>
          <p class="mt-1 truncate text-sm text-[var(--text-primary)]">
            {{ order.email }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-sm font-bold text-[var(--text-primary)]">
            {{ formatMoney(order.amount) }}
          </p>
          <StatusChip :tone="adminOrderStatusTone(order.status)" class="mt-1">
            {{ t(adminOrderStatusLabelKey(order.status)) }}
          </StatusChip>
        </div>
      </header>

      <dl class="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div class="min-w-0">
          <dt class="text-[var(--text-tertiary)]">{{ t('orders.colId') }}</dt>
          <dd class="mt-1 font-mono text-[var(--text-secondary)]">
            #{{ order.id }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="text-[var(--text-tertiary)]">
            {{ t('orders.colMethod') }}
          </dt>
          <dd class="mt-1 text-[var(--text-secondary)]">
            {{ t(adminOrderMethodLabelKey(order.method)) }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="text-[var(--text-tertiary)]">{{ t('orders.colType') }}</dt>
          <dd class="mt-1 text-[var(--text-secondary)]">
            {{ t(adminOrderTypeLabelKey(order.type)) }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="text-[var(--text-tertiary)]">
            {{ t('orders.colCreated') }}
          </dt>
          <dd class="mt-1 text-[var(--text-secondary)]">
            {{ formatTime(order.created) }}
          </dd>
        </div>
      </dl>

      <footer
        class="mt-3 flex items-center justify-end gap-1 border-t border-[var(--border-subtle)] pt-3"
      >
        <IconButton :label="t('orders.viewOrder')" @click="viewOrder(order)">
          <Eye :size="16" />
        </IconButton>
        <IconButton
          v-if="canRefund(order) || isRefunding(order.id)"
          :label="t('orders.refundOrder')"
          tone="danger"
          :disabled="!canRefund(order)"
          @click="refundOrder(order)"
        >
          <LoaderCircle
            v-if="isRefunding(order.id)"
            :size="16"
            class="animate-spin"
          />
          <RotateCcw v-else :size="16" />
        </IconButton>
      </footer>
    </article>
  </div>
</template>
