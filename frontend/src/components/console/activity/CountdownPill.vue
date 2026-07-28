<script lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// One shared 1s ticker for every pill on the page (module scope) — the
// activity grid renders several countdowns and per-instance intervals add up.
const sharedNow = ref(Math.floor(Date.now() / 1000))
let sharedTimer: number | null = null
let subscriberCount = 0

function subscribeTicker() {
  if (subscriberCount++ === 0) {
    sharedNow.value = Math.floor(Date.now() / 1000)
    sharedTimer = window.setInterval(() => {
      sharedNow.value = Math.floor(Date.now() / 1000)
    }, 1000)
  }
}

function unsubscribeTicker() {
  if (--subscriberCount === 0 && sharedTimer !== null) {
    window.clearInterval(sharedTimer)
    sharedTimer = null
  }
}
</script>

<script setup lang="ts">
const props = defineProps<{
  end: number // epoch seconds
}>()

const { t } = useI18n()

const remain = computed(() => Math.max(0, props.end - sharedNow.value))

const parts = computed(() => {
  const s = remain.value
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
})

const label = computed(() => {
  if (remain.value <= 0) return t('activity.countdown.ended')
  const p = parts.value
  const hh = String(p.hours).padStart(2, '0')
  const mm = String(p.minutes).padStart(2, '0')
  const ss = String(p.seconds).padStart(2, '0')
  if (p.days > 0) {
    return t('activity.countdown.untilEnd', {
      days: p.days,
      time: `${hh}:${mm}:${ss}`,
    })
  }
  return t('activity.countdown.untilEndShort', { time: `${hh}:${mm}:${ss}` })
})

onMounted(subscribeTicker)
onBeforeUnmount(unsubscribeTicker)
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)]"
    aria-live="off"
  >
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
    {{ label }}
  </span>
</template>
