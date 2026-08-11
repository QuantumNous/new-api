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
const observesVisibility =
  typeof window !== 'undefined' && 'IntersectionObserver' in window
const showcase = useHomeShowcase(startTime, {
  loadMetrics: true,
  initiallyVisible: !observesVisibility,
})

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
      :request-metrics="showcase.requestMetrics.value"
    />
  </main>
</template>
