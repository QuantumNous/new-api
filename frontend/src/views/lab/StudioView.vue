<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FilterSelect, {
  type SelectOption,
} from '@/components/common/FilterSelect.vue'
import SegmentedToggle from '@/components/common/SegmentedToggle.vue'
import GalleryMasonry, {
  type GalleryTile,
} from '@/components/lab/GalleryMasonry.vue'
import { useLabStudio } from '@/composables/useLab'
import { useToast } from '@/composables/useToast'
import { formatDuration } from '@/utils/format'
import type { StudioKind } from '@/types/lab'

const { t } = useI18n()
const toast = useToast()
const { loading, works, tools, load } = useLabStudio()

const prompt = ref('')
const kind = ref<StudioKind>('image')

const kindOptions = computed(() => [
  { value: 'image', label: t('lab.studio.image') },
  { value: 'video', label: t('lab.studio.video') },
])

// Parameters swap with the mode: styles for image, duration for video.
const modelOptions: SelectOption[] = [
  { value: '4.5', label: t('lab.studio.model', { v: '4.5' }) },
  { value: '4.0', label: t('lab.studio.model', { v: '4.0' }) },
]
const ratioOptions: SelectOption[] = [
  { value: '1:1', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
]
const styleOptions = computed<SelectOption[]>(() => [
  { value: 'real', label: t('lab.studio.styleReal') },
  { value: 'illust', label: t('lab.studio.styleIllust') },
  { value: 'chinese', label: t('lab.studio.styleChinese') },
  { value: 'cyber', label: t('lab.studio.styleCyber') },
])
const durationOptions: SelectOption[] = [
  { value: '5', label: '5s' },
  { value: '8', label: '8s' },
  { value: '10', label: '10s' },
]

const model = ref('4.5')
const ratio = ref('3:4')
const style = ref('real')
const duration = ref('5')

const tiles = computed<GalleryTile[]>(() =>
  works.value.map((w) => ({
    id: w.id,
    cover: w.cover,
    caption: w.prompt,
    badge: w.kind === 'video' ? formatDuration(w.duration ?? 0) : undefined,
    meta: w.model,
  }))
)

function reload() {
  void load(kind.value)
}
onMounted(reload)
watch(kind, reload)

function generate() {
  if (!prompt.value.trim()) return
  toast.info(t('lab.prototypeToast'))
}
function runTool() {
  toast.info(t('lab.prototypeToast'))
}
</script>

<template>
  <div
    class="subtle-scroll h-full overflow-y-auto"
    data-handdrawn-page="studio"
  >
    <div class="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
      <div class="mb-6 text-center">
        <h1
          class="gesture-mark text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl"
        >
          {{ t('lab.studio.title') }}
        </h1>
        <p class="mt-1.5 text-sm text-[var(--text-tertiary)]">
          {{ t('lab.studio.subtitle') }}
        </p>
      </div>

      <!-- prompt composer -->
      <div
        class="pencil-surface-strong mx-auto max-w-[760px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-2 shadow-[var(--card-shadow)]"
        data-handdrawn="surface-strong"
      >
        <textarea
          v-model="prompt"
          rows="2"
          :placeholder="t('lab.studio.placeholder')"
          class="block w-full resize-none border-0 bg-transparent px-3 pt-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
        />
        <div class="flex flex-wrap items-center gap-2 px-1 pb-1 pt-2">
          <SegmentedToggle
            v-model="kind"
            :options="kindOptions"
            :label="t('lab.studio.mode')"
            size="sm"
          />
          <button
            type="button"
            class="pencil-control flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring"
            data-handdrawn="control"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {{ t('lab.studio.reference') }}
          </button>
          <FilterSelect
            v-model="model"
            :options="modelOptions"
            :label="t('lab.studio.modelLabel')"
            size="sm"
          />
          <FilterSelect
            v-model="ratio"
            :options="ratioOptions"
            :label="t('lab.studio.ratio')"
            size="sm"
          />
          <FilterSelect
            v-if="kind === 'image'"
            v-model="style"
            :options="styleOptions"
            :label="t('lab.studio.style')"
            size="sm"
          />
          <FilterSelect
            v-else
            v-model="duration"
            :options="durationOptions"
            :label="t('lab.studio.duration')"
            size="sm"
          />
          <button
            type="button"
            class="pencil-control ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] transition-all hover:bg-[var(--accent-hover)] disabled:opacity-40 focus-ring"
            data-handdrawn="control"
            :disabled="!prompt.trim()"
            @click="generate"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10z" />
            </svg>
            {{ t('lab.studio.generate') }}
          </button>
        </div>
      </div>

      <!-- quick tools -->
      <div
        class="mx-auto mt-4 flex max-w-[760px] flex-wrap items-center justify-center gap-2"
      >
        <button
          v-for="tool in tools"
          :key="tool.id"
          type="button"
          class="pencil-control flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-ring"
          data-handdrawn="control"
          @click="runTool"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path :d="tool.icon" />
          </svg>
          {{ t(tool.labelKey) }}
        </button>
      </div>

      <!-- gallery -->
      <div class="mt-10">
        <h2 class="mb-4 text-sm font-semibold text-[var(--text-primary)]">
          {{ t('lab.studio.gallery') }}
        </h2>
        <GalleryMasonry :tiles="tiles" :loading="loading" :skeleton-count="8" />
      </div>
    </div>
  </div>
</template>
