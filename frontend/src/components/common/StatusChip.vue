<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'
  }>(),
  { tone: 'neutral' }
)

const style = computed(() => {
  switch (props.tone) {
    case 'success':
      return 'background:var(--status-success-soft);color:var(--status-success-text);border-left:2.5px solid var(--status-success)'
    case 'warning':
      return 'background:var(--status-warning-soft);color:var(--status-warning-text);border-left:2.5px solid var(--status-warning)'
    case 'danger':
      return 'background:var(--status-danger-soft);color:var(--status-danger-text);border-left:2.5px solid var(--status-danger)'
    case 'info':
      return 'background:var(--status-info-soft);color:var(--status-info-text);border-left:2.5px solid var(--status-info)'
    case 'accent':
      return 'background:var(--accent-soft);color:var(--accent-text);border-left:2.5px solid var(--accent)'
    default:
      return 'background:var(--surface-muted);color:var(--text-tertiary);border-left:2.5px solid var(--border-default)'
  }
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
    style="border-radius:4px 6px 5px 5px/5px 4px 6px 4px"
    :style="style"
  >
    <slot />
  </span>
</template>
