<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LogItem } from '@/types/console'

import {
  formatLogDuration,
  formatLogTps,
  getDurationTone,
  getFirstTokenTone,
  type PerformanceTone,
} from './logPerformance'

type PerformanceMetric = 'duration' | 'first-token'

interface TooltipState {
  metric: PerformanceMetric
  x: number
  y: number
}

const props = withDefaults(
  defineProps<{
    log: LogItem
    interactive?: boolean
  }>(),
  { interactive: true }
)

const { t } = useI18n()

const showDetails = ref(false)
const tooltip = ref<TooltipState | null>(null)
const tooltipId = `log-performance-tooltip-${useId()}`
const available = computed(
  () => props.log.request_mode !== null && props.log.latency > 0
)
const stream = computed(() => props.log.request_mode === 'stream')
const firstTokenLabel = computed(() =>
  formatLogDuration(props.log.first_token_latency)
)
const durationLabel = computed(() => formatLogDuration(props.log.latency))
const tpsLabel = computed(() => formatLogTps(props.log.tps))
const firstTokenTone = computed(() =>
  getFirstTokenTone(props.log.first_token_latency)
)
const durationTone = computed(() =>
  getDurationTone(props.log.latency, props.log.completion_tokens, props.log.tps)
)

const barToneClass: Record<PerformanceTone, string> = {
  success: 'bg-[var(--status-success)]',
  warning: 'bg-[var(--status-warning)]',
  danger: 'bg-[var(--status-danger)]',
  neutral: 'bg-[var(--border-default)]',
}

const toneTextClass: Record<PerformanceTone, string> = {
  success: 'text-[var(--status-success-text)]',
  warning: 'text-[var(--status-warning-text)]',
  danger: 'text-[var(--status-danger-text)]',
  neutral: 'text-[var(--text-tertiary)]',
}

const tonePillClass: Record<PerformanceTone, string> = {
  success:
    'border-[var(--status-success)] bg-[var(--status-success-soft)] text-[var(--status-success-text)]',
  warning:
    'border-[var(--status-warning)] bg-[var(--status-warning-soft)] text-[var(--status-warning-text)]',
  danger:
    'border-[var(--status-danger)] bg-[var(--status-danger-soft)] text-[var(--status-danger-text)]',
  neutral:
    'border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-tertiary)]',
}

function metricLabel(metric: PerformanceMetric): string {
  return metric === 'duration' ? t('logs.totalDuration') : t('logs.firstToken')
}

function metricValue(metric: PerformanceMetric): string {
  return metric === 'duration' ? durationLabel.value : firstTokenLabel.value
}

function metricTone(metric: PerformanceMetric): PerformanceTone {
  return metric === 'duration' ? durationTone.value : firstTokenTone.value
}

const tooltipLabel = computed(() =>
  tooltip.value ? metricLabel(tooltip.value.metric) : ''
)
const tooltipValue = computed(() =>
  tooltip.value ? metricValue(tooltip.value.metric) : ''
)
const tooltipTone = computed<PerformanceTone>(() =>
  tooltip.value ? metricTone(tooltip.value.metric) : 'neutral'
)
const tooltipStyle = computed(() =>
  tooltip.value
    ? {
        left: `${tooltip.value.x}px`,
        top: `${tooltip.value.y}px`,
      }
    : undefined
)

function hideTooltip(): void {
  tooltip.value = null
}

function showTooltip(metric: PerformanceMetric, event: Event): void {
  if (!props.interactive) return

  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return

  const rect = target.getBoundingClientRect()
  const horizontalInset = 112
  tooltip.value = {
    metric,
    x: Math.min(
      Math.max(rect.left + rect.width / 2, horizontalInset),
      window.innerWidth - horizontalInset
    ),
    y: Math.max(8, rect.top - 8),
  }
}

function toggleDetails(): void {
  hideTooltip()
  showDetails.value = !showDetails.value
}

