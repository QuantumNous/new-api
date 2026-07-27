<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEChart } from '@/charts/useEChart'
import { areaGradient, lineMood } from '@/charts/themePreset'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import type { AdminOrderDailyPoint } from '@/types/console'
import { formatMoney } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    points: AdminOrderDailyPoint[]
    loading?: boolean
  }>(),
  { loading: false }
)

const { t } = useI18n()
const el = ref<HTMLElement | null>(null)

const points = computed(() => props.points)

/**
 * Label density is derived from the window length: 7 days shows every tick,
 * 90 days would otherwise overlap into an unreadable band.
 */
const labelInterval = computed(() => {
  const count = props.points.length
  if (count <= 10) return 0
  return Math.max(1, Math.ceil(count / 12) - 1)
})

/**
 * Ticks render as `MM-DD` in every window. The year is identical across a range
 * that is at most 90 days, so printing it only costs width — and width is what
 * clips here: `boundaryGap: false` seats the first and last points on the grid
 * boundary, so their centred labels overhang it. The sr-only table keeps the
 * full ISO date for assistive tech.
 */
const axisLabels = computed(() =>
  props.points.map((point) => point.date.slice(5))
)

useEChart(
  el,
  (p) => {
    const mood = lineMood(p)
    return {
      grid: { left: 8, right: 8, top: 40, bottom: 24, containLabel: true },
      /**
       * Units live in the legend rather than in `yAxis.name`. An axis name
       * defaults to nameLocation:'end', which puts it in the same top strip the
       * legend occupies — the left axis name lands under the legend and the right
       * one overprints it. Carrying the unit here states it once, unambiguously.
       */
      legend: {
        top: 4,
        right: 0,
        itemWidth: 18,
        itemHeight: 10,
        icon: p.isDark ? 'roundRect' : 'rect',
        textStyle: { color: p.textSecondary, fontSize: 11 },
        data: [t('orders.chart.revenue'), t('orders.chart.orders')],
        formatter: (name: string) =>
          name === t('orders.chart.revenue')
            ? t('orders.chart.revenueAxis')
            : t('orders.chart.ordersAxis'),
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.surfaceSolid,
        borderColor: p.borderSubtle,
        textStyle: { color: p.textPrimary, fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: p.borderSubtle } },
      },
      xAxis: {
        type: 'category',
        data: axisLabels.value,
        boundaryGap: false,
        axisLine: { lineStyle: { color: p.borderSubtle } },
        axisTick: { show: false },
        axisLabel: {
          color: p.textTertiary,
          fontSize: 10,
          interval: labelInterval.value,
        },
      },
      // Neither axis carries a `name`: ECharts anchors it at nameLocation:'end'
      // (the top of the axis), which put the right-hand one directly under the
      // legend. The units live in the legend labels instead, where they cannot
      // collide with anything.
      yAxis: [
        {
          type: 'value',
          splitLine: mood.splitLine,
          axisLabel: {
            color: p.textTertiary,
            fontSize: 10,
            formatter: (v: number) =>
              v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v),
          },
        },
        {
          type: 'value',
          splitLine: { show: false },
          axisLabel: { color: p.textTertiary, fontSize: 10 },
          minInterval: 1,
        },
      ],
      series: [
        {
          name: t('orders.chart.revenue'),
          type: 'line',
          smooth: mood.line.smooth,
          showSymbol: !p.isDark,
          symbol: mood.line.symbol,
          symbolSize: mood.line.symbolSize,
          data: points.value.map((point) => point.revenue),
          lineStyle: { color: p.accent, ...mood.line.lineStyle },
          itemStyle: {
            color: p.accent,
            borderColor: p.surfaceSolid,
            borderWidth: 2,
          },
          tooltip: { valueFormatter: (v: number) => formatMoney(v) },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: areaGradient(p, p.accent),
            },
          },
        },
        {
          name: t('orders.chart.orders'),
          type: 'line',
          yAxisIndex: 1,
          smooth: mood.line.smooth,
          showSymbol: !p.isDark,
          symbol: mood.line.symbol,
          symbolSize: mood.line.symbolSize,
          data: points.value.map((point) => point.orders),
          lineStyle: { color: p.signalStrong, ...mood.line.lineStyle },
          itemStyle: {
            color: p.signalStrong,
            borderColor: p.surfaceSolid,
            borderWidth: 2,
          },
        },
      ],
    }
  },
  [points, labelInterval, () => t('orders.chart.revenue')]
)
</script>

<template>
  <ConsoleCard :title="t('orders.chart.title')">
    <!-- The skeleton overlays the canvas host rather than replacing it: a
         hidden host would report 0×0 to echarts.init() on first mount, and the
         chart would only recover on the next resize. -->
    <div class="relative">
      <div
        ref="el"
        class="h-72 w-full"
        role="img"
        :aria-label="t('orders.chart.title')"
      />
      <div
        v-if="loading"
        class="absolute inset-0 animate-pulse rounded-xl bg-[var(--surface-muted)]"
        aria-hidden="true"
      />
    </div>
    <!-- Canvas carries no text for assistive tech, so the same figures are
         reachable as a table. -->
    <table class="sr-only">
      <caption>
        {{
          t('orders.chart.title')
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ t('orders.chart.date') }}</th>
          <th scope="col">{{ t('orders.chart.revenue') }}</th>
          <th scope="col">{{ t('orders.chart.orders') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="point in points" :key="point.date">
          <th scope="row">{{ point.date }}</th>
          <td>{{ formatMoney(point.revenue) }}</td>
          <td>{{ point.orders }}</td>
        </tr>
      </tbody>
    </table>
  </ConsoleCard>
</template>
