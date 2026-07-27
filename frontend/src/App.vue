<script setup lang="ts">
import { RouterView } from 'vue-router'

import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue'
import ToastHost from '@/components/common/ToastHost.vue'
import { useTheme } from '@/composables/useTheme'

useTheme()
</script>

<template>
  <AppErrorBoundary>
    <RouterView />
  </AppErrorBoundary>
  <ToastHost />
</template>
