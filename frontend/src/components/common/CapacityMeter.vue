<script setup lang="ts">
import { computed } from 'vue'

/**
 * Shared used-of-total meter. The threshold policy lives here only, so channel
 * capacity and user quota can never drift apart: signal below 80%, warning from
 * 80%, danger once the allowance is exhausted.
 */
const props = withDefaults(
  defineProps<{
    used: number
    total: number
    /** Renders raw counts by default; pass formatQuota for money-like values. */
    format?: (value: number) => string
    minWidth?: string
  }>(),
  { format: (value: number) => String(value), minWidth: '92px' }
)

const percent = computed(() => {
  if (props.total <= 0) return 0
  return Math.min(100, Math.max(0, (props.used / props.total) * 100))
})

const color = computed(() => {
  if (percent.value >= 100) return 'var(--status-danger)'
  if (percent.value >= 80) return 'var(--status-warning)'
  return 'var(--signal)'
})
</script>

<template>
  <div :style="{ minWidth }">
    <div
      class="flex items-center justify-between gap-2 font-mono text-xs tabular-nums"
    >
      <span class="text-[var(--text-primary)]">
        {{ format(used) }}/{{ format(total) }}
      </span>
      <span class="text-[10px] text-[var(--text-tertiary)]">
        {{ Math.round(percent) }}%
      </span>
    </div>
    <div
      class="pencil-progress mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"
      aria-hidden="true"
    >
      <div
        class="h-full rounded-full transition-[width]"
        :style="{ width: `${percent}%`, background: color }"
      />
    </div>
  </div>
</template>
