<template>
  <span
    v-if="notice"
    class="group hidden items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] py-1 pl-2 pr-3 lg:inline-flex"
  >
    <span class="flex items-center gap-1.5">
      <span class="relative flex h-1.5 w-1.5" aria-hidden="true">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75"
        />
        <span
          class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
        />
      </span>
      <span
        class="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]"
      >
        {{ t('notice.badge') }}
      </span>
    </span>
    <span
      class="max-w-[220px] truncate text-xs text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]"
    >
      {{ notice }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useAppStore } from '@/stores'

const { t } = useI18n()
const { notice } = storeToRefs(useAppStore())
</script>
