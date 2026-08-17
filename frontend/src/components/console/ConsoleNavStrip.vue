<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { getAccessibleConsoleNavGroups } from '@/constants/navigation/consoleNav'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useTicketQueueStore } from '@/stores/ticketQueue'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const app = useAppStore()
const ticketQueue = useTicketQueueStore()
const activeItem = ref<HTMLElement | null>(null)

onMounted(ticketQueue.start)
onBeforeUnmount(ticketQueue.stop)

const allItems = computed(() =>
  getAccessibleConsoleNavGroups({
    isAdmin: auth.isAdmin,
    isRoot: auth.isRoot,
    hasPermission: auth.hasPermission,
    featureStatus: (feature) => app.featureStatus(feature),
  }).flatMap((group) => group.items)
)

function navComponent(item: {
  route?: string
  href?: string
  disabled?: boolean
}) {
  if (item.disabled) return 'button'
  if (item.href) return 'a'
  return RouterLink
}

function setActiveItem(element: unknown): void {
  const candidate =
    element instanceof HTMLElement
      ? element
      : (element as { $el?: unknown } | null)?.$el
  activeItem.value = candidate instanceof HTMLElement ? candidate : null
}

const activeName = computed(
  () =>
    allItems.value.find(
      (i) => i.route && (i.route === route.name || i.route === route.meta.nav)
    )?.name ?? null
)

watch(
  activeName,
  async () => {
    await nextTick()
    activeItem.value?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  },
  { immediate: true }
)
</script>

<template>
  <nav
    class="strip flex select-none gap-1 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-solid)] px-3 py-2 lg:hidden"
    :aria-label="t('nav.console')"
    data-handdrawn="navigation-strip"
  >
    <component
      :is="navComponent(item)"
      v-for="item in allItems"
      :key="item.name"
      :ref="item.name === activeName ? setActiveItem : undefined"
      :type="item.disabled ? 'button' : undefined"
      :to="
        !item.disabled && item.route && !item.href
          ? { name: item.route }
          : undefined
      "
      :href="!item.disabled && item.href ? item.href : undefined"
      class="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-ring"
      :class="item.disabled ? 'cursor-not-allowed opacity-40' : ''"
      :style="
        item.name === activeName
          ? 'background:var(--accent);color:var(--accent-contrast)'
          : 'color:var(--text-secondary)'
      "
      :disabled="item.disabled"
      :aria-current="item.name === activeName ? 'page' : undefined"
      :data-console-nav-item="item.name"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <path :d="item.icon" />
      </svg>
      {{ t(item.labelKey) }}
      <span
        v-if="
          item.name === 'ticket-management' && ticketQueue.summary.pending > 0
        "
        class="flex min-w-5 items-center justify-center rounded-full bg-[var(--status-danger)] px-1 text-[10px] font-semibold leading-5 text-[var(--text-inverse)]"
        :aria-label="
          t('tickets.admin.pendingCount', {
            count: ticketQueue.summary.pending,
          })
        "
      >
        {{
          ticketQueue.summary.pending > 99 ? '99+' : ticketQueue.summary.pending
        }}
      </span>
    </component>
  </nav>
</template>

<style scoped>
.strip {
  scrollbar-width: none;
}
.strip::-webkit-scrollbar {
  display: none;
}
</style>
