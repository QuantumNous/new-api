<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleTabs, { type TabItem } from '@/components/common/ConsoleTabs.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import SegmentedToggle from '@/components/common/SegmentedToggle.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useLabAssets } from '@/composables/useLab'
import { useToast } from '@/composables/useToast'
import { formatBytes, relativeTime } from '@/utils/format'
import { safeImageUrl } from '@/utils/safeUrl'
import type { AssetItem, AssetKind } from '@/types/lab'

const { t } = useI18n()
const toast = useToast()
const { loading, items, storage, load } = useLabAssets()

const safeCover = (value: string | undefined) => safeImageUrl(value)

const tab = ref('all')
const view = ref<'list' | 'grid'>('list')
const keyword = ref('')

const tabs = computed<TabItem[]>(() => [
  { key: 'all', label: t('lab.assets.tabAll') },
  { key: 'doc', label: t('lab.assets.tabDocs') },
  { key: 'media', label: t('lab.assets.tabMedia') },
  { key: 'code', label: t('lab.assets.tabCode') },
])

const viewOptions = computed(() => [
  {
    value: 'list',
    ariaLabel: t('lab.assets.viewList'),
    icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  },
  {
    value: 'grid',
    ariaLabel: t('lab.assets.viewGrid'),
    icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  },
])

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return kw
    ? items.value.filter((a) => a.name.toLowerCase().includes(kw))
    : items.value
})

const KIND_ICON: Record<AssetKind, string> = {
  doc: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z',
  image:
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM21 15l-5-5L5 21',
  video:
    'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM10 9l5 3-5 3z',
  code: 'm8 6-6 6 6 6M16 6l6 6-6 6',
  sheet: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16',
}

const SOURCE_KEY: Record<string, string> = {
  chat: 'lab.assets.srcChat',
  studio: 'lab.assets.srcStudio',
  upload: 'lab.assets.srcUpload',
}

const storagePct = computed(() =>
  storage.value
    ? Math.min(100, (storage.value.usedBytes / storage.value.totalBytes) * 100)
    : 0
)

function reload() {
  void load(tab.value)
}
onMounted(reload)
watch(tab, reload)

function upload() {
  toast.info(t('lab.prototypeToast'))
}
function rowAction(_item: AssetItem) {
  toast.info(t('lab.prototypeToast'))
}
</script>

<template>
  <div
    class="subtle-scroll h-full overflow-y-auto"
    data-handdrawn-page="assets"
  >
    <div class="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <!-- header -->
      <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            class="gesture-mark text-2xl font-bold tracking-tight text-[var(--text-primary)]"
          >
            {{ t('lab.assets.title') }}
          </h1>
          <div v-if="storage" class="mt-2 flex items-center gap-3">
            <div
              class="pencil-progress h-1.5 w-40 overflow-hidden rounded-full bg-[var(--surface-muted)]"
            >
              <div
                class="h-full rounded-full bg-[var(--accent)]"
                :style="{ width: `${storagePct}%` }"
              />
            </div>
            <span class="text-xs text-[var(--text-tertiary)]">
              {{
                t('lab.assets.storage', {
                  used: formatBytes(storage.usedBytes),
                  total: formatBytes(storage.totalBytes),
                })
              }}
            </span>
          </div>
        </div>
        <button
          type="button"
          class="pencil-control flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] transition-all hover:bg-[var(--accent-hover)] focus-ring"
          data-handdrawn="control"
          @click="upload"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
          </svg>
          {{ t('lab.assets.upload') }}
        </button>
      </div>

      <!-- toolbar -->
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ConsoleTabs v-model="tab" :items="tabs" class="flex-1" />
        <div class="flex items-center gap-2">
          <SearchInput
            v-model="keyword"
            :placeholder="t('lab.assets.search')"
            class="w-48"
          />
          <SegmentedToggle
            v-model="view"
            :options="viewOptions"
            :label="t('lab.assets.viewMode')"
            size="sm"
          />
        </div>
      </div>

      <!-- list view -->
      <div
        v-if="view === 'list'"
        class="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
        data-handdrawn="ledger-list"
      >
        <div
          class="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-table-header)] px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]"
        >
          <span class="flex-1">{{ t('lab.assets.colName') }}</span>
          <span class="hidden w-24 sm:block">{{
            t('lab.assets.colSource')
          }}</span>
          <span class="w-20 text-right">{{ t('lab.assets.colSize') }}</span>
          <span class="hidden w-24 text-right md:block">{{
            t('lab.assets.colOpened')
          }}</span>
          <span class="w-8" />
        </div>

        <div v-if="loading">
          <div
            v-for="i in 8"
            :key="i"
            class="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-0"
          >
            <div
              class="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-[var(--surface-muted)]"
            />
            <div
              class="h-4 flex-1 animate-pulse rounded bg-[var(--surface-muted)]"
            />
          </div>
        </div>

        <template v-else-if="filtered.length">
          <div
            v-for="item in filtered"
            :key="item.id"
            class="group flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 transition-colors last:border-0 hover:bg-[var(--surface-muted)]"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--text-secondary)]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path :d="KIND_ICON[item.kind]" />
              </svg>
            </span>
            <span
              class="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]"
              >{{ item.name }}</span
            >
            <span
              class="hidden w-24 text-xs text-[var(--text-tertiary)] sm:block"
              >{{ t(SOURCE_KEY[item.source]) }}</span
            >
            <span class="w-20 text-right text-xs text-[var(--text-tertiary)]">{{
              formatBytes(item.size)
            }}</span>
            <span
              class="hidden w-24 text-right text-xs text-[var(--text-tertiary)] md:block"
              >{{ relativeTime(item.updatedAt) }}</span
            >
            <button
              type="button"
              class="touch-row-action flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] opacity-0 transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring group-hover:opacity-100"
              :aria-label="t('lab.assets.more')"
              @click="rowAction(item)"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
          </div>
        </template>

        <EmptyState
          v-else
          :title="t('lab.assets.emptyTitle')"
          :hint="t('lab.assets.emptyHint')"
        />
      </div>

      <!-- grid view -->
      <div v-else>
        <div
          v-if="loading"
          class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          <div
            v-for="i in 8"
            :key="i"
            class="aspect-square animate-pulse rounded-2xl bg-[var(--surface-muted)]"
          />
        </div>
        <div
          v-else-if="filtered.length"
          class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          <figure
            v-for="item in filtered"
            :key="item.id"
            class="pencil-surface group overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-shadow-hover)]"
            data-handdrawn="surface-clipped"
          >
            <div
              class="aspect-square overflow-hidden bg-[var(--surface-muted)]"
            >
              <img
                v-if="safeCover(item.cover)"
                :src="safeCover(item.cover)!"
                :alt="item.name"
                class="h-full w-full object-cover"
                loading="lazy"
              />
              <div
                v-else
                class="flex h-full items-center justify-center text-[var(--text-tertiary)]"
              >
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path :d="KIND_ICON[item.kind]" />
                </svg>
              </div>
            </div>
            <figcaption
              class="flex items-center justify-between gap-2 px-3 py-2.5"
            >
              <span
                class="min-w-0 truncate text-xs font-medium text-[var(--text-primary)]"
                >{{ item.name }}</span
              >
              <span class="shrink-0 text-[11px] text-[var(--text-tertiary)]">{{
                formatBytes(item.size)
              }}</span>
            </figcaption>
          </figure>
        </div>
        <EmptyState
          v-else
          :title="t('lab.assets.emptyTitle')"
          :hint="t('lab.assets.emptyHint')"
        />
      </div>
    </div>
  </div>
</template>
