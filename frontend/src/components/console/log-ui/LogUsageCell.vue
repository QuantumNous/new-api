<script setup lang="ts">
import { ArrowDown, ArrowUp, Database, Info, PenLine } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LogItem } from '@/types/console'
import { formatCompact, formatNumber } from '@/utils/format'

import { formatLogCacheHitRate, getLogUsageSummary } from './logUsage'

type PopoverPlacement = 'above' | 'below'

interface PopoverPosition {
  left: number
  top: number
  placement: PopoverPlacement
}

const props = withDefaults(
  defineProps<{
    log: LogItem
    mobile?: boolean
  }>(),
  { mobile: false }
)

const { t } = useI18n()

const detailsOpen = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const popoverId = `log-usage-popover-${useId()}`
const popoverTitleId = `log-usage-title-${useId()}`
const popoverPosition = ref<PopoverPosition>({
  left: 12,
  top: 12,
  placement: 'below',
})
const usage = computed(() => getLogUsageSummary(props.log))
const cacheSummaryAvailable = computed(
  () =>
    usage.value.cacheReadTokens !== null ||
    usage.value.cacheWriteTokens !== null
)
const cacheHitRateLabel = computed(() =>
  formatLogCacheHitRate(usage.value.cacheHitRate)
)
const popoverStyle = computed(() => ({
  left: `${popoverPosition.value.left}px`,
  top: `${popoverPosition.value.top}px`,
}))

function formatTokenValue(value: number | null): string {
  return value === null ? '—' : formatNumber(value)
}

function dismissDetails(): void {
  detailsOpen.value = false
}

function updatePopoverPosition(): void {
  const trigger = triggerRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const viewportMargin = 12
  const popoverWidth = 256
  const popoverHeight = popoverRef.value?.offsetHeight ?? 208
  const maxLeft = Math.max(
    viewportMargin,
    window.innerWidth - popoverWidth - viewportMargin
  )
  const left = Math.min(
    Math.max(rect.right - popoverWidth, viewportMargin),
    maxLeft
  )
  const placement: PopoverPlacement =
    rect.top >= popoverHeight + viewportMargin ? 'above' : 'below'

  popoverPosition.value = {
    left,
    top: placement === 'above' ? rect.top - 8 : rect.bottom + 8,
    placement,
  }
}

async function openDetails(): Promise<void> {
  detailsOpen.value = true
  await nextTick()
  updatePopoverPosition()
}

function toggleDetails(): void {
  if (detailsOpen.value) dismissDetails()
  else void openDetails()
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!detailsOpen.value || !(event.target instanceof Node)) return
  if (triggerRef.value?.contains(event.target)) return
  if (popoverRef.value?.contains(event.target)) return
  dismissDetails()
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !detailsOpen.value) return
  event.preventDefault()
  dismissDetails()
  triggerRef.value?.focus()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('keydown', onWindowKeydown)
  window.addEventListener('scroll', dismissDetails, true)
  window.addEventListener('resize', dismissDetails, { passive: true })
  window.visualViewport?.addEventListener('resize', dismissDetails, {
    passive: true,
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('scroll', dismissDetails, true)
  window.removeEventListener('resize', dismissDetails)
  window.visualViewport?.removeEventListener('resize', dismissDetails)
})
</script>

