<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { labNavItems } from '@/constants/navigation/labNav'

const { t } = useI18n()
const route = useRoute()
const activeItem = ref<HTMLElement | null>(null)

const activeName = computed(() => {
  const current =
    route.name === 'lab-chat-session'
      ? 'lab-chat'
      : ((route.meta.nav || route.name) as string | undefined)
  return labNavItems.find((item) => item.route === current)?.name ?? null
})

function setActiveItem(element: unknown): void {
  const candidate =
    element instanceof HTMLElement
      ? element
      : (element as { $el?: unknown } | null)?.$el
  activeItem.value = candidate instanceof HTMLElement ? candidate : null
}

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
    class="lab-strip flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-solid)] px-3 py-2 lg:hidden"
    :aria-label="t('nav.alchemy')"
    data-handdrawn="navigation-strip"
  >
    <RouterLink
      v-for="item in labNavItems"
      :key="item.name"
      :ref="item.name === activeName ? setActiveItem : undefined"
      :to="{ name: item.route }"
      class="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors focus-ring"
      :style="
        item.name === activeName
          ? 'background:var(--accent);color:var(--accent-contrast)'
          : undefined
      "
      :aria-current="item.name === activeName ? 'page' : undefined"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <path :d="item.icon" />
      </svg>
      {{ t(item.labelKey) }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.lab-strip {
  scrollbar-width: none;
}

.lab-strip::-webkit-scrollbar {
  display: none;
}
</style>
