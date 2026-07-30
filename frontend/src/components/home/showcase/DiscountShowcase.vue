<script setup lang="ts">
import { computed } from 'vue'
import { Coins, KeyRound, Percent } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import type { HomeDiscountTier } from '@/types/homeShowcase'

import HomeSectionHeading from './HomeSectionHeading.vue'

const props = defineProps<{
  tiers: readonly HomeDiscountTier[]
  usage: number
  exampleSpend: number
}>()

const emit = defineEmits<{
  'update:usage': [value: number]
  'update:exampleSpend': [value: number]
}>()

const { t, locale } = useI18n()

const maxUsage = 60_000_000
const currentTierIndex = computed(() => {
  let active = 0
  props.tiers.forEach((tier, index) => {
    if (props.usage >= tier.thresholdTokens) active = index
  })
  return active
})
const currentTier = computed(() => props.tiers[currentTierIndex.value])
const nextTier = computed(() => props.tiers[currentTierIndex.value + 1])
const payRatio = computed(
  () => (1 - (currentTier.value?.discountRate ?? 0)) * 100
)
const savings = computed(
  () => props.exampleSpend * (currentTier.value?.discountRate ?? 0)
)
const sliderProgress = computed(() =>
  Math.min(100, Math.max(0, (props.usage / maxUsage) * 100))
)

function tierLabel(tier: HomeDiscountTier | undefined): string {
  return tier ? t(`showcase.discount.tiers.${tier.id}`) : ''
}

function percent(rate: number | undefined): string {
  return new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: 1,
  }).format((rate ?? 0) * 100)
}

function compact(value: number): string {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function currency(value: number): string {
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function onUsageInput(event: Event) {
  emit('update:usage', Number((event.target as HTMLInputElement).value))
}

function onSpendInput(event: Event) {
  emit('update:exampleSpend', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <section id="discount" class="home-showcase-band home-discount-band">
    <div class="home-showcase-inner">
      <HomeSectionHeading
        :eyebrow="t('showcase.discount.eyebrow')"
        :title="t('showcase.discount.title')"
        :description="t('showcase.discount.description')"
      />

      <div class="discount-workbench">
        <div class="discount-readout" aria-live="polite">
          <div class="discount-readout__usage">
            <span>{{ t('showcase.discount.usage') }}</span>
            <strong>{{ compact(usage) }}</strong>
            <small>{{ t('showcase.discount.accountWide') }}</small>
          </div>

          <dl class="discount-readout__stats">
            <div>
              <dt>
                <KeyRound :size="17" />{{ t('showcase.discount.currentTier') }}
              </dt>
              <dd>{{ tierLabel(currentTier) }}</dd>
            </div>
            <div>
              <dt>
                <Percent :size="17" />{{
                  t('showcase.discount.instantDiscount')
                }}
              </dt>
              <dd>{{ percent(currentTier?.discountRate) }}%</dd>
            </div>
            <div>
              <dt><Coins :size="17" />{{ t('showcase.discount.payRatio') }}</dt>
              <dd>{{ payRatio.toFixed(1) }}%</dd>
            </div>
          </dl>
        </div>

        <div class="discount-slider-block">
          <label for="home-discount-usage" class="sr-only">
            {{ t('showcase.discount.sliderLabel') }}
          </label>
          <input
            id="home-discount-usage"
            class="discount-slider"
            type="range"
            min="0"
            :max="maxUsage"
            step="250000"
            :value="usage"
            :aria-valuetext="compact(usage)"
            :style="{ '--discount-progress': `${sliderProgress}%` }"
            @input="onUsageInput"
          />

          <div class="discount-tier-rail" aria-hidden="true">
            <div
              v-for="(tier, index) in tiers"
              :key="tier.id"
              class="discount-tier"
              :class="{
                'is-active': index === currentTierIndex,
                'is-reached': index < currentTierIndex,
              }"
            >
              <span class="discount-tier__node">{{ index + 1 }}</span>
              <strong>{{ tierLabel(tier) }}</strong>
              <small>{{ compact(tier.thresholdTokens) }}</small>
              <b>{{ percent(tier.discountRate) }}%</b>
            </div>
          </div>

          <p class="discount-next-copy">
            <template v-if="nextTier">
              {{
                t('showcase.discount.nextTier', {
                  amount: compact(
                    Math.max(0, nextTier.thresholdTokens - usage)
                  ),
                })
              }}
            </template>
            <template v-else>{{ t('showcase.discount.maxTier') }}</template>
            <span>
              {{ t('showcase.discount.saved') }}
              <strong>{{ currency(savings) }}</strong>
            </span>
          </p>

          <label class="discount-spend-trial">
            <span>{{ t('showcase.discount.exampleSpend') }}</span>
            <input
              type="number"
              min="0"
              step="10"
              :value="exampleSpend"
              @input="onSpendInput"
            />
            <small>
              {{
                t('showcase.discount.estimatedPayment', {
                  amount: currency(exampleSpend * (payRatio / 100)),
                })
              }}
            </small>
          </label>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-discount-band {
  position: relative;
  overflow: hidden;
  background: var(--surface-footer);
  color: var(--footer-text-primary);
}

.home-discount-band::before {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--footer-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--footer-border) 1px, transparent 1px);
  background-size: 52px 52px;
  content: '';
  opacity: 0.18;
  pointer-events: none;
}

.home-discount-band :deep(.home-showcase-heading__title) {
  color: var(--footer-text-primary);
}

.home-discount-band :deep(.home-showcase-heading__description) {
  color: var(--footer-text-secondary);
}

.discount-workbench {
  position: relative;
  display: grid;
  gap: 3rem;
  margin-top: 3.5rem;
  padding: clamp(1.25rem, 4vw, 3rem) 0;
  border-top: 1px solid var(--footer-border);
  border-bottom: 1px solid var(--footer-border);
}

.discount-readout {
  display: grid;
  gap: 2rem;
}

.discount-readout__usage {
  display: grid;
  align-content: start;
  gap: 0.35rem;
}

.discount-readout__usage > span,
.discount-readout__usage > small {
  color: var(--footer-text-tertiary);
  font-size: 0.78rem;
}

.discount-readout__usage > strong {
  color: var(--footer-accent);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: clamp(2.75rem, 8vw, 5.75rem);
  line-height: 1;
  letter-spacing: 0;
}

.discount-readout__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  border-top: 1px solid var(--footer-border);
}

