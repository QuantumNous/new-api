<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    index: string
    title: string
    icon: Component
    danger?: boolean
  }>(),
  { danger: false }
)
</script>

<template>
  <div class="flex items-center justify-between gap-4 px-5 py-5 sm:px-6">
    <div class="flex min-w-0 items-center gap-3">
      <span
        class="shrink-0 font-mono text-xs font-semibold"
        :style="{
          color: danger ? 'var(--status-danger-text)' : 'var(--accent-text)',
        }"
      >
        {{ index }}
      </span>
      <component
        :is="icon"
        :size="17"
        :stroke-width="1.8"
        class="shrink-0"
        :style="{
          color: danger ? 'var(--status-danger-text)' : 'var(--text-tertiary)',
        }"
        aria-hidden="true"
      />
      <h3
        class="break-words text-base font-semibold"
        :style="{
          color: danger ? 'var(--status-danger-text)' : 'var(--text-primary)',
        }"
      >
        {{ title }}
      </h3>
    </div>
    <slot />
  </div>
</template>
