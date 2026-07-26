<script setup lang="ts" generic="T extends string">
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-vue-next'
import { nextTick, ref, useId } from 'vue'
import { onClickOutside } from '@vueuse/core'

import IconButton from './IconButton.vue'

/**
 * Column-visibility popover shared by every admin table. The component owns no
 * domain knowledge: the caller supplies the canonical field order, the default
 * set and a label resolver, so toggling always yields a canonically ordered
 * selection regardless of click order.
 */
const model = defineModel<T[]>({ required: true })

const props = defineProps<{
  allFields: readonly T[]
  defaultFields: readonly T[]
  labelFor: (field: T) => string
  title: string
  resetLabel: string
}>()

const root = ref<HTMLElement | null>(null)
const trigger = ref<InstanceType<typeof IconButton> | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
const panelId = useId()
const titleId = useId()

function isVisible(field: T): boolean {
  return model.value.includes(field)
}

function toggleField(field: T) {
  model.value = isVisible(field)
    ? model.value.filter((item) => item !== field)
    : props.allFields.filter(
        (item) => item === field || model.value.includes(item)
      )
}

function restoreDefaults() {
  model.value = [...props.defaultFields]
}

async function openMenu() {
  open.value = true
  await nextTick()
  panel.value?.querySelector<HTMLButtonElement>('button')?.focus()
}

function closeMenu({ restoreFocus = false } = {}) {
  open.value = false
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

function toggleMenu() {
  if (open.value) closeMenu({ restoreFocus: true })
  else void openMenu()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  event.stopPropagation()
  closeMenu({ restoreFocus: true })
}

function onFocusout() {
  window.requestAnimationFrame(() => {
    if (root.value?.contains(document.activeElement)) return
    closeMenu()
  })
}

onClickOutside(root, () => closeMenu())
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown" @focusout="onFocusout">
    <IconButton
      ref="trigger"
      :label="title"
      class="h-10 w-10 rounded-xl border border-[var(--border-default)] bg-[var(--surface-solid)]"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="toggleMenu"
    >
      <SlidersHorizontal :size="17" />
    </IconButton>

    <Transition name="field-menu">
      <div
        v-if="open"
        :id="panelId"
        ref="panel"
        role="dialog"
        aria-modal="false"
        :aria-labelledby="titleId"
        class="subtle-scroll absolute right-0 top-full z-50 mt-2 max-h-[min(24rem,calc(100dvh-8rem))] w-64 overflow-y-auto rounded-lg border border-[var(--overlay-border)] bg-[var(--surface-overlay)] py-1.5 shadow-[var(--overlay-shadow)]"
      >
        <div class="flex items-center justify-between gap-2 px-3 py-1.5">
          <p
            :id="titleId"
            class="text-xs font-semibold text-[var(--text-secondary)]"
          >
            {{ title }}
          </p>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-ring"
            @click="restoreDefaults"
          >
            <RotateCcw :size="13" />
            {{ resetLabel }}
          </button>
        </div>

        <button
          v-for="field in allFields"
          :key="field"
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)] focus-ring"
          :class="
            isVisible(field)
              ? 'text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)]'
          "
          :aria-pressed="isVisible(field)"
          @click="toggleField(field)"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
            :class="
              isVisible(field)
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                : 'border-[var(--border-default)]'
            "
            aria-hidden="true"
          >
            <Check v-if="isVisible(field)" :size="12" :stroke-width="3" />
          </span>
          <span>{{ labelFor(field) }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.field-menu-enter-active,
.field-menu-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.field-menu-enter-from,
.field-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
