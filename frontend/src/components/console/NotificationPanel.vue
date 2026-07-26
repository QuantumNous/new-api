<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { relativeTime } from '@/utils/format'

interface NotificationItem {
  id: number
  kind: 'success' | 'receive' | 'payment' | 'info'
  titleKey: string
  detailKey: string
  time: number
  unread: boolean
}

const { t, locale } = useI18n()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

const nowSec = Math.floor(Date.now() / 1000)
const items = ref<NotificationItem[]>([
  {
    id: 1,
    kind: 'success',
    titleKey: 'notificationDemo.topupTitle',
    detailKey: 'notificationDemo.topupDetail',
    time: nowSec - 180,
    unread: true,
  },
  {
    id: 2,
    kind: 'success',
    titleKey: 'notificationDemo.redeemTitle',
    detailKey: 'notificationDemo.redeemDetail',
    time: nowSec - 3000,
    unread: true,
  },
  {
    id: 3,
    kind: 'receive',
    titleKey: 'notificationDemo.subscriptionTitle',
    detailKey: 'notificationDemo.subscriptionDetail',
    time: nowSec - 18_000,
    unread: false,
  },
  {
    id: 4,
    kind: 'payment',
    titleKey: 'notificationDemo.modelTitle',
    detailKey: 'notificationDemo.modelDetail',
    time: nowSec - 86_000,
    unread: false,
  },
])

const toneVar: Record<NotificationItem['kind'], string> = {
  success: 'var(--status-info)',
  receive: 'var(--status-success)',
  payment: 'var(--status-danger)',
  info: 'var(--text-tertiary)',
}

// Derived from the data so the badge can never drift out of sync.
const hasUnread = computed(() => items.value.some((n) => n.unread))

function markAllRead() {
  items.value = items.value.map((n) => ({ ...n, unread: false }))
}

function close({ restoreFocus = false } = {}) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  e.preventDefault()
  close({ restoreFocus: true })
}

// The Escape listener exists only while the popover is open; a closed panel
// costs nothing. Focus moves into the panel on open and back to the trigger
// when it leaves, matching the LogsView column-settings popover.
watch(open, (value) => {
  if (value) {
    document.addEventListener('keydown', onKeydown)
    nextTick(() => panel.value?.querySelector<HTMLElement>('button')?.focus())
  } else {
    document.removeEventListener('keydown', onKeydown)
  }
})

function onFocusout() {
  window.requestAnimationFrame(() => {
    if (root.value?.contains(document.activeElement)) return
    close()
  })
}

onClickOutside(root, () => close())
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div ref="root" class="relative" @focusout="onFocusout">
    <button
      ref="trigger"
      type="button"
      class="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring"
      :aria-label="t('nav.notifications')"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open ? close() : (open = true)"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      <span
        v-if="hasUnread"
        class="absolute right-2 top-2 h-2 w-2 rounded-full"
        style="background: var(--status-danger)"
      />
    </button>

    <div
      v-if="open"
      ref="panel"
      role="dialog"
      :aria-label="t('nav.notifications')"
      class="absolute right-0 top-12 z-40 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--overlay-border)] bg-[var(--surface-overlay)] shadow-[var(--overlay-shadow)] animate-scale-in"
    >
      <header class="flex items-center justify-between px-5 pt-4">
        <h3 class="text-sm font-semibold text-[var(--text-primary)]">
          {{ t('nav.notifications') }}
        </h3>
        <button
          type="button"
          class="text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-text)]"
          @click="markAllRead"
        >
          ✓ {{ t('nav.markAllRead') }}
        </button>
      </header>

      <ul class="subtle-scroll mt-2 max-h-80 overflow-y-auto px-2 pb-2">
        <li
          v-for="item in items"
          :key="item.id"
          class="flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--surface-muted)]"
        >
          <span
            class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            :style="{
              background: 'var(--surface-muted)',
              color: toneVar[item.kind],
            }"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <path d="M3 10h18M8 16h4" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-sm font-medium text-[var(--text-primary)]">
                {{ t(item.titleKey) }}
              </p>
              <span
                class="flex shrink-0 items-center gap-1 text-xs text-[var(--text-tertiary)]"
              >
                {{ relativeTime(item.time, locale) }}
                <span
                  v-if="item.unread"
                  class="h-1.5 w-1.5 rounded-full"
                  style="background: var(--status-danger)"
                />
              </span>
            </div>
            <p class="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">
              {{ t(item.detailKey) }}
            </p>
          </div>
        </li>
      </ul>

      <div class="border-t border-[var(--border-subtle)] p-3">
        <button
          type="button"
          class="h-10 w-full rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
          @click="close({ restoreFocus: true })"
        >
          {{ t('nav.viewAllNotifications') }}
        </button>
      </div>
    </div>
  </div>
</template>
