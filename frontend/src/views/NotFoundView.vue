<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div
    class="texture-paper flex min-h-screen flex-col items-center justify-center gap-5 px-4"
  >
    <p class="display-title text-7xl font-bold text-[var(--accent-text)]">
      404
    </p>
    <p class="text-lg text-[var(--text-secondary)]">
      {{ t('notFound.title') }}
    </p>
    <RouterLink
      :to="{ name: 'home' }"
      class="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] shadow-[0_6px_18px_var(--shadow-color)] transition-all focus-ring hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]"
    >
      {{ t('notFound.backHome') }}
    </RouterLink>
  </div>
</template>
