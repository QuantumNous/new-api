<script setup lang="ts">
import { computed } from 'vue'

/**
 * Metric tile for the orders overview. The icon plate is the only coloured
 * surface, so four tiles sit side by side without competing with the chart
 * below them. Every tone maps to a `--status-*` / `--accent` pair that exists
 * in both themes — there is no bespoke palette here.
 */
const props = withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    tone?: 'success' | 'info' | 'accent' | 'warning'
    loading?: boolean
  }>(),
  { hint: '', tone: 'accent', loading: false }
)

const plate = computed(() => {
  switch (props.tone) {
    case 'success':
      return 'background:var(--status-success-soft);color:var(--status-success-text)'
    case 'info':
      return 'background:var(--status-info-soft);color:var(--status-info-text)'
    case 'warning':
      return 'background:var(--status-warning-soft);color:var(--status-warning-text)'
    default:
      return 'background:var(--accent-soft);color:var(--accent-text)'
  }
})
</script>

<template>
  <section
    class="sketch-card flex items-center gap-3.5 border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4"
  >
    <span
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
      :style="plate"
      aria-hidden="true"
    >
      <slot name="icon" />
    </span>
    <div class="min-w-0">
      <p class="truncate text-xs text-[var(--text-tertiary)]">{{ label }}</p>
      <p
        v-if="loading"
        class="mt-1.5 h-7 w-24 animate-pulse rounded bg-[var(--surface-muted)]"
      />
      <p
        v-else
        class="mt-0.5 truncate text-2xl font-bold tracking-tight text-[var(--text-primary)]"
        :title="value"
      >
        {{ value }}
      </p>
      <p
        v-if="hint && !loading"
        class="mt-0.5 truncate text-xs text-[var(--text-tertiary)]"
      >
        {{ hint }}
      </p>
    </div>
  </section>
</template>
