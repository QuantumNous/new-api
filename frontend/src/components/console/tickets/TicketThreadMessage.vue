<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import type { TicketMessage } from '@/types/console'
import { relativeTime } from '@/utils/format'
import { safeImageUrl } from '@/utils/safeUrl'

interface MessageImageState {
  source: string
  url: string
  loading: boolean
  failed: boolean
}

const props = withDefaults(
  defineProps<{
    message: TicketMessage
    viewer?: 'user' | 'support'
  }>(),
  { viewer: 'user' }
)
defineEmits<{ 'image-click': [url: string] }>()

const { t, locale } = useI18n()
const imageStates = ref<MessageImageState[]>([])
const imageControllers = new Set<AbortController>()
let imageGeneration = 0

function clearImages() {
  imageGeneration += 1
  for (const controller of imageControllers) controller.abort()
  imageControllers.clear()
  for (const image of imageStates.value) {
    if (image.url) URL.revokeObjectURL(image.url)
  }
  imageStates.value = []
}

async function loadImage(image: MessageImageState, generation: number) {
  if (image.url) URL.revokeObjectURL(image.url)
  image.url = ''
  image.loading = true
  image.failed = false
  const controller = new AbortController()
  imageControllers.add(controller)
  try {
    const blob = await api.getBlob(image.source, { signal: controller.signal })
    const objectUrl = URL.createObjectURL(blob)
    if (
      controller.signal.aborted ||
      generation !== imageGeneration ||
      !imageStates.value.includes(image)
    ) {
      URL.revokeObjectURL(objectUrl)
      return
    }
    image.url = safeImageUrl(objectUrl) ?? ''
    image.failed = !image.url
  } catch {
    if (!controller.signal.aborted && generation === imageGeneration) {
      image.failed = true
    }
  } finally {
    imageControllers.delete(controller)
    if (generation === imageGeneration) image.loading = false
  }
}

function retryImage(image: MessageImageState) {
  void loadImage(image, imageGeneration)
}

watch(
  () => props.message.images,
  (images) => {
    clearImages()
    const generation = imageGeneration
    imageStates.value = images.map((source) => ({
      source,
      url: '',
      loading: true,
      failed: false,
    }))
    for (const image of imageStates.value) void loadImage(image, generation)
  },
  { immediate: true }
)

onBeforeUnmount(clearImages)

const isOwn = computed(() => props.message.role === props.viewer)
const authorLabel = computed(() => {
  if (isOwn.value) return ''
  if (props.message.role === 'support') {
    if (props.viewer === 'user') return t('tickets.detail.dept.support')
    return t(`tickets.detail.dept.${props.message.department ?? 'support'}`)
  }
  return t('tickets.admin.requester')
})
const bubbleClass = computed(() =>
  isOwn.value
    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
    : 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)]'
)
</script>

<template>
  <div
    v-if="message.role === 'system'"
    class="flex items-center justify-center gap-3 py-1"
  >
    <span class="h-px flex-1 bg-[var(--dec-gold-line)]" />
    <span
      class="text-center text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
    >
      {{ message.content }} · {{ relativeTime(message.created, locale) }}
    </span>
    <span class="h-px flex-1 bg-[var(--dec-gold-line)]" />
  </div>

  <div v-else class="flex" :class="isOwn ? 'flex-row-reverse' : ''">
    <div class="min-w-0 max-w-[86%] sm:max-w-[80%]">
      <div
        class="mb-1 flex items-baseline gap-2"
        :class="isOwn ? 'flex-row-reverse' : ''"
      >
        <span
          v-if="authorLabel"
          class="display-title text-sm font-semibold text-[var(--text-secondary)]"
        >
          {{ authorLabel }}
        </span>
        <time class="text-xs text-[var(--text-tertiary)]">
          {{ relativeTime(message.created, locale) }}
        </time>
      </div>

      <div
        class="sketch-md px-4 py-2.5 text-sm leading-relaxed"
        :class="bubbleClass"
      >
        <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>

        <div v-if="imageStates.length" class="mt-2.5 grid grid-cols-2 gap-2">
          <button
            v-for="(image, index) in imageStates"
            :key="`${image.source}-${index}`"
            type="button"
            class="sketch-sm aspect-video overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
            :class="
              image.url
                ? 'transition-transform motion-safe:hover:scale-[1.02]'
                : 'flex items-center justify-center px-3 text-center text-xs text-[var(--status-danger-text)]'
            "
            :disabled="image.loading"
            @click="
              image.url ? $emit('image-click', image.url) : retryImage(image)
            "
          >
            <img
              v-if="image.url"
              :src="image.url"
              alt=""
              class="h-full w-full object-cover"
            />
            <span v-else-if="image.loading" class="text-[var(--text-tertiary)]">
              {{ t('common.loading') }}
            </span>
            <span v-else>
              {{ t('tickets.upload.loadFailed') }} ·
              {{ t('tickets.upload.retry') }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
