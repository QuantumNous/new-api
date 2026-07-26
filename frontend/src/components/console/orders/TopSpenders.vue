<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { adminOrderRankStyle } from '@/constants/adminOrders'
import type { AdminOrderSpender } from '@/types/console'
import { formatMoney } from '@/utils/format'

withDefaults(
  defineProps<{
    items: AdminOrderSpender[]
    loading?: boolean
  }>(),
  { loading: false }
)

const { t } = useI18n()
</script>

<template>
  <ConsoleCard :title="t('orders.topSpenders')">
    <ul v-if="loading" class="space-y-3.5" aria-hidden="true">
      <li
        v-for="i in 5"
        :key="i"
        class="h-9 animate-pulse rounded bg-[var(--surface-muted)]"
      />
    </ul>
    <ol v-else-if="items.length > 0" class="space-y-3.5">
      <li
        v-for="(item, index) in items"
        :key="item.user_id"
        class="flex items-center justify-between gap-3 text-sm"
      >
        <span class="flex min-w-0 items-center gap-3">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
            :style="adminOrderRankStyle(index + 1)"
            aria-hidden="true"
          >
            {{ index + 1 }}
          </span>
          <span class="min-w-0">
            <span
              class="block truncate text-[var(--text-secondary)]"
              :title="item.email"
            >
              {{ item.email }}
            </span>
            <span class="block text-xs text-[var(--text-tertiary)]">
              {{ t('orders.spenderOrders', { count: item.orders }) }}
            </span>
          </span>
        </span>
        <span
          class="shrink-0 font-semibold tabular-nums text-[var(--text-primary)]"
        >
          {{ formatMoney(item.amount) }}
        </span>
      </li>
    </ol>
    <EmptyState v-else :title="t('orders.noRevenue')" />
  </ConsoleCard>
</template>
