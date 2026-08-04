<script setup lang="ts">
import { computed } from 'vue'
import { CircleOff, Crown, HeartPulse, Percent, Timer } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import MiniRing from '@/components/console/dashboard/MiniRing.vue'
import type { RouteChannelRow } from '@/composables/useAutoRoute'
import { routeHealthStateFromValue } from '@/utils/routeHealth'
import { scoreBand, WEIGHTS } from '@/utils/routeScore'

const props = defineProps<{
  entry: RouteChannelRow
}>()

const { t } = useI18n()
const HEALTH_SEGMENTS = 10

function latencyLabel(ms: number): string {
  if (ms === 0) return t('dashboard.autoRoute.untested')
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

const isRanked = computed(
  () =>
    props.entry.rank !== null &&
    props.entry.score !== null &&
    props.entry.breakdown !== null
)
const healthBand = computed(() => routeHealthStateFromValue(props.entry.health))
const healthTone = computed(() => {
  if (healthBand.value === 'healthy') return 'success'
  if (healthBand.value === 'degraded') return 'warning'
  if (healthBand.value === 'down') return 'danger'
  return 'info'
})
const healthColor = computed(() =>
  healthBand.value === 'unknown'
    ? 'var(--text-tertiary)'
    : `var(--status-${healthTone.value})`
)
const healthFilled = computed(() =>
  Math.max(
    0,
    Math.min(
      HEALTH_SEGMENTS,
      Math.round((props.entry.health / 100) * HEALTH_SEGMENTS)
    )
  )
)
const scoreColor = computed(() =>
  props.entry.score === null
    ? 'var(--text-tertiary)'
    : `var(--status-${scoreBand(props.entry.score)})`
)
const inactiveLabel = computed(() =>
  props.entry.status === 3
    ? t('dashboard.autoRoute.autoDisabled')
    : t('dashboard.autoRoute.manuallyDisabled')
)

const FACTORS = [
  { key: 'latency', label: 'factorLatency', opacity: 1 },
  { key: 'health', label: 'factorHealth', opacity: 0.85 },
  { key: 'cost', label: 'factorCost', opacity: 0.7 },
  { key: 'quota', label: 'factorQuota', opacity: 0.55 },
  { key: 'weight', label: 'factorWeight', opacity: 0.4 },
  { key: 'priority', label: 'factorPriority', opacity: 0.28 },
] as const

const segments = computed(() => {
  if (!props.entry.breakdown) return []
  return FACTORS.map((factor) => {
    const value = props.entry.breakdown![factor.key]
    const points = value * WEIGHTS[factor.key] * 100
    return {
      key: factor.key,
      points,
      opacity: factor.opacity,
      title: t('dashboard.autoRoute.factorContribution', {
        factor: t(`dashboard.autoRoute.${factor.label}`),
        value: value.toFixed(2),
        weight: Math.round(WEIGHTS[factor.key] * 100),
        points: points.toFixed(1),
      }),
    }
  })
})
</script>

<template>
  <div
    class="flex items-center gap-2 py-3 first:pt-0 sm:gap-3"
    data-route-channel
  >
    <span
      v-if="entry.rank === 1"
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]"
      :title="t('dashboard.autoRoute.groupBest')"
    >
      <Crown :size="13" aria-hidden="true" />
      <span class="sr-only">{{ t('dashboard.autoRoute.groupBest') }}</span>
    </span>
    <span
      v-else-if="entry.rank !== null"
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--text-tertiary)]"
    >
      {{ entry.rank }}
    </span>
    <span
      v-else
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--status-danger-soft)] text-[var(--status-danger-text)]"
      :title="inactiveLabel"
    >
      <CircleOff :size="13" aria-hidden="true" />
      <span class="sr-only">{{ inactiveLabel }}</span>
    </span>

    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex min-w-0 items-center justify-between gap-2">
        <p
          class="min-w-0 truncate text-sm font-medium text-[var(--text-primary)]"
        >
          {{ entry.name }}
        </p>
        <span class="flex shrink-0 items-center gap-2">
          <span
            class="flex items-center gap-1 text-[11px] tabular-nums text-[var(--text-tertiary)] sm:text-xs"
            :title="t('dashboard.autoRoute.factorLatency')"
          >
            <Timer :size="12" aria-hidden="true" />
            {{ latencyLabel(entry.latency) }}
          </span>
          <span
            class="flex items-center gap-1 font-mono text-[11px] text-[var(--text-tertiary)] sm:text-xs"
            :title="t('dashboard.autoRoute.cost')"
          >
            <Percent :size="12" aria-hidden="true" />
            {{ (entry.upstreamMult * entry.channelMult).toFixed(2) }}×
          </span>
        </span>
      </div>

      <div class="flex items-center gap-2">
        <HeartPulse
          :size="12"
          class="shrink-0 text-[var(--text-tertiary)]"
          aria-hidden="true"
        />
        <div
          class="grid min-w-24 max-w-64 flex-1 grid-cols-10 gap-0.5"
          role="img"
          :aria-label="`${t('dashboard.autoRoute.health')} ${entry.health}%`"
          data-channel-health-meter
        >
          <span
            v-for="index in HEALTH_SEGMENTS"
            :key="index"
            class="h-2 rounded-sm"
            :style="{
              background:
                index <= healthFilled ? healthColor : 'var(--surface-muted)',
            }"
            data-channel-health-segment
          />
        </div>
        <span
          class="w-9 shrink-0 text-right text-[10px] font-semibold tabular-nums"
          :style="{ color: healthColor }"
        >
          {{ entry.health }}%
        </span>
      </div>

      <div
        v-if="isRanked"
        class="pencil-progress flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-[var(--surface-muted)]"
        role="img"
        :aria-label="`${t('dashboard.autoRoute.breakdownLabel')} ${entry.score}`"
      >
        <div
          v-for="segment in segments"
          :key="segment.key"
          class="h-full shrink-0"
          :style="{
            width: `${segment.points}%`,
            background: 'var(--accent)',
            opacity: segment.opacity,
          }"
          :title="segment.title"
        />
      </div>
      <p v-else class="text-[10px] font-medium text-[var(--text-tertiary)]">
        {{ inactiveLabel }} · {{ t('dashboard.autoRoute.excluded') }}
      </p>
    </div>

    <MiniRing
      v-if="entry.score !== null"
      :percent="entry.score"
      :color="scoreColor"
      :size="40"
      role="img"
      :aria-label="`${t('dashboard.autoRoute.score')} ${entry.score}`"
    >
      <span
        class="text-xs font-bold tabular-nums"
        :style="{ color: scoreColor }"
      >
        {{ entry.score }}
      </span>
    </MiniRing>
    <span
      v-else
      class="max-w-20 shrink-0 text-right text-[10px] font-semibold text-[var(--status-danger-text)]"
    >
      {{ inactiveLabel }}
    </span>
  </div>
</template>
