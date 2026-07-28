<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ConsoleButton from './ConsoleButton.vue'
import ConsoleModal from './ConsoleModal.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    message?: string
    confirmText?: string
    cancelText?: string
    loading?: boolean
  }>(),
  { message: '', confirmText: '', cancelText: '', loading: false }
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const { t } = useI18n()
</script>

<template>
  <ConsoleModal
    :open="open"
    :aria-label="title"
    size="sm"
    @close="emit('cancel')"
  >
    <div class="flex flex-col items-center text-center">
      <span
        class="flex h-16 w-16 items-center justify-center rounded-full"
        style="
          background: var(--status-warning-soft);
          color: var(--status-warning-text);
        "
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="5" y="5" width="14" height="16" rx="2" />
          <path d="M9 2h6v4H9zM9.5 11.5l5 5M14.5 11.5l-5 5" />
        </svg>
      </span>
      <h2 class="mt-4 text-xl font-bold text-[var(--text-primary)]">
        {{ title }}
      </h2>
      <p v-if="message" class="mt-2 text-sm text-[var(--text-secondary)]">
        {{ message }}
      </p>
      <slot />
    </div>
    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <ConsoleButton variant="secondary" size="lg" @click="emit('cancel')">
          {{ cancelText || t('common.cancel') }}
        </ConsoleButton>
        <ConsoleButton size="lg" :loading="loading" @click="emit('confirm')">
          {{ confirmText || t('common.confirm') }}
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>
