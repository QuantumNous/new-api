<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { consoleEntryRoute } from '@/constants/navigation/consoleNav'
import { labEntryRoute } from '@/constants/navigation/labNav'

interface NavChild {
  name: string
  labelKey: string
  route?: string
  disabled?: boolean
  icon?: string
}

interface NavGroup {
  name: string
  labelKey: string
  route?: string
  disabled?: boolean
  children?: NavChild[]
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const navGroups: NavGroup[] = [
  { name: 'activities', labelKey: 'nav.activities', route: 'activity' },
  { name: 'dashboard', labelKey: 'nav.dashboard', route: 'dashboard' },
  {
    // Direct link into the workspace layout; its sub-nav lives in the
    // Ledger Spine sidebar there, not in a dropdown here.
    name: 'console',
    labelKey: 'nav.console',
    route: consoleEntryRoute,
  },
  {
    // Plain link into the Lab layout — sub-nav lives in LabSidebar.
    name: 'alchemy',
    labelKey: 'nav.alchemy',
    route: labEntryRoute,
  },
  {
    name: 'community',
    labelKey: 'nav.community',
    children: [{ name: 'docs', labelKey: 'nav.docs', disabled: true }],
  },
]

const openGroup = ref<string | null>(null)
const root = ref<HTMLElement | null>(null)

const activeGroup = computed(() => {
  if (route.meta.topNav) return route.meta.topNav
  for (const group of navGroups) {
    if (group.route && route.name === group.route) return group.name
    if (group.children?.some((c) => c.route && route.name === c.route))
      return group.name
  }
  return null
})

function isActive(group: NavGroup) {
  return activeGroup.value === group.name
}

function onGroupClick(group: NavGroup) {
  if (group.disabled) return
  if (group.route) {
    openGroup.value = null
    router.push({ name: group.route })
    return
  }
  openGroup.value = openGroup.value === group.name ? null : group.name
}

function onChildClick(child: NavChild) {
  if (child.disabled || !child.route) return
  openGroup.value = null
  router.push({ name: child.route })
}

function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node))
    openGroup.value = null
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') openGroup.value = null
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="flex items-center justify-center gap-1">
    <div v-for="group in navGroups" :key="group.name" class="relative">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all focus-ring"
        :class="[
          group.disabled
            ? 'cursor-not-allowed opacity-50'
            : isActive(group)
              ? ''
              : 'hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]',
        ]"
        :style="
          isActive(group) && !group.disabled
            ? 'background:var(--accent);color:var(--accent-contrast)'
            : 'color:var(--text-secondary)'
        "
        :disabled="group.disabled"
        :title="group.disabled ? t('nav.comingSoon') : undefined"
        :aria-expanded="group.children ? openGroup === group.name : undefined"
        :aria-current="isActive(group) && group.route ? 'page' : undefined"
        @click="onGroupClick(group)"
      >
        {{ t(group.labelKey) }}
        <svg
          v-if="group.children"
          class="transition-transform"
          :class="{ 'rotate-180': openGroup === group.name }"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        v-if="group.children && openGroup === group.name"
        class="absolute left-1/2 top-12 z-40 w-52 -translate-x-1/2 rounded-2xl border border-[var(--overlay-border)] bg-[var(--surface-overlay)] py-1.5 shadow-[var(--overlay-shadow)] animate-scale-in"
        data-handdrawn="menu"
      >
        <button
          v-for="child in group.children"
          :key="child.name"
          type="button"
          class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors"
          :class="
            child.disabled
              ? 'cursor-not-allowed text-[var(--text-tertiary)] opacity-60'
              : 'text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
          "
          :disabled="child.disabled"
          @click="onChildClick(child)"
        >
          <svg
            v-if="child.icon"
            class="shrink-0 text-[var(--text-tertiary)]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
          >
            <path :d="child.icon" />
          </svg>
          <span class="min-w-0 flex-1 truncate">{{ t(child.labelKey) }}</span>
          <span
            v-if="child.disabled"
            class="rounded bg-[var(--surface-muted)] px-1.5 py-px text-[10px] text-[var(--text-tertiary)]"
          >
            {{ t('nav.comingSoon') }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
