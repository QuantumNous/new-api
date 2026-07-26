<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { SERIES_TOKENS } from '@/charts/palette'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { adminOrderMethodLabelKey } from '@/constants/adminOrders'
import type { AdminOrderMethodShare } from '@/types/console'
import { formatMoney } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    items: AdminOrderMethodShare[]
    loading?: boolean
  }>(),
  { loading: false }
)

const { t } = useI18n()

// CSS-var strings rather than resolved hex, so the swatches re-resolve when the
// theme flips (same reason ModelShareDonut's legend uses them).
const colors = SERIES_TOKENS

const total = computed(() =>
  props.items.reduce((sum, item) => sum + item.amount, 0)
)

function share(amount: number): number {
  return total.value > 0 ? Math.round((amount / total.value) * 100) : 0
}
</script>

<template>
  <ConsoleCard :title="t('orders.paymentShare')">
    <ul v-if="loading" class="space-y-4" aria-hidden="true">
      <li v-for="i in 3" :key="i">
        <div class="h-5 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div class="mt-2 h-1 rounded-full bg-[var(--surface-muted)]" />
      </li>
    </ul>
    <ul v-else-if="items.length > 0" class="space-y-4">
      <li v-for="(item, index) in items" :key="item.method">
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="flex min-w-0 items-center gap-2.5">
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ background: colors[index % colors.length] }"
              aria-hidden="true"
            />
            <span class="truncate text-[var(--text-secondary)]">
              {{ t(adminOrderMethodLabelKey(item.method)) }}
            </span>
          </span>
          <span class="shrink-0 tabular-nums">
            <span class="font-semibold text-[var(--text-primary)]">
              {{ formatMoney(item.amount) }}
            </span>
            <span class="ml-1.5 text-xs text-[var(--text-tertiary)]">
              ({{ item.count }})
            </span>
          </span>
        </div>
        <div
          class="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"
        >
          <div
            class="h-full rounded-full"
            :style="{
              width: `${share(item.amount)}%`,
              background: colors[index % colors.length],
            }"
            role="meter"
            :aria-valuenow="share(item.amount)"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="
              t('orders.paymentShareOf', {
                method: t(adminOrderMethodLabelKey(item.method)),
                percent: share(item.amount),
              })
            "
          />
        </div>
      </li>
    </ul>
    <EmptyState v-else :title="t('orders.noRevenue')" />
  </ConsoleCard>
</template>
