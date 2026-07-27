<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    label: string
    tone?: 'default' | 'danger'
  }>(),
  { tone: 'default' }
)

const button = ref<HTMLButtonElement | null>(null)
defineExpose({
  focus: () => button.value?.focus(),
  element: button,
})
</script>

<template>
  <button
    ref="button"
    type="button"
    :aria-label="label"
    :title="label"
    class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors focus-ring"
    data-handdrawn="control"
    :class="
      tone === 'danger'
        ? 'hover:bg-[var(--status-danger-soft)] hover:text-[var(--status-danger-text)]'
        : 'hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
    "
  >
    <slot />
  </button>
</template>
