<script setup lang="ts">
import { ArrowUpDown } from 'lucide-vue-next'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import MiniRing from '@/components/console/dashboard/MiniRing.vue'
import MiniSparkline from '@/components/console/dashboard/MiniSparkline.vue'
import type { SystemMetrics } from '@/composables/useDashboard'
import { useAppStore } from '@/stores'

const props = defineProps<{
  metrics?: SystemMetrics | null
}>()

const { t } = useI18n()
const { phase, statusReachable, versionLabel } = storeToRefs(useAppStore())

const apiState = computed(() => {
  if (phase.value === 'ready' && statusReachable.value) {
    return {
      tone: 'success' as const,
      color: 'var(--status-success)',
      label: t('dashboard.online'),
      pulse: true,
    }
  }
  if (phase.value === 'degraded' && statusReachable.value) {
    return {
      tone: 'warning' as const,
      color: 'var(--status-warning)',
      label: t('dashboard.degraded'),
      pulse: false,
    }
  }
  if (phase.value === 'error') {
    return {
      tone: 'danger' as const,
      color: 'var(--status-danger)',
      label: t('dashboard.offline'),
      pulse: false,
    }
  }
  if (phase.value === 'loading') {
    return {
      tone: 'info' as const,
      color: 'var(--status-info)',
      label: t('dashboard.loading'),
      pulse: false,
    }
  }
  return {
    tone: 'neutral' as const,
    color: 'var(--text-tertiary)',
    label: t('dashboard.unknown'),
    pulse: false,
  }
})

/** Load thresholds: comfortable below 70%, tight from 70%, saturated from 90%. */
function loadColor(percent: number | null): string {
  if (percent === null) return 'var(--text-tertiary)'
  if (percent >= 90) return 'var(--status-danger)'
  if (percent >= 70) return 'var(--status-warning)'
  return 'var(--status-success)'
}

/** Success rate reads the other way round — high is good. */
function rateColor(percent: number | null): string {
  if (percent === null) return 'var(--text-tertiary)'
  if (percent >= 99) return 'var(--status-success)'
  if (percent >= 95) return 'var(--status-warning)'
  return 'var(--status-danger)'
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) return '--'
  const rounded = Math.round(value * 10) / 10
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

function formatBandwidth(valueMbps: number): string {
  if (!Number.isFinite(valueMbps)) return '--'
  const magnitude = Math.abs(valueMbps)
  if (magnitude >= 1) return `${formatMetric(valueMbps)} Mbps`
  if (magnitude >= 0.001) return `${formatMetric(valueMbps * 1_000)} Kbps`
  return `${formatMetric(valueMbps * 1_000_000)} bps`
}

interface MetricTile {
  key: string
  label: string
  /** lucide 24×24 path data */
  icon?: string
  value: string
  unit: string
  bandwidth?: { up: string; down: string }
  /** 0-100 usage against a ceiling; null when the metric has none */
  percent: number | null
  /** Shared-scale throughput history, for metrics with no ceiling */
  series?: { down: number[]; up: number[] }
  color: string
}

const tiles = computed<MetricTile[]>(() => {
  const m = props.metrics
  const dash = '--'

  const memPercent =
    m &&
    m.memory_total_gb !== null &&
    m.memory_total_gb > 0 &&
    m.memory_used_gb !== null
      ? Math.round((m.memory_used_gb / m.memory_total_gb) * 100)
      : null
  const diskPercent =
    m &&
    m.disk_total_gb !== null &&
    m.disk_total_gb > 0 &&
    m.disk_used_gb !== null
      ? Math.round((m.disk_used_gb / m.disk_total_gb) * 100)
      : null
  const bandwidth =
    m?.bandwidth_up_mbps !== null &&
    m?.bandwidth_up_mbps !== undefined &&
    m?.bandwidth_down_mbps !== null &&
    m?.bandwidth_down_mbps !== undefined
      ? {
          up: formatBandwidth(m.bandwidth_up_mbps),
          down: formatBandwidth(m.bandwidth_down_mbps),
        }
      : undefined

  const result: MetricTile[] = [
    {
      key: 'cpu',
      label: t('dashboard.systemStatus.cpu'),
      icon: 'M4 4h16v16H4zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3M9 9h6v6H9z',
      value:
        m?.cpu_percent !== null && m?.cpu_percent !== undefined
          ? formatMetric(m.cpu_percent)
          : dash,
      unit: m?.cpu_percent !== null && m?.cpu_percent !== undefined ? '%' : '',
      percent: m?.cpu_percent ?? null,
      color: loadColor(m?.cpu_percent ?? null),
    },
    {
      key: 'memory',
      label: t('dashboard.systemStatus.memory'),
      icon: 'M3 7h18v10H3zM7 7v10M11 7v10M15 7v10M5 17v3M19 17v3',
      value:
        m?.memory_used_gb !== null &&
        m?.memory_used_gb !== undefined &&
        m?.memory_total_gb !== null &&
        m?.memory_total_gb !== undefined
          ? `${m.memory_used_gb} / ${m.memory_total_gb}`
          : dash,
      unit:
        m?.memory_used_gb !== null &&
        m?.memory_used_gb !== undefined &&
        m?.memory_total_gb !== null &&
        m?.memory_total_gb !== undefined
          ? 'GB'
          : '',
      percent: memPercent,
      color: loadColor(memPercent),
    },
    {
      key: 'bandwidth',
      label: t('dashboard.systemStatus.bandwidth'),
      value: bandwidth ? '' : dash,
      unit: '',
      bandwidth,
      // Bandwidth has no ceiling to measure against, so instead of a bar it
      // charts recent throughput — download shaded, upload as a line.
      percent: null,
      series: m?.bandwidth_series ?? undefined,
      color: 'var(--signal)',
    },
    {
      key: 'disk',
      label: t('dashboard.systemStatus.disk'),
      icon: 'M22 12H2M5.5 16h.01M9.5 16h.01M5.45 5h13.1a2 2 0 0 1 1.79 1.11L22 12v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5l1.66-5.89A2 2 0 0 1 5.45 5z',
      value:
        m?.disk_used_gb !== null &&
        m?.disk_used_gb !== undefined &&
        m?.disk_total_gb !== null &&
        m?.disk_total_gb !== undefined
          ? `${m.disk_used_gb} / ${m.disk_total_gb}`
          : dash,
      unit:
        m?.disk_used_gb !== null &&
        m?.disk_used_gb !== undefined &&
        m?.disk_total_gb !== null &&
        m?.disk_total_gb !== undefined
          ? 'GB'
          : '',
      percent: diskPercent,
      color: loadColor(diskPercent),
    },
  ]
  return result
})

