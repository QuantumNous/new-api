<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { marketTagPool, MODELS } from '@/constants/console'
import type { MarketListing, Merchant } from '@/types/console'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import HealthMeter from '@/components/common/HealthMeter.vue'
import MultiFilterSelect from '@/components/common/MultiFilterSelect.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import SegmentedToggle from '@/components/common/SegmentedToggle.vue'
import ListingDetailModal from '@/components/console/market/ListingDetailModal.vue'
import ListingFormModal from '@/components/console/market/ListingFormModal.vue'
import MarketSellPanel from '@/components/console/market/MarketSellPanel.vue'
import MerchantCommentsModal from '@/components/console/market/MerchantCommentsModal.vue'
import MerchantSection from '@/components/console/market/MerchantSection.vue'
import MyChannelsPanel from '@/components/console/market/MyChannelsPanel.vue'
import { useMarketplace } from '@/composables/useMarketplace'
import { useMyChannels } from '@/composables/useMyChannels'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()

const {
  loading,
  catalog,
  side,
  keyword,
  vendor,
  source,
  types,
  sort,
  scale,
  currency,
  view,
  merchantGroups,
  merchantById,
  hasResults,
  merchantCount,
  availableChannelCount,
  avgAvailability,
  vendorOptions,
  sourceOptions,
  formatPrice,
  load,
} = useMarketplace()

const mine = useMyChannels()

const detailListing = ref<MarketListing | null>(null)
const addingId = ref<number | null>(null)
const addingAllId = ref<number | null>(null)
const commentsMerchant = ref<Merchant | null>(null)

// sell side
const sellPanel = ref<InstanceType<typeof MarketSellPanel> | null>(null)
const formOpen = ref(false)
const editing = ref<MarketListing | null>(null)

const sideOptions = computed(() => [
  { value: 'buy', label: t('market.sideBuy') },
  { value: 'sell', label: t('market.sideSell') },
  { value: 'mine', label: t('market.sideMine') },
])

const viewOptions = computed(() => [
  {
    value: 'list',
    ariaLabel: t('market.viewList'),
    icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  },
  {
    value: 'grid',
    ariaLabel: t('market.viewGrid'),
    icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  },
])

const currencyOptions = computed(() => [
  { value: 'CNY', label: 'CNY ¥' },
  { value: 'USD', label: 'USD $' },
])

const vendorSelectOptions = computed(() => [
  { value: '', label: t('market.allVendors') },
  ...vendorOptions.value.map((v) => ({ value: v, label: v })),
])

const sourceSelectOptions = computed(() => [
  { value: '', label: t('market.allSources') },
  ...sourceOptions.value.map((s) => ({ value: s, label: s })),
])

const typeOptions = computed(() => [
  { value: 'chat', label: t('models.type.chat') },
  { value: 'image', label: t('models.type.image') },
  { value: 'embedding', label: t('models.type.embedding') },
  { value: 'audio', label: t('models.type.audio') },
  { value: 'video', label: t('models.type.video') },
  { value: 'rerank', label: t('models.type.rerank') },
])

const sortOptions = computed(() => [
  { value: 'default', label: t('market.sortDefault') },
  { value: 'price', label: t('market.sortPrice') },
  { value: 'qc', label: t('market.sortQc') },
  { value: 'availability', label: t('market.sortAvailability') },
  { value: 'rating', label: t('market.sortRating') },
])

const scaleOptions = computed(() => [
  { value: '', label: t('market.allScales') },
  {
    value: 'platform',
    label: t('market.scale.platform'),
    tone: 'accent' as const,
  },
  { value: 'empire', label: t('market.scale.empire') },
  { value: 'studio', label: t('market.scale.studio') },
  { value: 'workshop', label: t('market.scale.workshop') },
  { value: 'vendor', label: t('market.scale.vendor') },
])

