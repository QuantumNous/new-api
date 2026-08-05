<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type CSSProperties } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    segments: Array<{
      key: string
      label: string
      value: number
      displayValue: string
      intensity: number
    }>
    color: string
    emptyLabel: string
    summary?: string
    layout?: 'ranked' | 'rhythm'
    minimal?: boolean
  }>(),
  { summary: '', layout: 'ranked', minimal: false }
)

const root = ref<HTMLElement | null>(null)
const focusKey = ref('')
const tooltipId = useId()
const tooltip = ref<{
  key: string
  label: string
  left: number
  top: number
} | null>(null)

const visibleSegments = computed(() =>
  props.segments.filter((segment) => segment.value > 0)
)
const total = computed(() =>
  visibleSegments.value.reduce((sum, segment) => sum + segment.value, 0)
)

function segmentStyle(segment: (typeof props.segments)[number]): CSSProperties {
  return {
    width: `${total.value ? (segment.value / total.value) * 100 : 0}%`,
    background: `color-mix(in srgb, ${props.color} ${segment.intensity}%, var(--surface-solid))`,
  }
}

function showTooltip(
  event: FocusEvent | MouseEvent,
  segment: (typeof props.segments)[number]
) {
  if (!root.value) return
  const target = event.currentTarget as HTMLElement
  const targetRect = target.getBoundingClientRect()
  const rootRect = root.value.getBoundingClientRect()
  tooltip.value = {
    key: segment.key,
    label: `${segment.label} · ${segment.displayValue}`,
    left: Math.min(
      rootRect.width - 72,
      Math.max(72, targetRect.left - rootRect.left + targetRect.width / 2)
    ),
    top: targetRect.top - rootRect.top - 6,
  }
}

function hideTooltip(key: string) {
  if (tooltip.value?.key === key) tooltip.value = null
}

function onSegmentFocus(
  event: FocusEvent,
  segment: (typeof props.segments)[number]
) {
  focusKey.value = segment.key
  showTooltip(event, segment)
}

async function focusSegment(key: string) {
  const target = root.value?.querySelector<HTMLButtonElement>(
    `[data-usage-segment="${key}"]`
  )
  if (!target) return
  focusKey.value = key
  await nextTick()
  target.focus()
}

function onKeydown(event: KeyboardEvent, key: string) {
  const segments = visibleSegments.value
  const current = segments.findIndex((segment) => segment.key === key)
  if (current < 0) return

  let next: number
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next = (current - 1 + segments.length) % segments.length
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next = (current + 1) % segments.length
  } else if (event.key === 'Home') {
    next = 0
  } else if (event.key === 'End') {
    next = segments.length - 1
  } else {
    return
  }
  event.preventDefault()
  const target = segments[next]
  if (target) void focusSegment(target.key)
}

watch(
  visibleSegments,
  (segments) => {
    if (!segments.some((segment) => segment.key === focusKey.value)) {
      focusKey.value = segments[0]?.key ?? ''
    }
    tooltip.value = null
  },
  { immediate: true }
)
</script>

<template>
  <section
    ref="root"
    class="relative min-w-0"
    :data-usage-segment-bar="layout"
    :data-usage-segment-minimal="minimal || undefined"
  >
    <div
      v-if="!minimal"
      class="flex min-w-0 items-center justify-between gap-2"
      data-usage-segment-title
    >
      <h3 class="truncate text-[11px] font-medium text-[var(--text-tertiary)]">
        {{ title }}
      </h3>
      <span
        v-if="summary"
        class="truncate text-right text-[9px] tabular-nums text-[var(--text-tertiary)]"
      >
        {{ summary }}
      </span>
    </div>

    <template v-if="visibleSegments.length">
      <div
        class="flex overflow-hidden rounded-full bg-[var(--surface-muted)]"
        :class="minimal ? 'h-2.5' : 'mt-1 h-2'"
        role="group"
        :aria-label="title"
      >
        <button
          v-for="segment in visibleSegments"
          :key="segment.key"
          type="button"
          class="h-full min-w-px border-r border-[var(--surface-solid)] transition-[filter] last:border-r-0 hover:brightness-110 focus-ring"
          :style="segmentStyle(segment)"
          :tabindex="focusKey === segment.key ? 0 : -1"
          :aria-label="`${segment.label} ${segment.displayValue}`"
          :aria-describedby="
            tooltip?.key === segment.key ? tooltipId : undefined
          "
          :data-usage-segment="segment.key"
          :data-usage-segment-share="
            total ? (segment.value / total).toFixed(6) : '0'
          "
          @focus="onSegmentFocus($event, segment)"
          @blur="hideTooltip(segment.key)"
          @mouseenter="showTooltip($event, segment)"
          @mouseleave="hideTooltip(segment.key)"
          @keydown="onKeydown($event, segment.key)"
        />
      </div>

      <div
        v-if="!minimal && layout === 'ranked'"
        class="mt-1 space-y-0.5"
        data-usage-segment-details
      >
        <div
          v-for="segment in segments"
          :key="segment.key"
          class="grid grid-cols-[0.45rem_minmax(0,1fr)_auto] items-center gap-1.5 text-[9px]"
        >
          <span
            class="size-1.5 rounded-sm"
            :style="{
              background: `color-mix(in srgb, ${color} ${segment.intensity}%, var(--surface-solid))`,
            }"
            aria-hidden="true"
          />
          <span class="truncate text-[var(--text-secondary)]">
            {{ segment.label }}
          </span>
          <span class="font-mono tabular-nums text-[var(--text-primary)]">
            {{ segment.displayValue }}
          </span>
        </div>
      </div>

      <div
        v-else-if="!minimal"
        class="mt-1 grid grid-cols-7 gap-0.5 text-center text-[9px] text-[var(--text-tertiary)]"
        data-usage-segment-labels
        aria-hidden="true"
      >
        <span v-for="segment in segments" :key="segment.key" class="truncate">
          {{ segment.label }}
        </span>
      </div>
    </template>

    <p v-else class="mt-2 text-[10px] text-[var(--text-tertiary)]">
      {{ emptyLabel }}
    </p>

    <div
      v-if="tooltip"
      :id="tooltipId"
      class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 text-[10px] text-[var(--text-primary)] shadow-[var(--overlay-shadow)]"
      :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }"
      role="tooltip"
    >
      {{ tooltip.label }}
    </div>
  </section>
</template>