<template>
  <div
    v-if="usage.available"
    data-log-usage
    class="flex w-full min-w-0 items-center"
    :class="mobile ? 'gap-3' : 'gap-2'"
  >
    <div
      data-log-usage-content
      class="flex min-w-0 flex-1 flex-col items-start"
      :class="mobile ? 'gap-1.5' : 'gap-1'"
    >
      <div
        data-log-usage-io
        class="flex min-w-0 items-center gap-3 text-sm font-semibold leading-none"
      >
        <span
          data-log-usage-input
          class="inline-flex items-center gap-1 whitespace-nowrap tabular-nums text-[var(--status-success-text)]"
          :aria-label="`${t('logs.inputTokens')}: ${formatNumber(usage.promptTokens)}`"
        >
          <ArrowDown :size="14" stroke-width="1.9" aria-hidden="true" />
          {{ formatNumber(usage.promptTokens) }}
        </span>
        <span
          data-log-usage-output
          class="inline-flex items-center gap-1 whitespace-nowrap tabular-nums text-[var(--accent)]"
          :aria-label="`${t('logs.outputTokens')}: ${formatNumber(usage.completionTokens)}`"
        >
          <ArrowUp :size="14" stroke-width="1.9" aria-hidden="true" />
          {{ formatNumber(usage.completionTokens) }}
        </span>
      </div>

      <div
        class="flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-[var(--text-tertiary)]"
      >
        <template v-if="cacheSummaryAvailable">
          <span
            v-if="usage.cacheReadTokens !== null"
            class="inline-flex items-center gap-1 text-[var(--status-info-text)]"
            :aria-label="`${t('logs.cacheRead')}: ${formatNumber(usage.cacheReadTokens)}`"
          >
            <Database :size="13" stroke-width="1.8" aria-hidden="true" />
            <span class="tabular-nums">{{
              formatCompact(usage.cacheReadTokens)
            }}</span>
          </span>
          <span
            v-if="usage.cacheWriteTokens !== null"
            class="inline-flex items-center gap-1 text-[var(--status-warning-text)]"
            :aria-label="`${t('logs.cacheWrite')}: ${formatNumber(usage.cacheWriteTokens)}`"
          >
            <PenLine :size="13" stroke-width="1.8" aria-hidden="true" />
            <span class="tabular-nums">{{
              formatCompact(usage.cacheWriteTokens)
            }}</span>
          </span>
        </template>
        <span v-else class="whitespace-nowrap">{{
          t('logs.cacheUnavailable')
        }}</span>
      </div>
    </div>

    <button
      ref="triggerRef"
      type="button"
      data-log-usage-trigger
      :aria-controls="popoverId"
      :aria-expanded="detailsOpen"
      :aria-label="t('logs.viewTokenDetails')"
      class="inline-flex h-6 w-6 shrink-0 self-center items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
      @click="toggleDetails"
    >
      <Info :size="15" stroke-width="1.9" aria-hidden="true" />
    </button>
  </div>

  <span v-else data-log-usage-empty class="text-xs text-[var(--text-tertiary)]">
    —
  </span>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="translate-y-1 scale-95 opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="translate-y-1 scale-95 opacity-0"
    >
      <section
        v-if="detailsOpen"
        :id="popoverId"
        ref="popoverRef"
        data-log-usage-popover
        role="dialog"
        aria-modal="false"
        :aria-labelledby="popoverTitleId"
        class="fixed z-[100] w-64 rounded-lg border border-[var(--overlay-border)] bg-[var(--surface-overlay)] p-3 shadow-[var(--overlay-shadow)] backdrop-blur-xl"
        :class="
          popoverPosition.placement === 'above' ? '-translate-y-full' : ''
        "
        :style="popoverStyle"
      >
        <h4
          :id="popoverTitleId"
          class="text-sm font-semibold text-[var(--text-primary)]"
        >
          {{ t('logs.tokenDetails') }}
        </h4>

        <dl class="mt-2.5 space-y-2 text-xs">
          <div class="flex items-center justify-between gap-4">
            <dt class="flex items-center gap-1.5 text-[var(--text-tertiary)]">
              <ArrowDown
                :size="14"
                class="text-[var(--status-success-text)]"
                aria-hidden="true"
              />
              {{ t('logs.inputTokens') }}
            </dt>
            <dd class="font-medium tabular-nums text-[var(--text-primary)]">
              {{ formatTokenValue(usage.promptTokens) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="flex items-center gap-1.5 text-[var(--text-tertiary)]">
              <ArrowUp
                :size="14"
                class="text-[var(--accent)]"
                aria-hidden="true"
              />
              {{ t('logs.outputTokens') }}
            </dt>
            <dd class="font-medium tabular-nums text-[var(--text-primary)]">
              {{ formatTokenValue(usage.completionTokens) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="flex items-center gap-1.5 text-[var(--text-tertiary)]">
              <PenLine
                :size="14"
                class="text-[var(--status-warning-text)]"
                aria-hidden="true"
              />
              {{ t('logs.cacheCreation') }}
            </dt>
            <dd
              class="flex items-center gap-1.5 font-medium tabular-nums text-[var(--text-primary)]"
            >
              {{ formatTokenValue(usage.cacheWriteTokens) }}
              <span
                v-if="usage.cacheTtl"
                class="rounded border border-[var(--status-warning)] bg-[var(--status-warning-soft)] px-1 py-0.5 text-[10px] font-medium leading-none text-[var(--status-warning-text)]"
              >
                {{ usage.cacheTtl }}
              </span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="flex items-center gap-1.5 text-[var(--text-tertiary)]">
              <Database
                :size="14"
                class="text-[var(--status-info-text)]"
                aria-hidden="true"
              />
              {{ t('logs.cacheReadTokens') }}
            </dt>
            <dd class="font-medium tabular-nums text-[var(--text-primary)]">
              {{ formatTokenValue(usage.cacheReadTokens) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-[var(--text-tertiary)]">
              {{ t('logs.cacheHitRate') }}
            </dt>
            <dd class="font-medium tabular-nums text-[var(--text-primary)]">
              {{ cacheHitRateLabel }}
            </dd>
          </div>
          <div
            class="flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-2"
          >
            <dt class="font-medium text-[var(--text-secondary)]">
              {{ t('logs.totalTokens') }}
            </dt>
            <dd class="font-semibold tabular-nums text-[var(--accent)]">
              {{ formatNumber(usage.totalTokens) }}
            </dd>
          </div>
        </dl>
      </section>
    </Transition>
  </Teleport>
</template>
