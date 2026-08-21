<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ConsoleButton from './ConsoleButton.vue'

defineProps<{
  message?: string
}>()

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>

<template>
  <div
    role="alert"
    class="flex flex-col items-start gap-3 rounded-xl border border-[var(--status-danger)] bg-[var(--status-danger-soft)] px-4 py-3 sm:flex-row sm:items-center"
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="shrink-0 text-[var(--status-danger-text)]"
    >
      <path
        d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
      />
      <path d="M12 9v4M12 17h.01" />
    </svg>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-[var(--status-danger-text)]">
        {{ t('common.loadFailed') }}
      </p>
      <p
        v-if="message"
        class="mt-0.5 break-words text-xs text-[var(--text-tertiary)]"
      >
        {{ message }}
      </p>
    </div>
    <ConsoleButton variant="secondary" size="sm" @click="emit('retry')">
      {{ t('common.retry') }}
    </ConsoleButton>
  </div>
</template>
