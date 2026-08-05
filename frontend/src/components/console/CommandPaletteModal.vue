<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import ConsoleModal from '@/components/common/ConsoleModal.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import {
  consoleNavTools,
  getAccessibleConsoleNavGroups,
} from '@/constants/navigation/consoleNav'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

// Routes, labels, icons and access rules stay aligned with the sidebar.
const entries = computed(() =>
  [
    ...getAccessibleConsoleNavGroups({
      isAdmin: auth.isAdmin,
      hasPermission: auth.hasPermission,
    }).flatMap((group) => group.items),
    ...consoleNavTools,
  ]
    .filter((item) => item.route && !item.disabled)
    .map((item) => ({
      route: item.route as string,
      labelKey: item.labelKey,
      icon: item.icon,
    }))
)

const query = ref('')
const activeIndex = ref(0)
const inputWrap = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const listboxId = useId()

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter((entry) =>
    t(entry.labelKey).toLowerCase().includes(q)
  )
})

const activeOptionId = computed(() =>
  filtered.value.length ? `${listboxId}-option-${activeIndex.value}` : undefined
)

function go(routeName: string) {
  emit('close')
  router.push({ name: routeName })
}

function moveActive(delta: number) {
  const count = filtered.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + delta + count) % count
  nextTick(() => {
    listRef.value
      ?.querySelector<HTMLElement>(`#${CSS.escape(activeOptionId.value ?? '')}`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveActive(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveActive(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const entry = filtered.value[activeIndex.value]
    if (entry) go(entry.route)
  }
}

watch(query, () => {
  activeIndex.value = 0
})

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    inputWrap.value?.querySelector('input')?.focus()
  }
)
</script>

<template>
  <ConsoleModal
    :open="open"
    :aria-label="t('nav.search')"
    @close="emit('close')"
  >
    <div @keydown="onKeydown">
      <div ref="inputWrap">
        <SearchInput
          v-model="query"
          :placeholder="t('nav.search')"
          :aria-label="t('nav.search')"
          name="command-search"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="filtered.length > 0"
          :aria-controls="listboxId"
          :aria-activedescendant="activeOptionId"
        />
      </div>
      <div
        :id="listboxId"
        ref="listRef"
        role="listbox"
        :aria-label="t('nav.search')"
        class="subtle-scroll mt-3 max-h-80 overflow-y-auto"
      >
        <button
          v-for="(entry, index) in filtered"
          :id="`${listboxId}-option-${index}`"
          :key="entry.route"
          type="button"
          role="option"
          :aria-selected="index === activeIndex"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
          :class="{ 'bg-[var(--surface-muted)]': index === activeIndex }"
          @click="go(entry.route)"
          @mousemove="activeIndex = index"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            class="shrink-0 text-[var(--text-tertiary)]"
          >
            <path :d="entry.icon" />
          </svg>
          {{ t(entry.labelKey) }}
        </button>
        <div
          v-if="!filtered.length"
          class="flex flex-col items-center gap-2 px-3 py-6 text-center"
        >
          <p class="text-sm text-[var(--text-tertiary)]">
            {{ t('nav.searchNoResults') }}
          </p>
        </div>
      </div>
    </div>
  </ConsoleModal>
</template>
