<script setup lang="ts">
defineProps<{
  content: string
  label: string
}>()

const emit = defineEmits<{
  activate: []
}>()
</script>

<template>
  <button
    type="button"
    data-log-detail-trigger
    class="group block w-full min-w-0 text-left text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-text)] focus-visible:text-[var(--accent-text)] focus-visible:outline-none"
    :title="content"
    :aria-label="label"
    @click="emit('activate')"
  >
    <span class="relative inline-block max-w-full pb-0.5 align-bottom">
      <span class="block truncate">{{ content }}</span>
      <span
        data-log-detail-underline
        class="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-[var(--accent)] transition-transform duration-150 group-hover:scale-x-100 group-focus-visible:scale-x-100"
        aria-hidden="true"
      />
    </span>
  </button>
</template>
