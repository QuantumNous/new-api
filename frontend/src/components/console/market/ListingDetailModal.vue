<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MarketListing, Merchant } from '@/types/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import HealthMeter from '@/components/common/HealthMeter.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import TicketImageLightbox from '@/components/console/tickets/TicketImageLightbox.vue'
import ListingRating from './ListingRating.vue'
import ServiceTierBadge from './ServiceTierBadge.vue'
import { formatDate } from '@/utils/format'
import { safeImageUrl } from '@/utils/safeUrl'

const props = defineProps<{
  listing: MarketListing | null
  merchant?: Merchant
  formatPrice: (usd: number) => string
  adding?: boolean
}>()

const emit = defineEmits<{
  close: []
  add: [listing: MarketListing]
  comments: [merchant: Merchant]
}>()

const { t } = useI18n()

/** Currently zoomed QC test image ('' = closed). */
const lightboxUrl = ref('')
const safeQcImages = computed(() =>
  (props.listing?.qcImages ?? [])
    .map((image) => safeImageUrl(image))
    .filter((image): image is string => Boolean(image))
)

const typeLabel = computed(() =>
  props.listing ? t(`models.type.${props.listing.type}`) : ''
)
const priceUnit = computed(() =>
  props.listing &&
  (props.listing.type === 'chat' || props.listing.type === 'embedding')
    ? t('market.priceUnitToken')
    : t('market.priceUnitCall')
)
</script>

<template>
  <ConsoleModal
    :open="listing != null"
    :title="listing?.title ?? ''"
    size="lg"
    @close="emit('close')"
  >
    <div v-if="listing" class="space-y-5">
      <!-- header: type + rating + price -->
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2">
          <StatusChip :tone="'info'">{{ typeLabel }}</StatusChip>
          <ListingRating :value="listing.rating" :count="listing.reviewCount" />
        </div>
        <p class="font-mono text-2xl font-bold text-[var(--accent-text)]">
          {{ formatPrice(listing.priceUSD) }}
          <span
            class="font-sans text-sm font-normal text-[var(--text-tertiary)]"
            >{{ priceUnit }}</span
          >
        </p>
      </div>

      <p class="text-sm leading-relaxed text-[var(--text-secondary)]">
        {{ listing.summary }}
      </p>

      <!-- metric grid -->
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-xl bg-[var(--surface-muted)] p-3 text-center">
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('market.detailAvailability') }}
          </p>
          <p class="mt-1 text-lg font-bold text-[var(--text-primary)]">
            {{ listing.availability.toFixed(1) }}%
          </p>
        </div>
        <div class="rounded-xl bg-[var(--surface-muted)] p-3 text-center">
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('market.detailQc') }}
          </p>
          <p class="mt-1 text-lg font-bold text-[var(--text-primary)]">
            {{ listing.qcScore }}
          </p>
        </div>
        <div class="rounded-xl bg-[var(--surface-muted)] p-3 text-center">
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('market.detailSource') }}
          </p>
          <p
            class="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]"
            :title="listing.source"
          >
            {{ listing.source }}
          </p>
        </div>
      </div>

      <!-- qc meter row -->
      <div
        class="flex items-center justify-between rounded-xl bg-[var(--surface-muted)] px-4 py-3"
      >
        <span class="text-sm text-[var(--text-secondary)]">{{
          t('market.detailQc')
        }}</span>
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-[var(--text-primary)]">{{
            listing.qcScore
          }}</span>
          <HealthMeter :value="listing.qcScore" :bars="16" />
        </div>
      </div>

      <!-- qc test screenshots -->
      <div v-if="safeQcImages.length">
        <h3 class="mb-2 text-sm font-semibold text-[var(--text-primary)]">
          {{ t('market.qcImages') }}
        </h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(img, i) in safeQcImages"
            :key="i"
            type="button"
            class="overflow-hidden rounded-lg border border-[var(--border-subtle)] transition-colors hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            @click="lightboxUrl = img"
          >
            <img
              :src="img"
              alt=""
              class="h-20 w-32 object-cover"
              loading="lazy"
            />
          </button>
        </div>
      </div>

      <!-- supported models -->
      <div>
        <h3 class="mb-2 text-sm font-semibold text-[var(--text-primary)]">
          {{
            t('market.detailModels', { count: listing.supportedModels.length })
          }}
        </h3>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="m in listing.supportedModels"
            :key="m"
            class="rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 font-mono text-xs text-[var(--text-secondary)]"
          >
            {{ m }}
          </span>
        </div>
      </div>

      <!-- tags -->
      <div v-if="listing.tags.length">
        <h3 class="mb-2 text-sm font-semibold text-[var(--text-primary)]">
          {{ t('market.detailTags') }}
        </h3>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="tag in listing.tags"
            :key="tag"
            class="rounded-lg border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-tertiary)]"
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <!-- merchant -->
      <div v-if="merchant">
        <h3 class="mb-2 text-sm font-semibold text-[var(--text-primary)]">
          {{ t('market.detailMerchant') }}
        </h3>
        <div
          class="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-4 py-3"
        >
          <VendorLogo :vendor="merchant.name" :size="40" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="truncate text-sm font-semibold text-[var(--text-primary)]"
                >{{ merchant.name }}</span
              >
              <ServiceTierBadge :scale="merchant.scale">{{
                t(`market.scale.${merchant.scale}`)
              }}</ServiceTierBadge>
            </div>
            <button
              type="button"
              class="mt-0.5 text-xs text-[var(--text-tertiary)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent-text)]"
              @click="emit('comments', merchant)"
            >
              {{ t('market.comments', { n: merchant.comments.length }) }}
            </button>
          </div>
          <span class="shrink-0 text-xs text-[var(--text-tertiary)]">
            {{ t('market.detailListedAt') }} ·
            {{ formatDate(listing.listedAt) }}
          </span>
        </div>
      </div>
    </div>

    <template #footer>
      <ConsoleButton
        v-if="listing"
        size="lg"
        block
        :loading="adding"
        @click="emit('add', listing)"
      >
        {{ t('market.add') }} · {{ formatPrice(listing.priceUSD) }}
        {{ priceUnit }}
      </ConsoleButton>
    </template>
  </ConsoleModal>

  <TicketImageLightbox
    :open="lightboxUrl !== ''"
    :url="lightboxUrl"
    @close="lightboxUrl = ''"
  />
</template>
