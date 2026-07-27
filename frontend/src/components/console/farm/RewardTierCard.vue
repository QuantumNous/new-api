<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatQuota } from '@/utils/format'
import type { RebateTier, RebateState } from '@/types/farm'

const props = defineProps<{
  tiers: RebateTier[]
  state: RebateState
  loading: boolean
}>()

const { t } = useI18n()

const currentTier = computed(
  () => props.tiers[props.state.current_tier_index] ?? props.tiers[0]
)
const nextTier = computed(
  () => props.tiers[props.state.current_tier_index + 1] ?? null
)

const progressPercent = computed(() => {
  const cur = props.state.current_consume
  const min = currentTier.value?.min_quota ?? 0
  const max = nextTier.value?.min_quota ?? cur
  if (max <= min) return 100
  return Math.min(100, Math.round(((cur - min) / (max - min)) * 100))
})
</script>

<template>
  <article
    class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <h3 class="mb-4 text-sm font-semibold text-[var(--text-primary)]">
      💰 {{ t('farm.rebate.title') }}
    </h3>

    <div v-if="loading" class="space-y-3">
      <div
        v-for="i in 3"
        :key="i"
        class="h-10 animate-pulse rounded-xl bg-[var(--surface-muted)]"
      />
    </div>

    <template v-else>
      <!-- current tier + stats -->
      <div class="mb-4 grid grid-cols-2 gap-3">
        <div
          class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
        >
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('farm.rebate.currentTier') }}
          </p>
          <p class="mt-0.5 text-base font-bold text-[var(--text-primary)]">
            {{ currentTier?.badge }} {{ currentTier?.label }}
          </p>
        </div>
        <div
          class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
        >
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('farm.rebate.currentRate') }}
          </p>
          <p class="mt-0.5 text-base font-bold text-[var(--accent-text)]">
            {{ ((currentTier?.rate ?? 0) * 100).toFixed(1) }}%
          </p>
        </div>
        <div
          class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
        >
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('farm.rebate.earnedTotal') }}
          </p>
          <p class="mt-0.5 text-base font-bold text-[var(--text-primary)]">
            {{ formatQuota(state.earned_total) }}
          </p>
        </div>
        <div
          v-if="nextTier"
          class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
        >
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('farm.rebate.nextTier') }}
          </p>
          <p class="mt-0.5 text-base font-bold text-[var(--text-primary)]">
            {{ formatQuota(nextTier.min_quota - state.current_consume) }}
          </p>
        </div>
      </div>

      <!-- progress bar -->
      <div class="mb-4">
        <div
          class="mb-1.5 flex items-center justify-between text-xs text-[var(--text-tertiary)]"
        >
          <span>{{ t('farm.rebate.progress') }}</span>
          <span
            >{{ formatQuota(state.current_consume) }} /
            {{ nextTier ? formatQuota(nextTier.min_quota) : '—' }}</span
          >
        </div>
        <div
          class="pencil-progress h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
        >
          <div
            class="h-full rounded-full transition-all duration-700"
            style="
              background: linear-gradient(90deg, var(--accent), var(--support));
            "
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>

      <!-- tier ladder -->
      <div class="mb-4 flex gap-1.5">
        <div
          v-for="(tier, i) in tiers"
          :key="tier.label"
          class="flex flex-1 flex-col items-center rounded-lg py-2 text-center text-[10px]"
          :style="
            i === state.current_tier_index
              ? 'background:var(--accent-soft);color:var(--accent-text)'
              : i < state.current_tier_index
                ? 'background:var(--surface-muted);color:var(--text-tertiary)'
                : 'background:var(--surface-muted);color:var(--text-tertiary);opacity:0.5'
          "
        >
          <span class="text-base">{{ tier.badge }}</span>
          <span class="mt-0.5 font-medium">{{ tier.label }}</span>
          <span class="opacity-70">{{ (tier.rate * 100).toFixed(1) }}%</span>
        </div>
      </div>

      <!-- history table -->
      <div>
        <p class="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
          {{ t('farm.rebate.history') }}
        </p>
        <div
          v-if="state.history.length === 0"
          class="text-center py-4 text-sm text-[var(--text-tertiary)]"
        >
          {{ t('farm.rebate.emptyHistory') }}
        </div>
        <div v-else class="space-y-1">
          <div
            v-for="row in state.history"
            :key="row.date"
            class="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
          >
            <span class="text-[var(--text-secondary)]">{{ row.date }}</span>
            <span class="font-semibold text-[var(--text-primary)]">{{
              formatQuota(row.amount)
            }}</span>
            <span class="text-[var(--text-tertiary)]"
              >{{ (row.rate * 100).toFixed(1) }}%</span
            >
          </div>
        </div>
      </div>
    </template>
  </article>
</template>
