<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import type { ModelShare, UserDiscounts } from '@/composables/useDashboard'
import { formatQuota } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    discounts: UserDiscounts | null
    /** Per-model spend, used to total what the discount actually returned. */
    models?: ModelShare[]
    loading?: boolean
  }>(),
  { models: () => [], loading: false }
)

const { t } = useI18n()

const saving = computed(() =>
  props.discounts
    ? Math.round((1 - props.discounts.effective_ratio) * 1000) / 10
    : 0
)

/**
 * Money the discount actually returned, summed from the per-model list rather
 * than inferred from the ratio — the ratio is the headline rate, this is what it
 * came to on real traffic.
 */
const savedAmount = computed(() =>
  props.models.reduce((sum, m) => sum + (m.standard_quota - m.quota), 0)
)

const standardTotal = computed(() =>
  props.models.reduce((sum, m) => sum + m.standard_quota, 0)
)
</script>

<template>
  <ConsoleCard :title="t('dashboard.discount.title')" stretch>
    <div v-if="loading" class="space-y-3">
      <div class="h-10 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      <div class="h-10 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
    </div>

    <div v-else-if="discounts" class="flex grow flex-col gap-3">
      <!-- Global discount row -->
      <div class="flex items-center gap-3">
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)]"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-[var(--text-tertiary)]">{{
              t('dashboard.discount.global')
            }}</span>
            <span
              class="font-mono text-sm font-bold text-[var(--text-primary)]"
            >
              {{ discounts.global_ratio.toFixed(2) }}×
            </span>
          </div>
          <!-- progress bar: fill = (1 - ratio), showing discount depth -->
          <div
            class="pencil-progress mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          >
            <div
              class="h-full rounded-full bg-[var(--accent)] transition-[width]"
              :style="{ width: `${(1 - discounts.global_ratio) * 100 * 5}%` }"
            />
          </div>
          <p class="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            {{
              t('dashboard.discount.globalDesc', {
                pct: Math.round((1 - discounts.global_ratio) * 100),
              })
            }}
          </p>
        </div>
      </div>

      <!-- Personal / group discount row -->
      <div class="flex items-center gap-3">
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-text)"
            stroke-width="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-[var(--text-tertiary)]">
              {{ t('dashboard.discount.personal') }}
            </span>
            <span class="font-mono text-sm font-bold text-[var(--accent-text)]">
              {{ discounts.group_ratio.toFixed(2) }}×
            </span>
          </div>
          <div
            class="pencil-progress mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          >
            <div
              class="h-full rounded-full bg-[var(--accent)] transition-[width]"
              :style="{ width: `${(1 - discounts.group_ratio) * 100 * 5}%` }"
            />
          </div>
          <p class="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            {{
              t('dashboard.discount.personalDesc', {
                pct: Math.round((1 - discounts.group_ratio) * 100),
              })
            }}
          </p>
        </div>
      </div>

      <!-- Divider + effective rate -->
      <div class="border-t border-[var(--border-subtle)] pt-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs text-[var(--text-tertiary)]">
              {{ t('dashboard.discount.effective') }}
            </p>
            <p class="mt-0.5 text-sm text-[var(--text-secondary)]">
              {{ t('dashboard.discount.savingDesc', { pct: saving }) }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold tabular-nums text-[var(--accent)]">
              {{ discounts.effective_ratio.toFixed(3) }}×
            </p>
          </div>
        </div>
      </div>

      <!--
        What the rate came to on real traffic. The ratio above is a rate; this is
        the amount, so the card ends on something concrete — pinned to the bottom
        edge when the row runs taller.
      -->
      <div
        v-if="savedAmount > 0"
        class="mt-auto rounded-xl bg-[var(--surface-muted)] px-3.5 py-3"
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-xs text-[var(--text-tertiary)]">
            {{ t('dashboard.discount.savedAmount') }}
          </span>
          <span
            class="font-bold tabular-nums text-[var(--status-success-text)]"
          >
            {{ formatQuota(savedAmount) }}
          </span>
        </div>
        <div
          class="mt-1.5 flex items-baseline justify-between gap-3 text-[11px] text-[var(--text-tertiary)]"
        >
          <span>{{ t('dashboard.discount.standardTotal') }}</span>
          <span class="tabular-nums line-through decoration-1">
            {{ formatQuota(standardTotal) }}
          </span>
        </div>
      </div>
    </div>
  </ConsoleCard>
</template>
