<script lang="ts">
// Body scroll lock is shared across stacked modals (module scope): a
// per-instance snapshot would restore "hidden" when modals close out of order
// and freeze the page. Only the first lock snapshots the overflow; only the
// last unlock restores it.
let scrollLockCount = 0
let scrollLockOverflow = ''

function lockBodyScroll(): void {
  if (scrollLockCount === 0) {
    scrollLockOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLockCount++
}

function unlockBodyScroll(): void {
  if (scrollLockCount === 0) return
  scrollLockCount--
  if (scrollLockCount === 0) {
    document.body.style.overflow = scrollLockOverflow
  }
}
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    subtitle?: string
    ariaLabel?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { title: '', subtitle: '', ariaLabel: '', size: 'md' }
)

const emit = defineEmits<{
  close: []
}>()

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }

const titleId = useId()
const subtitleId = useId()
const dialog = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null
let holdsScrollLock = false

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

function focusableEls(): HTMLElement[] {
  if (!panel.value) return []
  return Array.from(
    panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)
  ).filter((el) => el.offsetParent !== null || el === document.activeElement)
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open || !isTopmostDialog()) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }
  if (e.key === 'Tab') {
    // Trap focus within the dialog.
    const els = focusableEls()
    if (els.length === 0) {
      e.preventDefault()
      panel.value?.focus()
      return
    }
    const first = els[0]
    const last = els[els.length - 1]
    const active = document.activeElement as HTMLElement
    if (e.shiftKey && (active === first || !panel.value?.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

function isTopmostDialog(): boolean {
  const dialogs = document.querySelectorAll<HTMLElement>(
    '[role="dialog"][aria-modal="true"]'
  )
  return dialogs.item(dialogs.length - 1) === dialog.value
}

function acquireScrollLock(): void {
  if (holdsScrollLock) return
  holdsScrollLock = true
  lockBodyScroll()
}

function releaseScrollLock(): void {
  if (!holdsScrollLock) return
  holdsScrollLock = false
  unlockBodyScroll()
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      acquireScrollLock()
      previouslyFocused = document.activeElement as HTMLElement | null
      window.addEventListener('keydown', onKeydown)
      // Move focus into the dialog once it has rendered.
      nextTick(() => {
        const els = focusableEls()
        ;(els[0] ?? panel.value)?.focus()
      })
    } else {
      releaseScrollLock()
      window.removeEventListener('keydown', onKeydown)
      const restoreTarget = previouslyFocused
      previouslyFocused = null
      nextTick(() => restoreTarget?.isConnected && restoreTarget.focus())
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  releaseScrollLock()
  window.removeEventListener('keydown', onKeydown)
  const restoreTarget = previouslyFocused
  previouslyFocused = null
  nextTick(() => restoreTarget?.isConnected && restoreTarget.focus())
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        ref="dialog"
        class="fixed inset-0 z-[90] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
        :aria-label="!title ? ariaLabel || undefined : undefined"
        :aria-describedby="subtitle ? subtitleId : undefined"
      >
        <div
          class="absolute inset-0 backdrop-blur-[2px]"
          :style="{ background: 'var(--drawer-backdrop)' }"
          @click="emit('close')"
        />
        <div
          ref="panel"
          tabindex="-1"
          class="relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-solid)] texture-paper animate-scale-in focus:outline-none"
          style="
            border-radius: var(--sketch-border-radius-lg);
            box-shadow: var(--card-sketch-shadow);
          "
          :class="widths[size]"
        >
          <!-- Decorative gold-line top accent -->
          <div
            class="shrink-0 h-px w-full"
            style="
              background: linear-gradient(
                90deg,
                transparent 10%,
                var(--dec-gold-line) 40%,
                var(--dec-gold-line) 60%,
                transparent 90%
              );
            "
            aria-hidden="true"
          />
          <header
            v-if="title || subtitle"
            class="shrink-0 px-6 pt-5 text-center"
          >
            <h2
              :id="titleId"
              class="display-title text-xl font-bold text-[var(--text-primary)]"
            >
              {{ title }}
            </h2>
            <p
              v-if="subtitle"
              :id="subtitleId"
              class="mt-1.5 text-sm text-[var(--text-tertiary)]"
            >
              {{ subtitle }}
            </p>
          </header>
          <div class="subtle-scroll min-h-0 overflow-y-auto px-6 py-5">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="shrink-0 px-6 pb-6">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
