<script setup lang="ts">
import { ErrorComponent } from '@tanstack/vue-router'
import type { ErrorComponentProps } from '@tanstack/vue-router'

defineProps<ErrorComponentProps>()
</script>

<template>
  <ErrorComponent :error="error" />
</template>
