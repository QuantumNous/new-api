<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { storeToRefs } from 'pinia'

import { useHomeShowcase } from '@/composables/useHomeShowcase'
import { useAppStore } from '@/stores'

import RuntimePulseBand from './RuntimePulseBand.vue'

const root = ref<HTMLElement | null>(null)
const app = useAppStore()
const { uptimeLabel, startTime } = storeToRefs(app)
const showcase = useHomeShowcase(startTime)

if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
  showcase.setSectionVisible(false)
}

const { stop } = useIntersectionObserver(
  root,
  ([entry]) => showcase.setSectionVisible(Boolean(entry?.isIntersecting)),
  { threshold: 0 }
)

onBeforeUnmount(stop)
</script>

<template>
  <main ref="root" class="home-showcase no-handdrawn">
    <RuntimePulseBand
      :runtime="showcase.runtime.value"
      :uptime-label="uptimeLabel"
    />
  </main>
</template>
