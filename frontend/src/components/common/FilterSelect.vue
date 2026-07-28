<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { onClickOutside } from '@vueuse/core'

export interface SelectOption {
  value: string
  label: string
  /** status family — renders a small tone dot before the label (and in the
      trigger when selected) so the control echoes the table's StatusChip. */
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'accent'
}

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    options: SelectOption[]
    /** Stable accessible name that does not change with the selected value. */
    label: string
    placeholder?: string
    /** short label pinned before the value, e.g. "类型:" — gives toolbars a
        labeled control without an external caption. */
    prefixLabel?: string
    /** open the panel upward — use when the control sits near the page bottom */
    direction?: 'down' | 'up'
    /** control height — 'md' (default 40px) or 'sm' (36px, denser toolbars) */
    size?: 'sm' | 'md'
  }>(),
  { placeholder: '', prefixLabel: '', direction: 'down', size: 'md' }
)

const root = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const open = ref(false)
const activeIndex = ref(-1)
const triggerId = useId()
const listboxId = useId()
const optionId = (i: number) => `${listboxId}-option-${i}`

/**
 * Full option list. A non-empty `placeholder` synthesizes a leading value=''
 * row, mirroring the old native <select>'s `<option value="">` behavior so the
 * component's contract stays identical for every existing consumer.
 */
const allOptions = computed<SelectOption[]>(() =>
  props.placeholder
    ? [{ value: '', label: props.placeholder }, ...props.options]
    : props.options
)

const triggerLabel = computed(() => {
  const hit = allOptions.value.find((o) => o.value === model.value)
  return hit?.label ?? props.placeholder ?? allOptions.value[0]?.label ?? ''
})
const selectedOption = computed(() =>
  allOptions.value.find((o) => o.value === model.value)
)

/** token-backed color for a tone dot */
function toneColor(tone?: SelectOption['tone']): string {
  switch (tone) {
    case 'success':
      return 'var(--status-success)'
    case 'warning':
      return 'var(--status-warning)'
    case 'danger':
      return 'var(--status-danger)'
    case 'info':
      return 'var(--status-info)'
    case 'accent':
      return 'var(--accent)'
    default:
      return 'var(--text-tertiary)'
  }
}

function scrollActiveIntoView() {
  nextTick(() =>
    listRef.value
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  )
}

function openMenu() {
  open.value = true
  const cur = allOptions.value.findIndex((o) => o.value === model.value)
  activeIndex.value = cur >= 0 ? cur : 0
  scrollActiveIntoView()
}

function closeMenu() {
  open.value = false
  activeIndex.value = -1
}

function toggle() {
  if (open.value) closeMenu()
  else openMenu()
}

function select(opt: SelectOption) {
  model.value = opt.value
  closeMenu()
}

function move(delta: number) {
  const n = allOptions.value.length
  if (!n) return
  activeIndex.value = (activeIndex.value + delta + n) % n
  scrollActiveIntoView()
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (open.value) move(1)
      else openMenu()
      break
    case 'ArrowUp':
      e.preventDefault()
      if (open.value) move(-1)
      else openMenu()
      break
    case 'Home':
      if (open.value) {
        e.preventDefault()
        activeIndex.value = 0
        scrollActiveIntoView()
      }
      break
    case 'End':
      if (open.value) {
        e.preventDefault()
        activeIndex.value = allOptions.value.length - 1
        scrollActiveIntoView()
      }
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (!open.value) openMenu()
      else {
        // Stop the modal focus-trap / submit handlers from also reacting.
        e.stopPropagation()
        if (activeIndex.value >= 0) select(allOptions.value[activeIndex.value])
      }
      break
    case 'Escape':
      if (open.value) {
        e.preventDefault()
        // Contain Escape so an enclosing modal doesn't close too.
        e.stopPropagation()
        closeMenu()
      }
      break
    case 'Tab':
      if (open.value) closeMenu()
      break
  }
}

onClickOutside(root, closeMenu)
</script>

<template>
  <div ref="root" class="relative" :class="size === 'sm' ? 'h-9' : 'h-10'">
    <!-- trigger -->
    <button
      :id="triggerId"
      type="button"
      class="pencil-control flex h-full w-full items-center gap-2 rounded-xl border px-4 text-left text-sm text-[var(--text-primary)] transition-colors focus-ring"
      data-handdrawn="control"
      :class="
        open
          ? 'border-[var(--border-strong)] bg-[var(--surface-solid)]'
          : 'border-transparent bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)]'
      "
      role="combobox"
      :aria-label="label"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listboxId"
      :aria-activedescendant="
        open && activeIndex >= 0 ? optionId(activeIndex) : undefined
      "
      @click="toggle"
      @keydown="onKeydown"
    >
      <span v-if="prefixLabel" class="shrink-0 text-[var(--text-tertiary)]">{{
        prefixLabel
      }}</span>
      <span
        v-if="selectedOption?.tone"
        class="h-2 w-2 shrink-0 rounded-full"
        :style="{ background: toneColor(selectedOption.tone) }"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 truncate">{{ triggerLabel }}</span>
      <svg
        class="shrink-0 text-[var(--text-tertiary)] transition-transform"
        :class="open ? 'rotate-180' : ''"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <!-- panel: sketch radius + paper texture by day, uniform + elevation by night -->
    <Transition name="fs-pop">
      <ul
        v-if="open"
        :id="listboxId"
        ref="listRef"
        class="subtle-scroll texture-paper absolute left-0 z-40 max-h-64 w-full overflow-y-auto border border-[var(--border-subtle)] bg-[var(--surface-solid)] py-1"
        style="
          border-radius: var(--sketch-border-radius-md);
          box-shadow: var(--elevation-3);
        "
        :class="direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'"
        role="listbox"
        data-handdrawn="menu"
      >
        <li
          v-for="(opt, i) in allOptions"
          :id="optionId(i)"
          :key="opt.value"
          :data-active="i === activeIndex ? 'true' : undefined"
          role="option"
          :aria-selected="opt.value === model"
          :title="opt.label"
          class="flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm transition-colors"
          :class="[
            i === activeIndex ? 'bg-[var(--surface-muted)]' : '',
            opt.value === model
              ? 'font-semibold text-[var(--accent-text)]'
              : 'text-[var(--text-primary)]',
          ]"
          @click="select(opt)"
          @mousemove="activeIndex = i"
        >
          <span
            v-if="opt.tone"
            class="h-2 w-2 shrink-0 rounded-full"
            :style="{ background: toneColor(opt.tone) }"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate">{{ opt.label }}</span>
          <svg
            v-if="opt.value === model"
            class="shrink-0"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            aria-hidden="true"
          >
            <path d="m5 13 4 4L19 7" />
          </svg>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.fs-pop-enter-active,
.fs-pop-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s cubic-bezier(0.2, 0.6, 0.2, 1);
}
.fs-pop-enter-from,
.fs-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
