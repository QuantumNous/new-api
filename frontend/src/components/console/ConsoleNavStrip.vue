<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { consoleNavGroups } from '@/constants/navigation/consoleNav'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const allItems = computed(() => consoleNavGroups.flatMap((g) => g.items))

const activeName = computed(
  () =>
    allItems.value.find(
      (i) => i.route && (i.route === route.name || i.route === route.meta.nav)
    )?.name ?? null
)
</script>

<template>
  <nav
    class="strip flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-solid)] px-3 py-2 lg:hidden"
    :aria-label="t('nav.console')"
    data-handdrawn="navigation-strip"
  >
    <button
      v-for="item in allItems"
      :key="item.name"
      type="button"
      class="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-ring"
      :class="item.disabled ? 'cursor-not-allowed opacity-40' : ''"
      :style="
        item.name === activeName
          ? 'background:var(--accent);color:var(--accent-contrast)'
          : 'color:var(--text-secondary)'
      "
      :disabled="item.disabled"
      :aria-current="item.name === activeName ? 'page' : undefined"
      @click="!item.disabled && item.route && router.push({ name: item.route })"
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
    </button>
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
