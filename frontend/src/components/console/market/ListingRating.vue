<script setup lang="ts">
import { computed } from 'vue'

/** Compact star rating. The gold star uses --status-warning per theme rules. */
const props = withDefaults(
  defineProps<{
    value: number // 0–5
    count?: number
    showCount?: boolean
  }>(),
  { count: 0, showCount: true }
)

const rounded = computed(() => Math.round(props.value * 10) / 10)
</script>

<template>
  <span class="inline-flex items-center gap-1 text-xs">
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="var(--status-warning)"
      aria-hidden="true"
    >
      <path
        d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2Z"
      />
    </svg>
    <span class="font-semibold text-[var(--text-primary)]">{{
      rounded.toFixed(1)
    }}</span>
    <span v-if="showCount && count" class="text-[var(--text-tertiary)]"
      >({{ count }})</span
    >
  </span>
</template>
