<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { labNavItems } from '@/constants/navigation/labNav'
import { useLabChat } from '@/composables/useLab'
import { useAuthStore } from '@/stores/auth'
import { formatQuota } from '@/utils/format'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const collapsed = useStorage<boolean>('ren2hub_lab_sidebar_collapsed', false)

const { conversations, load } = useLabChat()
onMounted(() => void load())

const activeName = computed(() => {
  const nav = (route.meta.nav as string) || (route.name as string)
  return (
    labNavItems.find((i) => i.route === nav || i.name === nav)?.name ?? null
  )
})

const DAY = 86_400
const historyGroups = computed(() => {
  const now = Math.floor(Date.now() / 1000)
  const buckets: Record<string, typeof conversations.value> = {
    pinned: [],
    today: [],
    week: [],
    earlier: [],
  }
  for (const c of conversations.value) {
    if (c.pinned) buckets.pinned.push(c)
    else if (now - c.updatedAt < DAY) buckets.today.push(c)
    else if (now - c.updatedAt < 7 * DAY) buckets.week.push(c)
    else buckets.earlier.push(c)
  }
  return [
    { key: 'pinned', labelKey: 'lab.history.pinned', items: buckets.pinned },
    { key: 'today', labelKey: 'lab.history.today', items: buckets.today },
    { key: 'week', labelKey: 'lab.history.week', items: buckets.week },
    { key: 'earlier', labelKey: 'lab.history.earlier', items: buckets.earlier },
  ].filter((g) => g.items.length > 0)
})

const activeConversationId = computed(() =>
  route.name === 'lab-chat-session' ? (route.params.id as string) : null
)

// `quota` is the current wallet balance; `used_quota` is cumulative usage.
const remaining = computed(() => {
  const u = auth.user
  if (!u) return null
  return Math.max(0, u.quota)
})
const remainingPct = computed(() => {
  const u = auth.user
  if (!u) return 0
  const total = u.quota + u.used_quota
  return total > 0 ? Math.min(100, (u.quota / total) * 100) : 0
})

function go(routeName: string) {
  router.push({ name: routeName })
}
function openConversation(id: string) {
  router.push({ name: 'lab-chat-session', params: { id } })
}
function newChat() {
  router.push({ name: 'lab-chat' })
}
</script>

