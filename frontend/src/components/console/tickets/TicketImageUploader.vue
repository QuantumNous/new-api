<script lang="ts">
// Window-level paste routing (module scope): with several uploaders mounted at
// once (e.g. the reply box behind a form modal), only the most recently
// mounted instance consumes a paste — otherwise one Ctrl+V adds the image to
// every uploader on the page.
const pasteStack: symbol[] = []
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTicketImages } from './useTicketImages'
import { safeImageUrl } from '@/utils/safeUrl'

const props = withDefaults(defineProps<{ maxCount?: number }>(), {
  maxCount: 4,
})

const { t } = useI18n()
const { images, addFiles, remove, getUrls, reset, canAddMore } =
  useTicketImages(props.maxCount)

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const safePreview = (value: string) => safeImageUrl(value)

// Parent reads the uploaded URLs and resets the field via a template ref.
defineExpose({ getUrls, reset })

function pickFiles() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) addFiles(Array.from(input.files))
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const files = event.dataTransfer?.files
  if (files?.length) addFiles(Array.from(files))
}

const pasteToken = Symbol('ticket-image-uploader')

function onPaste(event: ClipboardEvent) {
  if (pasteStack[pasteStack.length - 1] !== pasteToken) return
  const items = event.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  if (files.length) {
    event.preventDefault()
    addFiles(files)
  }
}

onMounted(() => {
  pasteStack.push(pasteToken)
  window.addEventListener('paste', onPaste)
})
onBeforeUnmount(() => {
  const index = pasteStack.indexOf(pasteToken)
  if (index !== -1) pasteStack.splice(index, 1)
  window.removeEventListener('paste', onPaste)
  reset()
})
</script>

<template>
  <div class="space-y-3">
    <!-- Preview grid -->
    <div v-if="images.length" class="grid grid-cols-4 gap-2.5">
      <div
        v-for="img in images"
        :key="img.id"
        class="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]"
      >
        <img
          v-if="safePreview(img.url)"
          :src="safePreview(img.url)!"
          alt=""
          class="h-full w-full object-cover"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-[var(--status-danger-text)]"
        >
          {{ img.error ? t(img.error) : t('tickets.upload.uploadFailed') }}
        </div>
        <button
          type="button"
          class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-solid)] text-[var(--text-secondary)] opacity-0 shadow transition-opacity hover:text-[var(--status-danger-text)] focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
          :aria-label="t('tickets.upload.remove')"
          @click="remove(img.id)"
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
    </div>

    <!-- Dropzone -->
    <button
      v-if="canAddMore()"
      type="button"
      class="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors focus-ring"
      :class="
        dragOver
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-solid)] hover:border-[var(--border-strong)]'
      "
      @click="pickFiles"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        class="text-[var(--text-tertiary)]"
      >
        <path
          d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        />
      </svg>
      <span class="text-sm font-medium text-[var(--text-secondary)]">
        {{ t('tickets.upload.selectFile') }}
        <span class="text-[var(--text-tertiary)]">{{
          t('tickets.upload.dragHint')
        }}</span>
      </span>
      <span class="text-xs text-[var(--text-tertiary)]">
        {{ t('tickets.upload.pasteHint') }} ·
        {{ t('tickets.upload.maxCount', { max: props.maxCount }) }}
      </span>
    </button>

    <input
      ref="fileInput"
      type="file"
      name="ticket-images"
      :aria-label="t('tickets.create.imagesLabel')"
      accept="image/png,image/jpeg,image/webp,image/gif"
      multiple
      class="hidden"
      @change="onFileChange"
    />
  </div>
</template>
