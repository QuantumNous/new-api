<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  PackageOpen,
  ShoppingCart,
  Store,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import marketDay from '@/assets/home/capabilities/market-day.webp'
import marketNight from '@/assets/home/capabilities/market-night.webp'
import { useThemedAsset } from '@/composables/useThemedAsset'
import type {
  HomeExchangeStage,
  HomeMarketListing,
  HomeMarketMode,
} from '@/types/homeShowcase'

const props = defineProps<{
  mode: HomeMarketMode
  stage: HomeExchangeStage
  marketListings: HomeMarketListing[]
  sellListings: HomeMarketListing[]
  activeTokenName: string
}>()

const emit = defineEmits<{
  'update:mode': [mode: HomeMarketMode]
  publish: [listingId: string]
  purchase: [listingId: string]
  bind: [listingId: string]
}>()

const { t } = useI18n()
const themedAsset = useThemedAsset(marketDay, marketNight)
const imageFailed = ref(false)
const stageOrder: HomeExchangeStage[] = [
  'draft',
  'published',
  'purchased',
  'bound',
]
const activeStageIndex = computed(() => stageOrder.indexOf(props.stage))
const visibleListings = computed(() =>
  props.mode === 'buy' ? props.marketListings : props.sellListings
)

watch(themedAsset, () => {
  imageFailed.value = false
})

function actionLabel(listing: HomeMarketListing) {
  if (props.mode === 'sell') {
    return listing.status === 'draft'
      ? t('showcase.market.actions.publish')
      : t('showcase.market.actions.published')
  }
  if (listing.status === 'purchased') {
    return t('showcase.market.actions.bind', { token: props.activeTokenName })
  }
  if (listing.status === 'bound') return t('showcase.market.actions.bound')
  return t('showcase.market.actions.purchase')
}

function runAction(listing: HomeMarketListing) {
  if (props.mode === 'sell') {
    emit('publish', listing.id)
    return
  }
  if (listing.status === 'purchased') {
    emit('bind', listing.id)
    return
  }
  if (listing.status === 'available') emit('purchase', listing.id)
}
</script>

<template>
  <section
    class="home-band capability-band capability-band--market"
    aria-labelledby="channel-exchange-title"
    data-home-channel-exchange
  >
    <div class="capability-backdrop" :class="{ 'is-fallback': imageFailed }">
      <img
        v-if="!imageFailed"
        :src="themedAsset"
        alt=""
        @error="imageFailed = true"
      />
    </div>

    <div class="capability-inner">
      <header class="capability-heading">
        <div>
          <p class="capability-kicker">
            <CircleDollarSign :size="17" aria-hidden="true" />
            {{ t('showcase.market.kicker') }}
          </p>
          <h2 id="channel-exchange-title">
            {{ t('showcase.market.title') }}
          </h2>
          <p>{{ t('showcase.market.description') }}</p>
        </div>
        <RouterLink :to="{ name: 'market' }" class="capability-link">
          {{ t('showcase.market.enterMarket') }}
          <ArrowRight :size="17" aria-hidden="true" />
        </RouterLink>
      </header>

      <ol class="exchange-track" :aria-label="t('showcase.market.trackLabel')">
        <li
          v-for="(stageKey, index) in stageOrder"
          :key="stageKey"
          :class="{
            'is-active': index === activeStageIndex,
            'is-complete': index < activeStageIndex,
          }"
        >
          <span>
            <Check v-if="index < activeStageIndex" :size="14" />
            <template v-else>{{ String(index + 1).padStart(2, '0') }}</template>
          </span>
          <strong>{{ t(`showcase.market.stages.${stageKey}`) }}</strong>
          <i v-if="index < stageOrder.length - 1" aria-hidden="true" />
        </li>
      </ol>

      <div class="exchange-workbench">
        <div class="exchange-toolbar">
          <div
            class="exchange-segments"
            role="tablist"
            :aria-label="t('showcase.market.modeLabel')"
          >
            <button
              type="button"
              role="tab"
              :aria-selected="mode === 'buy'"
              :class="{ 'is-active': mode === 'buy' }"
              @click="emit('update:mode', 'buy')"
            >
              <ShoppingCart :size="16" aria-hidden="true" />
              {{ t('showcase.market.buy') }}
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="mode === 'sell'"
              :class="{ 'is-active': mode === 'sell' }"
              @click="emit('update:mode', 'sell')"
            >
              <Store :size="16" aria-hidden="true" />
              {{ t('showcase.market.sell') }}
            </button>
          </div>
          <p>
            {{
              mode === 'buy'
                ? t('showcase.market.buyHint')
                : t('showcase.market.sellHint')
            }}
          </p>
        </div>

        <Transition name="exchange-list" mode="out-in">
          <div :key="mode" class="exchange-list" role="tabpanel">
            <TransitionGroup name="exchange-row">
              <article
                v-for="listing in visibleListings"
                :key="listing.id"
                class="exchange-row"
                :data-listing-id="listing.id"
                :data-status="listing.status"
              >
                <div class="exchange-provider">
                  <span class="exchange-source" :data-source="listing.source">
                    {{ t(`showcase.market.source.${listing.source}`) }}
                  </span>
                  <strong>{{ listing.provider }}</strong>
                  <small>{{ listing.region }} · {{ listing.model }}</small>
                </div>

                <dl class="exchange-metrics">
                  <div>
                    <dt>{{ t('showcase.market.price') }}</dt>
                    <dd>¥{{ listing.price.toFixed(2) }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('showcase.market.availability') }}</dt>
                    <dd>{{ listing.availability.toFixed(2) }}%</dd>
                  </div>
                  <div>
                    <dt>{{ t('showcase.market.quality') }}</dt>
                    <dd>
                      <BadgeCheck :size="14" /> {{ listing.qualityScore }}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  class="exchange-action"
                  :class="{
                    'is-complete':
                      listing.status === 'published' ||
                      listing.status === 'bound',
                  }"
                  :disabled="
                    listing.status === 'published' || listing.status === 'bound'
                  "
                  @click="runAction(listing)"
                >
                  <PackageOpen :size="16" aria-hidden="true" />
                  {{ actionLabel(listing) }}
                </button>
              </article>
            </TransitionGroup>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.capability-band {
  position: relative;
  min-height: 44rem;
  overflow: hidden;
  background: var(--showcase-capability-background);
}

