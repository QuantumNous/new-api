<template>
  <span class="relative flex h-2 w-2" aria-hidden="true">
    <span
      v-if="phase === 'ready'"
      class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
      style="background: var(--status-success)"
    />
    <span
      class="relative inline-flex h-2 w-2 rounded-full"
      :style="{ background: color }"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useAppStore } from '@/stores'

const { phase } = storeToRefs(useAppStore())
const color = computed(() => {
  if (phase.value === 'ready') return 'var(--status-success)'
  if (phase.value === 'degraded') return 'var(--status-warning)'
  if (phase.value === 'error') return 'var(--status-danger)'
  return 'var(--text-tertiary)'
})
</script>
