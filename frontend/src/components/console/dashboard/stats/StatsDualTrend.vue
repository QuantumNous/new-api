<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEChart } from '@/charts/useEChart'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import type { FlowPoint } from '@/composables/useDashboard'

const props = defineProps<{
  flow: FlowPoint[]
  loading?: boolean
}>()

const { t } = useI18n()
const el = ref<HTMLElement | null>(null)
const data = computed(() => props.flow)

useEChart(
  el,
  (p) => ({
    grid: { left: 52, right: 52, top: 40, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: p.surfaceSolid,
      borderColor: p.borderSubtle,
      textStyle: { color: p.textPrimary, fontSize: 12 },
    },
    // Legend sits above the plot, same as the token trend card — at the
    // bottom it collided with the x-axis date labels.
    legend: {
      data: [t('dashboard.stats.spend'), t('dashboard.stats.requests')],
      top: 0,
      left: 'center',
      textStyle: { color: p.textTertiary, fontSize: 10 },
      icon: 'circle',
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 14,
      inactiveColor: p.borderSubtle,
    },
    xAxis: {
      type: 'category',
      data: data.value.map((f) => f.date),
      axisLine: { lineStyle: { color: p.borderSubtle } },
      axisTick: { show: false },
      axisLabel: {
        color: p.textTertiary,
        fontSize: 10,
        interval: Math.floor(data.value.length / 6),
      },
    },
    yAxis: [
      {
        type: 'value',
        name: t('dashboard.stats.spend'),
        nameTextStyle: { color: p.textTertiary, fontSize: 10 },
        splitLine: { lineStyle: { color: p.borderSubtle, type: 'dashed' } },
        axisLabel: {
          color: p.textTertiary,
          fontSize: 10,
          formatter: (v: number) =>
            v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v),
        },
      },
      {
        type: 'value',
        name: t('dashboard.stats.requests'),
        nameTextStyle: { color: p.textTertiary, fontSize: 10 },
        splitLine: { show: false },
        axisLabel: {
          color: p.textTertiary,
          fontSize: 10,
          formatter: (v: number) =>
            v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v),
        },
      },
    ],
    series: [
      {
        name: t('dashboard.stats.spend'),
        type: 'line',
        smooth: true,
        data: data.value.map((f) => f.consume),
        lineStyle: { color: p.accent, width: 2.5 },
        itemStyle: { color: p.accent },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${p.accent}33` },
              { offset: 1, color: `${p.accent}05` },
            ],
          },
        },
        showSymbol: false,
        yAxisIndex: 0,
      },
      {
        name: t('dashboard.stats.requests'),
        type: 'line',
        smooth: true,
        data: data.value.map((f) => f.requests),
        lineStyle: { color: p.signal, width: 2 },
        itemStyle: { color: p.signal },
        showSymbol: false,
        yAxisIndex: 1,
      },
    ],
  }),
  [data]
)
</script>

<template>
  <ConsoleCard :title="t('dashboard.stats.trendTitle')">
    <div
      v-if="loading"
      class="h-56 animate-pulse rounded-xl bg-[var(--surface-muted)]"
    />
    <div
      v-else
      ref="el"
      class="h-56 w-full"
      role="img"
      :aria-label="t('dashboard.stats.trendTitle')"
    />
  </ConsoleCard>
</template>
