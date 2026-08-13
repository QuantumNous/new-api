<script setup lang="ts">
/**
 * Shared switcher for the three self-service log pages. Rendered inside the
 * PageBreadcrumb action slot so the breadcrumb and the tabs share one row.
 */
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

defineProps<{ active: 'consume' | 'drawing' | 'tasks' }>()

const { t } = useI18n()

const tabs = [
  { key: 'consume', routeName: 'logs', labelKey: 'relayLogs.tabConsume' },
  {
    key: 'drawing',
    routeName: 'logs-drawing',
    labelKey: 'relayLogs.tabDrawing',
  },
  { key: 'tasks', routeName: 'logs-tasks', labelKey: 'relayLogs.tabTasks' },
] as const
</script>

<template>
  <nav
    class="flex w-fit items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-1 lg:ml-auto"
    :aria-label="t('relayLogs.tabsLabel')"
  >
    <RouterLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="{ name: tab.routeName }"
      class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
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
</template>
