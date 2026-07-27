<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import type { MarketListing, Merchant } from '@/types/console'
import HealthMeter from '@/components/common/HealthMeter.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import ListingRating from './ListingRating.vue'
import { formatDate } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    listing: MarketListing
    merchant?: Merchant
    layout?: 'grid' | 'list'
    /** formats the USD base price into the active currency */
    formatPrice: (usd: number) => string
    adding?: boolean
  }>(),
  { merchant: undefined, layout: 'grid', adding: false }
)

const emit = defineEmits<{
  detail: [listing: MarketListing]
  add: [listing: MarketListing]
}>()

const { t } = useI18n()

const typeTone: Record<string, 'info' | 'success' | 'neutral'> = {
  chat: 'info',
  image: 'success',
  video: 'success',
  embedding: 'neutral',
  rerank: 'neutral',
  audio: 'neutral',
}

const typeLabel = computed(() => t(`models.type.${props.listing.type}`))
const priceUnit = computed(() =>
  props.listing.type === 'chat' || props.listing.type === 'embedding'
    ? t('market.priceUnitToken')
    : t('market.priceUnitCall')
)

/* Supported-models dropdown (list layout only). Shows first 2 chips inline +
   a "+N" button that opens a floating overlay panel with all models. */
const modelsDropdownOpen = ref(false)
const modelsDropdownRef = ref<HTMLElement | null>(null)
onClickOutside(modelsDropdownRef, () => {
  modelsDropdownOpen.value = false
})
</script>

