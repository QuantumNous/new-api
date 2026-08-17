<script setup lang="ts">
/**
 * Standalone breadcrumb row for console pages that don't render a hero title.
 * Thin wrapper over the shared Breadcrumb with an optional page action area.
 */
import Breadcrumb from './Breadcrumb.vue'

withDefaults(
  defineProps<{
    crumbs?: string[]
  }>(),
  { crumbs: () => [] }
)
</script>

<template>
  <div
    class="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <Breadcrumb :crumbs="crumbs" spacing="" class="shrink-0" />
    <div
      v-if="$slots.action"
      class="flex min-w-0 items-center sm:ml-auto sm:justify-end"
    >
      <slot name="action" />
    </div>
  </div>
</template>
