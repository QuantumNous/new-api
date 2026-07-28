<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    hint?: string
  }>(),
  { label: '', hint: '' }
)
</script>

<template>
  <label class="block">
    <span
      v-if="label"
      class="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
    >
      {{ label }}
    </span>
    <slot />
    <span
      v-if="hint"
      class="mt-1.5 block text-xs text-[var(--text-tertiary)]"
      >{{ hint }}</span
    >
  </label>
</template>
