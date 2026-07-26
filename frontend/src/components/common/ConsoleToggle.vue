<script setup lang="ts">
const model = defineModel<boolean>({ default: false })

withDefaults(
  defineProps<{
    disabled?: boolean
    label?: string
  }>(),
  { disabled: false, label: '' }
)
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    :aria-label="label"
    :disabled="disabled"
    class="toggle-track relative h-6 w-11 shrink-0 transition-colors duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
    :style="{ background: model ? 'var(--accent)' : 'var(--border-default)' }"
    @click="model = !model"
  >
    <span
      class="toggle-thumb absolute top-0.5 h-5 w-5 bg-[var(--surface-solid)] transition-all duration-200"
      :style="{ left: model ? 'calc(100% - 22px)' : '2px' }"
    />
  </button>
</template>

<style scoped>
/* Day: hand-drawn slightly-off circle thumb with ink outline.
   Night: MD uniform switch (tokens collapse the irregularity). */
.toggle-track {
  border-radius: var(--sketch-border-radius-sm);
}
.toggle-thumb {
  border-radius: 46% 54% 50% 50% / 52% 48% 52% 48%;
  border: 1px solid var(--border-default);
  box-shadow: var(--elevation-1);
}
html.dark .toggle-track {
  border-radius: 9999px;
}
html.dark .toggle-thumb {
  border-radius: 9999px;
  border-color: transparent;
}
</style>
