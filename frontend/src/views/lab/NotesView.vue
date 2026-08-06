<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/common/SearchInput.vue'
import { useFeatureAccess } from '@/composables/useFeatureAccess'
import { useLabNotes } from '@/composables/useLab'
import { useToast } from '@/composables/useToast'
import { relativeTime } from '@/utils/format'

const { t } = useI18n()
const toast = useToast()
const { readOnly } = useFeatureAccess('lab', 'prototype')
const { loading, items, load } = useLabNotes()

const keyword = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return kw
    ? items.value.filter(
        (n) =>
          n.title.toLowerCase().includes(kw) ||
          n.excerpt.toLowerCase().includes(kw)
      )
    : items.value
})

// Create shortcuts — tri-color badges per THEMES.md §1.2 (soft fill + strong
// icon, small area only; never a large color block).
const createCards = computed(() => [
  {
    id: 'new',
    labelKey: 'lab.notes.createNew',
    bg: 'var(--accent-soft)',
    fg: 'var(--accent-text)',
    icon: 'M12 5v14M5 12h14',
  },
  {
    id: 'upload',
    labelKey: 'lab.notes.uploadFile',
    bg: 'var(--status-info-soft)',
    fg: 'var(--status-info-text)',
    icon: 'M12 16V4M6 10l6-6 6 6M4 20h16',
  },
  {
    id: 'import',
    labelKey: 'lab.notes.importMd',
    bg: 'var(--support-soft, var(--status-warning-soft))',
    fg: 'var(--status-warning-text)',
    icon: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z',
  },
])

onMounted(() => void load())

function create() {
  if (readOnly.value) return
  toast.info(t('lab.prototypeToast'))
}
</script>

<template>
  <div class="subtle-scroll h-full overflow-y-auto" data-handdrawn-page="notes">
    <div class="mx-auto max-w-[1100px] px-4 pb-8 pt-14 sm:px-6">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1
          class="gesture-mark text-2xl font-bold tracking-tight text-[var(--text-primary)]"
        >
          {{ t('lab.notes.title') }}
        </h1>
        <div class="flex items-center gap-2">
          <SearchInput
            v-model="keyword"
            :placeholder="t('lab.notes.search')"
            class="w-48"
          />
          <button
            type="button"
            class="pencil-control flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] transition-all hover:bg-[var(--accent-hover)] focus-ring"
            data-handdrawn="control"
            :disabled="readOnly"
            @click="create"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {{ t('lab.notes.new') }}
          </button>
        </div>
      </div>

      <!-- create shortcut cards -->
      <div class="mb-8 grid gap-4 sm:grid-cols-3">
        <button
          v-for="card in createCards"
          :key="card.id"
          type="button"
          class="pencil-surface group flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 text-left shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-shadow-hover)] focus-ring"
          data-handdrawn="surface"
          :disabled="readOnly"
          @click="create"
        >
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            :style="{ background: card.bg }"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              :stroke="card.fg"
              stroke-width="1.9"
            >
              <path :d="card.icon" />
            </svg>
          </span>
          <span class="text-sm font-semibold text-[var(--text-primary)]">{{
            t(card.labelKey)
          }}</span>
        </button>
      </div>

      <!-- notes grid -->
      <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="i in 6"
          :key="i"
          class="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
        />
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="note in filtered"
          :key="note.id"
          class="pencil-surface group flex cursor-pointer flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-shadow-hover)]"
          data-handdrawn="surface"
          role="button"
          :tabindex="readOnly ? -1 : 0"
          :aria-disabled="readOnly"
          @click="create"
          @keydown.enter="create"
          @keydown.space.prevent="create"
        >
          <h3
            class="mb-2 truncate text-sm font-semibold text-[var(--text-primary)]"
          >
            {{ note.title }}
          </h3>
          <p
            class="mb-4 line-clamp-3 flex-1 text-xs leading-relaxed text-[var(--text-tertiary)]"
          >
            {{ note.excerpt }}
          </p>
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 flex-wrap gap-1.5">
              <span
                v-for="tag in note.tags"
                :key="tag"
                class="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
                data-handdrawn="chip"
              >
                {{ tag }}
              </span>
            </div>
            <span class="shrink-0 text-[11px] text-[var(--text-tertiary)]">{{
              relativeTime(note.updatedAt)
            }}</span>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
