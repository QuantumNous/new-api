<script setup lang="ts">
import { computed } from 'vue'
import { Crown, HeartPulse, Percent, Timer, Wallet } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import MiniRing from '@/components/console/dashboard/MiniRing.vue'
import type { ScoredChannel } from '@/composables/useAutoRoute'
import { formatMoney } from '@/utils/format'
import { scoreBand, WEIGHTS } from '@/utils/routeScore'

const props = defineProps<{
  channel: ScoredChannel
  rank: number
}>()

const { t } = useI18n()

/** Colour a 0-1 normalised factor value. */
function factorTone(value: number): string {
  if (value >= 0.7) return 'var(--status-success)'
  if (value >= 0.4) return 'var(--status-warning)'
  return 'var(--status-danger)'
}

function latencyLabel(ms: number): string {
  if (ms === 0) return t('dashboard.autoRoute.untested')
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

const scoreColor = computed(
  () => `var(--status-${scoreBand(props.channel.score)})`
)

/** Fixed factor order; opacity steps keep the accent-coloured segments
 *  distinguishable without misusing status hues as category colours. */
const FACTORS = [
  { key: 'latency', label: 'factorLatency', opacity: 1 },
  { key: 'health', label: 'factorHealth', opacity: 0.85 },
  { key: 'cost', label: 'factorCost', opacity: 0.7 },
  { key: 'quota', label: 'factorQuota', opacity: 0.55 },
  { key: 'weight', label: 'factorWeight', opacity: 0.4 },
  { key: 'priority', label: 'factorPriority', opacity: 0.28 },
] as const

/** Segment width in % of the track equals the factor's score-point
 *  contribution, so the filled length reads as the composite score. */
const segments = computed(() =>
  FACTORS.map((factor) => {
    const value = props.channel.breakdown[factor.key]
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
)
</script>

<template>
  <div class="flex items-center gap-3 py-3 first:pt-0">
    <!-- rank badge: the group's best channel wears the crown -->
    <span
      v-if="rank === 1"
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]"
      :title="t('dashboard.autoRoute.groupBest')"
    >
      <Crown :size="13" aria-hidden="true" />
      <span class="sr-only">{{ t('dashboard.autoRoute.groupBest') }}</span>
    </span>
    <span
      v-else
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--text-tertiary)]"
    >
      {{ rank }}
    </span>

    <div class="min-w-0 flex-1 space-y-1.5">
      <!-- name + icon metrics -->
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <p class="truncate text-sm font-medium text-[var(--text-primary)]">
          {{ channel.name }}
        </p>
        <span
          class="flex items-center gap-1 text-xs tabular-nums text-[var(--text-tertiary)]"
          :title="t('dashboard.autoRoute.factorLatency')"
        >
          <Timer :size="12" aria-hidden="true" />
          {{ latencyLabel(channel.latency) }}
        </span>
        <span
          class="flex items-center gap-1 font-mono text-xs text-[var(--text-tertiary)]"
          :title="t('dashboard.autoRoute.cost')"
        >
          <Percent :size="12" aria-hidden="true" />
          {{ (channel.upstreamMult * channel.channelMult).toFixed(2) }}×
        </span>
        <span
          class="flex items-center gap-1 text-xs tabular-nums text-[var(--text-tertiary)]"
          :title="t('dashboard.autoRoute.quota')"
        >
          <Wallet :size="12" aria-hidden="true" />
          {{ formatMoney(channel.quota) }}
        </span>
      </div>

      <!-- health bar -->
      <div
        class="flex items-center gap-1.5"
        :title="t('dashboard.autoRoute.health')"
      >
        <HeartPulse
          :size="12"
          class="shrink-0 text-[var(--text-tertiary)]"
          aria-hidden="true"
        />
        <div
          class="h-1.5 max-w-56 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          role="img"
          :aria-label="`${t('dashboard.autoRoute.health')} ${channel.health}%`"
        >
          <div
            class="h-full rounded-full transition-[width]"
            :style="{
              width: `${channel.health}%`,
              background: factorTone(channel.breakdown.health),
            }"
          />
        </div>
        <span
          class="w-8 shrink-0 text-right text-[10px] font-medium tabular-nums"
          :style="{ color: factorTone(channel.breakdown.health) }"
        >
          {{ channel.health }}%
        </span>
      </div>

      <!-- weighted contribution bar: filled length = composite score -->
      <div
        class="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-[var(--surface-muted)]"
        role="img"
        :aria-label="`${t('dashboard.autoRoute.breakdownLabel')} ${channel.score}`"
      >
        <div
          v-for="seg in segments"
          :key="seg.key"
          class="h-full shrink-0"
          :style="{
            width: `${seg.points}%`,
            background: 'var(--accent)',
            opacity: seg.opacity,
          }"
          :title="seg.title"
        />
      </div>
    </div>

    <!-- composite score ring -->
    <MiniRing
      :percent="channel.score"
      :color="scoreColor"
      :size="40"
      role="img"
      :aria-label="`${t('dashboard.autoRoute.score')} ${channel.score}`"
    >
      <span
        class="text-xs font-bold tabular-nums"
        :style="{ color: scoreColor }"
      >
        {{ channel.score }}
      </span>
    </MiniRing>
  </div>
</template>
