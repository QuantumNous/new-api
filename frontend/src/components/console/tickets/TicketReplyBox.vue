<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'

import TicketImageUploader from './TicketImageUploader.vue'

const props = defineProps<{ submitting?: boolean; readonly?: boolean }>()
const emit = defineEmits<{
  submit: [payload: { content: string; images: string[] }]
}>()

const { t } = useI18n()
const content = ref('')
const showUploader = ref(false)
const uploader = ref<InstanceType<typeof TicketImageUploader> | null>(null)

function send() {
  const text = content.value.trim()
  if (!text || props.submitting || props.readonly) return
  emit('submit', { content: text, images: uploader.value?.getUrls() ?? [] })
  content.value = ''
  uploader.value?.reset()
  showUploader.value = false
}
</script>

<template>
  <div class="space-y-3">
    <textarea
      v-model="content"
      rows="3"
      name="ticket-reply"
      :aria-label="t('tickets.detail.replyPlaceholder')"
      :placeholder="t('tickets.detail.replyPlaceholder')"
      :disabled="readonly"
      class="sketch-md w-full border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors focus:border-[var(--accent)] focus-ring"
      @keydown.enter.exact.prevent="send"
    />

    <TicketImageUploader v-if="showUploader" ref="uploader" :max-count="4" />

    <div class="flex items-center justify-between gap-3">
      <button
        type="button"
        class="sketch-sm inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring"
        :disabled="readonly"
        @click="showUploader = !showUploader"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <path
            d="M21 15l-5-5L5 21M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z"
          />
          <circle cx="9" cy="9" r="1.5" />
        </svg>
        {{ t('tickets.create.imagesLabel') }}
      </button>
      <ConsoleButton
        :loading="submitting"
        :disabled="readonly || !content.trim()"
        @click="send"
      >
        {{ t('tickets.detail.send') }}
      </ConsoleButton>
    </div>
  </div>
</template>
