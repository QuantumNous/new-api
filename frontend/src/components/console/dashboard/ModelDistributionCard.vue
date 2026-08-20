<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SERIES_TOKENS } from '@/charts/palette'
import { useEChart } from '@/charts/useEChart'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
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

const totalQuota = computed(() =>
  props.items.reduce((sum, m) => sum + m.quota, 0)
)

function modelSharePercent(quota: number): string {
  if (totalQuota.value <= 0) return '0.0'
  return ((quota / totalQuota.value) * 100).toFixed(1)
}

function modelShareRatio(quota: number): number {
  if (totalQuota.value <= 0) return 0
  return Math.min(100, Math.max(0, (quota / totalQuota.value) * 100))
}

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
        `${escapeHtml(params.name)}<br/>${escapeHtml(formatQuota(params.value))} · ${escapeHtml(String(params.percent))}%`,
    },
    series: [
      {
        type: 'pie',
        radius: ['60%', '82%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: p.surfaceSolid,
          borderWidth: 2,
          borderRadius: p.isDark ? 4 : 0,
        },
        label: { show: false },
        emphasis: {
          scaleSize: 5,
          itemStyle: {
            shadowBlur: p.isDark ? 12 : 6,
            shadowColor: p.isDark
              ? 'rgba(0, 4, 16, 0.65)'
              : 'rgba(56, 55, 43, 0.16)',
          },
        },
        data: slices.value,
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '42%',
        style: {
          text: String(props.items.length),
          fontSize: 26,
          fontWeight: 700,
          fontFamily: 'Ren2JetBrainsMono, monospace',
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
          fontSize: 11,
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
      class="grid grow gap-4 lg:gap-6 lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)]"
    >
      <div
        class="h-56 animate-pulse rounded-full bg-[var(--surface-muted)] lg:h-[300px]"
        data-model-distribution-chart
      />
      <div class="self-center space-y-2.5">
        <div
          v-for="i in 8"
          :key="i"
          class="h-7 animate-pulse rounded bg-[var(--surface-muted)]"
        />
      </div>
    </div>

    <EmptyState
      v-else-if="!items.length"
      class="grow"
      :title="t('dashboard.stats.noData')"
      :hint="t('dashboard.modelDist.emptyHint')"
    />

    <div
      v-else
      class="grid grow gap-4 lg:gap-6 lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)]"
    >
      <!--
        Donut sized to fill its column rather than sit in a fixed box. min-w-0:
        without it the canvas's intrinsic width props the single-column track
        open below lg, so the card can never shrink back after a resize.
      -->
      <div
        ref="el"
        class="h-56 w-full min-w-0 self-center lg:h-[300px]"
        role="img"
        :aria-label="t('dashboard.modelDist.title')"
        data-model-distribution-chart
      />

      <!--
        Every model is listed, so the body scrolls instead of the card growing
        without bound. The header stays put so the columns remain readable.
      -->
      <div
        class="subtle-scroll max-h-56 min-w-0 self-center overflow-y-auto overflow-x-auto pr-2 lg:max-h-[300px]"
        role="region"
        tabindex="0"
        :aria-label="t('dashboard.modelDist.title')"
        data-model-distribution-table
        data-model-distribution-scroll
      >
        <table class="w-full min-w-[560px] border-collapse text-sm">
          <colgroup>
            <col class="w-[34%]" />
            <col class="w-[13%]" />
            <col class="w-[15%]" />
            <col class="w-[22%]" />
            <col class="w-[16%]" />
          </colgroup>
          <!--
            Sticky lives on the cells, not on thead: with border-collapse the
            rows scroll through a sticky thead's background instead of behind it.
          -->
          <thead>
            <tr
              class="border-b border-[var(--border-subtle)] text-[11px] tracking-wider text-[var(--text-tertiary)]"
            >
              <th
                class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-table-header)] px-3 py-2.5 text-left font-semibold"
              >
                {{ t('dashboard.modelDist.model') }}
              </th>
              <th
                class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-table-header)] px-2.5 py-2.5 text-right font-semibold"
              >
                {{ t('dashboard.modelDist.requests') }}
              </th>
              <th
                class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-table-header)] px-2.5 py-2.5 text-right font-semibold"
              >
                {{ t('dashboard.modelDist.tokens') }}
              </th>
              <th
                class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-table-header)] px-3 py-2.5 text-right font-semibold"
              >
                {{ t('dashboard.modelDist.share') }}
              </th>
              <th
                class="sticky top-0 z-10 whitespace-nowrap bg-[var(--surface-table-header)] px-3 py-2.5 text-right font-semibold"
              >
                {{ t('dashboard.modelDist.spend') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(m, i) in ranked"
              :key="m.model"
              class="group border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-hover)]"
              @mouseenter="highlight(i, true)"
              @mouseleave="highlight(i, false)"
            >
              <td class="px-3 py-2.5">
                <span class="flex min-w-0 items-center gap-2.5">
                  <span
                    class="h-2 w-2 shrink-0 rounded-full ring-2 ring-[var(--surface-solid)] shadow-sm transition-transform group-hover:scale-125"
                    :style="{ background: swatchColor(i) }"
                  />
                  <span
                    class="max-w-[170px] truncate font-mono text-xs font-medium text-[var(--text-primary)]"
                    :title="m.model"
                  >
                    {{ m.model }}
                  </span>
                </span>
              </td>
              <td
                class="px-2.5 py-2.5 text-right font-mono text-xs tabular-nums text-[var(--text-secondary)]"
              >
                {{ formatNumber(m.requests) }}
              </td>
              <td
                class="px-2.5 py-2.5 text-right font-mono text-xs tabular-nums text-[var(--text-secondary)]"
              >
                {{ formatCompact(m.tokens) }}
              </td>
              <td class="px-3 py-2.5 text-right">
                <div class="flex items-center justify-end gap-2">
                  <div
                    class="pencil-progress h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                  >
                    <div
                      class="h-full rounded-full transition-all duration-300"
                      :style="{
                        width: `${modelShareRatio(m.quota)}%`,
                        background: swatchColor(i),
                      }"
                    />
                  </div>
                  <span
                    class="w-11 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--text-tertiary)]"
                  >
                    {{ modelSharePercent(m.quota) }}%
                  </span>
                </div>
              </td>
              <td
                class="px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums text-[var(--text-primary)] dark:text-[var(--accent-text)]"
              >
                {{ formatQuota(m.quota) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </ConsoleCard>
</template>