async function addListing(listing: MarketListing) {
  if (addingId.value != null) return
  addingId.value = listing.id
  try {
    await api.post(`/api/market/listing/${listing.id}/add`)
    toast.success(t('market.added', { title: listing.title }))
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    addingId.value = null
  }
}

async function addAllChannels(merchant: Merchant) {
  if (addingAllId.value != null) return
  addingAllId.value = merchant.id
  try {
    const data = await api.post<{ added: number }>(
      `/api/market/merchant/${merchant.id}/add-all`
    )
    toast.success(t('market.addAllDone', { n: data.added }))
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    addingAllId.value = null
  }
}

async function toggleMyChannel(id: number) {
  try {
    const message = await mine.toggle(id)
    if (message) toast.success(message)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  }
}

async function removeMyChannel(id: number) {
  try {
    await mine.remove(id)
    toast.success(t('market.mine.removed'))
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  }
}

// Refresh the manageable list whenever the tab becomes visible.
watch(side, (s) => {
  if (s === 'mine') mine.load()
})

function openCreate() {
  editing.value = null
  formOpen.value = true
}

function openEdit(listing: MarketListing) {
  editing.value = listing
  formOpen.value = true
}

function onSaved() {
  sellPanel.value?.load()
}

const availableModels = MODELS
const availableChannels = computed(() => catalog.value?.channels ?? [])

onMounted(load)
</script>

