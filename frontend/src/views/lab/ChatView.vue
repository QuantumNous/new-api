<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import BrandMark from '@/components/console/BrandMark.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import ChatComposer from '@/components/lab/ChatComposer.vue'
import { useFeatureAccess } from '@/composables/useFeatureAccess'
import { useLabChat, useLabConversation } from '@/composables/useLab'
import { useAuthStore } from '@/stores/auth'
import type { ChatMessage } from '@/types/lab'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const { readOnly } = useFeatureAccess('lab', 'prototype')

// One view serves both the landing (no :id) and an open conversation.
const sessionId = computed(() =>
  route.name === 'lab-chat-session' ? (route.params.id as string) : null
)

const {
  loading: landingLoading,
  models,
  starters,
  load: loadLanding,
} = useLabChat()
const {
  loading: convoLoading,
  conversation,
  load: loadConvo,
} = useLabConversation()

const draft = ref('')
// Local echo appended after send so the shell feels alive (prototype only).
const localMessages = ref<ChatMessage[]>([])
const pendingReplyTimers = new Set<number>()

const greeting = computed(() => {
  const name = auth.user?.display_name || auth.user?.username || ''
  const h = new Date().getHours()
  const key =
    h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  return t(`lab.chat.greeting.${key}`, { name })
})

const messages = computed<ChatMessage[]>(() => [
  ...(conversation.value?.messages ?? []),
  ...localMessages.value,
])

const STARTER_ICONS: Record<string, string> = {
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  doc: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z',
  chart: 'M3 3v18h18M8 15v3M13 10v8M18 6v12',
  code: 'm8 6-6 6 6 6M16 6l6 6-6 6',
  globe:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  image:
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM21 15l-5-5L5 21',
}

function sync() {
  for (const timer of pendingReplyTimers) window.clearTimeout(timer)
  pendingReplyTimers.clear()
  localMessages.value = []
  if (sessionId.value) void loadConvo(sessionId.value)
  else void loadLanding()
}

onMounted(sync)
watch(sessionId, sync)

function send() {
  if (readOnly.value) return
  const content = draft.value.trim()
  if (!content) return
  const base = Date.now()
  localMessages.value.push({
    id: base,
    role: 'user',
    content,
    createdAt: Math.floor(base / 1000),
  })
  draft.value = ''
  // Fixed assistant reply after a beat — no backend, just keeps the shell warm.
  const timer = window.setTimeout(() => {
    pendingReplyTimers.delete(timer)
    localMessages.value.push({
      id: base + 1,
      role: 'assistant',
      content: t('lab.chat.stubReply'),
      createdAt: Math.floor(base / 1000) + 1,
    })
  }, 600)
  pendingReplyTimers.add(timer)
}

function useStarter(desc: string) {
  draft.value = desc
}

function pickModel(name: string) {
  draft.value = draft.value ? draft.value : t('lab.chat.tryModel', { name })
}

onBeforeUnmount(() => {
  for (const timer of pendingReplyTimers) window.clearTimeout(timer)
  pendingReplyTimers.clear()
})
</script>

<template>
  <div class="flex h-full flex-col" data-handdrawn-page="chat">
    <!-- ===== conversation view ===== -->
    <template v-if="sessionId">
      <div class="subtle-scroll min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-[760px] px-4 py-8">
          <div v-if="convoLoading" class="space-y-6">
            <div v-for="i in 3" :key="i" class="animate-pulse space-y-2">
              <div class="h-4 w-24 rounded bg-[var(--surface-muted)]" />
              <div class="h-16 rounded-2xl bg-[var(--surface-muted)]" />
            </div>
          </div>

          <div v-else class="space-y-6">
            <h1
              class="gesture-mark mb-2 text-xl font-bold text-[var(--text-primary)]"
            >
              {{ conversation?.title }}
            </h1>
            <div
              v-for="m in messages"
              :key="m.id"
              class="flex gap-3"
              :class="m.role === 'user' ? 'flex-row-reverse' : ''"
            >
              <BrandMark
                v-if="m.role === 'assistant'"
                class="mt-0.5 h-8 w-8 shrink-0 rounded-lg"
              />
              <div
                class="lab-message-content max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                :data-message-role="m.role"
                :class="
                  m.role === 'user'
                    ? 'pencil-surface bg-[var(--accent-soft)] text-[var(--text-primary)]'
                    : 'lab-assistant-message text-[var(--text-primary)]'
                "
              >
                {{ m.content }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="shrink-0 border-t border-[var(--border-subtle)] px-4 py-4">
        <div class="mx-auto max-w-[760px]">
          <ChatComposer
            v-model="draft"
            :models="models"
            :readonly="readOnly"
            direction="up"
            @send="send"
          />
        </div>
      </div>
    </template>

    <!-- ===== landing (new chat) ===== -->
    <div v-else class="subtle-scroll h-full overflow-y-auto">
      <div
        class="mx-auto flex min-h-full max-w-[760px] flex-col justify-center px-4 py-12"
      >
        <div class="mb-8 text-center">
          <BrandMark class="mx-auto mb-5 h-14 w-14 rounded-2xl" />
          <h1
            class="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl"
          >
            {{ greeting }}
          </h1>
        </div>

        <ChatComposer
          v-model="draft"
          :models="models"
          :readonly="readOnly"
          @send="send"
        />

        <!-- model quick-picks -->
        <div
          v-if="!landingLoading"
          class="mt-4 flex flex-wrap items-center justify-center gap-2"
        >
          <span
            class="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-tertiary)]"
          >
            {{ t('lab.chat.fresh') }}
          </span>
          <button
            v-for="m in models"
            :key="m.id"
            type="button"
            class="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-solid)] py-1 pl-1 pr-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-ring"
            data-handdrawn="brand-option"
            @click="pickModel(m.name)"
          >
            <VendorLogo :vendor="m.vendor" :size="20" />
            {{ m.name }}
          </button>
        </div>
        <div v-else class="mt-4 flex flex-wrap justify-center gap-2">
          <div
            v-for="i in 5"
            :key="i"
            class="h-7 w-28 animate-pulse rounded-full bg-[var(--surface-muted)]"
          />
        </div>

        <!-- starter cards -->
        <div class="mt-10">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t('lab.chat.startersTitle') }}
            </h2>
            <button
              type="button"
              class="flex items-center gap-1 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-ring"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
              </svg>
              {{ t('lab.chat.shuffle') }}
            </button>
          </div>

          <div v-if="landingLoading" class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="i in 4"
              :key="i"
              class="h-20 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
            />
          </div>
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <button
              v-for="s in starters"
              :key="s.id"
              type="button"
              class="pencil-surface group flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4 text-left shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-shadow-hover)] focus-ring"
              data-handdrawn="surface"
              @click="useStarter(s.desc)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)]"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent-text)"
                  stroke-width="1.8"
                >
                  <path :d="STARTER_ICONS[s.icon]" />
                </svg>
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block text-sm font-semibold text-[var(--text-primary)]"
                  >{{ s.title }}</span
                >
                <span
                  class="mt-0.5 block text-xs leading-relaxed text-[var(--text-tertiary)]"
                  >{{ s.desc }}</span
                >
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