.discount-readout__stats > div {
  min-width: 0;
  padding: 1rem 1rem 0;
  border-left: 1px solid var(--footer-border);
}

.discount-readout__stats > div:first-child {
  padding-left: 0;
  border-left: 0;
}

.discount-readout__stats dt {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--footer-text-tertiary);
  font-size: 0.72rem;
}

.discount-readout__stats dd {
  margin: 0.5rem 0 0;
  color: var(--footer-text-primary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: clamp(1.4rem, 4vw, 2rem);
  font-weight: 750;
}

.discount-slider-block {
  min-width: 0;
}

.discount-slider {
  width: 100%;
  height: 1.5rem;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.discount-slider::-webkit-slider-runnable-track {
  height: 0.4rem;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--footer-accent) var(--discount-progress),
    var(--ink-surface-muted) var(--discount-progress)
  );
}

.discount-slider::-moz-range-track {
  height: 0.4rem;
  border-radius: 999px;
  background: var(--ink-surface-muted);
}

.discount-slider::-moz-range-progress {
  height: 0.4rem;
  border-radius: 999px;
  background: var(--footer-accent);
}

.discount-slider::-webkit-slider-thumb {
  width: 1.35rem;
  height: 1.35rem;
  margin-top: -0.47rem;
  border: 4px solid var(--surface-footer);
  border-radius: 50%;
  appearance: none;
  background: var(--footer-accent);
  box-shadow: 0 0 0 1px var(--footer-border);
}

.discount-slider::-moz-range-thumb {
  width: 0.85rem;
  height: 0.85rem;
  border: 4px solid var(--surface-footer);
  border-radius: 50%;
  background: var(--footer-accent);
  box-shadow: 0 0 0 1px var(--footer-border);
}

.discount-slider:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 5px;
}

.discount-tier-rail {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 1.5rem;
}

.discount-tier {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
  padding-right: 0.5rem;
  color: var(--footer-text-tertiary);
}

.discount-tier__node {
  display: grid;
  width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  margin-bottom: 0.35rem;
  border: 1px solid var(--footer-border);
  border-radius: 50%;
  background: var(--surface-footer);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 0.65rem;
}

.discount-tier strong,
.discount-tier b,
.discount-tier small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discount-tier b {
  color: inherit;
  font-size: 0.78rem;
}

.discount-tier small {
  font-size: 0.65rem;
}

.discount-tier.is-reached,
.discount-tier.is-active {
  color: var(--footer-text-primary);
}

.discount-tier.is-active .discount-tier__node {
  border-color: var(--footer-accent);
  background: var(--footer-accent);
  color: var(--surface-footer);
  box-shadow: 0 0 0 5px
    color-mix(in srgb, var(--footer-accent) 14%, transparent);
}

.discount-next-copy {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  margin: 1.5rem 0 0;
  color: var(--footer-text-tertiary);
  font-size: 0.8rem;
}

.discount-next-copy strong {
  color: var(--footer-accent);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
}

.discount-spend-trial {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(7rem, 10rem);
  align-items: center;
  gap: 0.55rem 1rem;
  margin-top: 1.25rem;
  border-top: 1px solid var(--footer-border);
  padding-top: 1.25rem;
  color: var(--footer-text-secondary);
  font-size: 0.75rem;
}

.discount-spend-trial input {
  min-height: 2.5rem;
  border: 1px solid var(--footer-border);
  border-radius: var(--shape-control);
  background: var(--ink-surface-muted);
  padding-inline: 0.75rem;
  color: var(--footer-text-primary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
}

.discount-spend-trial input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

.discount-spend-trial small {
  grid-column: 1 / -1;
  color: var(--footer-text-tertiary);
}

@media (min-width: 900px) {
  .discount-workbench {
    grid-template-columns: minmax(19rem, 0.78fr) minmax(0, 1.22fr);
    align-items: end;
  }
}

@media (max-width: 640px) {
  .discount-readout__stats {
    grid-template-columns: 1fr;
    gap: 0.85rem;
  }

  .discount-readout__stats > div,
  .discount-readout__stats > div:first-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 0 0;
    border-top: 1px solid var(--footer-border);
    border-left: 0;
  }

  .discount-readout__stats dd {
    margin: 0;
  }

  .discount-tier strong {
    font-size: 0.68rem;
  }

  .discount-tier small {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .discount-slider,
  .discount-tier__node {
    transition: none;
  }
}
</style>
