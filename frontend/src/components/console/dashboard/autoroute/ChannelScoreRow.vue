<script setup lang="ts">
import { computed } from 'vue'
import { CircleDollarSign, CircleOff, Crown, Timer } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import MiniRing from '@/components/console/dashboard/MiniRing.vue'
import type { RouteChannelRow } from '@/composables/useAutoRoute'
import { scoreBand, WEIGHTS } from '@/utils/routeScore'

const props = defineProps<{
  entry: RouteChannelRow
}>()

const { t } = useI18n()
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
  { key: 'quota', label: 'factorQuota', opacity: 0.75 },
  { key: 'weight', label: 'factorWeight', opacity: 0.5 },
  { key: 'priority', label: 'factorPriority', opacity: 0.3 },
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
            :title="t('dashboard.autoRoute.factorQuota')"
            data-route-balance
          >
            <CircleDollarSign :size="12" aria-hidden="true" />
            {{ entry.quota.toFixed(2) }}
          </span>
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
