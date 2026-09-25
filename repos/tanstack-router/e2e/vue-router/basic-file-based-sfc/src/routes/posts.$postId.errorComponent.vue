<script setup lang="ts">
import { ErrorComponent } from '@tanstack/vue-router'
import type { ErrorComponentProps } from '@tanstack/vue-router'

const props = defineProps<ErrorComponentProps>()
</script>

<template>
  <ErrorComponent :error="props.error" />
</template>
