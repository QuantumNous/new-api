<script setup lang="ts">
/**
 * Compact segmented pill (2+ options), sharing the visual language of the
 * grid/list view toggle in ModelsView: a muted track with the active segment
 * lifted onto the solid surface. Used for the buy/sell switch and view mode.
 */
export interface SegmentOption {
  value: string
  label?: string
  /** accessible label + tooltip when the segment is icon-only */
  ariaLabel?: string
  /** lucide 24×24 path — renders an icon instead of / alongside the label */
  icon?: string
}

const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    options: SegmentOption[]
    /** stable accessible name for the whole group */
    label: string
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' }
)

function onKeydown(event: KeyboardEvent, index: number) {
  const last = props.options.length - 1
  let next: number
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next = index === last ? 0 : index + 1
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next = index === 0 ? last : index - 1
  } else if (event.key === 'Home') {
    next = 0
  } else if (event.key === 'End') {
    next = last
  } else {
    return
  }

  const option = props.options[next]
  if (!option) return
  event.preventDefault()
  model.value = option.value
  const radios = (
    event.currentTarget as HTMLElement
  ).parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')
  radios?.[next]?.focus()
}
</script>

<template>
  <div
    class="inline-flex items-center gap-1 rounded-xl bg-[var(--surface-muted)] p-1"
    role="radiogroup"
    :aria-label="label"
    data-handdrawn="segments"
  >
    <button
      v-for="(opt, index) in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="model === opt.value"
      :tabindex="model === opt.value ? 0 : -1"
      :aria-label="opt.ariaLabel"
      :title="opt.ariaLabel"
      class="inline-flex items-center justify-center gap-1.5 font-semibold transition-colors focus-ring"
      :class="[
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        opt.label ? '' : size === 'sm' ? 'w-8 px-0' : 'w-9 px-0',
        model === opt.value
          ? 'seg-active text-[var(--text-primary)]'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--state-hover-layer)] rounded-lg',
      ]"
      @click="model = opt.value"
      @keydown="onKeydown($event, index)"
    >
      <svg
        v-if="opt.icon"
        :width="size === 'sm' ? 15 : 16"
        :height="size === 'sm' ? 15 : 16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path :d="opt.icon" />
      </svg>
      <span v-if="opt.label">{{ opt.label }}</span>
    </button>
  </div>
</template>

<style scoped>
/* Active segment: day = outlined hand-drawn tile; night = filled + elevation */
.seg-active {
  background: var(--surface-solid);
  border-radius: var(--sketch-border-radius-sm);
  box-shadow: var(--elevation-1);
  border: 1px solid var(--border-default);
}
</style>
