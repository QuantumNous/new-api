<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { useBalanceVisibility } from '@/composables/useDashboard'
import { formatQuota } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    quota: number
    usedQuota?: number
    todayQuota?: number
    /** rolling daily burn used for the runway estimate */
    dailyBurn?: number
    compact?: boolean
  }>(),
  {
    usedQuota: 0,
    todayQuota: undefined,
    dailyBurn: undefined,
    compact: false,
  }
)

const { t } = useI18n()
const router = useRouter()
const { hidden, toggle } = useBalanceVisibility()

const display = computed(() =>
  hidden.value ? '••••••••' : formatQuota(props.quota)
)

// Usage ratio: how much of total balance has been consumed this billing period
const totalBalance = computed(() => props.quota + props.usedQuota)
const usedPercent = computed(() =>
  totalBalance.value > 0
    ? Math.min(100, Math.round((props.usedQuota / totalBalance.value) * 100))
    : 0
)
const meterColor = computed(() => {
  if (usedPercent.value >= 90) return 'var(--status-danger)'
  if (usedPercent.value >= 70) return 'var(--status-warning)'
  return 'var(--status-success)'
})

/** Remaining share of the balance drives the health indicator. */
const remainPercent = computed(() => 100 - usedPercent.value)
const health = computed(() => {
  if (remainPercent.value < 10) {
    return {
      tone: 'danger' as const,
      label: t('dashboard.balanceHint.critical'),
    }
  }
  if (remainPercent.value < 30) {
    return { tone: 'warning' as const, label: t('dashboard.balanceHint.low') }
  }
  return { tone: 'success' as const, label: t('dashboard.balanceHint.healthy') }
})

/** Runway in whole days; null when there is nothing to extrapolate from. */
const runwayDays = computed(() => {
  const burn = props.dailyBurn ?? props.todayQuota ?? 0
  if (burn <= 0 || props.quota <= 0) return null
  return Math.floor(props.quota / burn)
})
</script>

<template>
  <ConsoleCard variant="sketch" stretch>
    <!-- Top row: label + health indicator -->
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-[var(--text-tertiary)]">
        {{ t('dashboard.totalBalance') }}
      </p>
      <StatusChip v-if="!compact" :tone="health.tone">
        {{ health.label }}
      </StatusChip>
    </div>

    <!-- Balance number: mono font for ledger feel; weight is theme-driven -->
    <div class="mt-3 flex items-center gap-2.5">
      <p
        class="display-number font-mono text-3xl tracking-tight text-[var(--text-primary)]"
      >
        {{ display }}
      </p>
      <button
        type="button"
        class="text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-ring"
        :aria-label="hidden ? t('common.showBalance') : t('common.hideBalance')"
        @click="toggle"
      >
        <!-- eye-off -->
        <svg
          v-if="hidden"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M3 3l18 18M10.5 10.7a3 3 0 0 0 4.2 4.2M7.4 7.6C4.8 9.3 3 12 3 12s3.5 6 9 6c1.6 0 3-.4 4.3-1M12 6c5.5 0 9 6 9 6s-.6 1.1-1.8 2.3"
          />
        </svg>
        <!-- eye -->
        <svg
          v-else
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>

    <!-- Runway estimate -->
    <p v-if="!compact" class="mt-1.5 text-xs text-[var(--text-tertiary)]">
      <template v-if="runwayDays !== null">
        {{ t('dashboard.balanceHint.runway', { days: runwayDays }) }}
      </template>
      <template v-else>
        {{ t('dashboard.balanceHint.runwayUnknown') }}
      </template>
    </p>

    <!-- Usage bar: hand-drawn brush-stroke style -->
    <div v-if="usedQuota > 0 && !compact" class="mt-4">
      <div
        class="mb-1.5 flex items-baseline justify-between gap-3 text-xs text-[var(--text-tertiary)]"
      >
        <span>
          {{ t('dashboard.usedQuota') }}
          <span class="font-semibold text-[var(--text-secondary)]">{{
            formatQuota(usedQuota)
          }}</span>
        </span>
        <span class="font-mono tabular-nums">{{ usedPercent }}%</span>
      </div>
      <!-- Thicker bar with irregular radius for brush-stroke feel -->
      <div
        class="h-2 overflow-hidden bg-[var(--surface-muted)]"
        style="border-radius: 3px 2px 4px 2px / 2px 3px 2px 4px"
      >
        <div
          class="h-full transition-[width] duration-700"
          style="border-radius: 3px 1px 3px 2px / 2px 2px 3px 1px"
          :style="{ width: `${usedPercent}%`, background: meterColor }"
        />
      </div>
    </div>

    <!-- Today vs. average spend grid -->
    <div
      v-if="!compact && (todayQuota !== undefined || dailyBurn !== undefined)"
      class="mt-4 grid grid-cols-2 gap-3"
    >
      <div
        class="px-3 py-2.5"
        style="
          background: var(--surface-muted);
          border-radius: var(--sketch-border-radius-sm);
        "
      >
        <p class="text-[11px] text-[var(--text-tertiary)]">
          {{ t('dashboard.todaySpend') }}
        </p>
        <p
          class="mt-0.5 font-mono font-bold tabular-nums text-[var(--text-primary)]"
        >
          {{ todayQuota === undefined ? '--' : formatQuota(todayQuota) }}
        </p>
      </div>
      <div
        class="px-3 py-2.5"
        style="
          background: var(--surface-muted);
          border-radius: var(--sketch-border-radius-sm);
        "
      >
        <p class="text-[11px] text-[var(--text-tertiary)]">
          {{ t('dashboard.balanceHint.avgBurn') }}
        </p>
        <p
          class="mt-0.5 font-mono font-bold tabular-nums text-[var(--text-primary)]"
        >
          {{ dailyBurn === undefined ? '--' : formatQuota(dailyBurn) }}
        </p>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="mt-auto grid grid-cols-2 gap-3 pt-5">
      <ConsoleButton @click="router.push({ name: 'wallet' })">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18M8 15h4" />
        </svg>
        {{ t('dashboard.recharge') }}
      </ConsoleButton>
      <ConsoleButton
        variant="secondary"
        @click="router.push({ name: 'wallet', query: { panel: 'redeem' } })"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9Z"
          />
          <path d="M13 7v12" stroke-dasharray="3 3" />
        </svg>
        {{ t('dashboard.redeem') }}
      </ConsoleButton>
    </div>
  </ConsoleCard>
</template>
