<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { TicketMessage } from '@/types/console'
import { relativeTime } from '@/utils/format'
import { safeImageUrl } from '@/utils/safeUrl'

const props = defineProps<{ message: TicketMessage }>()
defineEmits<{ 'image-click': [url: string] }>()

const { t, locale } = useI18n()
const safeImages = computed(() =>
  props.message.images
    .map((image) => safeImageUrl(image))
    .filter((image): image is string => Boolean(image))
)

const isSupport = computed(() => props.message.role === 'support')

/**
 * Bubble skin. Support speaks on paper (muted surface + ink border), the user
 * speaks in accent ink. Both sides borrow the hand-drawn radius so the thread
 * reads like a pasted-in note rather than a chat widget.
 */
const bubbleClass = computed(() =>
  isSupport.value
    ? 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)]'
    : 'bg-[var(--accent)] text-[var(--accent-contrast)]'
)
</script>

<template>
  <!-- system notes render as a centered divider line -->
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

  <div v-else class="flex" :class="isSupport ? '' : 'flex-row-reverse'">
    <!-- bubble (avatars intentionally omitted; role is conveyed by side + name) -->
    <div class="min-w-0 max-w-[80%]">
      <div
        class="mb-1 flex items-baseline gap-2"
        :class="isSupport ? '' : 'flex-row-reverse'"
      >
        <!-- Support replies are labeled by department; the user's own name is
             intentionally hidden, leaving only the timestamp. -->
        <span
          v-if="isSupport"
          class="display-title text-sm font-semibold text-[var(--text-secondary)]"
        >
          {{ t(`tickets.detail.dept.${message.department ?? 'support'}`) }}
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

        <div v-if="safeImages.length" class="mt-2.5 grid grid-cols-2 gap-2">
          <button
            v-for="(img, idx) in safeImages"
            :key="idx"
            type="button"
            class="sketch-sm aspect-video overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-solid)] transition-transform motion-safe:hover:scale-[1.02]"
            @click="$emit('image-click', img)"
          >
            <img :src="img" alt="" class="h-full w-full object-cover" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
