<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

/**
 * Progress ring geometry, shared by the rate-limit gauge and the API
 * success-rate readout. Purely presentational: thresholds and any hover detail
 * belong to the caller, which knows what the number means.
 */
const props = withDefaults(
  defineProps<{
    /** 0-100 */
    percent: number
    color: string
    size?: number
    /** Dashed full ring instead of an arc — for "no ceiling" style states. */
    indeterminate?: boolean
    /** Accessible name for a standalone ring; omit when decorative. */
    ariaLabel?: string
  }>(),
  { size: 44, indeterminate: false, ariaLabel: undefined }
)

const stroke = computed(() => (props.size >= 40 ? 4 : 3))
const center = computed(() => props.size / 2)
const radius = computed(() => center.value - stroke.value / 2 - 1)
const circumference = computed(() => 2 * Math.PI * radius.value)

const clamped = computed(() => Math.min(100, Math.max(0, props.percent)))
const dashOffset = computed(
  () => circumference.value * (1 - clamped.value / 100)
)
</script>

<template>
  <span
    class="relative inline-flex shrink-0"
    :role="ariaLabel ? 'img' : undefined"
    :aria-label="ariaLabel"
  >
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      aria-hidden="true"
    >
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        stroke="var(--surface-muted)"
        :stroke-width="stroke"
      />
      <circle
        v-if="!indeterminate"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :transform="`rotate(-90 ${center} ${center})`"
        class="transition-[stroke-dashoffset] duration-700"
      />
      <circle
        v-else
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        stroke-dasharray="3 4"
        opacity="0.7"
      />
    </svg>
    <span
      v-if="$slots.default"
      class="absolute inset-0 flex items-center justify-center"
    >
      <slot />
    </span>
  </span>
</template>
