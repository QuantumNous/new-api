<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useToast, type ToastType } from '@/composables/useToast'

const { t } = useI18n()
const { toasts, dismiss } = useToast()

const toneVar: Record<ToastType, string> = {
  success: 'var(--status-success)',
  error: 'var(--status-danger)',
  info: 'var(--status-info)',
  warning: 'var(--status-warning)',
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-4 bottom-5 z-[100] flex flex-col gap-2 sm:left-auto sm:right-5 sm:w-80"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-3.5 shadow-[var(--card-shadow)]"
        :role="toast.type === 'error' ? 'alert' : 'status'"
      >
        <span
          class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          :style="{ background: toneVar[toast.type] }"
        />
        <p class="min-w-0 flex-1 text-sm text-[var(--text-primary)]">
          {{ toast.message }}
        </p>
        <button
          type="button"
          class="text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          :aria-label="t('common.close')"
          @click="dismiss(toast.id)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
