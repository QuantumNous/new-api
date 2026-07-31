<template>
  <nav
    class="home-progress-dots"
    aria-label="首页进度导航"
    data-home-progress-dots
  >
    <button
      v-for="index in DOT_COUNT"
      :key="index"
      type="button"
      class="home-progress-dots__dot"
      :class="{ 'is-active': activeIndex === index - 1 }"
      :aria-current="activeIndex === index - 1 ? 'step' : undefined"
      :aria-label="`页面进度 ${index} / ${DOT_COUNT}`"
      :data-home-progress-dot="index - 1"
      @click="scrollToIndex(index - 1)"
    >
      <span aria-hidden="true" />
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const DOT_COUNT = 12

const scrollProgress = ref(0)
const reducedMotion = ref(false)

let frameId: number | undefined
let resizeObserver: ResizeObserver | undefined
let mediaQuery: MediaQueryList | undefined

const activeIndex = computed(() =>
  Math.round(scrollProgress.value * (DOT_COUNT - 1))
)

function getScrollMetrics() {
  const scrollRoot = document.scrollingElement ?? document.documentElement
  const maxScroll = Math.max(scrollRoot.scrollHeight - window.innerHeight, 0)
  const currentScroll = Math.min(
    Math.max(window.scrollY || scrollRoot.scrollTop, 0),
    maxScroll
  )

  return { currentScroll, maxScroll }
}

function updateProgress() {
  const { currentScroll, maxScroll } = getScrollMetrics()
  scrollProgress.value = maxScroll > 0 ? currentScroll / maxScroll : 0
}

function scheduleProgress() {
  if (frameId !== undefined) return

  frameId = window.requestAnimationFrame(() => {
    frameId = undefined
    updateProgress()
  })
}

function scrollToIndex(index: number) {
  const { maxScroll } = getScrollMetrics()
  const target = maxScroll * (index / (DOT_COUNT - 1))

  window.scrollTo({
    top: target,
    behavior: reducedMotion.value ? 'auto' : 'smooth',
  })
}

function updateMotionPreference(event?: MediaQueryListEvent) {
  reducedMotion.value = event?.matches ?? mediaQuery?.matches ?? false
}

onMounted(() => {
  updateProgress()
  window.addEventListener('scroll', scheduleProgress, { passive: true })
  window.addEventListener('resize', scheduleProgress, { passive: true })

  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateMotionPreference()
  mediaQuery.addEventListener?.('change', updateMotionPreference)

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(scheduleProgress)
    resizeObserver.observe(document.documentElement)
    resizeObserver.observe(document.body)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleProgress)
  window.removeEventListener('resize', scheduleProgress)
  mediaQuery?.removeEventListener?.('change', updateMotionPreference)
  resizeObserver?.disconnect()

  if (frameId !== undefined) {
    window.cancelAnimationFrame(frameId)
  }
})
</script>

<style scoped>
.home-progress-dots {
  position: fixed;
  top: 50%;
  right: max(0.85rem, env(safe-area-inset-right));
  z-index: 60;
  display: grid;
  width: 1.5rem;
  gap: 0.5rem;
  justify-items: center;
  transform: translateY(-50%);
  pointer-events: none;
}

.home-progress-dots__dot {
  position: relative;
  z-index: 1;
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  pointer-events: auto;
}

.home-progress-dots__dot::before {
  position: absolute;
  width: 0.65rem;
  height: 0.65rem;
  border: 1px solid color-mix(in srgb, var(--border-strong) 72%, transparent);
  border-radius: 50%;
  content: '';
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.home-progress-dots__dot span {
  width: 0.3rem;
  height: 0.3rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--text-tertiary) 50%, transparent);
  transition:
    transform 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.home-progress-dots__dot:hover::before,
.home-progress-dots__dot:focus-visible::before,
.home-progress-dots__dot.is-active::before {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent);
  transform: scale(1.06);
}

.home-progress-dots__dot:hover span,
.home-progress-dots__dot:focus-visible span,
.home-progress-dots__dot.is-active span {
  background: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
  transform: scale(1.18);
}

.home-progress-dots__dot.is-active span {
  animation: home-progress-breathe 1.8s ease-in-out infinite;
}

.home-progress-dots__dot:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .home-progress-dots {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-progress-dots__dot::before,
  .home-progress-dots__dot span {
    animation: none;
    transition: none;
  }
}

@keyframes home-progress-breathe {
  50% {
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--accent) 17%, transparent),
      0 0 12px color-mix(in srgb, var(--accent) 40%, transparent);
    transform: scale(1.35);
  }
}
</style>
