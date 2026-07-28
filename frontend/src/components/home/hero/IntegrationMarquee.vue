<template>
  <div class="overflow-visible px-1 py-[var(--space-2)]">
    <div
      class="mb-[var(--space-2)] flex items-center justify-between gap-[var(--space-3)] max-lg:hidden"
    >
      <div>
        <p
          class="font-mono text-[10px] font-bold uppercase tracking-[var(--letter-spacing-wide)] text-[var(--brand-scan)]"
        >
          {{ t('integration.eyebrow') }}
        </p>
        <h2
          class="mt-0.5 text-[length:var(--text-label-sm)] font-semibold text-[var(--text-primary)]"
        >
          {{ t('integration.title') }}
        </h2>
      </div>
      <a
        v-if="showDocs"
        :href="docsLink"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-11 shrink-0 items-center rounded-full border border-[var(--border-default)] px-3 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
      >
        {{ t('integration.viewAll') }}
      </a>
    </div>

    <div
      ref="wrapperRef"
      class="hero-integration-marquee-wrapper -mx-[var(--space-2)] flex min-h-[5.25rem] items-center overflow-hidden py-2 sm:min-h-[5.5rem] sm:py-4"
      :class="{ 'is-dragging': isDragging }"
      data-hero-canvas-boundary
      role="region"
      :aria-label="t('integration.title')"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @lostpointercapture="onLostPointerCapture"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
      @click.capture="onClickCapture"
    >
      <div
        ref="trackRef"
        class="flex w-max shrink-0 items-center px-[var(--space-2)] will-change-transform"
      >
        <div
          ref="firstGroupRef"
          class="flex shrink-0 items-center gap-[var(--space-3)] pr-[var(--space-3)]"
        >
          <IntegrationChip
            v-for="(tool, i) in INTEGRATIONS"
            :key="tool.id"
            :tool="tool"
            :active="i === activeIndex"
          />
        </div>
        <div
          class="flex shrink-0 items-center gap-[var(--space-3)] pr-[var(--space-3)]"
          aria-hidden="true"
        >
          <IntegrationChip
            v-for="(tool, i) in INTEGRATIONS"
            :key="`c-${tool.id}`"
            :tool="tool"
            :active="i === activeIndex"
            clone
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import IntegrationChip from './IntegrationChip.vue'
import { INTEGRATIONS } from '@/constants/home/integrations'
import { useAppStore } from '@/stores'

const { t } = useI18n()
const { docsLink, showDocs } = storeToRefs(useAppStore())

const wrapperRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const firstGroupRef = ref<HTMLElement | null>(null)

const activeIndex = ref(-1)
const isPointerInside = ref(false)
const isFocusWithin = ref(false)
const isDragging = ref(false)

// The rail behaves like a physical instrument panel: it settles when inspected,
// then accelerates back into its ambient pace when the visitor leaves it.
const BASE_SPEED = 0.0252 // px / ms, matching the former 0.42 px / frame pace
const STOP_EASE_MS = 150
const RESUME_EASE_MS = 420
const DRAG_THRESHOLD = 6

let offset = 0
let groupWidth = 0
let wrapperCenter = 0
let centers: number[] = []
let raf = 0
let running = false
let velocity = BASE_SPEED
let lastFrameAt = 0
let suppressClickUntil = 0

interface PointerSession {
  id: number
  startX: number
  startY: number
  startOffset: number
  dragged: boolean
}

let pointerSession: PointerSession | null = null

const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function measure() {
  const track = trackRef.value
  const wrapper = wrapperRef.value
  const group = firstGroupRef.value
  if (!track || !wrapper || !group) return

  groupWidth = group.offsetWidth
  wrapperCenter = wrapper.clientWidth / 2

  const trackLeft = track.getBoundingClientRect().left
  centers = Array.from(group.children).map((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect()
    return rect.left + rect.width / 2 - trackLeft + offset
  })
}

function updateActive() {
  if (!centers.length || groupWidth <= 0) return

  const target = normalizeOffset(wrapperCenter + offset)
  let best = 0
  let bestDistance = Infinity

  for (let index = 0; index < centers.length; index += 1) {
    const center = normalizeOffset(centers[index])
    let distance = Math.abs(center - target)
    distance = Math.min(distance, groupWidth - distance)

    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }

  activeIndex.value = best
}

function normalizeOffset(value: number) {
  if (groupWidth <= 0) return 0
  return ((value % groupWidth) + groupWidth) % groupWidth
}

function applyTransform() {
  if (trackRef.value)
    trackRef.value.style.transform = `translateX(${-offset}px)`
}