<template>
  <!-- ============ GRID ============ -->
  <article
    v-if="layout === 'grid'"
    class="pencil-surface sketch-card group flex flex-col border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4 transition duration-200 ease-out hover:border-[var(--accent)] focus-within:border-[var(--accent)] motion-safe:hover:-translate-y-1"
    data-handdrawn="surface"
  >
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-base font-bold text-[var(--text-primary)]">
          {{ listing.title }}
        </h3>
        <p
          class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]"
        >
          {{ listing.summary }}
        </p>
      </div>
      <StatusChip :tone="typeTone[listing.type]">{{ typeLabel }}</StatusChip>
    </div>

    <!-- tags -->
    <div v-if="listing.tags.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="tag in listing.tags"
        :key="tag"
        class="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]"
      >
        {{ tag }}
      </span>
    </div>

    <!-- metrics -->
    <div
      class="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] pt-3 text-xs"
    >
      <div class="flex items-center justify-between">
        <span class="text-[var(--text-tertiary)]">{{
          t('market.colAvailability')
        }}</span>
        <span class="font-semibold text-[var(--text-primary)]"
          >{{ listing.availability.toFixed(1) }}%</span
        >
      </div>
      <div class="flex items-center justify-between">
        <span class="text-[var(--text-tertiary)]">{{ t('market.colQc') }}</span>
        <span class="font-semibold text-[var(--text-primary)]">{{
          listing.qcScore
        }}</span>
      </div>
    </div>

    <!-- footer: listed date + rating + price + actions -->
    <div class="mt-auto pt-3">
      <div
        class="flex items-center justify-between text-[11px] text-[var(--text-tertiary)]"
      >
        <span>{{
          t('market.listedAt', { date: formatDate(listing.listedAt) })
        }}</span>
        <ListingRating :value="listing.rating" :count="listing.reviewCount" />
      </div>
      <div class="mt-2 flex items-end justify-between gap-2">
        <p class="font-mono text-lg font-bold text-[var(--accent-text)]">
          {{ formatPrice(listing.priceUSD) }}
          <span
            class="font-sans text-xs font-normal text-[var(--text-tertiary)]"
            >{{ priceUnit }}</span
          >
        </p>
        <div class="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            class="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring"
            @click="emit('detail', listing)"
          >
            {{ t('market.detail') }}
          </button>
          <button
            type="button"
            :disabled="adding"
            class="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 focus-ring"
            @click="emit('add', listing)"
          >
            {{ t('market.add') }}
          </button>
        </div>
      </div>
    </div>
  </article>

  <!-- ============ LIST ============ -->
  <article
    v-else
    class="group flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 py-3 transition duration-200 ease-out hover:border-[var(--accent)] hover:shadow-[var(--card-shadow-hover)] focus-within:border-[var(--accent)]"
  >
    <!-- name + source -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <h3 class="truncate text-sm font-bold text-[var(--text-primary)]">
          {{ listing.title }}
        </h3>
        <StatusChip :tone="typeTone[listing.type]">{{ typeLabel }}</StatusChip>
      </div>
      <p class="truncate text-xs text-[var(--text-tertiary)]">
        {{ listing.source }}
      </p>
    </div>

    <!-- availability: bars + percentage, matching reference image -->
    <div class="hidden shrink-0 items-center gap-2 sm:flex">
      <HealthMeter :value="listing.availability" compact />
      <span
        class="text-xs font-semibold tabular-nums text-[var(--text-primary)]"
        >{{ listing.availability.toFixed(1) }}%</span
      >
    </div>

    <!-- supported models: first 2 chips inline + "+N" dropdown for the rest -->
    <div class="relative hidden w-44 shrink-0 lg:block">
      <div class="flex flex-wrap items-center gap-1">
        <span
          v-for="m in listing.supportedModels.slice(0, 2)"
          :key="m"
          class="truncate rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]"
          style="max-width: 9rem"
          >{{ m }}</span
        >
        <button
          v-if="listing.supportedModels.length > 2"
          type="button"
          :aria-label="t('market.previewModels')"
          :aria-expanded="modelsDropdownOpen"
          class="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring"
          @click.stop="modelsDropdownOpen = !modelsDropdownOpen"
        >
          +{{ listing.supportedModels.length - 2 }}
        </button>
      </div>
      <!-- floating panel — overlay material per THEMES.md §1.2 -->
      <Transition name="mdd-pop">
        <div
          v-if="modelsDropdownOpen"
          ref="modelsDropdownRef"
          class="absolute left-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-[var(--overlay-border)] bg-[var(--surface-overlay)] p-2.5 shadow-[var(--overlay-shadow)]"
          role="listbox"
          :aria-label="t('market.colModels')"
          @keydown.escape.stop="modelsDropdownOpen = false"
        >
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="m in listing.supportedModels"
              :key="m"
              role="option"
              class="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]"
              >{{ m }}</span
            >
          </div>
        </div>
      </Transition>
    </div>

    <!-- qc -->
    <div class="hidden w-16 shrink-0 text-right md:block">
      <p
        class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]"
      >
        {{ t('market.colQc') }}
      </p>
      <p class="text-xs font-semibold text-[var(--text-primary)]">
        {{ listing.qcScore }}
      </p>
    </div>

    <!-- tags -->
    <div class="hidden w-28 shrink-0 xl:flex xl:flex-wrap xl:gap-1">
      <span
        v-for="tag in listing.tags.slice(0, 2)"
        :key="tag"
        class="truncate rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]"
      >
        {{ tag }}
      </span>
    </div>

    <!-- price -->
    <div class="w-24 shrink-0 text-right">
      <p class="font-mono text-sm font-bold text-[var(--accent-text)]">
        {{ formatPrice(listing.priceUSD) }}
      </p>
      <p class="text-[10px] text-[var(--text-tertiary)]">{{ priceUnit }}</p>
    </div>

    <!-- actions -->
    <div class="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        class="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border-default)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring"
        @click="emit('detail', listing)"
      >
        {{ t('market.detail') }}
      </button>
      <button
        type="button"
        :disabled="adding"
        class="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--accent)] px-2.5 text-xs font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 focus-ring"
        @click="emit('add', listing)"
      >
        {{ t('market.add') }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.mdd-pop-enter-active,
.mdd-pop-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s cubic-bezier(0.2, 0.6, 0.2, 1);
}
.mdd-pop-enter-from,
.mdd-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
