<script setup lang="ts">
/**
 * System settings shell — top tab bar (7 categories) + RouterView content area.
 * Layout: PageHero (title + tab strip) / content panel below.
 * Root-only page; access guard is handled by the router.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, RouterView, RouterLink } from 'vue-router'
import { useSystemSettings } from '@/composables/useSystemSettings'
import { onMounted } from 'vue'

const { t } = useI18n()
const route = useRoute()
const { load } = useSystemSettings()

const tabs = computed(() => [
  { key: 'system-settings-site',       label: t('systemSettings.tabs.site') },
  { key: 'system-settings-auth',       label: t('systemSettings.tabs.auth') },
  { key: 'system-settings-billing',    label: t('systemSettings.tabs.billing') },
  { key: 'system-settings-models',     label: t('systemSettings.tabs.models') },
  { key: 'system-settings-security',   label: t('systemSettings.tabs.security') },
  { key: 'system-settings-content',    label: t('systemSettings.tabs.content') },
  { key: 'system-settings-operations', label: t('systemSettings.tabs.operations') },
])

const activeTab = computed(() => String(route.name ?? ''))

// Pre-fetch all options once on mount so sub-views share the same data
onMounted(() => load())
</script>

<template>
  <div data-handdrawn-page="system-settings">
    <!-- Page hero -->
    <div class="mb-0" data-handdrawn="page-hero">
      <nav class="mb-1 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
        <span>{{ t('systemSettings.breadcrumb[0]') }}</span>
        <span aria-hidden="true">/</span>
        <span class="text-[var(--text-secondary)]">{{ t('systemSettings.breadcrumb[1]') }}</span>
      </nav>
      <h1 class="gesture-mark display-title text-4xl font-bold text-[var(--text-primary)] lg:text-5xl leading-tight">
        {{ t('systemSettings.title') }}
      </h1>
    </div>

    <!-- Top tab bar -->
    <div
      class="console-tabs mt-6 flex items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)]"
      role="tablist"
      :aria-label="t('systemSettings.title')"
      data-handdrawn="tabs"
    >
      <RouterLink
        v-for="tab in tabs"
        :key="tab.key"
        :to="{ name: tab.key }"
        role="tab"
        :aria-selected="activeTab === tab.key"
        class="sys-tab shrink-0 relative pb-3 text-sm font-medium transition-colors focus-ring"
        :class="
          activeTab === tab.key
            ? 'text-[var(--text-primary)]'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
        "
      >
        <span
          :class="activeTab === tab.key ? 'brush-highlight' : ''"
          style="position: relative; z-index: 0"
        >{{ tab.label }}</span>
        <span
          v-if="activeTab === tab.key"
          class="active-bar absolute inset-x-0 -bottom-px"
          aria-hidden="true"
        />
      </RouterLink>
    </div>

    <!-- Content -->
    <div class="mt-8">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.console-tabs {
  scrollbar-width: none;
}
.console-tabs::-webkit-scrollbar {
  display: none;
}

.sys-tab {
  padding-right: 0.25rem;
  padding-left: 0.25rem;
  margin-right: 1.25rem;
}

.active-bar {
  height: 2.5px;
  background: var(--accent);
  border-radius: 9999px;
  clip-path: var(--tab-bar-clip, none);
  box-shadow: var(--tab-bar-glow, none);
}
</style>
