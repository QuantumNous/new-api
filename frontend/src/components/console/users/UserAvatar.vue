<script setup lang="ts">
import { computed } from 'vue'

/**
 * Same recipe as the topbar's UserMenu avatar (accent-soft plate, accent-text
 * initial) so one identity reads identically in both places. Decorative only —
 * the username always sits beside it, so no accessible name is needed here.
 */
const props = withDefaults(
  defineProps<{
    username: string
    displayName?: string
    size?: number
  }>(),
  { displayName: '', size: 32 }
)

const initial = computed(() =>
  (props.displayName || props.username || 'U').slice(0, 1).toUpperCase()
)

const boxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.4)}px`,
  background: 'var(--accent-soft)',
  color: 'var(--accent-text)',
}))
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
    :style="boxStyle"
    aria-hidden="true"
  >
    {{ initial }}
  </span>
</template>
