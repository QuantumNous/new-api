<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SERIES_TOKENS } from '@/charts/palette'
import { useEChart } from '@/charts/useEChart'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import type { ModelShare } from '@/composables/useDashboard'
import { formatCompact, formatNumber, formatQuota } from '@/utils/format'
import { escapeHtml } from '@/utils/html'

/** Slices the donut plots individually; everything past this folds into one. */
const TOP_N = 10

const props = defineProps<{
  items: ModelShare[]
  loading?: boolean
}>()

const { t } = useI18n()
const el = ref<HTMLElement | null>(null)
// CSS-var strings so legend swatches re-resolve on theme switch.
const colors = SERIES_TOKENS

/** Highest spend first, so the fold keeps the models that matter. */
const ranked = computed(() =>
  [...props.items].sort((a, b) => b.quota - a.quota)
)

/**
 * Donut data: the top models by spend plus a single aggregate for the tail. A
 * 15-slice donut is unreadable, and the tail is a rounding error next to the
 * head — but dropping it outright would make the ring stop summing to 100%.
 */
const slices = computed(() => {
  const head = ranked.value.slice(0, TOP_N)
  const tail = ranked.value.slice(TOP_N)
  if (!tail.length) return head.map((m) => ({ name: m.model, value: m.quota }))

  return [
    ...head.map((m) => ({ name: m.model, value: m.quota })),
    {
      name: t('dashboard.modelDist.others', { n: tail.length }),
      value: tail.reduce((sum, m) => sum + m.quota, 0),
    },
  ]
})

/**
 * Row → slice index. Folded rows point at the aggregate slice so hovering them
 * still highlights where their spend actually sits on the ring.
 */
function sliceIndexOf(rowIndex: number): number {
  return Math.min(rowIndex, TOP_N)
}

/**
 * Swatch colour. Folded rows get a neutral chip rather than a series colour —
 * they have no slice of their own, and borrowing one would imply they do.
 */
function swatchColor(rowIndex: number): string {
  if (rowIndex >= TOP_N) return 'var(--text-tertiary)'
  return colors[rowIndex % colors.length]!
}

const { dispatch } = useEChart(
  el,
  (p) => ({
    color: p.series,
    tooltip: {
      trigger: 'item',
      backgroundColor: p.surfaceSolid,
      borderColor: p.borderSubtle,
      textStyle: { color: p.textPrimary, fontSize: 12 },
      formatter: (params: { name: string; percent: number; value: number }) =>
        `${escapeHtml(params.name)}<br/>${escapeHtml(formatQuota(params.value))} · ${escapeHtml(params.percent)}%`,
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '80%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: p.surfaceSolid,
          borderWidth: 2,
          borderRadius: p.isDark ? 4 : 0,
        },
        label: { show: false },
        emphasis: { scaleSize: 6 },
        data: slices.value,
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '43%',
        style: {
          text: String(props.items.length),
          fontSize: 24,
          fontWeight: 700,
          fill: p.textPrimary,
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '56%',
        style: {
          text: t('dashboard.modelDist.modelsUsed'),
          fontSize: 10,
          fill: p.textTertiary,
          textAlign: 'center',
        },
      },
    ],
  }),
  () => props.items
)

/** Row hover lights up the matching donut slice. */
function highlight(rowIndex: number, on: boolean) {
  dispatch({
    type: on ? 'highlight' : 'downplay',
    seriesIndex: 0,
    dataIndex: sliceIndexOf(rowIndex),
  })
}
</script>

<template>
  <ConsoleCard :title="t('dashboard.modelDist.title')" stretch>
    <template #action>
      <span class="text-xs text-[var(--text-tertiary)]">
        {{ t('dashboard.modelDist.topNote', { n: TOP_N }) }}
      </span>
    </template>

    <div
      v-if="loading"
      class="grid grow gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
    >
      <div class="h-64 animate-pulse rounded-full bg-[var(--surface-muted)]" />
      <div class="space-y-2.5">
        <div
          v-for="i in 8"
          :key="i"
          class="h-7 animate-pulse rounded bg-[var(--surface-muted)]"
        />
      </div>
    </div>

    <div
      v-else
      class="grid grow gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
    >
      <!--
        Donut sized to fill its column rather than sit in a fixed box. min-w-0:
        without it the canvas's intrinsic width props the single-column track
        open below lg, so the card can never shrink back after a resize.
      -->
      <div
        ref="el"
        class="h-64 w-full min-w-0 self-center"
        role="img"
        :aria-label="t('dashboard.modelDist.title')"
      />

      <!--
        Every model is listed, so the body scrolls instead of the card growing
        without bound. The header stays put so the columns remain readable.
      -->
      <div
        class="subtle-scroll max-h-64 overflow-y-auto overflow-x-auto pr-2"
        role="region"
        tabindex="0"
        :aria-label="t('dashboard.modelDist.title')"
      >
        <table class="w-full min-w-[420px] border-collapse text-sm">
          <!--
            Sticky lives on the cells, not on thead: with border-collapse the
            rows scroll through a sticky thead's background instead of behind it.
          -->
          <thead>
            <tr class="text-xs text-[var(--text-tertiary)]">
              <th
                class="sticky top-0 z-10 bg-[var(--surface-solid)] px-2 pb-2 text-left font-medium"
              >
                {{ t('dashboard.modelDist.model') }}
              </th>
              <th
                class="sticky top-0 z-10 bg-[var(--surface-solid)] px-2 pb-2 text-right font-medium"
              >
                {{ t('dashboard.modelDist.requests') }}
              </th>
              <th
                class="sticky top-0 z-10 bg-[var(--surface-solid)] px-2 pb-2 text-right font-medium"
              >
                {{ t('dashboard.modelDist.tokens') }}
              </th>
              <th
                class="sticky top-0 z-10 bg-[var(--surface-solid)] px-2 pb-2 text-right font-medium"
              >
                {{ t('dashboard.modelDist.actual') }}
              </th>
              <th
                class="sticky top-0 z-10 bg-[var(--surface-solid)] px-2 pb-2 text-right font-medium"
              >
                {{ t('dashboard.modelDist.standard') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(m, i) in ranked"
              :key="m.model"
              class="border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-muted)]"
              @mouseenter="highlight(i, true)"
              @mouseleave="highlight(i, false)"
            >
              <td class="px-2 py-2">
                <span class="flex min-w-0 items-center gap-2">
                  <span
                    class="h-2.5 w-2.5 shrink-0 rounded-sm"
                    :style="{ background: swatchColor(i) }"
                  />
                  <span class="truncate text-[var(--text-primary)]">{{
                    m.model
                  }}</span>
                </span>
              </td>
              <td
                class="px-2 py-2 text-right tabular-nums text-[var(--text-secondary)]"
              >
                {{ formatNumber(m.requests) }}
              </td>
              <td
                class="px-2 py-2 text-right tabular-nums text-[var(--text-secondary)]"
              >
                {{ formatCompact(m.tokens) }}
              </td>
              <td
                class="px-2 py-2 text-right font-semibold tabular-nums"
                :style="{ color: 'var(--status-success-text)' }"
              >
                {{ formatQuota(m.quota) }}
              </td>
              <td
                class="px-2 py-2 text-right tabular-nums text-[var(--text-tertiary)] line-through decoration-1"
              >
                {{ formatQuota(m.standard_quota) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </ConsoleCard>
</template>
