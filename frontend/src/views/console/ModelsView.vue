<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import type { MarketModel } from '@/types/console'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import HealthMeter from '@/components/common/HealthMeter.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import VendorSection from '@/components/console/models/VendorSection.vue'
import { useModelMarket } from '@/composables/useModelMarket'
import { useToast } from '@/composables/useToast'
import { formatContext, formatLatency, formatTokenPrice } from '@/utils/format'

const { t } = useI18n()
const toast = useToast()
const { copy } = useClipboard()

const {
  loading,
  keyword,
  channel,
  vendor,
  type,
  sort,
  view,
  groups,
  resultCount,
  hasResults,
  channelOptions,
  vendorOptions,
  load,
} = useModelMarket()

const detailModel = ref<MarketModel | null>(null)

const typeOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'chat', label: t('models.type.chat') },
  { value: 'image', label: t('models.type.image') },
  { value: 'embedding', label: t('models.type.embedding') },
  { value: 'audio', label: t('models.type.audio') },
  { value: 'video', label: t('models.type.video') },
  { value: 'rerank', label: t('models.type.rerank') },
])

const channelSelectOptions = computed(() => [
  { value: '', label: t('models.allChannels') },
  ...channelOptions.value.map((c) => ({ value: c, label: c })),
])

const vendorSelectOptions = computed(() => [
  { value: '', label: t('models.allVendors') },
  ...vendorOptions.value.map((v) => ({ value: v, label: v })),
])

const sortOptions = computed(() => [
  { value: 'default', label: t('models.sortDefault') },
  { value: 'health', label: t('models.sortHealth') },
  { value: 'latency', label: t('models.sortLatency') },
  { value: 'tps', label: t('models.sortTps') },
  { value: 'price', label: t('models.sortPrice') },
])

const detailTypeLabel = computed(() =>
  detailModel.value ? t(`models.type.${detailModel.value.type}`) : ''
)
const detailBillingLabel = computed(() =>
  detailModel.value ? t(`models.billing.${detailModel.value.billing}`) : ''
)

async function copyName(name: string) {
  await copy(name)
  toast.success(t('models.copied', { name }))
}

onMounted(load)
</script>

