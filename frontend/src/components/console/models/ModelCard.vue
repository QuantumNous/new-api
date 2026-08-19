<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import type {
  MarketBilling,
  MarketModel,
  MarketModelType,
} from '@/types/console'
import HealthMeter from '@/components/common/HealthMeter.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { useToast } from '@/composables/useToast'
import { formatLatency, formatTokenPrice } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    model: MarketModel
    layout?: 'grid' | 'list'
  }>(),
  { layout: 'grid' }
)

const emit = defineEmits<{
  detail: [model: MarketModel]
}>()

const { t } = useI18n()
const toast = useToast()
const { copy } = useClipboard()

const billingTone: Record<MarketBilling, 'accent' | 'warning' | 'info'> = {
  token: 'accent',
  tiered: 'warning',
  per_call: 'info',
}

const typeTone: Record<MarketModelType, 'info' | 'success' | 'neutral'> = {
  chat: 'info',
  image: 'success',
  video: 'success',
  embedding: 'neutral',
  rerank: 'neutral',
  audio: 'neutral',
}

const billingLabel = computed(() => t(`models.billing.${props.model.billing}`))
const typeLabel = computed(() => t(`models.type.${props.model.type}`))
const tierCount = computed(() => props.model.price.tiers?.length ?? 0)

async function copyName() {
  await copy(props.model.name)
  toast.success(t('models.copied', { name: props.model.name }))
}
</script>

