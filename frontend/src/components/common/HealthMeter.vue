<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    /** 0-100 health score. */
    value: number
    /** Number of bars in the meter. */
    bars?: number
    compact?: boolean
  }>(),
  { bars: 12, compact: false }
)

const { t } = useI18n()

/** Threshold → semantic status token. Color is never the sole signal:
 *  the aria-label carries the same meaning for screen readers. */
const tone = computed(() => {
  if (props.value >= 95) return 'success'
  if (props.value >= 80) return 'warning'
  return 'danger'
})

const color = computed(() => `var(--status-${tone.value})`)

const filled = computed(() =>
  Math.max(1, Math.round((props.value / 100) * props.bars))
)

const label = computed(() => {
  const state = t(`models.health.${tone.value}`)
  return t('models.health.aria', { state, value: props.value })
})
</script>

<template>
  <div
    class="flex items-end gap-[2px]"
    :class="compact ? 'h-3' : 'h-4'"
    role="img"
    :aria-label="label"
    :title="label"
    data-handdrawn="health-meter"
  >
    <span
      v-for="i in bars"
      :key="i"
      class="w-[3px] rounded-full transition-colors"
      :class="compact ? 'h-full' : ''"
      :style="{
        height: compact ? '100%' : `${45 + (i / bars) * 55}%`,
        background: i <= filled ? color : 'var(--border-default)',
      }"
    />
  </div>
</template>
