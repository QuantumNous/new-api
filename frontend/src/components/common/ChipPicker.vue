<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    options: string[]
    placeholder?: string
    max?: number
  }>(),
  { placeholder: '', max: 0 }
)

const model = defineModel<string[]>({ default: () => [] })

const keyword = ref('')
const open = ref(false)
const inputId = useId()
let blurTimer: number | undefined

const filtered = computed(() => {
  const kw = keyword.value.toLowerCase()
  return props.options
    .filter((o) => !model.value.includes(o))
    .filter((o) => (kw ? o.toLowerCase().includes(kw) : true))
    .slice(0, 8)
})

function add(option: string) {
  if (props.max > 0 && model.value.length >= props.max) return
  model.value = [...model.value, option]
  keyword.value = ''
}

function remove(option: string) {
  model.value = model.value.filter((o) => o !== option)
}

function onBlur() {
  if (blurTimer) window.clearTimeout(blurTimer)
  blurTimer = window.setTimeout(() => {
    blurTimer = undefined
    open.value = false
  }, 150)
}

function onFocus() {
  if (blurTimer) window.clearTimeout(blurTimer)
  blurTimer = undefined
  open.value = true
}

onBeforeUnmount(() => {
  if (blurTimer) window.clearTimeout(blurTimer)
})
</script>

<template>
  <div class="relative">
    <div class="pencil-control" data-handdrawn="control">
      <input
        :id="inputId"
        v-model="keyword"
        type="text"
        name="chip-picker-search"
        :aria-label="placeholder"
        :placeholder="placeholder"
        class="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors focus:border-[var(--border-strong)] focus-ring"
        @focus="onFocus"
        @blur="onBlur"
      />
    </div>

    <div
      v-if="open && filtered.length > 0"
      class="subtle-scroll absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] py-1 shadow-[var(--card-shadow)]"
      data-handdrawn="menu"
    >
      <button
        v-for="option in filtered"
        :key="option"
        type="button"
        class="block w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
        @mousedown.prevent="add(option)"
      >
        {{ option }}
      </button>
    </div>

    <div v-if="model.length > 0" class="mt-2.5 flex flex-wrap gap-2">
      <span
        v-for="option in model"
        :key="option"
        class="relative inline-flex items-center rounded-lg bg-[var(--surface-muted)] py-1.5 pl-3 pr-7 text-xs font-medium text-[var(--text-primary)]"
        data-handdrawn="chip"
      >
        {{ option }}
        <button
          type="button"
          class="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--surface-solid)]"
          style="height: 18px; width: 18px"
          :aria-label="t('common.removeItem', { item: option })"
          @click="remove(option)"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </span>
    </div>
  </div>
</template>
