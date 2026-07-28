<template>
  <div
    v-if="canScroll"
    class="scroll-activity-indicator"
    :class="{ 'is-visible': isVisible }"
    aria-hidden="true"
  >
    <span class="scroll-activity-indicator__track" />
    <span class="scroll-activity-indicator__thumb" :style="thumbStyle" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const canScroll = ref(false)
const isVisible = ref(false)
const thumbHeight = ref(0)
const thumbOffset = ref(0)

let hideTimer: number | undefined
let frameId: number | undefined
let resizeObserver: ResizeObserver | undefined
let visualViewport: VisualViewport | undefined

const thumbStyle = computed(() => ({
  height: `${thumbHeight.value}px`,
  transform: `translate3d(0, ${thumbOffset.value}px, 0)`,
}))

function getDocumentMetrics() {
  const scrollRoot = document.scrollingElement ?? document.documentElement
  const viewportHeight = scrollRoot.clientHeight
  const documentHeight = scrollRoot.scrollHeight

  return { documentHeight, scrollRoot, viewportHeight }
}

function updateMetrics() {
  const { documentHeight, scrollRoot, viewportHeight } = getDocumentMetrics()
  const maxScroll = Math.max(documentHeight - viewportHeight, 0)

  canScroll.value = maxScroll > 1
  if (!canScroll.value || viewportHeight <= 0) {
    thumbHeight.value = 0
    thumbOffset.value = 0
    return
  }

  // A restrained minimum keeps the rail legible on the long landing page
  // without making it look like a second UI control.
  const nextHeight = Math.min(
    viewportHeight,
    Math.max(42, Math.round(viewportHeight * (viewportHeight / documentHeight)))
  )
  const currentScroll = Math.min(
    Math.max(window.scrollY || scrollRoot.scrollTop, 0),
    maxScroll
  )

  thumbHeight.value = nextHeight
  thumbOffset.value = Math.round(
    (currentScroll / maxScroll) * (viewportHeight - nextHeight)
  )
}

function cancelHide() {
  if (hideTimer === undefined) return
  window.clearTimeout(hideTimer)
  hideTimer = undefined
}

function scheduleMetrics() {
  if (frameId !== undefined) return

  frameId = window.requestAnimationFrame(() => {
    frameId = undefined
    updateMetrics()
  })
}

function revealForScroll() {
  cancelHide()
  isVisible.value = true
  scheduleMetrics()

  hideTimer = window.setTimeout(() => {
    isVisible.value = false
    hideTimer = undefined
  }, 800)
}

function onResize() {
  scheduleMetrics()
}

onMounted(() => {
  updateMetrics()
  window.addEventListener('scroll', revealForScroll, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  visualViewport = window.visualViewport ?? undefined
  visualViewport?.addEventListener('resize', onResize, { passive: true })

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(scheduleMetrics)
    resizeObserver.observe(document.documentElement)
    resizeObserver.observe(document.body)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', revealForScroll)
  window.removeEventListener('resize', onResize)
  visualViewport?.removeEventListener('resize', onResize)
  resizeObserver?.disconnect()
  cancelHide()

  if (frameId !== undefined) {
    window.cancelAnimationFrame(frameId)
  }
})
</script>

<style scoped>
.scroll-activity-indicator {
  position: fixed;
  inset: 0 0 auto auto;
  z-index: 60;
  width: 10px;
  height: 100dvh;
  opacity: 0;
  pointer-events: none;
  transition: opacity 280ms ease-out;
  will-change: opacity;
}

.scroll-activity-indicator__track {
  position: absolute;
  inset: 0;
  background: var(--scroll-track);
}

.scroll-activity-indicator__thumb {
  position: absolute;
  inset: 0 0 auto;
  width: 10px;
  border-radius: 999px;
  border: 2px solid var(--scroll-track);
  background: var(--scroll-thumb);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
  will-change: transform;
}

.scroll-activity-indicator.is-visible {
  opacity: 1;
}

@media (max-width: 767px) {
  .scroll-activity-indicator {
    width: 8px;
  }

  .scroll-activity-indicator__thumb {
    width: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scroll-activity-indicator {
    transition: none;
  }
}
</style>