onMounted(() => {
  window.addEventListener('scroll', hideTooltip, true)
  window.addEventListener('resize', hideTooltip, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', hideTooltip, true)
  window.removeEventListener('resize', hideTooltip)
})
</script>

<template>
  <div
    v-if="available"
    data-log-performance
    :data-log-performance-mode="log.request_mode"
    class="flex w-full min-w-0 flex-col items-start gap-1.5"
  >
    <button
      v-if="showDetails && interactive"
      type="button"
      data-log-performance-details
      :aria-label="t('logs.hideTimingDetails')"
      :aria-expanded="true"
      class="flex max-w-full flex-wrap items-center gap-2 text-left focus-visible:outline-none"
      @click="toggleDetails"
    >
      <span
        v-if="stream"
        data-log-performance-detail-metric
        data-metric="first-token"
        :data-tone="firstTokenTone"
        class="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs tabular-nums"
        :class="tonePillClass[firstTokenTone]"
      >
        <span class="opacity-75">{{ t('logs.firstToken') }}</span>
        <strong class="font-semibold">{{ firstTokenLabel }}</strong>
      </span>
      <span
        data-log-performance-detail-metric
        data-metric="duration"
        :data-tone="durationTone"
        class="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs tabular-nums"
        :class="tonePillClass[durationTone]"
      >
        <span class="opacity-75">{{ t('logs.totalDuration') }}</span>
        <strong class="font-semibold">{{ durationLabel }}</strong>
      </span>
    </button>

    <span
      v-else-if="!interactive"
      data-log-performance-details
      class="flex min-w-0 items-center gap-2 text-left"
    >
      <span
        data-log-performance-indicator
        :data-mode="log.request_mode"
        class="flex w-1.5 shrink-0 overflow-hidden rounded-full"
        :class="stream ? 'h-[52px] flex-col' : 'h-7'"
        aria-hidden="true"
      >
        <template v-if="stream">
          <span class="flex-1" :class="barToneClass[firstTokenTone]" />
          <span class="flex-1" :class="barToneClass[durationTone]" />
        </template>
        <span v-else class="flex-1" :class="barToneClass[durationTone]" />
      </span>

      <span class="flex min-w-0 flex-col gap-1 text-xs leading-none">
        <span v-if="stream" class="flex items-center gap-2">
          <span class="text-[var(--text-tertiary)]">{{
            t('logs.firstToken')
          }}</span>
          <strong
            data-metric="first-token"
            :data-tone="firstTokenTone"
            class="font-semibold tabular-nums"
            :class="toneTextClass[firstTokenTone]"
          >
            {{ firstTokenLabel }}
          </strong>
        </span>
        <span class="flex items-center gap-2">
          <span class="text-[var(--text-tertiary)]">{{
            t('logs.totalDuration')
          }}</span>
          <strong
            data-metric="duration"
            :data-tone="durationTone"
            class="font-semibold tabular-nums"
            :class="toneTextClass[durationTone]"
          >
            {{ durationLabel }}
          </strong>
        </span>
      </span>
    </span>

    <div
      v-else
      data-log-performance-summary
      class="flex w-full min-w-0 items-center py-0.5"
    >
      <span
        data-log-performance-indicator
        :data-mode="log.request_mode"
        class="flex h-4 w-full min-w-0 shrink-0 overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-muted)]"
      >
        <button
          type="button"
          data-log-performance-trigger
          data-metric="duration"
          :data-tone="durationTone"
          :aria-describedby="
            tooltip?.metric === 'duration' ? tooltipId : undefined
          "
          :aria-label="`${metricLabel('duration')}: ${durationLabel}. ${t('logs.showTimingDetails')}`"
          class="min-h-0 flex-1 transition-[filter] duration-100 hover:brightness-110 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
          :class="[
            barToneClass[durationTone],
            stream ? 'border-r border-[var(--surface-solid)]' : '',
          ]"
          @pointerenter="showTooltip('duration', $event)"
          @pointerleave="hideTooltip"
          @focus="showTooltip('duration', $event)"
          @blur="hideTooltip"
          @click="toggleDetails"
        />
        <button
          v-if="stream"
          type="button"
          data-log-performance-trigger
          data-metric="first-token"
          :data-tone="firstTokenTone"
          :aria-describedby="
            tooltip?.metric === 'first-token' ? tooltipId : undefined
          "
          :aria-label="`${metricLabel('first-token')}: ${firstTokenLabel}. ${t('logs.showTimingDetails')}`"
          class="min-h-0 flex-1 transition-[filter] duration-100 hover:brightness-110 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
          :class="barToneClass[firstTokenTone]"
          @pointerenter="showTooltip('first-token', $event)"
          @pointerleave="hideTooltip"
          @focus="showTooltip('first-token', $event)"
          @blur="hideTooltip"
          @click="toggleDetails"
        />
      </span>
    </div>

    <span
      class="flex items-center gap-1.5 pl-0.5 text-xs leading-none text-[var(--text-tertiary)]"
    >
      <span
        class="font-medium"
        :class="
          stream
            ? 'text-[var(--status-info-text)]'
            : 'text-[var(--text-secondary)]'
        "
      >
        {{ stream ? t('logs.stream') : t('logs.sync') }}
      </span>
      <span aria-hidden="true">&middot;</span>
      <span class="tabular-nums">{{ tpsLabel }}</span>
    </span>
  </div>

  <span
    v-else
    data-log-performance-empty
    class="text-xs text-[var(--text-tertiary)]"
  >
    &mdash;
  </span>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="translate-y-1 scale-95 opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="translate-y-1 scale-95 opacity-0"
    >
      <div
        v-if="tooltip"
        :id="tooltipId"
        data-log-performance-tooltip
        :data-metric="tooltip.metric"
        :data-tone="tooltipTone"
        role="tooltip"
        class="pointer-events-none fixed z-[100] flex -translate-x-1/2 -translate-y-full items-center gap-2 rounded-md border border-[var(--overlay-border)] bg-[var(--surface-overlay)] px-2.5 py-1.5 text-xs shadow-[var(--overlay-shadow)] backdrop-blur-xl"
        :style="tooltipStyle"
      >
        <span
          aria-hidden="true"
          class="h-1.5 w-1.5 rounded-full"
          :class="barToneClass[tooltipTone]"
        />
        <span class="text-[var(--text-secondary)]">{{ tooltipLabel }}</span>
        <strong
          class="font-semibold tabular-nums"
          :class="toneTextClass[tooltipTone]"
        >
          {{ tooltipValue }}
        </strong>
      </div>
    </Transition>
  </Teleport>
</template>
