<script setup lang="ts">
import StatusChip from '@/components/common/StatusChip.vue'
import type { LogItem } from '@/types/console'
import { computed } from 'vue'

import {
  formatReasoningEffort,
  getLogMetadata,
  type LogReasoningEffort,
} from './logMetadata'

const props = defineProps<{
  log: LogItem
  mobile?: boolean
}>()

const effortTone: Record<
  LogReasoningEffort,
  'neutral' | 'info' | 'warning' | 'accent' | 'danger'
> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  xHigh: 'accent',
  max: 'danger',
}

const effort = computed(() =>
  formatReasoningEffort(getLogMetadata(props.log).reasoningEffort)
)

function effortKnown(value: string): value is LogReasoningEffort {
  return value in effortTone
}

function effortToneFor(value: string) {
  return effortKnown(value) ? effortTone[value] : 'neutral'
}
</script>

<template>
  <span
    data-log-reasoning-effort
    class="inline-flex min-w-0 max-w-full items-center"
    :class="mobile ? 'text-xs' : 'text-[11px]'"
    :title="effort"
  >
    <StatusChip v-if="effortKnown(effort)" :tone="effortToneFor(effort)">
      {{ effort }}
    </StatusChip>
    <span v-else class="truncate text-[var(--text-tertiary)]">
      {{ effort }}
    </span>
  </span>
</template>
