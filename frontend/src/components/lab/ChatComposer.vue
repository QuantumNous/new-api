<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FilterSelect, {
  type SelectOption,
} from '@/components/common/FilterSelect.vue'
import type { LabModelPick } from '@/types/lab'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    models: LabModelPick[]
    /** open the model dropdown upward (composer pinned to the bottom) */
    direction?: 'down' | 'up'
  }>(),
  { direction: 'down' }
)

const text = defineModel<string>({ default: '' })
const emit = defineEmits<{ send: [] }>()

const deepThink = ref(false)
const activeModel = ref(props.models[0]?.id ?? '')

const modelOptions = computed<SelectOption[]>(() =>
  props.models.map((m) => ({ value: m.id, label: m.name }))
)

const canSend = computed(() => text.value.trim().length > 0)

function onEnter(e: KeyboardEvent) {
  // Ctrl/Cmd+Enter sends; plain Enter inserts a newline (design 图1 hint).
  if ((e.ctrlKey || e.metaKey) && canSend.value) {
    e.preventDefault()
    emit('send')
  }
}
</script>

<template>
  <div
    class="pencil-surface-strong rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)] transition-shadow focus-within:shadow-[var(--card-shadow-hover)]"
    data-handdrawn="surface-strong"
  >
    <textarea
      v-model="text"
      rows="3"
      :placeholder="t('lab.chat.composerPlaceholder')"
      class="block w-full resize-none border-0 bg-transparent px-4 pt-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
      @keydown.enter="onEnter"
    />

    <div class="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
      <div class="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring"
          :aria-label="t('lab.chat.attach')"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          class="pencil-control flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors focus-ring"
          data-handdrawn="control"
          :style="
            deepThink
              ? 'background:var(--accent-soft);color:var(--accent-text)'
              : 'color:var(--text-tertiary)'
          "
          :aria-pressed="deepThink"
          @click="deepThink = !deepThink"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path
              d="M12 3a7 7 0 0 0-4 12.7V18a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 3ZM9 22h6"
            />
          </svg>
          {{ t('lab.chat.deepThink') }}
        </button>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <FilterSelect
          v-model="activeModel"
          :options="modelOptions"
          :label="t('lab.chat.model')"
          :direction="direction"
          size="sm"
        />
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] transition-all hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
          :disabled="!canSend"
          :aria-label="t('lab.chat.send')"
          @click="emit('send')"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
