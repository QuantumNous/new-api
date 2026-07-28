<script setup lang="ts">
import { computed } from 'vue'
import type { MerchantScale } from '@/types/console'

/**
 * Merchant-scale badge following the tri-color system (THEMES.md §1.1):
 *   platform → solid --accent (official, highest emphasis)
 *   empire   → --accent-soft tint
 *   studio   → --support 16% tint (no dedicated *-soft token; same alpha as
 *              --accent-soft / --status-*-soft, via color-mix())
 *   workshop → --signal-soft tint
 *   vendor   → neutral muted surface
 */
const props = defineProps<{
  scale: MerchantScale
}>()

const style = computed((): string => {
  switch (props.scale) {
    case 'platform':
      return 'background:var(--accent);color:var(--accent-contrast)'
    case 'empire':
      return 'background:var(--accent-soft);color:var(--accent-text)'
    case 'studio':
      return 'background:color-mix(in srgb,var(--support) 16%,transparent);color:var(--support-strong)'
    case 'workshop':
      return 'background:var(--signal-soft);color:var(--signal-strong)'
    case 'vendor':
      return 'background:var(--surface-muted);color:var(--text-secondary)'
    default:
      return 'background:var(--surface-muted);color:var(--text-secondary)'
  }
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
    :style="style"
  >
    <slot />
  </span>
</template>
