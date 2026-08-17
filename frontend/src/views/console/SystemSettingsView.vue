<script setup lang="ts">
/**
 * System settings shell — top tab bar (7 categories) + RouterView content area.
 * Layout: PageBreadcrumb + Pill navigation tab strip / content panel below.
 * Root-only page; access guard is handled by the router.
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, RouterView, RouterLink } from 'vue-router'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import { useSystemSettings } from '@/composables/useSystemSettings'
import { SYSTEM_SETTINGS_DOMAINS } from '@/constants/systemSettingsCatalog'

const { t } = useI18n()
const route = useRoute()
const { load } = useSystemSettings()

const tabs = computed(() =>
  SYSTEM_SETTINGS_DOMAINS.map((domain) => ({
    key: `system-settings-${domain.id}`,
    label: t(domain.titleKey),
    section: domain.defaultSection,
  }))
)

const activeTab = computed(() => String(route.name ?? ''))

// Pre-fetch all options once on mount so sub-views share the same data
onMounted(() => load())
</script>

<template>
  <div data-handdrawn-page="system-settings" class="space-y-6">
    <!-- Breadcrumb with compact right-aligned domain switcher -->
    <PageBreadcrumb
      :crumbs="[
        t('systemSettings.breadcrumb[0]'),
        t('systemSettings.breadcrumb[1]'),
      ]"
    >
      <template #action>
        <div class="subtle-scroll max-w-full overflow-x-auto sm:ml-auto">
          <nav
            class="flex w-max items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-1 shadow-[var(--card-shadow)]"
            role="tablist"
            :aria-label="t('systemSettings.title')"
          >
            <RouterLink
              v-for="tab in tabs"
              :key="tab.key"
              :to="{ name: tab.key, params: { section: tab.section } }"
              role="tab"
              :aria-selected="activeTab === tab.key"
              class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all sm:text-sm focus-ring"
              :class="
                activeTab === tab.key
                  ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-text)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
              "
            >
              <span>{{ tab.label }}</span>
            </RouterLink>
          </nav>
        </div>
      </template>
    </PageBreadcrumb>

    <!-- Content -->
    <main class="min-w-0">
      <RouterView />
    </main>
  </div>
</template>
