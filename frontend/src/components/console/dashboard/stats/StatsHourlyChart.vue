<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEChart } from '@/charts/useEChart'
import { lineMood } from '@/charts/themePreset'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import type { HourlyPoint } from '@/composables/useDashboardStats'

const props = defineProps<{
  hourly: HourlyPoint[]
  loading?: boolean
}>()

const { t } = useI18n()
const el = ref<HTMLElement | null>(null)
const data = computed(() => props.hourly)

const peakHour = computed(() => {
  if (!props.hourly.length) return null
  return props.hourly.reduce((a, b) => (a.requests > b.requests ? a : b))
})

useEChart(
  el,
  (p) => {
    const mood = lineMood(p)
    const values = data.value.map((h) => h.requests)
    const maxVal = Math.max(...values, 1)
    return {
      grid: { left: 40, right: 12, top: 12, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.surfaceSolid,
        borderColor: p.borderSubtle,
        textStyle: { color: p.textPrimary, fontSize: 12 },
        axisPointer: p.isDark
          ? { type: 'shadow' }
          : {
              type: 'line',
              lineStyle: {
                color: p.borderSubtle,
                type: [7, 3, 2, 5],
                width: 1,
              },
            },
      },
      xAxis: {
        type: 'category',
        data: data.value.map((h) => h.hour),
        axisLine: { lineStyle: { color: p.borderSubtle } },
        axisTick: { show: false },
        axisLabel: {
          color: p.textTertiary,
          fontSize: 9,
          interval: 2,
          formatter: (v: string) => v.replace(':00', ''),
        },
      },
      yAxis: {
        type: 'value',
        splitLine: mood.splitLine,
        axisLabel: { color: p.textTertiary, fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v) => ({
            value: v,
            itemStyle: {
              color: v === maxVal ? p.accent : `${p.accent}66`,
              borderRadius: mood.barRadius,
            },
          })),
          emphasis: {
            itemStyle: { color: p.accent },
          },
        },
      ],
    }
  },
  [data]
)
</script>

<template>
  <ConsoleCard :title="t('dashboard.stats.hourlyDist')" stretch>
    <template #action>
      <span
        v-if="peakHour"
        class="rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-xs text-[var(--accent-text)]"
      >
        {{ t('dashboard.stats.peakAt', { hour: peakHour.hour }) }}
      </span>
    </template>

    <!-- h-36 is the floor; `grow` fills the row set by the model table beside it -->
    <div
      v-if="loading"
      class="h-36 grow animate-pulse rounded-xl bg-[var(--surface-muted)]"
    />
    <div
      v-else
      ref="el"
      class="h-36 w-full grow"
      role="img"
      :aria-label="t('dashboard.stats.hourlyDist')"
    />
  </ConsoleCard>
</template>
