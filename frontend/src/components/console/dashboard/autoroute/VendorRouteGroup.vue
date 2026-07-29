<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ChevronDown,
  CircleCheck,
  CircleHelp,
  CircleX,
  TriangleAlert,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import ChannelScoreRow from './ChannelScoreRow.vue'
import RouteHealthTimeline from './RouteHealthTimeline.vue'
import type { RouteChannelRow } from '@/composables/useAutoRoute'
import type { RouteHealthSummary } from '@/utils/routeHealth'
import { scoreBand } from '@/utils/routeScore'

const props = defineProps<{
  vendor: string
  channels: RouteChannelRow[]
  activeCount: number
  monitor: RouteHealthSummary
}>()

const { t } = useI18n()
const expanded = ref(false)

const bestScore = computed(
  () => props.channels.find((channel) => channel.score !== null)?.score ?? null
)
const bestBand = computed(() =>
  bestScore.value === null ? 'danger' : scoreBand(bestScore.value)
)

const stateMeta = computed(() => {
  switch (props.monitor.state) {
    case 'healthy':
      return { icon: CircleCheck, tone: 'success' }
    case 'degraded':
      return { icon: TriangleAlert, tone: 'warning' }
    case 'down':
      return { icon: CircleX, tone: 'danger' }
    default:
      return { icon: CircleHelp, tone: 'info' }
  }
})

const availabilityLabel = computed(() =>
  props.monitor.availability === null
    ? t('dashboard.autoRoute.availabilityUnknown')
    : t('dashboard.autoRoute.availability1h', {
        value: props.monitor.availability.toFixed(2),
      })
)
</script>

<template>
  <ConsoleCard>
    <button
      type="button"
      class="focus-ring flex w-full flex-wrap items-center gap-2 rounded-lg text-left sm:gap-3"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        :style="{
          background: `var(--status-${stateMeta.tone}-soft)`,
          color: `var(--status-${stateMeta.tone}-text)`,
        }"
      >
        <component :is="stateMeta.icon" :size="17" aria-hidden="true" />
      </span>

      <VendorLogo :vendor="vendor" :size="28" />
      <span class="min-w-28 flex-1">
        <span
          class="block truncate text-sm font-semibold text-[var(--text-primary)]"
        >
          {{ vendor }}
        </span>
        <span class="mt-0.5 block text-xs text-[var(--text-tertiary)]">
          {{
            t('dashboard.autoRoute.activeChannelCount', {
              active: activeCount,
              total: channels.length,
            })
          }}
          · {{ t(`dashboard.autoRoute.monitorState.${monitor.state}`) }}
        </span>
      </span>

      <span
        v-if="bestScore !== null"
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold tabular-nums"
        :style="{
          background: `var(--status-${bestBand}-soft)`,
          color: `var(--status-${bestBand}-text)`,
        }"
        :title="t('dashboard.autoRoute.topScore')"
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :style="{ background: `var(--status-${bestBand})` }"
        />
        {{ bestScore }}
      </span>

      <span
        class="shrink-0 font-mono text-xs font-semibold tabular-nums text-[var(--text-secondary)]"
      >
        {{ availabilityLabel }}
      </span>
      <ChevronDown
        :size="16"
        class="shrink-0 text-[var(--text-tertiary)] transition-transform"
        :class="{ 'rotate-180': expanded }"
        aria-hidden="true"
      />
    </button>

    <RouteHealthTimeline class="mt-4" :checks="monitor.checks" />

    <div v-if="expanded" class="mt-3 divide-y divide-[var(--border-subtle)]">
      <ChannelScoreRow
        v-for="channel in channels"
        :key="channel.id"
        :entry="channel"
      />
    </div>
  </ConsoleCard>
</template>
