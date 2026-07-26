<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })

withDefaults(
  defineProps<{
    placeholder?: string
  }>(),
  { placeholder: '' }
)

const attrs = useAttrs()
const fallbackId = useId()
const inputId = computed(() => String(attrs.id ?? fallbackId))
const wrapperStyle = computed(() => attrs.style)
const inputAttrs = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest.style
  delete rest.id
  return rest
})
</script>

<template>
  <div class="relative" :class="attrs.class" :style="wrapperStyle">
    <svg
      class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
    <input
      :id="inputId"
      v-model="model"
      type="search"
      :placeholder="placeholder"
      v-bind="inputAttrs"
      class="h-10 w-full border-0 border-b-[1.5px] bg-transparent pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-[border-color,background-color] focus:outline-none focus:border-[var(--accent)] hover:bg-[var(--state-hover-layer)]"
      style="border-color: var(--border-default)"
    />
  </div>
</template>