<template>
  <!-- ============ GRID ============ -->
  <article
    v-if="layout === 'grid'"
    class="pencil-surface sketch-card group flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4.5 transition duration-200 ease-out hover:border-[var(--accent)] hover:shadow-[var(--card-shadow-hover)] focus-within:border-[var(--accent)] motion-safe:hover:-translate-y-1"
    data-handdrawn="surface"
  >
    <!-- Header: Model Name on left, Type Chip + Actions on right -->
    <div>
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="flex max-w-full items-center gap-1.5 text-left font-mono text-base font-bold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-text)] hover:text-[var(--accent-text)] focus-ring rounded"
            :title="t('models.copyHint', { name: model.name })"
            @click="copyName"
          >
            <span class="truncate">{{ model.name }}</span>
          </button>
        </div>

        <div class="flex shrink-0 items-center gap-1.5">
          <StatusChip :tone="typeTone[model.type]">{{ typeLabel }}</StatusChip>

          <div
            class="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/60 transition-colors group-hover:border-[var(--accent)]"
          >
            <button
              type="button"
              :aria-label="t('common.copy')"
              :title="t('common.copy')"
              class="inline-flex h-7 w-7 items-center justify-center rounded-l-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] focus-ring"
              @click="copyName"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            </button>
            <span
              class="h-3.5 w-px bg-[var(--border-subtle)]"
              aria-hidden="true"
            />
            <button
              type="button"
              :aria-label="t('models.detail')"
              :title="t('models.detail')"
              class="inline-flex h-7 w-7 items-center justify-center rounded-r-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] focus-ring"
              @click="emit('detail', model)"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Pricing magnetic tiles: 2-column strip -->
      <div class="mt-3">
        <template v-if="model.billing === 'per_call'">
          <div
            class="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/50 px-3.5 py-2.5"
          >
            <span class="text-xs text-[var(--text-tertiary)]">{{
              t('models.perCall')
            }}</span>
            <span
              class="font-mono text-base font-bold text-[var(--text-primary)]"
            >
              {{ formatTokenPrice(model.price.per_call) }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="grid grid-cols-2 gap-2">
            <div
              class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/50 p-2.5"
            >
              <div class="text-[11px] text-[var(--text-tertiary)]">
                {{ t('models.priceInput') }}
              </div>
              <div class="mt-0.5 flex items-baseline gap-1">
                <span
                  class="font-mono text-sm font-bold text-[var(--text-primary)]"
                >
                  {{ formatTokenPrice(model.price.input) }}
                </span>
                <span class="text-[10px] text-[var(--text-tertiary)]"
                  >/ 1M</span
                >
              </div>
            </div>
            <div
              v-if="model.price.output != null"
              class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/50 p-2.5"
            >
              <div class="text-[11px] text-[var(--text-tertiary)]">
                {{ t('models.priceOutput') }}
              </div>
              <div class="mt-0.5 flex items-baseline gap-1">
                <span
                  class="font-mono text-sm font-bold text-[var(--text-primary)]"
                >
                  {{ formatTokenPrice(model.price.output) }}
                </span>
                <span class="text-[10px] text-[var(--text-tertiary)]"
                  >/ 1M</span
                >
              </div>
            </div>
          </div>
          <div
            v-if="model.price.cache_read != null"
            class="mt-1.5 flex items-center justify-between px-1 text-[11px] text-[var(--text-tertiary)]"
          >
            <span>{{ t('models.priceCache') }}</span>
            <span class="font-mono font-medium text-[var(--text-secondary)]">
              {{ formatTokenPrice(model.price.cache_read) }} / 1M
            </span>
          </div>
        </template>
      </div>

      <!-- Tagline / Description -->
      <p
        v-if="model.tagline"
        class="mt-2.5 line-clamp-1 text-xs leading-relaxed text-[var(--text-tertiary)]"
        :title="model.tagline"
      >
        {{ model.tagline }}
      </p>
    </div>

    <!-- Bottom Unified Single Row: Billing info on left, Performance & Health on right -->
    <div
      class="mt-3 flex items-center justify-between border-t border-[var(--border-default)] pt-2.5"
      data-model-divider
    >
      <div class="flex items-center gap-1.5">
        <StatusChip :tone="billingTone[model.billing]" data-model-billing>
          {{ billingLabel }}
        </StatusChip>
        <span
          v-if="tierCount"
          class="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]"
          data-model-tier-count
        >
          {{ t('models.tierCount', { count: tierCount }) }}
        </span>
      </div>

      <div class="flex items-center gap-3 text-right">
        <div v-if="model.latency > 0" class="flex items-center gap-1 text-xs">
          <span class="text-[10px] text-[var(--text-tertiary)]">{{
            t('models.latency')
          }}</span>
          <span class="font-mono font-semibold text-[var(--text-secondary)]">
            {{ formatLatency(model.latency) }}
          </span>
        </div>
        <div
          v-if="model.tps > 0"
          class="hidden items-center gap-1 text-xs sm:flex"
        >
          <span class="text-[10px] text-[var(--text-tertiary)]">TPS</span>
          <span class="font-mono font-semibold text-[var(--text-secondary)]">
            {{ model.tps.toFixed(1) }}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <HealthMeter :value="model.health" :bars="5" compact />
        </div>
      </div>
    </div>
  </article>

  <!-- ============ LIST ============ -->
  <article
    v-else
    class="group flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 py-3 transition duration-200 ease-out hover:border-[var(--accent)] hover:shadow-[var(--card-shadow-hover)] focus-within:border-[var(--accent)] motion-safe:hover:-translate-y-0.5"
  >
    <!-- name + description -->
    <div class="min-w-0 flex-1">
      <button
        type="button"
        class="flex max-w-full items-center gap-1.5 text-left font-mono text-base font-bold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-text)] hover:text-[var(--accent-text)]"
        :title="t('models.copyHint', { name: model.name })"
        @click="copyName"
      >
        <span class="truncate">{{ model.name }}</span>
      </button>
      <p class="truncate text-xs text-[var(--text-tertiary)]">
        {{ model.tagline }}
      </p>
    </div>
    <!-- billing + type chips -->
    <div class="hidden shrink-0 items-center gap-2 md:flex">
      <StatusChip :tone="typeTone[model.type]">{{ typeLabel }}</StatusChip>
      <div class="flex items-center gap-1.5">
        <StatusChip :tone="billingTone[model.billing]" data-model-billing>{{
          billingLabel
        }}</StatusChip>
        <span
          v-if="tierCount"
          class="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]"
          data-model-tier-count
        >
          {{ t('models.tierCount', { count: tierCount }) }}
        </span>
      </div>
    </div>
    <!-- price (input/output) -->
    <div class="hidden w-32 shrink-0 text-right lg:block">
      <p
        v-if="model.billing === 'per_call'"
        class="font-mono text-xs font-semibold text-[var(--text-primary)]"
      >
        {{ formatTokenPrice(model.price.per_call) }}
        <span class="font-sans text-[var(--text-tertiary)]"
          >/ {{ t('models.perCallShort') }}</span
        >
      </p>
      <template v-else>
        <p class="font-mono text-xs font-semibold text-[var(--text-primary)]">
          {{ formatTokenPrice(model.price.input) }}
        </p>
        <p class="font-mono text-[11px] text-[var(--text-tertiary)]">
          {{ formatTokenPrice(model.price.output) }} / 1M
        </p>
      </template>
    </div>
    <!-- latency + health -->
    <div class="hidden w-16 shrink-0 text-right sm:block">
      <p class="text-[10px] uppercase text-[var(--text-tertiary)]">
        {{ t('models.latency') }}
      </p>
      <p class="text-xs font-semibold text-[var(--text-primary)]">
        {{ formatLatency(model.latency) }}
      </p>
    </div>
    <div class="hidden shrink-0 sm:block">
      <HealthMeter :value="model.health" compact />
    </div>
    <!-- actions -->
    <div
      class="inline-flex shrink-0 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/60 transition-colors group-hover:border-[var(--accent)]"
    >
      <button
        type="button"
        :aria-label="t('common.copy')"
        :title="t('common.copy')"
        class="inline-flex h-8 items-center justify-center rounded-l-lg px-2.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] focus-ring"
        @click="copyName"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      </button>
      <span
        class="h-4 w-px shrink-0 bg-[var(--border-subtle)]"
        aria-hidden="true"
      />
      <button
        type="button"
        :aria-label="t('models.detail')"
        :title="t('models.detail')"
        class="inline-flex h-8 items-center justify-center rounded-r-lg px-2.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] focus-ring"
        @click="emit('detail', model)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  </article>
</template>
