<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    hint?: string
    /**
     * Legacy asset URL (detected by a `/`); any other value falls back to
     * the built-in box sketch.
     */
    illustration?: string
  }>(),
  { hint: '', illustration: '' }
)

const isUrl = computed(() => props.illustration.includes('/'))
const imageFailed = ref(false)
watch(
  () => props.illustration,
  () => {
    imageFailed.value = false
  }
)
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
    <img
      v-if="isUrl && !imageFailed"
      :src="illustration"
      alt=""
      aria-hidden="true"
      class="h-32 w-auto max-w-60 select-none object-contain"
      @error="imageFailed = true"
    />
    <svg
      v-else
      width="120"
      height="96"
      viewBox="0 0 120 96"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="60" cy="86" rx="34" ry="6" fill="var(--surface-muted)" />
      <path
        d="M30 38h60l-5 40a6 6 0 0 1-6 5H41a6 6 0 0 1-6-5l-5-40Z"
        fill="var(--surface-muted)"
        stroke="var(--border-default)"
        stroke-width="2"
      />
      <path
        d="M30 38l8-14h44l8 14"
        fill="none"
        stroke="var(--border-default)"
        stroke-width="2"
      />
      <rect
        x="46"
        y="18"
        width="28"
        height="6"
        rx="3"
        fill="var(--border-subtle)"
      />
      <rect
        x="50"
        y="10"
        width="20"
        height="5"
        rx="2.5"
        fill="var(--border-subtle)"
      />
    </svg>
    <p class="mt-4 text-base font-semibold text-[var(--text-primary)]">
      {{ title }}
    </p>
    <p v-if="hint" class="mt-1 text-sm text-[var(--text-tertiary)]">
      {{ hint }}
    </p>
    <slot />
  </div>
</template>
