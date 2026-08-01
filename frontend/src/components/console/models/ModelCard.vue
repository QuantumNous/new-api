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

/** Channels shown inline; the rest collapse to a "+N" chip. */
const shownChannels = computed(() => props.model.channels.slice(0, 2))
const extraChannels = computed(() =>
  Math.max(0, props.model.channels.length - 2)
)

async function copyName() {
  await copy(props.model.name)
  toast.success(t('models.copied', { name: props.model.name }))
}
</script>

<template>
  <!-- ============ GRID ============ -->
  <article
    v-if="layout === 'grid'"
    class="pencil-surface sketch-card group flex flex-col border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4 transition duration-200 ease-out hover:border-[var(--accent)] focus-within:border-[var(--accent)] motion-safe:hover:-translate-y-1"
    data-handdrawn="surface"
  >
    <!-- header: model name + actions -->
    <div class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <button
          type="button"
          class="flex max-w-full items-center gap-1.5 text-left font-mono text-lg font-bold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-text)] hover:text-[var(--accent-text)]"
          :title="t('models.copyHint', { name: model.name })"
          @click="copyName"
        >
          <span class="truncate">{{ model.name }}</span>
        </button>
      </div>
      <div
        class="inline-flex shrink-0 items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-muted)] transition-colors group-hover:border-[var(--accent)]"
      >
        <button
          type="button"
          :aria-label="t('common.copy')"
          :title="t('common.copy')"
          class="inline-flex h-8 items-center justify-center rounded-l-full px-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] focus-ring"
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
          class="h-4 w-px shrink-0 bg-[var(--border-default)] transition-colors group-hover:bg-[var(--border-strong)]"
          aria-hidden="true"
        />
        <button
          type="button"
          :aria-label="t('models.detail')"
          :title="t('models.detail')"
          class="inline-flex h-8 items-center justify-center rounded-r-full px-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] focus-ring"
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
    </div>

    <!-- price block -->
    <div class="mt-3 space-y-1">
      <template v-if="model.billing === 'per_call'">
        <div class="flex items-baseline gap-1.5">
          <span class="text-lg font-bold text-[var(--text-primary)]">{{
            formatTokenPrice(model.price.per_call)
          }}</span>
          <span class="text-xs text-[var(--text-tertiary)]">{{
            t('models.perCall')
          }}</span>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center justify-between text-xs">
          <span class="text-[var(--text-tertiary)]">{{
            t('models.priceInput')
          }}</span>
          <span class="font-mono font-semibold text-[var(--text-primary)]"
            >{{ formatTokenPrice(model.price.input) }}
            <span class="font-sans font-normal text-[var(--text-tertiary)]"
              >/ 1M</span
            ></span
          >
        </div>
        <div
          v-if="model.price.output != null"
          class="flex items-center justify-between text-xs"
        >
          <span class="text-[var(--text-tertiary)]">{{
            t('models.priceOutput')
          }}</span>
          <span class="font-mono font-semibold text-[var(--text-primary)]"
            >{{ formatTokenPrice(model.price.output) }}
            <span class="font-sans font-normal text-[var(--text-tertiary)]"
              >/ 1M</span
            ></span
          >
        </div>
        <div
          v-if="model.price.cache_read != null"
          class="flex items-center justify-between text-xs"
        >
          <span class="text-[var(--text-tertiary)]">{{
            t('models.priceCache')
          }}</span>
          <span class="font-mono font-semibold text-[var(--text-secondary)]"
            >{{ formatTokenPrice(model.price.cache_read) }}
            <span class="font-sans font-normal text-[var(--text-tertiary)]"
              >/ 1M</span
            ></span
          >
        </div>
      </template>
    </div>

    <!-- tagline: anchored to the bottom, right above the metrics divider -->
    <p
      class="mt-auto pt-3 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]"
    >
      {{ model.tagline }}
    </p>

    <!-- metrics row -->
    <div
      class="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-[var(--border-subtle)] pt-3"
    >
      <div class="flex min-w-0 flex-wrap items-center gap-1.5">
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
      <div class="flex shrink-0 items-end gap-4 text-right">
        <div>
          <p
            class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]"
          >
            {{ t('models.latency') }}
          </p>
          <p class="text-xs font-semibold text-[var(--text-primary)]">
            {{ formatLatency(model.latency) }}
          </p>
        </div>
        <div v-if="model.tps > 0">
          <p
            class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]"
          >
            TPS
          </p>
          <p class="text-xs font-semibold text-[var(--text-primary)]">
            {{ model.tps.toFixed(1) }}
          </p>
        </div>
        <div>
          <p
            class="mb-0.5 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]"
          >
            {{ t('models.status') }}
          </p>
          <HealthMeter :value="model.health" :bars="5" />
        </div>
      </div>
    </div>

    <!-- footer: type + channels -->
    <div
      class="mt-3 flex items-center gap-2 text-xs text-[var(--text-tertiary)]"
    >
      <StatusChip :tone="typeTone[model.type]">{{ typeLabel }}</StatusChip>
      <span class="ml-auto min-w-0 truncate text-right" data-model-channels>
        {{ t('models.channels') }} {{ shownChannels.join(' · ')
        }}<span v-if="extraChannels"> +{{ extraChannels }}</span>
      </span>
    </div>
  </article>

  <!-- ============ LIST ============ -->
  <article
    v-else
    class="group flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 py-3 transition duration-200 ease-out hover:border-[var(--accent)] hover:shadow-[var(--card-shadow-hover)] focus-within:border-[var(--accent)] motion-safe:hover:-translate-y-0.5"
  >
    <!-- name + channels -->
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
        {{ shownChannels.join(' · ')
        }}<span v-if="extraChannels"> +{{ extraChannels }}</span>
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
      class="inline-flex shrink-0 items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-muted)] transition-colors group-hover:border-[var(--accent)]"
    >
      <button
        type="button"
        :aria-label="t('common.copy')"
        :title="t('common.copy')"
        class="inline-flex h-8 items-center justify-center rounded-l-full px-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] focus-ring"
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
        class="h-4 w-px shrink-0 bg-[var(--border-default)] transition-colors group-hover:bg-[var(--border-strong)]"
        aria-hidden="true"
      />
      <button
        type="button"
        :aria-label="t('models.detail')"
        :title="t('models.detail')"
        class="inline-flex h-8 items-center justify-center rounded-r-full px-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] focus-ring"
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
