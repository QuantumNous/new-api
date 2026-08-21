<script setup lang="ts">
withDefaults(
  defineProps<{
    tag?: 'h2' | 'h3'
  }>(),
  { tag: 'h2' }
)
</script>

<template>
  <component :is="tag" class="section-heading"><slot /></component>
</template>
