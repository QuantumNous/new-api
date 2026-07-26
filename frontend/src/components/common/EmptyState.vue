<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    hint?: string
    /**
     * Legacy asset URL (detected by a `/`); any other value falls back to
     * the built-in hand-drawn sketch.
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
    <!-- Hand-drawn line-art empty box illustration: rough strokes, sketch feel -->
    <svg
      v-else
      width="120"
      height="100"
      viewBox="0 0 120 100"
      fill="none"
      aria-hidden="true"
    >
      <!-- ground shadow: soft ellipse -->
      <ellipse cx="60" cy="92" rx="32" ry="5" fill="var(--surface-muted)" />
      <!-- box body: slightly irregular rect for hand-drawn feel -->
      <path
        d="M28 42 Q27 40 29 38 L91 38 Q93 39 92 42 L87 82 Q86.5 86 82 86 H38 Q33.5 86 33 82 Z"
        fill="var(--surface-muted)"
        stroke="var(--border-default)"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- box flap: top opening panel -->
      <path
        d="M29 38 L37 24 H83 L91 38"
        fill="var(--surface-raised)"
        stroke="var(--border-default)"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- center label on flap: hand-drawn horizontal lines -->
      <line
        x1="48"
        y1="29"
        x2="72"
        y2="29"
        stroke="var(--border-subtle)"
        stroke-width="2"
        stroke-linecap="round"
      />
      <line
        x1="52"
        y1="34"
        x2="68"
        y2="34"
        stroke="var(--border-subtle)"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <!-- inner question mark (hand-drawn): stroke path -->
      <path
        d="M55 58 Q55 52 60 52 Q65 52 65 57 Q65 61 60 63"
        stroke="var(--text-tertiary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
        opacity="0.6"
      />
      <circle
        cx="60"
        cy="68"
        r="1.5"
        fill="var(--text-tertiary)"
        opacity="0.6"
      />
      <!-- decorative small leaf sprout top-right -->
      <path
        d="M95 20 Q98 14 104 16 Q99 22 95 20Z"
        fill="var(--dec-leaf)"
        stroke="var(--dec-leaf)"
        stroke-width="0.5"
      />
      <line
        x1="95"
        y1="20"
        x2="95"
        y2="30"
        stroke="var(--dec-leaf)"
        stroke-width="1.2"
        stroke-linecap="round"
        opacity="0.7"
      />
    </svg>

    <p
      class="display-title mt-5 text-base font-semibold text-[var(--text-primary)]"
    >
      {{ title }}
    </p>
    <p
      v-if="hint"
      class="mt-1.5 text-sm leading-relaxed text-[var(--text-tertiary)]"
    >
      {{ hint }}
    </p>
    <slot />
  </div>
</template>
