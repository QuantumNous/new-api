<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEChart } from '@/charts/useEChart'
import { areaGradient, lineMood } from '@/charts/themePreset'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import type { TokenTrendPoint } from '@/composables/useDashboard'
import { formatCompact, formatQuota } from '@/utils/format'
import { escapeHtml } from '@/utils/html'

const props = defineProps<{
  points: TokenTrendPoint[]
  loading?: boolean
}>()

const { t } = useI18n()
const el = ref<HTMLElement | null>(null)

/** Window-wide cache hit rate, shown next to the title. */
const avgHitRate = computed(() => {
  if (!props.points.length) return 0
  const sum = props.points.reduce((acc, p) => acc + p.hit_rate, 0)
  return Math.round((sum / props.points.length) * 10) / 10
})

const totalSaved = computed(() =>
  props.points.reduce((acc, p) => acc + (p.standard - p.actual), 0)
)

interface TooltipParam {
  dataIndex: number
  seriesName: string
  value: number
  color: string
  axisValueLabel: string
}

useEChart(
  el,
  (p) => {
    const mood = lineMood(p)
    const dates = props.points.map((d) => d.date)
    const labels = {
      input: t('dashboard.tokenTrend.input'),
      output: t('dashboard.tokenTrend.output'),
      cacheCreate: t('dashboard.tokenTrend.cacheCreate'),
      cacheRead: t('dashboard.tokenTrend.cacheRead'),
      hitRate: t('dashboard.tokenTrend.hitRate'),
    }

    // Token series share the left axis; the hit-rate percentage gets its own.
    const tokenSeries = [
      { name: labels.input, key: 'input' as const, color: p.signal },
      { name: labels.output, key: 'output' as const, color: p.success },
      {
        name: labels.cacheCreate,
        key: 'cache_create' as const,
        color: p.warning,
      },
      { name: labels.cacheRead, key: 'cache_read' as const, color: p.accent },
    ].map((s) => ({
      name: s.name,
      type: 'line' as const,
      smooth: mood.line.smooth,
      showSymbol: !p.isDark,
      symbol: mood.line.symbol,
      symbolSize: mood.line.symbolSize,
      yAxisIndex: 0,
      data: props.points.map((d) => d[s.key]),
      lineStyle: { color: s.color, ...mood.line.lineStyle },
      itemStyle: {
        color: s.color,
        borderColor: p.surfaceSolid,
        borderWidth: 2,
      },
      areaStyle: {
        color: {
          type: 'linear' as const,
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: areaGradient(p, s.color),
        },
      },
    }))

    return {
      grid: { left: 56, right: 46, top: 40, bottom: 26 },
      legend: {
        top: 0,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 14,
        icon: 'circle',
        textStyle: { color: p.textTertiary, fontSize: 10 },
        inactiveColor: p.borderSubtle,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.surfaceSolid,
        borderColor: p.borderSubtle,
        textStyle: { color: p.textPrimary, fontSize: 12 },
        formatter: (params: TooltipParam[]) => {
          if (!params.length) return ''
          const point = props.points[params[0]!.dataIndex]
          if (!point) return ''
          const rows = params
            .map((s) => {
              const value =
                s.seriesName === labels.hitRate
                  ? `${s.value}%`
                  : formatCompact(s.value)
              return `<div style="display:flex;align-items:center;gap:6px;margin-top:3px">
                <span style="width:8px;height:8px;border-radius:2px;background:${s.color}"></span>
                <span style="color:${p.textSecondary}">${escapeHtml(s.seriesName)}:</span>
                <span style="margin-left:auto;font-weight:600">${escapeHtml(value)}</span>
              </div>`
            })
            .join('')
          return `<div style="min-width:186px">
            <div style="font-weight:700;margin-bottom:2px">${escapeHtml(params[0]!.axisValueLabel)}</div>
            ${rows}
            <div style="margin-top:7px;padding-top:6px;border-top:1px solid ${p.borderSubtle};font-weight:600">
              ${escapeHtml(t('dashboard.tokenTrend.actual'))}: ${escapeHtml(formatQuota(point.actual))}
              <span style="color:${p.textTertiary};font-weight:400"> | ${escapeHtml(t('dashboard.tokenTrend.standard'))}: ${escapeHtml(formatQuota(point.standard))}</span>
            </div>
          </div>`
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLine: { lineStyle: { color: p.borderSubtle } },
        axisTick: { show: false },
        axisLabel: {
          color: p.textTertiary,
          fontSize: 9,
          interval: Math.max(0, Math.floor(dates.length / 5) - 1),
        },
      },
      yAxis: [
        {
          type: 'value',
          splitLine: mood.splitLine,
          axisLabel: {
            color: p.textTertiary,
            fontSize: 9,
            formatter: (v: number) => formatCompact(v),
          },
        },
        {
          type: 'value',
          min: 0,
          max: 100,
          splitLine: { show: false },
          axisLabel: {
            color: p.support,
            fontSize: 9,
            formatter: (v: number) => `${v}%`,
          },
        },
      ],
      series: [
        ...tokenSeries,
        {
          name: labels.hitRate,
          type: 'line',
          smooth: mood.line.smooth,
          yAxisIndex: 1,
          showSymbol: !p.isDark,
          symbol: mood.line.symbol,
          symbolSize: mood.line.symbolSize,
          data: props.points.map((d) => d.hit_rate),
          lineStyle: {
            color: p.support,
            ...mood.line.lineStyle,
            type: p.isDark ? 'solid' : 'dashed',
          },
          itemStyle: {
            color: p.surfaceSolid,
            borderColor: p.support,
            borderWidth: 2,
          },
        },
      ],
    }
  },
  () => props.points
)
</script>

<template>
  <ConsoleCard :title="t('dashboard.tokenTrend.title')" stretch>
    <template #action>
      <div class="flex items-center gap-3 text-xs">
        <span class="text-[var(--text-tertiary)]">
          {{ t('dashboard.tokenTrend.avgHitRate') }}
          <span class="font-semibold text-[var(--support)]"
            >{{ avgHitRate }}%</span
          >
        </span>
        <span class="text-[var(--text-tertiary)]">
          {{ t('dashboard.tokenTrend.saved') }}
          <span class="font-semibold text-[var(--status-success-text)]">{{
            formatQuota(totalSaved)
          }}</span>
        </span>
      </div>
    </template>

    <div
      v-if="loading"
      class="h-80 grow animate-pulse rounded-xl bg-[var(--surface-muted)]"
    />
    <div
      v-else
      ref="el"
      class="h-80 w-full grow"
      role="img"
      :aria-label="t('dashboard.tokenTrend.title')"
    />
  </ConsoleCard>
</template>