function wantsToPause() {
  return isPointerInside.value || isFocusWithin.value || Boolean(pointerSession)
}

function updatePosition(delta: number) {
  offset = normalizeOffset(offset + delta)
  applyTransform()
  updateActive()
}

function resetFrameClock() {
  lastFrameAt = performance.now()
}

function frame(now: number) {
  if (!running) return

  const deltaMs = lastFrameAt ? Math.min(now - lastFrameAt, 64) : 16.7
  lastFrameAt = now

  if (!isDragging.value) {
    const targetVelocity = wantsToPause() ? 0 : BASE_SPEED
    const easeMs = targetVelocity === 0 ? STOP_EASE_MS : RESUME_EASE_MS
    const easing = 1 - Math.exp(-deltaMs / easeMs)
    velocity += (targetVelocity - velocity) * easing

    if (Math.abs(velocity) > 0.0001) updatePosition(velocity * deltaMs)
  }

  raf = requestAnimationFrame(frame)
}

const onResize = useDebounceFn(() => {
  const progress = groupWidth > 0 ? offset / groupWidth : 0
  measure()
  offset = normalizeOffset(progress * groupWidth)
  applyTransform()
  measure()
  updateActive()
}, 180)

function onPointerEnter() {
  isPointerInside.value = true
}

function onPointerLeave() {
  isPointerInside.value = false

  // If a non-dragging mouse press leaves the rail, it cannot produce a valid chip
  // click. Releasing this lock avoids leaving the ambient motion paused.
  if (pointerSession && !pointerSession.dragged) pointerSession = null
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || reduced) return

  pointerSession = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startOffset: offset,
    dragged: false,
  }

  // Pause immediately after a real press, so a click cannot land on a different
  // chip while the browser is resolving its eventual click event.
  velocity = 0
  resetFrameClock()
}

function onPointerMove(event: PointerEvent) {
  const session = pointerSession
  const wrapper = wrapperRef.value
  if (!session || session.id !== event.pointerId || !wrapper || reduced) return

  const deltaX = event.clientX - session.startX
  const deltaY = event.clientY - session.startY

  if (!session.dragged) {
    if (Math.abs(deltaX) < DRAG_THRESHOLD) return
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return

    session.dragged = true
    isDragging.value = true
    suppressClickUntil = performance.now() + 450
    wrapper.setPointerCapture(event.pointerId)
  }

  event.preventDefault()
  offset = normalizeOffset(session.startOffset - deltaX)
  applyTransform()
  updateActive()
}

function finishPointerSession(pointerId?: number) {
  if (
    pointerSession &&
    (pointerId === undefined || pointerSession.id === pointerId)
  ) {
    if (pointerSession.dragged) suppressClickUntil = performance.now() + 450
    pointerSession = null
  }

  isDragging.value = false
  resetFrameClock()
}

function onPointerUp(event: PointerEvent) {
  finishPointerSession(event.pointerId)
}

function onPointerCancel(event: PointerEvent) {
  finishPointerSession(event.pointerId)
}

function onLostPointerCapture(event: PointerEvent) {
  finishPointerSession(event.pointerId)
}

function onClickCapture(event: MouseEvent) {
  if (performance.now() < suppressClickUntil) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function onFocusIn() {
  isFocusWithin.value = true
}

function onFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget as Node | null
  if (!wrapperRef.value?.contains(nextTarget)) isFocusWithin.value = false
}

function onWindowBlur() {
  finishPointerSession()
}

onMounted(() => {
  measure()

  if (reduced) {
    activeIndex.value = -1
    return
  }

  updateActive()
  running = true
  resetFrameClock()
  raf = requestAnimationFrame(frame)
  window.addEventListener('resize', onResize)
  window.addEventListener('blur', onWindowBlur)
})

onBeforeUnmount(() => {
  running = false
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('blur', onWindowBlur)
})
</script>

<style scoped>
.hero-integration-marquee-wrapper {
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent,
    #000 8%,
    #000 92%,
    transparent
  );
  mask-image: linear-gradient(
    90deg,
    transparent,
    #000 8%,
    #000 92%,
    transparent
  );
  cursor: grab;
  touch-action: pan-y;
}
.hero-integration-marquee-wrapper.is-dragging {
  cursor: grabbing;
  user-select: none;
}
.hero-integration-marquee-wrapper :deep(a) {
  cursor: pointer;
}
.hero-integration-marquee-wrapper :deep(a:focus-visible) {
  outline: 2px solid var(--focus-ring);
  outline-offset: 4px;
}
</style>
