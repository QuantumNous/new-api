<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RouteHealthCheck, RouteHealthState } from '@/utils/routeHealth'

const props = defineProps<{
  checks: RouteHealthCheck[]
}>()

const { t, locale } = useI18n()

const stateColor: Record<RouteHealthState, string> = {
  healthy: 'var(--status-success)',
  degraded: 'var(--status-warning)',
  down: 'var(--status-danger)',
  unknown: 'var(--surface-muted)',
}

function stateLabel(state: RouteHealthState): string {
  return t(`dashboard.autoRoute.monitorState.${state}`)
}

function checkLabel(check: RouteHealthCheck): string {
  const time = new Date(check.timestamp * 1000).toLocaleTimeString(
    locale.value,
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  )
  return t('dashboard.autoRoute.monitorCheck', {
    time,
    state: stateLabel(check.state),
  })
}

const summaryLabel = computed(() => {
  const counts: Record<RouteHealthState, number> = {
    healthy: 0,
    degraded: 0,
    down: 0,
    unknown: 0,
  }
  props.checks.forEach((check) => counts[check.state]++)
  return t('dashboard.autoRoute.monitorSummary', counts)
})
</script>

<template>
  <div
    class="grid grid-cols-6 gap-1.5"
    role="img"
    :aria-label="summaryLabel"
    data-route-health-timeline
  >
    <span
      v-for="check in checks"
      :key="check.timestamp"
      class="h-6 min-w-0 rounded-md border transition-colors sm:h-7"
      :class="
        check.state === 'unknown'
          ? 'border-[var(--border-subtle)]'
          : 'border-transparent'
      "
      :style="{ background: stateColor[check.state] }"
      :title="checkLabel(check)"
      :aria-label="checkLabel(check)"
      data-route-health-cell
    />
  </div>
</template>
