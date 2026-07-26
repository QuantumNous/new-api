<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { vendorLogoMeta } from '@/constants/console'

const props = withDefaults(
  defineProps<{
    vendor: string
    size?: number
  }>(),
  { size: 40 }
)

/** Deterministic token pairing so a vendor always gets the same swatch.
 *  Only semantic tokens are used — swaps cleanly across both themes. */
const palettes = [
  { bg: 'var(--accent-soft)', fg: 'var(--accent-text)' },
  { bg: 'var(--status-info-soft)', fg: 'var(--status-info-text)' },
  { bg: 'var(--status-success-soft)', fg: 'var(--status-success-text)' },
  { bg: 'var(--status-warning-soft)', fg: 'var(--status-warning-text)' },
  { bg: 'var(--status-danger-soft)', fg: 'var(--status-danger-text)' },
]

const imageFailed = ref(false)
const logo = computed(() => vendorLogoMeta[props.vendor])
const showLogo = computed(() => logo.value != null && !imageFailed.value)

watch(
  () => props.vendor,
  () => {
    imageFailed.value = false
  }
)

const swatch = computed(() => {
  let hash = 0
  for (let i = 0; i < props.vendor.length; i++) {
    hash = (hash * 31 + props.vendor.charCodeAt(i)) | 0
  }
  return palettes[Math.abs(hash) % palettes.length]
})

/** First alphanumeric char (handles CJK vendor names gracefully). */
const initial = computed(() => props.vendor.trim().charAt(0).toUpperCase())
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-subtle)] font-bold"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      background: showLogo
        ? logo?.darkSurface
          ? 'var(--signal-deep)'
          : 'var(--surface-solid)'
        : swatch.bg,
      color: swatch.fg,
      fontSize: `${Math.round(size * 0.42)}px`,
    }"
    aria-hidden="true"
  >
    <img
      v-if="showLogo"
      :src="logo?.src"
      alt=""
      class="h-[68%] w-[68%] object-contain"
      :class="logo?.monochrome ? 'dark:invert' : undefined"
      @error="imageFailed = true"
    />
    <template v-else>{{ initial }}</template>
  </span>
</template>