<template>
  <aside
    class="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-solid)] transition-[width] duration-[250ms] lg:flex"
    :style="{ width: collapsed ? '64px' : '264px' }"
    data-handdrawn="navigation"
  >
    <!-- new chat CTA (formerly below brand header) -->
    <div class="shrink-0 px-3 pt-4 pb-1">
      <button
        type="button"
        class="pencil-control flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] font-semibold text-[var(--accent-contrast)] shadow-[var(--button-shadow)] transition-all hover:bg-[var(--accent-hover)] hover:shadow-[var(--button-shadow-hover)] active:bg-[var(--accent-active)] focus-ring"
        data-handdrawn="control"
        :title="collapsed ? t('lab.newChat') : undefined"
        @click="newChat"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span v-if="!collapsed">{{ t('lab.newChat') }}</span>
      </button>
    </div>

    <div
      class="subtle-scroll flex min-h-0 flex-1 flex-col overflow-y-auto py-3"
    >
      <!-- primary nav -->
      <div class="px-3" :class="{ 'mb-5': !collapsed }">
        <div v-if="!collapsed" class="mb-1 flex items-center gap-2 px-3 py-0.5">
          <span
            class="h-3.5 w-0.5 rounded-full bg-[var(--status-danger)]"
            aria-hidden="true"
          />
          <span
            class="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]"
          >
            {{ t('lab.groupExplore') }}
          </span>
        </div>
        <ul class="space-y-0.5">
          <li v-for="item in labNavItems" :key="item.name">
            <button
              type="button"
              class="group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all focus-ring"
              :class="[
                activeName === item.name
                  ? ''
                  : 'hover:bg-[var(--surface-muted)]',
                collapsed ? 'justify-center' : '',
              ]"
              :style="
                activeName === item.name
                  ? 'color:var(--text-primary);background:var(--surface-muted)'
                  : 'color:var(--text-secondary)'
              "
              :title="collapsed ? t(item.labelKey) : undefined"
              :aria-current="activeName === item.name ? 'page' : undefined"
              @click="go(item.route)"
            >
              <span
                v-if="activeName === item.name && !collapsed"
                class="absolute left-0 h-5 w-0.5 rounded-r-full bg-[var(--accent)]"
                aria-hidden="true"
              />
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                :class="
                  activeName === item.name ? 'text-[var(--accent-text)]' : ''
                "
              >
                <path :d="item.icon" />
              </svg>
              <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-left">
                {{ t(item.labelKey) }}
              </span>
            </button>
          </li>
        </ul>
      </div>

      <!-- history -->
      <div v-if="!collapsed" class="px-3">
        <div v-for="group in historyGroups" :key="group.key" class="mb-3">
          <div class="mb-1 px-3 py-0.5">
            <span
              class="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]"
            >
              {{ t(group.labelKey) }}
            </span>
          </div>
          <ul class="space-y-0.5">
            <li v-for="convo in group.items" :key="convo.id">
              <button
                type="button"
                class="group flex h-8 w-full items-center gap-2 rounded-lg px-3 text-left text-[13px] transition-colors focus-ring"
                :class="
                  activeConversationId === convo.id
                    ? 'bg-[var(--surface-muted)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
                "
                @click="openConversation(convo.id)"
              >
                <svg
                  v-if="convo.pinned"
                  class="shrink-0 text-[var(--text-tertiary)]"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    d="M12 17v5M9 10.8V4h6v6.8a2 2 0 0 0 .6 1.4L18 15H6l2.4-2.8a2 2 0 0 0 .6-1.4Z"
                  />
                </svg>
                <span class="min-w-0 flex-1 truncate">{{ convo.title }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- bottom: balance widget + collapse toggle -->
    <div class="shrink-0 border-t border-[var(--border-subtle)] px-3 py-3">
      <!-- balance widget (expanded) -->
      <button
        v-if="!collapsed && remaining !== null"
        type="button"
        class="pencil-surface mb-2 flex w-full flex-col gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)] focus-ring"
        data-handdrawn="surface"
        :title="t('lab.balance.hint')"
        @click="go('wallet')"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-text)"
              stroke-width="2"
            >
              <path
                d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6ZM3 10h18M8 15h4"
              />
            </svg>
            {{ t('lab.balance.label') }}
          </span>
          <span class="text-xs font-semibold text-[var(--text-primary)]">
            {{ formatQuota(remaining ?? 0) }}
          </span>
        </div>
        <!-- progress bar: remaining / total -->
        <div
          class="pencil-progress h-1 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]"
        >
          <div
            class="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
            :style="{ width: `${remainingPct}%` }"
          />
        </div>
        <span class="text-[11px] text-[var(--text-tertiary)]">{{
          t('lab.balance.topup')
        }}</span>
      </button>

      <!-- balance icon only (collapsed) -->
      <button
        v-else-if="collapsed"
        type="button"
        class="mb-2 flex h-9 w-full items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-muted)] focus-ring"
        :title="t('lab.balance.label')"
        @click="go('wallet')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent-text)"
          stroke-width="2"
        >
          <path
            d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6ZM3 10h18M8 15h4"
          />
        </svg>
      </button>

      <!-- collapse toggle -->
      <button
        type="button"
        class="flex h-9 w-full items-center rounded-xl px-3 text-xs font-medium text-[var(--text-tertiary)] transition-all hover:bg-[var(--surface-muted)] focus-ring"
        :class="collapsed ? 'justify-center' : 'justify-between'"
        :aria-label="collapsed ? t('nav.expand') : t('nav.collapse')"
        @click="collapsed = !collapsed"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="shrink-0 text-[var(--status-danger-text)] transition-transform duration-[250ms]"
          :class="collapsed ? 'rotate-180' : ''"
        >
          <path d="m15 6-6 6 6 6" />
        </svg>
        <span v-if="!collapsed">{{ t('nav.collapse') }}</span>
      </button>
    </div>
  </aside>
</template>