<template>
  <div>
    <PageBreadcrumb
      :crumbs="[t('models.breadcrumb.0'), t('models.breadcrumb.1')]"
    />

    <!-- filter toolbar -->
    <ConsoleCard :padded="false">
      <div class="flex flex-wrap items-center gap-3 p-4">
        <SearchInput
          v-model="keyword"
          :placeholder="t('models.searchPlaceholder')"
          :aria-label="t('models.searchPlaceholder')"
          name="model-search"
          class="w-full sm:w-64"
        />
        <div class="flex flex-1 flex-wrap items-center gap-3">
          <FilterSelect
            v-model="channel"
            :options="channelSelectOptions"
            :label="t('models.channelFilter')"
            class="min-w-[140px] flex-1 sm:flex-none sm:w-40"
          />
          <FilterSelect
            v-model="vendor"
            :options="vendorSelectOptions"
            :label="t('models.vendorFilter')"
            class="min-w-[130px] flex-1 sm:flex-none sm:w-36"
          />
          <FilterSelect
            v-model="type"
            :options="typeOptions"
            :label="t('models.typeFilter')"
            class="min-w-[110px] flex-1 sm:flex-none sm:w-32"
          />
          <FilterSelect
            v-model="sort"
            :options="sortOptions"
            :label="t('models.sortFilter')"
            class="min-w-[130px] flex-1 sm:flex-none sm:w-36"
          />
        </div>
        <!-- view toggle -->
        <div
          class="flex shrink-0 items-center gap-1 rounded-xl bg-[var(--surface-muted)] p-1"
        >
          <button
            type="button"
            :aria-label="t('models.viewGrid')"
            :title="t('models.viewGrid')"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-ring"
            :class="
              view === 'grid'
                ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            "
            @click="view = 'grid'"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            :aria-label="t('models.viewList')"
            :title="t('models.viewList')"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-ring"
            :class="
              view === 'list'
                ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            "
            @click="view = 'list'"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
        </div>
      </div>
    </ConsoleCard>

    <!-- result meta -->
    <p class="mb-4 mt-5 text-sm text-[var(--text-tertiary)]">
      {{ t('models.resultCount', { count: resultCount }) }}
      <span class="ml-2 text-xs">· {{ t('models.snapshotNote') }}</span>
    </p>

    <!-- loading skeleton -->
    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="i in 6"
        :key="i"
        class="h-56 animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]"
      />
    </div>

    <!-- empty -->
    <ConsoleCard v-else-if="!hasResults">
      <EmptyState
        :title="t('models.emptyTitle')"
        :hint="t('models.emptyHint')"
        illustration="empty-models"
      />
    </ConsoleCard>

    <!-- vendor groups -->
    <template v-else>
      <VendorSection
        v-for="g in groups"
        :key="g.vendor"
        :group="g"
        :view="view"
        @detail="detailModel = $event"
      />
    </template>

    <!-- detail modal -->
    <ConsoleModal
      :open="detailModel != null"
      :title="detailModel?.name ?? ''"
      size="lg"
      @close="detailModel = null"
    >
      <div v-if="detailModel" class="space-y-5">
        <!-- header meta -->
        <div class="flex items-center gap-3">
          <VendorLogo :vendor="detailModel.vendor" :size="44" />
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <StatusChip tone="info">{{ detailTypeLabel }}</StatusChip>
              <StatusChip tone="accent">{{ detailBillingLabel }}</StatusChip>
            </div>
            <p class="mt-1 text-sm text-[var(--text-tertiary)]">
              {{ detailModel.vendor }}
            </p>
          </div>
          <ConsoleButton
            variant="secondary"
            size="sm"
            @click="copyName(detailModel.name)"
          >
            {{ t('common.copy') }}
          </ConsoleButton>
        </div>

        <p class="text-sm leading-relaxed text-[var(--text-secondary)]">
          {{ detailModel.tagline }}
        </p>

        <!-- metric grid -->
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-xl bg-[var(--surface-muted)] p-3 text-center">
            <p class="text-xs text-[var(--text-tertiary)]">
              {{ t('models.latency') }}
            </p>
            <p class="mt-1 text-lg font-bold text-[var(--text-primary)]">
              {{ formatLatency(detailModel.latency) }}
            </p>
          </div>
          <div class="rounded-xl bg-[var(--surface-muted)] p-3 text-center">
            <p class="text-xs text-[var(--text-tertiary)]">TPS</p>
            <p class="mt-1 text-lg font-bold text-[var(--text-primary)]">
              {{ detailModel.tps > 0 ? detailModel.tps.toFixed(1) : '—' }}
            </p>
          </div>
          <div class="rounded-xl bg-[var(--surface-muted)] p-3 text-center">
            <p class="text-xs text-[var(--text-tertiary)]">
              {{ t('models.contextWindow') }}
            </p>
            <p class="mt-1 text-lg font-bold text-[var(--text-primary)]">
              {{ formatContext(detailModel.context) }}
            </p>
          </div>
        </div>

        <!-- health -->
        <div
          class="flex items-center justify-between rounded-xl bg-[var(--surface-muted)] px-4 py-3"
        >
          <span class="text-sm text-[var(--text-secondary)]">{{
            t('models.status')
          }}</span>
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-[var(--text-primary)]"
              >{{ detailModel.health }}%</span
            >
            <HealthMeter :value="detailModel.health" :bars="16" />
          </div>
        </div>

        <!-- full price table -->
        <div>
          <h3 class="mb-2 text-sm font-semibold text-[var(--text-primary)]">
            {{ t('models.priceTitle') }}
          </h3>
          <div
            v-if="detailModel.billing === 'per_call'"
            class="rounded-xl border border-[var(--border-subtle)] px-4 py-3 text-sm"
          >
            <div class="flex justify-between">
              <span class="text-[var(--text-tertiary)]">{{
                t('models.perCall')
              }}</span>
              <span
                class="font-mono font-semibold text-[var(--text-primary)]"
                >{{ formatTokenPrice(detailModel.price.per_call) }}</span
              >
            </div>
          </div>
          <div
            v-else
            class="overflow-hidden rounded-xl border border-[var(--border-subtle)]"
          >
            <table class="w-full text-sm">
              <thead>
                <tr
                  class="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs text-[var(--text-tertiary)]"
                >
                  <th class="px-4 py-2 text-left font-medium">
                    {{ t('models.tier') }}
                  </th>
                  <th class="px-4 py-2 text-right font-medium">
                    {{ t('models.priceInput') }}
                  </th>
                  <th class="px-4 py-2 text-right font-medium">
                    {{ t('models.priceOutput') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-if="detailModel.price.tiers?.length">
                  <tr
                    v-for="tier in detailModel.price.tiers"
                    :key="tier.label"
                    class="border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <td class="px-4 py-2 text-[var(--text-secondary)]">
                      {{ tier.label }}
                    </td>
                    <td
                      class="px-4 py-2 text-right font-mono text-[var(--text-primary)]"
                    >
                      {{ formatTokenPrice(tier.input) }} / 1M
                    </td>
                    <td
                      class="px-4 py-2 text-right font-mono text-[var(--text-primary)]"
                    >
                      {{ formatTokenPrice(tier.output) }} / 1M
                    </td>
                  </tr>
                </template>
                <tr
                  v-else
                  class="border-b border-[var(--border-subtle)] last:border-0"
                >
                  <td class="px-4 py-2 text-[var(--text-secondary)]">
                    {{ t('models.standard') }}
                  </td>
                  <td
                    class="px-4 py-2 text-right font-mono text-[var(--text-primary)]"
                  >
                    {{ formatTokenPrice(detailModel.price.input) }} / 1M
                  </td>
                  <td
                    class="px-4 py-2 text-right font-mono text-[var(--text-primary)]"
                  >
                    {{ formatTokenPrice(detailModel.price.output) }} / 1M
                  </td>
                </tr>
                <tr v-if="detailModel.price.cache_read != null">
                  <td class="px-4 py-2 text-[var(--text-secondary)]">
                    {{ t('models.priceCache') }}
                  </td>
                  <td
                    class="px-4 py-2 text-right font-mono text-[var(--text-secondary)]"
                    colspan="2"
                  >
                    {{ formatTokenPrice(detailModel.price.cache_read) }} / 1M
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- channels -->
        <div>
          <h3 class="mb-2 text-sm font-semibold text-[var(--text-primary)]">
            {{
              t('models.channelTitle', { count: detailModel.channels.length })
            }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="c in detailModel.channels"
              :key="c"
              class="rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
            >
              {{ c }}
            </span>
          </div>
        </div>
      </div>
    </ConsoleModal>
  </div>
</template>