.capability-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--showcase-image-fallback);
  pointer-events: none;
}

.capability-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  opacity: var(--showcase-image-opacity);
}

.capability-backdrop::after {
  position: absolute;
  inset: 0;
  background: var(--showcase-image-scrim);
  content: '';
}

.capability-inner {
  position: relative;
  z-index: 1;
  width: min(100% - 2rem, 92rem);
  margin-inline: auto;
  padding-block: clamp(4.5rem, 8vw, 7.5rem);
}

.capability-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
}

.capability-heading > div {
  max-width: 56rem;
}

.capability-kicker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--accent-text);
  font-family: var(--home-font-stamp);
  font-size: 0.72rem;
}

.capability-heading h2 {
  max-width: 14em;
  margin: 0.75rem 0 0;
  font-family: var(--home-font-display);
  font-size: 4.25rem;
  font-weight: 400;
  line-height: 1.08;
  letter-spacing: 0;
  font-synthesis: none;
  text-wrap: balance;
}

.capability-heading > div > p:last-child {
  max-width: 46rem;
  margin: 1rem 0 0;
  color: var(--text-secondary);
  line-height: 1.8;
}

.capability-link {
  display: inline-flex;
  min-height: 2.75rem;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.55rem;
  border-bottom: 1px solid var(--accent);
  color: var(--accent-text);
  font-size: 0.8rem;
  font-weight: 700;
}

.exchange-track {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 3rem 0 0;
  padding: 0;
  list-style: none;
}

.exchange-track li {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.7rem;
  color: var(--text-tertiary);
}

.exchange-track li > span {
  position: relative;
  z-index: 1;
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--showcase-rule-strong);
  border-radius: 50%;
  background: var(--showcase-capability-panel);
  font-family: var(--home-font-stamp);
  font-size: 0.64rem;
}

.exchange-track li > strong {
  font-family: var(--home-font-hand);
  font-size: 0.82rem;
  font-weight: 400;
  font-synthesis: none;
}

.exchange-track li > i {
  position: absolute;
  z-index: 0;
  right: 0.75rem;
  left: 2rem;
  height: 1px;
  overflow: hidden;
  background: var(--showcase-rule-strong);
}

.exchange-track li > i::after {
  position: absolute;
  inset: 0;
  background: var(--showcase-flow-line);
  content: '';
  transform: translateX(-100%);
}

.exchange-track li.is-complete,
.exchange-track li.is-active {
  color: var(--text-primary);
}

.exchange-track li.is-complete > span,
.exchange-track li.is-active > span {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}

.exchange-track li.is-active > span {
  box-shadow: var(--showcase-active-halo);
}

.exchange-track li.is-complete > i::after {
  animation: capability-flow 1.4s linear infinite;
}

