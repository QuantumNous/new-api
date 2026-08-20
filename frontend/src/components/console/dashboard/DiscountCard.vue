<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { UserDiscounts } from '@/composables/useDashboard'

withDefaults(
  defineProps<{
    discounts: UserDiscounts | null
    loading?: boolean
  }>(),
  { loading: false }
)

const { t } = useI18n()
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
              {{ discounts.plan_ratio.toFixed(2) }}×
            </span>
          </div>
          <div
            class="pencil-progress mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          >
            <div
              class="h-full rounded-full bg-[var(--accent)] transition-[width]"
              :style="{ width: `${(1 - discounts.plan_ratio) * 100 * 5}%` }"
            />
          </div>
          <p class="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            {{
              t('dashboard.discount.personalDesc', {
                pct: Math.round((1 - discounts.plan_ratio) * 100),
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
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold tabular-nums text-[var(--accent)]">
              {{ discounts.effective_ratio.toFixed(3) }}×
            </p>
          </div>
        </div>
      </div>
    </div>

    <EmptyState
      v-else
      class="grow"
      :title="t('dashboard.stats.noData')"
      :hint="t('dashboard.discount.emptyHint')"
    />
  </ConsoleCard>
</template>
