<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { onClickOutside } from '@vueuse/core'

/**
 * Multi-select sibling of FilterSelect: same trigger/panel look, aria roles and
 * keyboard model, but backed by a string[] and per-option checkboxes. The
 * trigger reads "<prefix> · N" (or the placeholder when empty). Used for the
 * marketplace type filter, which FilterSelect (single value) can't express.
 */
export interface MultiSelectOption {
  value: string
  label: string
}

const model = defineModel<string[]>({ default: () => [] })

const props = withDefaults(
  defineProps<{
    options: MultiSelectOption[]
    /** stable accessible name that doesn't change with the selection */
    label: string
    /** shown in the trigger when nothing is selected, e.g. "全部类型" */
    placeholder: string
    /** short caption pinned before the count, e.g. "类型" */
    prefixLabel?: string
    /** text for the footer clear-selection action */
    clearLabel?: string
    direction?: 'down' | 'up'
    size?: 'sm' | 'md'
  }>(),
  { prefixLabel: '', clearLabel: 'Clear', direction: 'down', size: 'md' }
)

const root = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const open = ref(false)
const activeIndex = ref(-1)
const triggerId = useId()
const listboxId = useId()
const optionId = (i: number) => `${listboxId}-option-${i}`

const selectedCount = computed(() => model.value.length)
const triggerLabel = computed(() => {
  if (selectedCount.value === 0) return props.placeholder
  const head = props.prefixLabel || props.placeholder
  return `${head} · ${selectedCount.value}`
})

function isChecked(value: string) {
  return model.value.includes(value)
}

function toggleValue(value: string) {
  model.value = isChecked(value)
    ? model.value.filter((v) => v !== value)
    : [...model.value, value]
}

function clearAll() {
  model.value = []
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
  activeIndex.value = 0
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

function move(delta: number) {
  const n = props.options.length
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
        activeIndex.value = props.options.length - 1
        scrollActiveIntoView()
      }
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (!open.value) openMenu()
      else {
        // Contain so an enclosing modal's submit/focus-trap doesn't also react.
        e.stopPropagation()
        if (activeIndex.value >= 0)
          toggleValue(props.options[activeIndex.value].value)
      }
      break
    case 'Escape':
      if (open.value) {
        e.preventDefault()
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
      <span
        v-if="selectedCount > 0"
        class="h-2 w-2 shrink-0 rounded-full"
        style="background: var(--accent)"
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
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <Transition name="fs-pop">
      <div
        v-if="open"
        :id="listboxId"
        ref="listRef"
        class="subtle-scroll absolute left-0 z-40 max-h-72 w-full min-w-[180px] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] py-1 shadow-[var(--card-shadow)]"
        :class="direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'"
        role="listbox"
        data-handdrawn="menu"
        aria-multiselectable="true"
      >
        <ul>
          <li
            v-for="(opt, i) in options"
            :id="optionId(i)"
            :key="opt.value"
            :data-active="i === activeIndex ? 'true' : undefined"
            role="option"
            :aria-selected="isChecked(opt.value)"
            :title="opt.label"
            class="flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm transition-colors"
            :class="[
              i === activeIndex ? 'bg-[var(--surface-muted)]' : '',
              isChecked(opt.value)
                ? 'font-semibold text-[var(--accent-text)]'
                : 'text-[var(--text-primary)]',
            ]"
            @click="toggleValue(opt.value)"
            @mousemove="activeIndex = i"
          >
            <span
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
              :class="
                isChecked(opt.value)
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                  : 'border-[var(--border-default)]'
              "
              aria-hidden="true"
            >
              <svg
                v-if="isChecked(opt.value)"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <span class="min-w-0 flex-1 truncate">{{ opt.label }}</span>
          </li>
        </ul>
        <div
          v-if="selectedCount > 0"
          class="mt-1 flex justify-end border-t border-[var(--border-subtle)] px-4 pt-1.5"
        >
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-text)] focus-ring"
            @click.stop="clearAll"
          >
            {{ clearLabel }}
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
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
