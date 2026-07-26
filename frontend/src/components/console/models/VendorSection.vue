<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { MarketModel } from '@/types/console'
import type {
  VendorGroup,
  ModelMarketViewMode,
} from '@/composables/useModelMarket'
import ModelCard from './ModelCard.vue'
import VendorLogo from './VendorLogo.vue'

defineProps<{
  group: VendorGroup
  view: ModelMarketViewMode
}>()

const emit = defineEmits<{
  detail: [model: MarketModel]
}>()

const { t } = useI18n()
</script>

<template>
  <section class="mb-8">
    <!-- group header -->
    <header class="mb-3 flex items-center gap-3 px-1">
      <VendorLogo :vendor="group.vendor" :size="40" />
      <div class="min-w-0">
        <h2 class="truncate text-base font-semibold text-[var(--text-primary)]">
          {{ group.vendor }}
        </h2>
        <p
          v-if="group.tagline"
          class="truncate text-xs text-[var(--text-tertiary)]"
        >
          {{ group.tagline }}
        </p>
      </div>
      <!-- rust-red editorial rule (--status-danger: day rust / night muted coral) -->
      <span
        class="h-px min-w-6 flex-1 bg-[var(--status-danger)] opacity-40"
        aria-hidden="true"
      />
      <div class="shrink-0 text-right">
        <p class="text-sm text-[var(--text-secondary)]">
          <span class="font-semibold text-[var(--text-primary)]">{{
            group.models.length
          }}</span>
          {{ t('models.modelUnit') }}
          <span class="mx-1 text-[var(--border-default)]">·</span>
          <span class="font-semibold text-[var(--text-primary)]">{{
            group.channelCount
          }}</span>
          {{ t('models.channelUnit') }}
        </p>
        <p class="mt-0.5 flex items-center justify-end gap-2 text-xs">
          <span
            v-if="group.healthy"
            class="text-[var(--status-success-text)]"
            >{{ t('models.healthy', { count: group.healthy }) }}</span
          >
          <span
            v-if="group.degraded"
            class="text-[var(--status-warning-text)]"
            >{{ t('models.degraded', { count: group.degraded }) }}</span
          >
          <span v-if="group.down" class="text-[var(--status-danger-text)]">{{
            t('models.down', { count: group.down })
          }}</span>
        </p>
      </div>
    </header>

    <!-- cards -->
    <div
      :class="
        view === 'grid'
          ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
          : 'flex flex-col gap-2'
      "
    >
      <ModelCard
        v-for="m in group.models"
        :key="m.id"
        :model="m"
        :layout="view"
        @detail="emit('detail', $event)"
      />
    </div>
  </section>
</template>
