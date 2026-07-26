<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEChart } from '@/charts/useEChart'
import { areaGradient, lineMood } from '@/charts/themePreset'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import { formatQuota, formatNumber } from '@/utils/format'
import type { DashboardStats, FlowPoint } from '@/composables/useDashboard'

type ChartMode = 'both' | 'consume' | 'requests'

const props = defineProps<{
  stats: DashboardStats | null
  flow: FlowPoint[]
  loading?: boolean
}>()

const { t } = useI18n()
const el = ref<HTMLElement | null>(null)
const mode = ref<ChartMode>('both')

const flowData = computed(() => props.flow)

useEChart(
  el,
  (p) => {
    const mood = lineMood(p)
    const dates = flowData.value.map((f) => f.date)
    const consume = flowData.value.map((f) => f.consume)
    const requests = flowData.value.map((f) => f.requests)

    const showConsume = mode.value === 'both' || mode.value === 'consume'
    const showRequests = mode.value === 'both' || mode.value === 'requests'
    const singleAxis = mode.value !== 'both'

    return {
      grid: {
        left: singleAxis ? 44 : 52,
        right: singleAxis ? 12 : 52,
        top: 14,
        bottom: 28,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.surfaceSolid,
        borderColor: p.borderSubtle,
        textStyle: { color: p.textPrimary, fontSize: 12 },
        valueFormatter: (v: number) =>
          mode.value === 'consume' ? formatQuota(v) : formatNumber(v),
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: p.borderSubtle } },
        axisTick: { show: false },
        axisLabel: {
          color: p.textTertiary,
          fontSize: 10,
          interval: Math.floor(dates.length / 6),
        },
      },
      yAxis: singleAxis
        ? [
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
          ]
        : [
            {
              type: 'value',
              name: t('dashboard.consumeTrend'),
              nameTextStyle: { color: p.textTertiary, fontSize: 9 },
              splitLine: mood.splitLine,
              axisLabel: {
                color: p.textTertiary,
                fontSize: 9,
                formatter: (v: number) =>
                  v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v),
              },
            },
            {
              type: 'value',
              name: t('dashboard.requestTrend'),
              nameTextStyle: { color: p.textTertiary, fontSize: 9 },
              splitLine: { show: false },
              axisLabel: {
                color: p.textTertiary,
                fontSize: 9,
                formatter: (v: number) =>
                  v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v),
              },
            },
          ],
      series: [
        ...(showConsume
          ? [
              {
                name: t('dashboard.consumeTrend'),
                type: 'line',
                smooth: mood.line.smooth,
                data: consume,
                lineStyle: { color: p.accent, ...mood.line.lineStyle },
                itemStyle: {
                  color: p.accent,
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
                    colorStops: areaGradient(p, p.accent),
                  },
                },
                showSymbol: !p.isDark,
                symbol: mood.line.symbol,
                symbolSize: mood.line.symbolSize,
                yAxisIndex: 0,
              },
            ]
          : []),
        ...(showRequests
          ? [
              {
                name: t('dashboard.requestTrend'),
                type: 'line',
                smooth: mood.line.smooth,
                data: requests,
                lineStyle: {
                  color: p.signal,
                  ...mood.line.lineStyle,
                  width: 2,
                },
                itemStyle: {
                  color: p.signal,
                  borderColor: p.surfaceSolid,
                  borderWidth: 2,
                },
                showSymbol: !p.isDark,
                symbol: mood.line.symbol,
                symbolSize: mood.line.symbolSize,
                yAxisIndex: singleAxis ? 0 : 1,
              },
            ]
          : []),
      ],
    }
  },
  [flowData, mode]
)
</script>

<template>
  <ConsoleCard stretch>
    <!-- Header row: headlines + mode toggle -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <!-- dual headlines -->
      <div class="flex items-center gap-5">
        <div>
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('dashboard.consumeTrend') }}
          </p>
          <div class="mt-0.5 flex items-center gap-2">
            <p
              class="text-xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]"
            >
              <span
                v-if="loading"
                class="inline-block h-6 w-20 animate-pulse rounded bg-[var(--surface-muted)]"
              />
              <template v-else>{{
                formatQuota(stats?.used_quota ?? 0)
              }}</template>
            </p>
            <span
              v-if="stats?.month_quota_delta !== undefined && !loading"
              class="rounded px-1.5 py-0.5 text-xs font-semibold"
              :style="
                stats.month_quota_delta >= 0
                  ? 'background:var(--status-danger-soft);color:var(--status-danger-text)'
                  : 'background:var(--status-success-soft);color:var(--status-success-text)'
              "
            >
              {{ stats.month_quota_delta >= 0 ? '↗' : '↘'
              }}{{ Math.abs(stats.month_quota_delta) }}%
            </span>
          </div>
        </div>
        <div class="h-8 w-px bg-[var(--border-subtle)]" />
        <div>
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('dashboard.requestTrend') }}
          </p>
          <div class="mt-0.5 flex items-center gap-2">
            <p
              class="text-xl font-bold tabular-nums tracking-tight text-[var(--signal)]"
            >
              <span
                v-if="loading"
                class="inline-block h-6 w-16 animate-pulse rounded bg-[var(--surface-muted)]"
              />
              <template v-else>{{
                formatNumber(stats?.total_requests ?? 0)
              }}</template>
            </p>
            <span
              v-if="stats?.month_requests_delta !== undefined && !loading"
              class="rounded px-1.5 py-0.5 text-xs font-semibold"
              :style="
                stats.month_requests_delta >= 0
                  ? 'background:var(--status-danger-soft);color:var(--status-danger-text)'
                  : 'background:var(--status-success-soft);color:var(--status-success-text)'
              "
            >
              {{ stats.month_requests_delta >= 0 ? '↗' : '↘'
              }}{{ Math.abs(stats.month_requests_delta) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- mode segmented toggle -->
      <div
        class="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5 text-xs"
      >
        <button
          v-for="opt in [
            { key: 'both', label: t('dashboard.trendBoth') },
            { key: 'consume', label: t('dashboard.consumeShort') },
            { key: 'requests', label: t('dashboard.requestsShort') },
          ] as const"
          :key="opt.key"
          type="button"
          class="rounded-lg px-3 py-1.5 font-medium transition-all focus-ring"
          :class="
            mode === opt.key
              ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          "
          @click="mode = opt.key"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Chart: h-56 is the floor; `grow` lets it take the row's surplus height -->
    <div
      v-if="loading"
      class="mt-4 h-56 grow animate-pulse rounded-xl bg-[var(--surface-muted)]"
    />
    <div
      v-else
      ref="el"
      class="mt-4 h-56 w-full grow"
      role="img"
      :aria-label="t('dashboard.consumeTrend')"
    />
  </ConsoleCard>
</template>
