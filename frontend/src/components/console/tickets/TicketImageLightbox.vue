<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { safeImageUrl } from '@/utils/safeUrl'

const props = defineProps<{ open: boolean; url: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const closeButton = ref<HTMLButtonElement | null>(null)
const safeUrl = computed(() => safeImageUrl(props.url))
let previouslyFocused: HTMLElement | null = null
let previousBodyOverflow = ''

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    closeButton.value?.focus()
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      if (!safeUrl.value) {
        emit('close')
        return
      }
      previouslyFocused = document.activeElement as HTMLElement | null
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKeydown)
      nextTick(() => closeButton.value?.focus())
      return
    }

    document.body.style.overflow = previousBodyOverflow
    window.removeEventListener('keydown', onKeydown)
    const restoreTarget = previouslyFocused
    previouslyFocused = null
    nextTick(() => restoreTarget?.isConnected && restoreTarget.focus())
  }
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', onKeydown)
  if (previouslyFocused?.isConnected) previouslyFocused.focus()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="open"
        class="fixed inset-0 z-[95] flex items-center justify-center p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="t('common.imagePreview')"
      >
        <div
          class="absolute inset-0 backdrop-blur-sm"
          style="background: var(--drawer-backdrop)"
          @click="emit('close')"
        />
        <img
          v-if="safeUrl"
          :src="safeUrl"
          alt=""
          class="relative max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-[0_24px_60px_var(--shadow-color)]"
        />
        <button
          ref="closeButton"
          type="button"
          class="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-solid)] text-[var(--text-secondary)] shadow transition-colors hover:text-[var(--text-primary)] focus-ring"
          :aria-label="t('common.close')"
          @click="emit('close')"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.2s ease;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
</style>
