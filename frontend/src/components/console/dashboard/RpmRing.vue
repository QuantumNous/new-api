<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import MiniRing from '@/components/console/dashboard/MiniRing.vue'

/**
 * Rate-limit gauge. Read-only: the ceiling comes from the account group, not the
 * user. Details sit behind hover/focus so the strip stays quiet until asked —
 * the popover reuses the floating-layer overlay tokens that the topbar dropdowns
 * and log tooltips already use.
 */
const props = withDefaults(
  defineProps<{
    current: number
    /** 0 = unmetered */
    limit: number
    size?: number
    /**
     * Show the percentage inside the ring. Off when a headline figure already
     * states the rate right above it — repeating it inside the ring is noise.
     */
    showInnerLabel?: boolean
    /** Render the label + value text beside the ring. */
    showSideLabel?: boolean
  }>(),
  { size: 44, showInnerLabel: true, showSideLabel: true }
)

const { t } = useI18n()
const open = ref(false)
const popoverId = `rpm-ring-${useId()}`
const anchor = ref<HTMLElement | null>(null)
const anchorRect = ref<DOMRect | null>(null)

/**
 * The popover is fixed rather than absolute so it escapes the KPI strip's
 * overflow-hidden (which the strip needs for its rounded corners). Measured on
 * open only — it closes on leave/blur, so it never outlives its coordinates.
 */
function show() {
  anchorRect.value = anchor.value?.getBoundingClientRect() ?? null
  open.value = true
}

const popoverStyle = computed(() => {
  const rect = anchorRect.value
  if (!rect) return undefined
  return {
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top - 8}px`,
  }
})

const unmetered = computed(() => props.limit === 0)

const percent = computed(() => {
  if (unmetered.value || props.limit <= 0) return 0
  return Math.min(100, Math.max(0, (props.current / props.limit) * 100))
})

const headroom = computed(() =>
  unmetered.value ? null : Math.max(0, props.limit - props.current)
)

const color = computed(() => {
  if (unmetered.value) return 'var(--signal)'
  if (percent.value >= 90) return 'var(--status-danger)'
  if (percent.value >= 70) return 'var(--status-warning)'
  return 'var(--signal)'
})

const summary = computed(() =>
  unmetered.value
    ? t('dashboard.rpm.unmetered')
    : `${props.current} / ${props.limit} RPM`
)
</script>

<template>
  <div
    class="flex items-center gap-3"
    @mouseenter="show"
    @mouseleave="open = false"
  >
    <button
      ref="anchor"
      type="button"
      class="rounded-full focus-ring"
      :aria-describedby="open ? popoverId : undefined"
      :aria-label="`${t('dashboard.rpm.label')} ${summary}`"
      @focus="show"
      @blur="open = false"
    >
      <MiniRing
        :percent="percent"
        :color="color"
        :size="size"
        :indeterminate="unmetered"
      >
        <span
          v-if="showInnerLabel || unmetered"
          class="text-[11px] font-bold tabular-nums"
          :style="{ color: unmetered ? 'var(--text-tertiary)' : color }"
        >
          {{ unmetered ? '∞' : `${Math.round(percent)}%` }}
        </span>
      </MiniRing>
    </button>

    <!-- Inline label -->
    <div v-if="showSideLabel" class="min-w-0">
      <p class="text-xs text-[var(--text-tertiary)]">
        {{ t('dashboard.rpm.label') }}
      </p>
      <p class="mt-0.5 font-mono text-xs tabular-nums">
        <span class="font-semibold text-[var(--text-primary)]">{{
          current
        }}</span>
        <span class="text-[var(--text-tertiary)]">
          / {{ unmetered ? t('dashboard.rpm.unmetered') : `${limit} RPM` }}
        </span>
      </p>
    </div>

    <!-- Detail popover -->
    <div
      v-if="open"
      :id="popoverId"
      role="tooltip"
      class="pointer-events-none fixed z-[100] w-max -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--overlay-border)] bg-[var(--surface-overlay)] px-3 py-2 text-xs shadow-[var(--overlay-shadow)] backdrop-blur-xl"
      :style="popoverStyle"
    >
      <dl class="space-y-1">
        <div class="flex items-center justify-between gap-4">
          <dt class="text-[var(--text-tertiary)]">
            {{ t('dashboard.rpm.current') }}
          </dt>
          <dd class="font-semibold tabular-nums text-[var(--text-primary)]">
            {{ current }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="text-[var(--text-tertiary)]">
            {{ t('dashboard.rpm.ceiling') }}
          </dt>
          <dd class="font-semibold tabular-nums text-[var(--text-primary)]">
            {{ unmetered ? t('dashboard.rpm.unmetered') : limit }}
          </dd>
        </div>
        <div
          v-if="headroom !== null"
          class="flex items-center justify-between gap-4"
        >
          <dt class="text-[var(--text-tertiary)]">
            {{ t('dashboard.rpm.headroom') }}
          </dt>
          <dd class="font-semibold tabular-nums" :style="{ color }">
            {{ headroom }}
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>
