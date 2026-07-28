<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEChart } from '@/charts/useEChart'
import { lineMood } from '@/charts/themePreset'
import type { InviteMonthPoint } from '@/types/console'
import ConsoleCard from '@/components/common/ConsoleCard.vue'

const props = defineProps<{
  series: InviteMonthPoint[]
}>()

const { t } = useI18n()
const el = ref<HTMLElement | null>(null)

type Mode = 'new' | 'cumulative'
const mode = ref<Mode>('new')

const categories = computed(() => props.series.map((p) => p.month))
const values = computed(() =>
  props.series.map((p) => (mode.value === 'new' ? p.new_count : p.cumulative))
)

const totalNew = computed(() =>
  props.series.reduce((s, p) => s + p.new_count, 0)
)

useEChart(
  el,
  (p) => ({
    grid: { left: 32, right: 12, top: 16, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: p.surfaceSolid,
      borderColor: p.borderSubtle,
      textStyle: { color: p.textPrimary, fontSize: 12 },
      formatter: (params: { name: string; value: number }[]) => {
        const item = params[0]
        const label =
          mode.value === 'new'
            ? t('invite.chartTabNew')
            : t('invite.chartTabCumulative')
        return `${item.name} · ${label} ${t('invite.people', { count: item.value })}`
      },
    },
    xAxis: {
      type: 'category',
      data: categories.value,
      axisLine: { lineStyle: { color: p.borderSubtle } },
      axisTick: { show: false },
      axisLabel: { color: p.textTertiary, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: lineMood(p).splitLine,
      axisLabel: { color: p.textTertiary, fontSize: 10 },
    },
    series: [
      {
        type: 'bar',
        data: values.value,
        barMaxWidth: 40,
        itemStyle: { color: p.accent, borderRadius: lineMood(p).barRadius },
        label: {
          show: true,
          position: 'top',
          color: p.textSecondary,
          fontSize: 11,
          formatter: (o: { value: number }) =>
            o.value > 0 ? String(o.value) : '',
        },
      },
    ],
  }),
  [categories, values]
)
</script>

<template>
  <ConsoleCard :title="t('invite.chartTitle')">
    <template #action>
      <div class="flex gap-1 rounded-lg bg-[var(--surface-muted)] p-0.5">
        <button
          v-for="m in ['new', 'cumulative'] as Mode[]"
          :key="m"
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          :style="
            mode === m
              ? 'background:var(--surface-solid);color:var(--text-primary)'
              : 'color:var(--text-tertiary)'
          "
          @click="mode = m"
        >
          {{
            m === 'new'
              ? t('invite.chartTabNew')
              : t('invite.chartTabCumulative')
          }}
        </button>
      </div>
    </template>

    <p class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
      {{ t('invite.people', { count: totalNew }) }}
    </p>
    <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
      {{ t('invite.chartSubtitle') }}
    </p>
    <div
      ref="el"
      class="mt-3 h-48 w-full"
      role="img"
      :aria-label="t('invite.chartTitle')"
    />
  </ConsoleCard>
</template>