<template>
  <div>
    <!-- breadcrumb + disclaimer -->
    <div class="mb-6 flex items-center justify-between gap-4">
      <div class="flex items-center">
        <PageBreadcrumb
          :crumbs="[t('market.breadcrumb.0'), t('market.breadcrumb.1')]"
          class="mb-0"
        />
      </div>
      <i18n-t
        keypath="market.disclaimer"
        tag="p"
        scope="global"
        class="text-xs leading-relaxed text-[var(--accent-text)]"
      >
        <template #platform>
          <strong class="font-semibold">{{
            t('market.disclaimerPlatform')
          }}</strong>
        </template>
      </i18n-t>
    </div>

    <!-- primary toolbar: side + stats + health + currency -->
    <ConsoleCard :padded="false">
      <div class="flex flex-wrap items-center gap-4 p-4">
        <SegmentedToggle
          v-model="side"
          :options="sideOptions"
          :label="t('market.sideLabel')"
        />
        <div
          v-if="side === 'buy'"
          class="flex flex-wrap items-center gap-5 text-sm"
        >
          <span class="text-[var(--text-tertiary)]">
            {{ t('market.statChannels') }}
            <span class="ml-1 font-semibold text-[var(--text-primary)]">{{
              availableChannelCount
            }}</span>
          </span>
          <span class="text-[var(--text-tertiary)]">
            {{ t('market.statMerchants') }}
            <span class="ml-1 font-semibold text-[var(--text-primary)]">{{
              merchantCount
            }}</span>
          </span>
          <span class="flex items-center gap-2 text-[var(--text-tertiary)]">
            {{ t('market.avgHealth') }}
            <HealthMeter :value="avgAvailability" :bars="12" />
            <span class="font-semibold text-[var(--text-primary)]"
              >{{ avgAvailability.toFixed(1) }}%</span
            >
          </span>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-[var(--text-tertiary)]">{{
            t('market.currencyLabel')
          }}</span>
          <FilterSelect
            v-model="currency"
            :options="currencyOptions"
            :label="t('market.currencyLabel')"
            size="sm"
            class="w-28"
          />
        </div>
      </div>
    </ConsoleCard>

    <!-- ======================= BUY ======================= -->
    <template v-if="side === 'buy'">
      <!-- filter toolbar -->
      <ConsoleCard :padded="false" class="mt-4">
        <div class="flex flex-wrap items-center gap-3 p-4">
          <SearchInput
            v-model="keyword"
            :placeholder="t('market.searchPlaceholder')"
            :aria-label="t('market.searchPlaceholder')"
            name="market-search"
            class="w-full sm:w-64"
          />
          <div class="flex flex-1 flex-wrap items-center gap-3">
            <FilterSelect
              v-model="vendor"
              :options="vendorSelectOptions"
              :label="t('market.vendorFilter')"
              class="min-w-[130px] flex-1 sm:flex-none sm:w-40"
            />
            <FilterSelect
              v-model="source"
              :options="sourceSelectOptions"
              :label="t('market.sourceFilter')"
              class="min-w-[130px] flex-1 sm:flex-none sm:w-40"
            />
            <MultiFilterSelect
              v-model="types"
              :options="typeOptions"
              :label="t('market.typeFilter')"
              :placeholder="t('market.allTypes')"
              :prefix-label="t('market.typeShort')"
              :clear-label="t('market.clearTypes')"
              class="min-w-[120px] flex-1 sm:flex-none sm:w-36"
            />
            <FilterSelect
              v-model="sort"
              :options="sortOptions"
              :label="t('market.sortFilter')"
              class="min-w-[120px] flex-1 sm:flex-none sm:w-36"
            />
            <FilterSelect
              v-model="scale"
              :options="scaleOptions"
              :label="t('market.scaleFilter')"
              class="min-w-[120px] flex-1 sm:flex-none sm:w-36"
            />
          </div>
          <SegmentedToggle
            v-model="view"
            :options="viewOptions"
            :label="t('market.viewLabel')"
            size="sm"
          />
        </div>
      </ConsoleCard>

      <!-- loading gap -->
      <div class="mt-4" />

      <!-- loading skeleton -->
      <div v-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="i in 6"
          :key="i"
          class="h-52 animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]"
        />
      </div>

      <!-- empty -->
      <ConsoleCard v-else-if="!hasResults">
        <EmptyState
          :title="t('market.emptyTitle')"
          :hint="t('market.emptyHint')"
          illustration="empty-market"
        />
      </ConsoleCard>

      <!-- merchant groups -->
      <template v-else>
        <MerchantSection
          v-for="g in merchantGroups"
          :key="g.merchant.id"
          :group="g"
          :view="view"
          :format-price="formatPrice"
          :adding-id="addingId"
          :adding-all-id="addingAllId"
          @detail="detailListing = $event"
          @add="addListing"
          @comments="commentsMerchant = $event"
          @add-all="addAllChannels"
        />
      </template>
    </template>

    <!-- ======================= SELL ======================= -->
    <div v-else-if="side === 'sell'" class="mt-4">
      <MarketSellPanel
        ref="sellPanel"
        :format-price="formatPrice"
        @create="openCreate"
        @edit="openEdit"
      />
    </div>

    <!-- ======================= MINE ======================= -->
    <ConsoleCard v-else :padded="false" class="mt-4">
      <MyChannelsPanel
        :channels="mine.channels.value"
        :loading="mine.loading.value"
        :pending="mine.pending.value"
        @toggle="toggleMyChannel"
        @remove="removeMyChannel"
        @go-buy="side = 'buy'"
      />
    </ConsoleCard>

    <!-- detail modal (buy) -->
    <ListingDetailModal
      :listing="detailListing"
      :merchant="
        detailListing ? merchantById.get(detailListing.merchantId) : undefined
      "
      :format-price="formatPrice"
      :adding="detailListing != null && addingId === detailListing.id"
      @close="detailListing = null"
      @add="addListing"
      @comments="commentsMerchant = $event"
    />

    <!-- merchant comments -->
    <MerchantCommentsModal
      :open="commentsMerchant !== null"
      :merchant="commentsMerchant"
      @close="commentsMerchant = null"
    />

    <!-- publish / edit form (sell) -->
    <ListingFormModal
      :open="formOpen"
      :editing="editing"
      :models="availableModels"
      :channels="availableChannels"
      :tag-pool="marketTagPool"
      @close="formOpen = false"
      @saved="onSaved"
    />
  </div>
</template>
