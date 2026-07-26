<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useEChart } from '@/charts/useEChart'
import { areaGradient, lineMood } from '@/charts/themePreset'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import type { FlowPoint } from '@/composables/useDashboard'
import { useToast } from '@/composables/useToast'
import { formatQuota } from '@/utils/format'

const { t } = useI18n()
const toast = useToast()

const el = ref<HTMLElement | null>(null)
const flow = ref<FlowPoint[]>([])
const showTopup = ref(true)
const year = ref('2026')

const categories = computed(() => flow.value.map((f) => f.date))
const series = computed(() =>
  showTopup.value
    ? flow.value.map((f) => f.topup)
    : flow.value.map((f) => f.consume)
)

useEChart(
  el,
  (p) => {
    const mood = lineMood(p)
    const lineColor = showTopup.value ? p.accent : p.signalStrong
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
  [flow, showTopup]
)

onMounted(async () => {
  try {
    flow.value = await api.get<FlowPoint[]>('/api/data/flow/self')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : t('common.failed'))
  }
})
</script>

<template>
  <ConsoleCard :title="t('wallet.flowTitle')">
    <template #action>
      <div class="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        <label class="flex items-center gap-1.5">
          <ConsoleToggle v-model="showTopup" :label="t('wallet.flowTopup')" />
          {{ t('wallet.flowTopup') }}
        </label>
        <span
          class="rounded-lg bg-[var(--surface-muted)] px-2 py-1 text-[var(--text-tertiary)]"
        >
          {{ t('wallet.yearSuffix', { year }) }} ▾
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
