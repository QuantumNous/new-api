<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import { formatQuota, formatNumber } from '@/utils/format'
import { SERIES_TOKENS } from '@/charts/palette'
import type { StatsModelRow } from '@/composables/useDashboardStats'

defineProps<{
  models: StatsModelRow[]
  loading?: boolean
}>()

const { t } = useI18n()
const colors = SERIES_TOKENS
</script>

<template>
  <ConsoleCard :title="t('dashboard.stats.modelBreakdown')" stretch>
    <template #action>
      <span v-if="models.length" class="text-xs text-[var(--text-tertiary)]">
        {{ t('dashboard.stats.modelsTotal', { n: models.length }) }}
      </span>
    </template>

    <!-- skeleton -->
    <div v-if="loading" class="space-y-3">
      <div
        v-for="i in 4"
        :key="i"
        class="h-10 animate-pulse rounded-lg bg-[var(--surface-muted)]"
      />
    </div>

    <!--
      Capped and scrollable so a long model list cannot stretch the whole row —
      the hourly chart beside it fills the same height instead of floating
      above a blank strip. The header stays put while the rows scroll.
      subtle-scroll: trackless thumb that only shows on hover; pr-2 keeps it
      off the share column when it does.
    -->
    <div
      v-else-if="models.length"
      class="subtle-scroll max-h-[22rem] overflow-y-auto overflow-x-auto pr-2 sm:max-h-64"
      role="region"
      tabindex="0"
      :aria-label="t('dashboard.stats.modelBreakdown')"
      data-stats-model-scroll
    >
      <table class="w-full min-w-[600px] border-collapse text-sm xl:min-w-0">
        <!--
          Sticky lives on the cells, not on thead: with border-collapse the
          rows scroll through a sticky thead's background instead of behind it.
        -->
        <thead>
          <tr
            class="border-b border-[var(--border-subtle)] text-[11px] tracking-wider text-[var(--text-tertiary)]"
          >
            <th
              class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-solid)] px-3 py-2.5 text-left font-semibold"
            >
              {{ t('dashboard.stats.model') }}
            </th>
            <th
              class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-solid)] px-2.5 py-2.5 text-right font-semibold"
            >
              {{ t('dashboard.stats.tokens') }}
            </th>
            <th
              class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-solid)] px-3 py-2.5 text-right font-semibold"
            >
              {{ t('dashboard.stats.spend') }}
            </th>
            <th
              class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-solid)] px-2.5 py-2.5 text-right font-semibold"
            >
              {{ t('dashboard.stats.requests') }}
            </th>
            <th
              class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-solid)] px-3 py-2.5 text-right font-semibold"
            >
              {{ t('dashboard.stats.share') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in models"
            :key="row.model"
            class="group border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <td class="px-3 py-2.5">
              <span class="flex min-w-0 items-center gap-2.5">
                <span
                  class="h-2 w-2 shrink-0 rounded-full ring-2 ring-[var(--surface-solid)] shadow-sm transition-transform group-hover:scale-125"
                  :style="{ background: colors[i % colors.length] }"
                />
                <span
                  class="min-w-0 max-w-[150px] truncate font-mono text-xs font-medium text-[var(--text-primary)]"
                  :title="row.model"
                >
                  {{ row.model }}
                </span>
              </span>
            </td>
            <td
              class="px-2.5 py-2.5 text-right font-mono text-xs tabular-nums text-[var(--text-secondary)]"
            >
              {{ formatNumber(row.tokens) }}
            </td>
            <td
              class="px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums text-[var(--text-primary)] dark:text-[var(--accent-text)]"
            >
              {{ formatQuota(row.quota) }}
            </td>
            <td
              class="px-2.5 py-2.5 text-right font-mono text-xs tabular-nums text-[var(--text-secondary)]"
            >
              {{ formatNumber(row.requests) }}
            </td>
            <td class="px-3 py-2.5 text-right">
              <!-- mini progress bar -->
              <div class="flex items-center justify-end gap-2">
                <div
                  class="pencil-progress h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                >
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    :style="{
                      width: `${row.share}%`,
                      background: colors[i % colors.length],
                    }"
                  />
                </div>
                <span
                  class="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--text-tertiary)]"
                >
                  {{ row.share }}%
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="py-8 text-center text-sm text-[var(--text-tertiary)]">
      {{ t('dashboard.stats.noData') }}
    </p>
  </ConsoleCard>
</template>
