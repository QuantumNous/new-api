<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEChart } from '@/charts/useEChart'
import { areaGradient, lineMood } from '@/charts/themePreset'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import type { FlowPoint } from '@/composables/useDashboard'
import { formatQuota } from '@/utils/format'

const { t } = useI18n()
const props = defineProps<{ flow: FlowPoint[] }>()

const el = ref<HTMLElement | null>(null)
const flow = computed(() => props.flow)
const year = computed(() => props.flow.at(-1)?.date.slice(0, 4) ?? '')

const categories = computed(() => flow.value.map((f) => f.date))
const series = computed(() => flow.value.map((f) => f.consume))

useEChart(
  el,
  (p) => {
    const mood = lineMood(p)
    const lineColor = p.signalStrong
    return {
      grid: { left: 56, right: 16, top: 18, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.surfaceSolid,
        borderColor: p.borderSubtle,
        textStyle: { color: p.textPrimary, fontSize: 12 },
        valueFormatter: (v: number) => formatQuota(v),
      },
      xAxis: {
        type: 'category',
        data: categories.value,
        axisLine: { lineStyle: { color: p.borderSubtle } },
        axisTick: { show: false },
        axisLabel: { color: p.textTertiary, fontSize: 10, interval: 4 },
      },
      yAxis: {
        type: 'value',
        splitLine: mood.splitLine,
        axisLabel: {
          color: p.textTertiary,
          fontSize: 10,
          formatter: (v: number) =>
            v >= 1_000_000
              ? `${v / 1_000_000}M`
              : v >= 1000
                ? `${v / 1000}K`
                : String(v),
        },
      },
      series: [
        {
          type: 'line',
          smooth: mood.line.smooth,
          symbol: mood.line.symbol,
          symbolSize: mood.line.symbolSize,
          showSymbol: !p.isDark,
          data: series.value,
          lineStyle: { color: lineColor, ...mood.line.lineStyle, width: 3 },
          itemStyle: {
            color: lineColor,
            borderColor: p.surfaceSolid,
            borderWidth: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: areaGradient(p, lineColor),
            },
          },
        },
      ],
    }
  },
  [flow]
)
</script>

<template>
  <ConsoleCard :title="t('wallet.flowTitle')">
    <template #action>
      <div class="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        <span
          class="rounded-lg bg-[var(--surface-muted)] px-2 py-1 text-[var(--text-tertiary)]"
        >
          {{ t('wallet.yearSuffix', { year }) }}
        </span>
      </div>
    </template>
    <div
      ref="el"
      class="h-64 w-full"
      role="img"
      :aria-label="t('wallet.flowTitle')"
    />
  </ConsoleCard>
</template>
