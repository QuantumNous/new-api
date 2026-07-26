<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import {
  consoleNavGroups,
  consoleNavTools,
} from '@/constants/navigation/consoleNav'
import { useSidebarCollapsed } from '@/composables/useSidebarCollapsed'
import { useAppStore } from '@/stores'

const { t } = useI18n()
const route = useRoute()
const app = useAppStore()

const collapsed = useSidebarCollapsed()

const AUTO_COLLAPSE_KEY = 'ren2hub_activity_auto_collapsed'
watch(
  () => route.name,
  (name) => {
    if (name !== 'activity') return
    try {
      if (window.sessionStorage.getItem(AUTO_COLLAPSE_KEY) === '1') return
      window.sessionStorage.setItem(AUTO_COLLAPSE_KEY, '1')
    } catch {
      // sessionStorage unavailable — collapse on each entry as before.
    }
    collapsed.value = true
  },
  { immediate: true }
)

const activeName = computed(() => {
  const matches = (routeName: string) =>
    routeName === route.name || routeName === route.meta.nav
  for (const group of consoleNavGroups) {
    for (const item of group.items) {
      if (item.route && matches(item.route)) return item.name
    }
  }
  for (const item of consoleNavTools) {
    if (item.route && matches(item.route)) return item.name
  }
  return null
})

function navComponent(item: { route?: string; disabled?: boolean }) {
  return !item.disabled && item.route ? RouterLink : 'button'
}

defineExpose({ collapsed })
</script>

<template>
  <aside
    class="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-solid)] texture-paper transition-[width] duration-[250ms] lg:flex"
    :style="{ width: collapsed ? '64px' : '220px' }"
  >
    <!-- brand header: serif typeface for hand-crafted feel -->
    <RouterLink
      :to="{ name: 'dashboard' }"
      class="flex h-16 shrink-0 items-center border-b border-[var(--border-subtle)] transition-all"
      :class="collapsed ? 'justify-center px-0' : 'gap-2.5 px-6'"
      :aria-label="`${app.systemName} ${t('nav.dashboard')}`"
    >
      <img
        :src="app.logo"
        alt=""
        aria-hidden="true"
        class="h-7 w-7 shrink-0 object-contain"
        style="filter: drop-shadow(0 1px 2px rgba(56, 55, 43, 0.18))"
      />
      <span
        v-if="!collapsed"
        class="display-title truncate text-lg font-bold tracking-tight text-[var(--text-primary)]"
      >
        {{ app.systemName }}
      </span>
    </RouterLink>

    <div
      class="subtle-scroll flex min-h-0 flex-1 flex-col overflow-y-auto py-4"
    >
      <!-- nav groups -->
      <div
        v-for="group in consoleNavGroups"
        :key="group.key"
        :class="['px-3', { 'mb-5': !collapsed }]"
      >
        <!-- group label: hand-drawn rust-red tick + wide-tracking text -->
        <div v-if="!collapsed" class="mb-1 flex items-center gap-2 px-3 py-0.5">
          <!-- bamboo-node style: a cluster of short horizontal rules -->
          <div class="flex flex-col gap-[3px] shrink-0" aria-hidden="true">
            <span
              class="block h-px w-3 rounded-full"
              style="background: var(--status-danger); opacity: 0.7"
            />
            <span
              class="block h-px w-2 rounded-full"
              style="background: var(--status-danger); opacity: 0.45"
            />
          </div>
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]"
          >
            {{ t(group.labelKey) }}
          </span>
        </div>

        <ul class="space-y-0.5">
          <li v-for="item in group.items" :key="item.name">
            <component
              :is="navComponent(item)"
              :to="
                !item.disabled && item.route ? { name: item.route } : undefined
              "
              :type="item.disabled || !item.route ? 'button' : undefined"
              class="group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all focus-ring"
              :class="[
                item.disabled
                  ? 'cursor-not-allowed opacity-40'
                  : activeName === item.name
                    ? ''
                    : 'hover:bg-[var(--surface-warm-tile)]',
                collapsed ? 'justify-center' : '',
              ]"
              :style="
                activeName === item.name && !item.disabled
                  ? 'color:var(--text-primary);background:var(--surface-muted)'
                  : 'color:var(--text-secondary)'
              "
              :disabled="item.disabled || undefined"
              :title="
                collapsed
                  ? t(item.labelKey)
                  : item.disabled
                    ? t('nav.comingSoon')
                    : undefined
              "
              :aria-current="activeName === item.name ? 'page' : undefined"
            >
              <!-- active indicator: wider brush-stroke bar with rounded caps -->
              <span
                v-if="activeName === item.name && !collapsed"
                class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                style="background: var(--accent)"
                aria-hidden="true"
              />

              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                :class="
                  activeName === item.name ? 'text-[var(--accent-text)]' : ''
                "
              >
                <path :d="item.icon" />
              </svg>

              <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-left">
                {{ t(item.labelKey) }}
              </span>

              <span
                v-if="!collapsed && item.disabled"
                class="shrink-0 rounded bg-[var(--surface-muted)] px-1.5 py-px text-[10px] text-[var(--text-tertiary)]"
              >
                {{ t('nav.comingSoon') }}
              </span>
            </component>
          </li>
        </ul>
      </div>
    </div>

    <!-- bottom tools: ink-brush divider by day, gold hairline by night -->
    <div class="shrink-0 px-3 py-3">
      <div class="ink-divider mb-3 -mx-3" aria-hidden="true" />
      <ul class="space-y-0.5">
        <li v-for="item in consoleNavTools" :key="item.name">
          <component
            :is="navComponent(item)"
            :to="
              !item.disabled && item.route ? { name: item.route } : undefined
            "
            :type="item.disabled || !item.route ? 'button' : undefined"
            class="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-xs font-medium transition-all focus-ring"
            :class="[
              item.disabled
                ? 'cursor-not-allowed opacity-40'
                : 'hover:bg-[var(--surface-warm-tile)]',
              collapsed ? 'justify-center' : '',
            ]"
            style="color: var(--text-tertiary)"
            :disabled="item.disabled || undefined"
            :title="
              collapsed
                ? t(item.labelKey)
                : item.disabled
                  ? t('nav.comingSoon')
                  : undefined
            "
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path :d="item.icon" />
            </svg>
            <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-left">{{
              t(item.labelKey)
            }}</span>
          </component>
        </li>
      </ul>

      <!-- collapse toggle -->
      <button
        type="button"
        class="mt-2 flex h-9 w-full items-center gap-3 rounded-xl px-3 text-xs font-medium text-[var(--text-tertiary)] transition-all hover:bg-[var(--surface-warm-tile)] focus-ring"
        :class="collapsed ? 'justify-center' : ''"
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
          stroke-linecap="round"
          stroke-linejoin="round"
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
