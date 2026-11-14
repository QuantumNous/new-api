<script setup lang="ts">
import { ErrorComponent } from '@tanstack/vue-router'

defineProps<{
  error: any
}>()
</script>

<template>
  <ErrorComponent :error="error" />
</template>
