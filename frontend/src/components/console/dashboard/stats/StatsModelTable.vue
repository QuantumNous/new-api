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
      class="subtle-scroll max-h-64 overflow-y-auto overflow-x-auto pr-2"
    >
      <table class="w-full border-collapse text-sm">
        <!--
          Sticky lives on the cells, not on thead: with border-collapse the
          rows scroll through a sticky thead's background instead of behind it.
        -->
        <thead>
          <tr class="text-xs text-[var(--text-tertiary)]">
            <th
              class="sticky top-0 z-10 bg-[var(--surface-solid)] pb-2 text-left font-medium"
            >
              {{ t('dashboard.stats.model') }}
            </th>
            <th
              class="sticky top-0 z-10 bg-[var(--surface-solid)] pb-2 text-right font-medium"
            >
              {{ t('dashboard.stats.tokens') }}
            </th>
            <th
              class="sticky top-0 z-10 bg-[var(--surface-solid)] pb-2 text-right font-medium"
            >
              {{ t('dashboard.stats.spend') }}
            </th>
            <th
              class="sticky top-0 z-10 bg-[var(--surface-solid)] pb-2 text-right font-medium"
            >
              {{ t('dashboard.stats.requests') }}
            </th>
            <th
              class="sticky top-0 z-10 bg-[var(--surface-solid)] pb-2 pr-0 text-right font-medium"
            >
              {{ t('dashboard.stats.share') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in models"
            :key="row.model"
            class="border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-muted)]"
          >
            <td class="py-2.5 pr-4">
              <span class="flex items-center gap-2">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-sm"
                  :style="{ background: colors[i % colors.length] }"
                />
                <span
                  class="max-w-[140px] truncate font-medium text-[var(--text-primary)]"
                >
                  {{ row.model }}
                </span>
              </span>
            </td>
            <td
              class="py-2.5 pr-4 text-right tabular-nums text-[var(--text-secondary)]"
            >
              {{ formatNumber(row.tokens) }}
            </td>
            <td
              class="py-2.5 pr-4 text-right font-semibold tabular-nums text-[var(--text-primary)]"
            >
              {{ formatQuota(row.quota) }}
            </td>
            <td
              class="py-2.5 pr-4 text-right tabular-nums text-[var(--text-secondary)]"
            >
              {{ formatNumber(row.requests) }}
            </td>
            <td class="py-2.5 text-right">
              <!-- mini progress bar -->
              <div class="flex items-center justify-end gap-2">
                <div
                  class="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                >
                  <div
                    class="h-full rounded-full transition-all"
                    :style="{
                      width: `${row.share}%`,
                      background: colors[i % colors.length],
                    }"
                  />
                </div>
                <span
                  class="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--text-tertiary)]"
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
