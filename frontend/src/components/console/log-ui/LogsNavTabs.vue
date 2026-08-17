<script setup lang="ts">
/**
 * Shared switcher for self-service logs and the admin operation ledger. Rendered inside the
 * PageBreadcrumb action slot so the breadcrumb and the tabs share one row.
 */
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

defineProps<{ active: 'consume' | 'drawing' | 'tasks' | 'operations' }>()

const { t } = useI18n()
const auth = useAuthStore()

const tabs = [
  {
    key: 'consume',
    routeName: 'logs',
    labelKey: 'relayLogs.tabConsume',
    adminOnly: false,
  },
  {
    key: 'drawing',
    routeName: 'logs-drawing',
    labelKey: 'relayLogs.tabDrawing',
    adminOnly: false,
  },
  {
    key: 'tasks',
    routeName: 'logs-tasks',
    labelKey: 'relayLogs.tabTasks',
    adminOnly: false,
  },
  {
    key: 'operations',
    routeName: 'logs-operations',
    labelKey: 'relayLogs.tabOperations',
    adminOnly: true,
  },
] as const
</script>

<template>
  <div class="subtle-scroll max-w-full overflow-x-auto lg:ml-auto">
    <nav
      class="flex w-max min-w-full items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-1 sm:min-w-0"
      :aria-label="t('relayLogs.tabsLabel')"
    >
      <RouterLink
        v-for="tab in tabs.filter((item) => !item.adminOnly || auth.isAdmin)"
        :key="tab.key"
        :to="{ name: tab.routeName }"
        class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        :class="
          active === tab.key
            ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
        "
        :aria-current="active === tab.key ? 'page' : undefined"
      >
        {{ t(tab.labelKey) }}
      </RouterLink>
    </nav>
  </div>
</template>
