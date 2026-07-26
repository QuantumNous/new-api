<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { adminUserQuotaMeter } from '@/constants/adminUsers'
import type { AdminUser } from '@/types/console'
import { formatQuota } from '@/utils/format'

/**
 * Remaining balance as the single headline number, with a ring carrying the
 * consumed share. The ring is deliberately round and unframed — every other
 * element in this table is a rectangle, so it reads as a state glyph rather
 * than more tabular data.
 */
const props = defineProps<{
  user: Pick<AdminUser, 'quota' | 'used_quota'>
}>()

const { t } = useI18n()

const SIZE = 15
const STROKE = 2.5
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const meter = computed(() => adminUserQuotaMeter(props.user))

const dashOffset = computed(
  () => CIRCUMFERENCE * (1 - meter.value.percent / 100)
)

/**
 * The sub-line changes what it says per state instead of always restating the
 * same figure: context when healthy, scarcity when nearly out.
 */
const note = computed(() => {
  if (meter.value.state === 'exhausted') return t('users.quotaExhausted')
  if (meter.value.state === 'low') {
    return t('users.quotaOnlyLeft', { percent: meter.value.remainingPercent })
  }
  return t('users.quotaUsed', { value: formatQuota(props.user.used_quota) })
})

/**
 * A healthy account keeps its sub-line quiet; only scarcity earns the meter's
 * warning colour. Resolved here rather than in the template so the token stays
 * a single expression.
 */
const noteColor = computed(() =>
  meter.value.state === 'normal' ? 'var(--text-tertiary)' : meter.value.color
)

const ariaLabel = computed(() =>
  t('users.quotaSummary', {
    remaining: formatQuota(props.user.quota),
    note: note.value,
  })
)
</script>

<template>
  <div
    data-user-quota
    :data-quota-state="meter.state"
    class="flex min-w-0 items-start gap-2"
    :aria-label="ariaLabel"
    role="img"
  >
    <svg
      :width="SIZE"
      :height="SIZE"
      :viewBox="`0 0 ${SIZE} ${SIZE}`"
      class="mt-0.5 shrink-0 -rotate-90"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        :cx="SIZE / 2"
        :cy="SIZE / 2"
        :r="RADIUS"
        fill="none"
        stroke="var(--border-default)"
        :stroke-width="STROKE"
      />
      <circle
        :cx="SIZE / 2"
        :cy="SIZE / 2"
        :r="RADIUS"
        fill="none"
        :stroke="meter.color"
        :stroke-width="STROKE"
        stroke-linecap="round"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="dashOffset"
        class="transition-[stroke-dashoffset,stroke]"
      />
    </svg>

    <div class="min-w-0">
      <p class="display-number font-mono text-xs text-[var(--text-primary)]">
        {{ formatQuota(user.quota) }}
      </p>
      <p class="truncate text-[11px]" :style="{ color: noteColor }">
        {{ note }}
      </p>
    </div>
  </div>
</template>