/** Success rate reads out in the header, so it is not one of the tiles. */
const successRate = computed(() => props.metrics?.api_success_rate ?? null)
const successColor = computed(() => rateColor(successRate.value))
</script>

<template>
  <ConsoleCard
    :title="t('dashboard.systemStatus.title')"
    data-system-status-card
    stretch
  >
    <!-- Success rate reads out as a ring in the header, not as a tile -->
    <template #action>
      <div class="flex items-center gap-2">
        <div class="text-right">
          <p class="text-[11px] leading-none text-[var(--text-tertiary)]">
            {{ t('dashboard.systemStatus.successRate') }}
          </p>
          <p
            class="mt-1 text-sm font-bold leading-none tabular-nums"
            :style="{ color: successColor }"
          >
            {{ successRate === null ? '--' : `${successRate}%` }}
          </p>
        </div>
        <MiniRing
          :percent="successRate ?? 0"
          :color="successColor"
          :size="34"
          :indeterminate="successRate === null"
        />
      </div>
    </template>

    <!-- API reachability: the one row backed by a live source -->
    <div
      class="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5"
      :data-status-reachable="statusReachable"
    >
      <span class="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"
          />
        </svg>
        {{ t('dashboard.systemStatus.apiService') }}
      </span>
      <span
        class="flex items-center gap-1.5 text-sm font-semibold"
        :style="{ color: apiState.color }"
      >
        <span class="relative flex h-2 w-2">
          <span
            v-if="apiState.pulse"
            class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            :style="{ background: apiState.color }"
          />
          <span
            class="relative inline-flex h-2 w-2 rounded-full"
            :style="{ background: apiState.color }"
          />
        </span>
        {{ apiState.label }}
      </span>
    </div>

    <!--
      Four resource gauges as equal panels. Every tile carries a dynamic visual gauge
      so the 2×2 grid stays square: CPU, Memory, Disk and App Traffic each display
      tailored visual dynamic meters with light/dark theme aesthetics.
    -->
    <div class="mb-4 mt-4 grid grow grid-cols-2 gap-3">
      <div
        v-for="tile in tiles"
        :key="tile.key"
        class="group relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-[var(--surface-muted)] px-3 py-2.5 transition-all duration-300 hover:bg-[var(--surface-hover)]"
      >
        <!-- Tile Header with Icon and subtle badge -->
        <div class="flex items-center justify-between gap-1.5">
          <p
            class="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]"
          >
            <ArrowUpDown
              v-if="tile.key === 'bandwidth'"
              :size="13"
              :stroke-width="1.8"
              aria-hidden="true"
              data-bandwidth-icon
            />
            <svg
              v-else-if="tile.icon"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path :d="tile.icon" />
            </svg>
            <span class="truncate">{{ tile.label }}</span>
          </p>
          <!-- Auxiliary micro badge for percent status (for metrics with ceiling like memory/disk) -->
          <span
            v-if="tile.percent !== null && tile.key !== 'cpu'"
            class="shrink-0 font-mono text-[9px] font-semibold tabular-nums opacity-80"
            :style="{ color: tile.color }"
          >
            {{ Math.round(tile.percent) }}%
          </span>
        </div>

        <!-- Metric Value Readout -->
        <p
          class="mt-1 flex items-baseline pb-1.5"
          :class="tile.bandwidth ? 'flex-wrap gap-x-2 gap-y-0.5' : 'gap-1'"
        >
          <template v-if="tile.bandwidth">
            <span
              data-bandwidth-direction="up"
              class="shrink-0 whitespace-nowrap text-sm font-bold leading-tight tabular-nums"
              :style="{ color: tile.color }"
            >
              ↑{{ tile.bandwidth.up }}
            </span>
            <span
              data-bandwidth-direction="down"
              class="shrink-0 whitespace-nowrap text-sm font-bold leading-tight tabular-nums"
              :style="{ color: tile.color }"
            >
              ↓{{ tile.bandwidth.down }}
            </span>
          </template>
          <template v-else>
            <span
              class="shrink-0 whitespace-nowrap text-base font-bold leading-tight tabular-nums tracking-tight"
              :style="{ color: tile.color }"
            >
              {{ tile.value }}
            </span>
            <span
              v-if="tile.unit"
              class="shrink-0 whitespace-nowrap text-[10px] text-[var(--text-tertiary)]"
            >
              {{ tile.unit }}
            </span>
          </template>
        </p>

        <!-- Dynamic Visualization Area -->
        <!-- Bandwidth: Smooth dual-track wave with dynamic glow & pulse points -->
        <div v-if="tile.series" class="mt-auto" aria-hidden="true">
          <MiniSparkline
            :points="tile.series.down"
            :secondary="tile.series.up"
            color="var(--glow)"
            secondary-color="var(--accent)"
            :height="26"
          />
        </div>

        <!-- Memory: Segmented dynamic fluid bar with tick marks -->
        <div
          v-else-if="tile.key === 'memory'"
          class="pencil-progress relative mt-auto flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-solid)]"
          aria-hidden="true"
        >
          <div
            v-if="tile.percent !== null"
            class="relative h-full rounded-full transition-[width] duration-700"
            :style="{
              width: `${tile.percent}%`,
              background: `linear-gradient(90deg, var(--glow) 0%, ${tile.color} 100%)`,
              boxShadow: '0 0 6px rgba(142, 200, 170, 0.25)',
            }"
          >
            <!-- Gentle light sheen in dark mode -->
            <div
              class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-sheen"
            />
          </div>
          <!-- Segment dividers for tactile scale -->
          <div
            class="pointer-events-none absolute inset-0 flex justify-between px-1"
          >
            <span
              v-for="tick in 4"
              :key="tick"
              class="h-full w-px bg-[var(--surface-muted)] opacity-60"
            />
          </div>
        </div>

        <!-- Disk: Capacity progress with warning threshold markers -->
        <div
          v-else-if="tile.key === 'disk'"
          class="pencil-progress relative mt-auto flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-solid)]"
          aria-hidden="true"
        >
          <div
            v-if="tile.percent !== null"
            class="h-full rounded-full transition-[width] duration-700"
            :style="{
              width: `${tile.percent}%`,
              background: `linear-gradient(90deg, var(--support) 0%, ${tile.color} 100%)`,
              boxShadow: '0 0 6px rgba(216, 152, 76, 0.25)',
            }"
          />
          <!-- 70% and 90% threshold indicators -->
          <span
            class="pointer-events-none absolute left-[70%] top-0 h-full w-px bg-[var(--status-warning)] opacity-40"
          />
          <span
            class="pointer-events-none absolute left-[90%] top-0 h-full w-px bg-[var(--status-danger)] opacity-40"
          />
        </div>

        <!-- CPU: Dynamic load energy gauge with active pulse beacon -->
        <div
          v-else
          class="pencil-progress relative mt-auto flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-solid)]"
          aria-hidden="true"
        >
          <div
            v-if="tile.percent !== null"
            class="relative h-full rounded-full transition-[width] duration-700"
            :style="{
              width: `${tile.percent}%`,
              background: `linear-gradient(90deg, var(--accent-soft) 0%, ${tile.color} 100%)`,
              boxShadow: '0 0 6px rgba(226, 188, 85, 0.25)',
            }"
          >
            <!-- Glowing end beacon for live CPU pulse -->
            <span
              v-if="tile.percent > 0"
              class="absolute right-0 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-white shadow-[0_0_4px_currentColor] animate-pulse-slow"
              :style="{ color: tile.color }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Version — pinned to the bottom edge when the row runs taller -->
    <div
      class="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3.5 text-xs"
    >
      <span class="flex items-center gap-1.5 text-[var(--text-tertiary)]">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01"
          />
        </svg>
        {{ t('dashboard.systemStatus.version') }}
      </span>
      <span class="font-mono text-[var(--text-secondary)]">{{
        versionLabel
      }}</span>
    </div>
  </ConsoleCard>
</template>
