<template>
  <p
    class="signal-latency-meter"
    :class="`is-${resolvedTier}`"
    :style="latencyStyle"
    :aria-label="ariaLabel"
  >
    <span
      class="signal-latency-meter__glyph"
      :class="{ 'is-pulsing': isPulsing }"
      aria-hidden="true"
    >
      <span class="signal-latency-meter__bar">▂</span>
      <span class="signal-latency-meter__bar">▅</span>
      <span class="signal-latency-meter__bar">▇</span>
    </span>
    <span class="signal-latency-meter__value">{{ latencyLabel }}</span>
  </p>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { SignalLatencyTier } from '@/constants/home/signalConsole'

const props = defineProps<{
  averageLatencyMs?: number
  tier?: SignalLatencyTier
  eventId?: number
}>()

const isPulsing = ref(false)
let pulseFrame: number | undefined
let pulseTimer: number | undefined

const resolvedTier = computed<SignalLatencyTier>(() => {
  if (props.tier) return props.tier
  const average = props.averageLatencyMs
  if (typeof average !== 'number') return 'low'
  if (average >= 260) return 'high'
  if (average >= 150) return 'elevated'
  return 'low'
})

const pulseDuration = computed(() => {
  if (resolvedTier.value === 'high') return 720
  if (resolvedTier.value === 'elevated') return 460
  return 260
})

const latencyLabel = computed(() => {
  const average = props.averageLatencyMs
  return typeof average === 'number' ? `${Math.round(average)}ms` : '--ms'
})

const ariaLabel = computed(() => {
  const average = props.averageLatencyMs
  return typeof average === 'number'
    ? `Average request latency ${Math.round(average)} milliseconds`
    : 'Average request latency pending'
})

const latencyStyle = computed(() => ({
  '--latency-wave-duration': `${pulseDuration.value}ms`,
  '--latency-wave-step': `${Math.max(44, Math.round(pulseDuration.value / 3))}ms`,
}))

function clearPulse() {
  if (pulseFrame !== undefined) window.cancelAnimationFrame(pulseFrame)
  if (pulseTimer) window.clearTimeout(pulseTimer)
  pulseFrame = undefined
  pulseTimer = undefined
  isPulsing.value = false
}

function triggerPulse() {
  clearPulse()
  pulseFrame = window.requestAnimationFrame(() => {
    pulseFrame = undefined
    isPulsing.value = true
    pulseTimer = window.setTimeout(
      () => {
        pulseTimer = undefined
        isPulsing.value = false
      },
      Math.round(pulseDuration.value * 1.75)
    )
  })
}

watch(
  () => props.eventId,
  (next, previous) => {
    if (next !== previous) triggerPulse()
  }
)

onBeforeUnmount(clearPulse)
</script>
