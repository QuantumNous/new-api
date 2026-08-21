<script setup lang="ts">
withDefaults(
  defineProps<{
    bordered?: boolean
    rounded?: 'md' | 'lg' | 'xl' | '2xl'
  }>(),
  { bordered: false, rounded: '2xl' }
)

const roundedClass = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
} as const
</script>

<template>
  <div
    aria-hidden="true"
    class="animate-pulse"
    :class="[
      bordered
        ? 'border border-[var(--border-subtle)] bg-[var(--surface-solid)]'
        : 'bg-[var(--surface-muted)]',
      roundedClass[rounded],
    ]"
  />
</template>
