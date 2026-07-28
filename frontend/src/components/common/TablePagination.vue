<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FilterSelect from './FilterSelect.vue'

const props = withDefaults(
  defineProps<{
    page: number
    pageSize: number
    total: number
    pageSizes?: number[]
  }>(),
  { pageSizes: () => [10, 20, 50] }
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
}>()

const { t } = useI18n()

// FilterSelect speaks strings; bridge to the numeric pageSize model.
const pageSizeOptions = computed(() =>
  props.pageSizes.map((size) => ({
    value: String(size),
    label: t('common.pageSize', { size }),
  }))
)
const pageSizeModel = computed({
  get: () => String(props.pageSize),
  set: (v: string) => {
    // Changing page size invalidates the current page number (e.g. page 5 at
    // size 10 may not exist at size 50), so reset to page 1. Emitting both in
    // the same tick lets the consumer's watch reload once with the new values.
    if (props.page !== 1) emit('update:page', 1)
    emit('update:pageSize', Number(v))
  },
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(props.total / props.pageSize))
)

const pageItems = computed<Array<number | '…'>>(() => {
  const count = pageCount.value
  const cur = props.page
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const items: Array<number | '…'> = [1]
  const start = Math.max(2, cur - 1)
  const end = Math.min(count - 1, cur + 1)
  if (start > 2) items.push('…')
  for (let i = start; i <= end; i++) items.push(i)
  if (end < count - 1) items.push('…')
  items.push(count)
  return items
})
</script>

<template>
  <div
    class="flex flex-col gap-3 px-3 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    data-handdrawn="pagination"
  >
    <!-- Compact navigation keeps mobile targets reachable without making the
         whole document wider than the viewport. Desktop retains number links. -->
    <div
      v-if="pageCount > 1"
      class="flex items-center justify-between sm:hidden"
    >
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors enabled:hover:bg-[var(--surface-muted)] enabled:hover:text-[var(--text-primary)] disabled:opacity-40"
        :disabled="page <= 1"
        :aria-label="t('common.prevPage')"
        @click="emit('update:page', page - 1)"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
      <span class="font-medium text-[var(--text-secondary)]" aria-live="polite">
        {{ t('common.pageProgress', { page, count: pageCount }) }}
      </span>
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors enabled:hover:bg-[var(--surface-muted)] enabled:hover:text-[var(--text-primary)] disabled:opacity-40"
        :disabled="page >= pageCount"
        :aria-label="t('common.nextPage')"
        @click="emit('update:page', page + 1)"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>

    <div v-if="pageCount > 1" class="hidden items-center gap-1 sm:flex">
      <button
        type="button"
        class="flex h-9 min-w-9 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors enabled:hover:bg-[var(--surface-muted)] enabled:hover:text-[var(--text-primary)] disabled:opacity-40"
        :disabled="page <= 1"
        :aria-label="t('common.prevPage')"
        @click="emit('update:page', page - 1)"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
      <template v-for="(item, i) in pageItems" :key="i">
        <span v-if="item === '…'" class="px-1 text-[var(--text-tertiary)]"
          >…</span
        >
        <button
          v-else
          type="button"
          class="h-9 min-w-9 rounded-md px-2.5 font-medium transition-colors"
          :style="
            item === page
              ? 'background:var(--accent);color:var(--accent-contrast)'
              : 'color:var(--text-secondary)'
          "
          :class="{
            'hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]':
              item !== page,
          }"
          :aria-current="item === page ? 'page' : undefined"
          :aria-label="t('common.goToPage', { page: item })"
          @click="emit('update:page', item)"
        >
          {{ item }}
        </button>
      </template>
      <button
        type="button"
        class="flex h-9 min-w-9 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors enabled:hover:bg-[var(--surface-muted)] enabled:hover:text-[var(--text-primary)] disabled:opacity-40"
        :disabled="page >= pageCount"
        :aria-label="t('common.nextPage')"
        @click="emit('update:page', page + 1)"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>

    <div
      class="flex items-center justify-between gap-3 text-[var(--text-tertiary)] sm:ml-auto sm:justify-start"
    >
      <span class="shrink-0">{{ t('common.pageInfo', { total }) }}</span>
      <FilterSelect
        v-model="pageSizeModel"
        :options="pageSizeOptions"
        :label="t('common.itemsPerPage')"
        direction="up"
        size="sm"
        class="w-32"
      />
    </div>
  </div>
</template>
