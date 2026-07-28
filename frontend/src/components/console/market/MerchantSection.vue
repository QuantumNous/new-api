<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MarketListing, Merchant } from '@/types/console'
import type {
  MerchantGroup,
  MarketViewMode,
} from '@/composables/useMarketplace'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import MarketListingCard from './MarketListingCard.vue'
import ServiceTierBadge from './ServiceTierBadge.vue'

const props = defineProps<{
  group: MerchantGroup
  view: MarketViewMode
  formatPrice: (usd: number) => string
  addingId: number | null
  addingAllId: number | null
}>()

const emit = defineEmits<{
  detail: [listing: MarketListing]
  add: [listing: MarketListing]
  comments: [merchant: Merchant]
  addAll: [merchant: Merchant]
}>()

const { t } = useI18n()

const merchant = computed(() => props.group.merchant)
const latestComment = computed(() => merchant.value.comments[0] ?? null)
</script>

<template>
  <section class="mb-8">
    <!-- merchant header -->
    <header class="mb-3 flex items-center gap-3 px-1">
      <VendorLogo :vendor="merchant.name" :size="40" />
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h2
            class="truncate text-base font-semibold text-[var(--text-primary)]"
          >
            {{ merchant.name }}
          </h2>
          <ServiceTierBadge :scale="merchant.scale">{{
            t(`market.scale.${merchant.scale}`)
          }}</ServiceTierBadge>
          <svg
            v-if="merchant.verified"
            :aria-label="t('market.verified')"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="var(--status-success)"
          >
            <path
              d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.2 15.6l.9-2.8-.9-2.8L5.6 8.3l1-2.8 3-.1L12 2Z"
            />
            <path
              d="m8.5 12 2.2 2.2 4.3-4.3"
              fill="none"
              stroke="var(--surface-solid)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div
          class="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-[var(--text-tertiary)]"
        >
          <button
            type="button"
            class="inline-flex min-w-0 items-center gap-1 rounded transition-colors hover:text-[var(--accent-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            @click="emit('comments', merchant)"
          >
            <span v-if="latestComment" class="max-w-[16rem] truncate"
              >"{{ latestComment.content }}"</span
            >
            <span v-else>{{ t('market.noComments') }}</span>
            <span
              class="shrink-0 font-medium underline decoration-dotted underline-offset-2"
            >
              {{ t('market.comments', { n: merchant.comments.length }) }}
            </span>
          </button>
        </div>
      </div>
      <!-- rust-red editorial rule (matches VendorSection convention) -->
      <span
        class="h-px min-w-6 flex-1 bg-[var(--status-danger)] opacity-40"
        aria-hidden="true"
      />
      <button
        type="button"
        class="shrink-0 rounded-lg border border-[var(--border-default)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="addingAllId === merchant.id"
        @click="emit('addAll', merchant)"
      >
        {{ t('market.addAllChannels') }}
      </button>
      <p class="shrink-0 text-sm text-[var(--text-secondary)]">
        {{ t('market.offerCount', { count: group.listings.length }) }}
      </p>
    </header>

    <!-- listings -->
    <div
      :class="
        view === 'grid'
          ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
          : 'flex flex-col gap-2'
      "
    >
      <MarketListingCard
        v-for="l in group.listings"
        :key="l.id"
        :listing="l"
        :merchant="merchant"
        :layout="view"
        :format-price="formatPrice"
        :adding="addingId === l.id"
        @detail="emit('detail', $event)"
        @add="emit('add', $event)"
      />
    </div>
  </section>
</template>