.exchange-workbench {
  margin-top: 2.4rem;
  border-block: 1px solid var(--showcase-rule-strong);
  background: var(--showcase-capability-workbench);
  box-shadow: var(--showcase-workbench-shadow);
}

.exchange-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.25rem;
  border-bottom: 1px solid var(--showcase-rule);
}

.exchange-toolbar > p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.72rem;
}

.exchange-segments {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--showcase-capability-panel);
}

.exchange-segments button {
  display: inline-flex;
  min-width: 6.5rem;
  min-height: 2.35rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding-inline: 0.9rem;
  color: var(--text-tertiary);
  font-size: 0.75rem;
  font-weight: 700;
}

.exchange-segments button.is-active {
  background: var(--showcase-selected-layer);
  color: var(--text-primary);
  box-shadow: var(--elevation-1);
}

.exchange-list {
  min-height: 20rem;
}

.exchange-row {
  display: grid;
  grid-template-columns: minmax(15rem, 1fr) minmax(23rem, 1.35fr) auto;
  align-items: center;
  gap: 1.5rem;
  padding: 1.25rem;
  border-bottom: 1px solid var(--showcase-rule);
  transition:
    background-color 180ms ease,
    transform 180ms ease;
}

.exchange-row:last-child {
  border-bottom: 0;
}

.exchange-row:hover {
  background: var(--state-hover-layer);
}

.exchange-provider {
  min-width: 0;
}

.exchange-source {
  display: inline-flex;
  color: var(--accent-text);
  font-family: var(--home-font-stamp);
  font-size: 0.58rem;
}

.exchange-provider strong,
.exchange-provider small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exchange-provider strong {
  margin-top: 0.45rem;
  font-size: 0.9rem;
}

.exchange-provider small {
  margin-top: 0.3rem;
  color: var(--text-tertiary);
  font-size: 0.68rem;
}

.exchange-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
}

.exchange-metrics > div {
  min-width: 0;
  border-left: 1px solid var(--showcase-rule);
  padding-left: 0.75rem;
}

.exchange-metrics dt {
  color: var(--text-tertiary);
  font-size: 0.62rem;
}

.exchange-metrics dd {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.35rem 0 0;
  color: var(--text-primary);
  font-family: var(--home-font-stamp);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.exchange-action {
  display: inline-flex;
  min-width: 8.75rem;
  min-height: 2.55rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  padding-inline: 0.85rem;
  color: var(--accent-contrast);
  font-size: 0.72rem;
  font-weight: 760;
}

.exchange-action:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--button-shadow-hover);
}

.exchange-action.is-complete {
  border-color: var(--status-success);
  background: var(--status-success-soft);
  color: var(--status-success-text);
}

.exchange-action:disabled {
  cursor: default;
  opacity: 0.8;
}

.exchange-segments button:focus-visible,
.exchange-action:focus-visible,
.capability-link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

.exchange-list-enter-active,
.exchange-list-leave-active,
.exchange-row-enter-active,
.exchange-row-leave-active,
.exchange-row-move {
  transition:
    opacity 240ms ease,
    transform 240ms ease;
}

.exchange-list-enter-from,
.exchange-list-leave-to {
  opacity: 0;
  transform: translateY(0.75rem);
}

.exchange-row-enter-from,
.exchange-row-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}

@keyframes capability-flow {
  to {
    transform: translateX(100%);
  }
}

@media (max-width: 900px) {
  .capability-heading {
    align-items: start;
    flex-direction: column;
  }

  .capability-heading h2 {
    font-size: 3.5rem;
  }

  .exchange-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .exchange-metrics {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

@media (max-width: 640px) {
  .capability-band {
    min-height: auto;
  }

  .capability-inner {
    width: min(100% - 1rem, 92rem);
    padding-block: 4rem;
  }

  .capability-heading h2 {
    font-size: 2.5rem;
  }

  .exchange-track {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.2rem 0;
  }

  .exchange-track li:nth-child(2) > i {
    display: none;
  }

  .exchange-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .exchange-segments {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .exchange-segments button {
    min-width: 0;
  }

  .exchange-row {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .exchange-metrics,
  .exchange-action {
    grid-column: 1;
    grid-row: auto;
  }

  .exchange-action {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .exchange-track li.is-complete > i::after,
  .exchange-list-enter-active,
  .exchange-list-leave-active,
  .exchange-row-enter-active,
  .exchange-row-leave-active,
  .exchange-row-move,
  .exchange-row,
  .exchange-action {
    animation: none;
    transition: none;
  }
}
</style>
