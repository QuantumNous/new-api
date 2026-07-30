<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { AlertTriangle, RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import { useHomeShowcase } from '@/composables/useHomeShowcase'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { HomeShowcaseSource } from '@/types/homeShowcase'

import ActivityShowcase from './ActivityShowcase.vue'
import DiscountShowcase from './DiscountShowcase.vue'
import MarketRouteShowcase from './MarketRouteShowcase.vue'
import TrustShowcase from './TrustShowcase.vue'

const props = defineProps<{
  source?: HomeShowcaseSource
}>()

const { t } = useI18n()
const { uptimeLabel } = storeToRefs(useAppStore())
const { isAuthenticated } = storeToRefs(useAuthStore())
const assuranceObserver = ref<HTMLElement | null>(null)

const {
  loading,
  error,
  snapshot,
  marketSide,
  marketListings,
  marketJourneyStage,
  routeChannels,
  loadBalance,
  routeSimulation,
  discountTiers,
  accountTokens,
  exampleSpendUsd,
  activities,
  runtime,
  todayRequests,
  qualityReports,
  configuredSupportLinks,
  load,
  setMarketSide,
  publishListing,
  purchaseListing,
  bindListingToRoute,
  reorderRoute,
  moveRoute,
  toggleRouteChannel,
  setRouteWeight,
  toggleLoadBalance,
  simulateFailover,
  setAccountTokens,
  setExampleSpendUsd,
  setSectionVisible,
} = useHomeShowcase({ source: props.source })

if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
  setSectionVisible(false)
}

const { stop } = useIntersectionObserver(
  assuranceObserver,
  ([entry]) => setSectionVisible(Boolean(entry?.isIntersecting)),
  { threshold: 0 }
)

onBeforeUnmount(stop)
</script>

<template>
  <main class="home-showcase" :aria-busy="loading">
    <section
      v-if="loading && !snapshot"
      class="home-showcase-band home-showcase-state"
      aria-live="polite"
    >
      <div class="home-showcase-inner">
        <span class="home-showcase-state__pulse" aria-hidden="true" />
        <p>{{ t('showcase.state.loading') }}</p>
      </div>
    </section>

    <section
      v-else-if="error && !snapshot"
      class="home-showcase-band home-showcase-state home-showcase-state--error"
      role="alert"
    >
      <div class="home-showcase-inner">
        <AlertTriangle :size="30" />
        <h2>{{ t('showcase.state.errorTitle') }}</h2>
        <p>{{ t('showcase.state.errorDescription') }}</p>
        <button type="button" @click="load">
          <RefreshCw :size="17" />{{ t('showcase.state.retry') }}
        </button>
      </div>
    </section>

    <template v-else-if="snapshot">
      <MarketRouteShowcase
        :side="marketSide"
        :listings="marketListings"
        :journey-stage="marketJourneyStage"
        :channels="routeChannels"
        :load-balance="loadBalance"
        :simulation="routeSimulation"
        @update:side="setMarketSide"
        @publish="publishListing"
        @purchase="purchaseListing"
        @bind="bindListingToRoute"
        @move="moveRoute"
        @reorder="reorderRoute"
        @toggle-channel="toggleRouteChannel"
        @update-weight="setRouteWeight"
        @toggle-load-balance="toggleLoadBalance"
        @simulate="simulateFailover"
      />

      <DiscountShowcase
        :tiers="discountTiers"
        :usage="accountTokens"
        :example-spend="exampleSpendUsd"
        @update:usage="setAccountTokens"
        @update:example-spend="setExampleSpendUsd"
      />

      <ActivityShowcase :activities="activities" />

      <div ref="assuranceObserver" class="home-showcase-assurance-group">
        <TrustShowcase
          :runtime="runtime"
          :today-requests="todayRequests"
          :uptime-label="uptimeLabel"
          :channels="routeChannels"
          :reports="qualityReports"
          :support-links="configuredSupportLinks"
          :authenticated="isAuthenticated"
        />
      </div>
    </template>
  </main>
</template>

<style scoped>
.home-showcase-state {
  display: grid;
  min-height: 26rem;
  place-items: center;
  background: var(--page-background);
  text-align: center;
}

.home-showcase-state .home-showcase-inner {
  display: grid;
  justify-items: center;
}

.home-showcase-state__pulse {
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--accent);
  border-radius: 50%;
  background: var(--accent-soft);
  animation: home-state-pulse 1.4s ease-in-out infinite;
}

.home-showcase-state p {
  max-width: 32rem;
  margin: 1rem 0 0;
  color: var(--text-secondary);
}

.home-showcase-state h2 {
  margin: 1rem 0 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 1.6rem;
}

.home-showcase-state--error svg {
  color: var(--status-warning-text);
}

.home-showcase-state button {
  display: inline-flex;
  min-height: 2.7rem;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.25rem;
  border-radius: var(--shape-control);
  background: var(--accent);
  padding: 0.6rem 1rem;
  color: var(--accent-contrast);
  font-weight: 750;
}

.home-showcase-state button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

@keyframes home-state-pulse {
  50% {
    box-shadow: 0 0 0 0.8rem color-mix(in srgb, var(--accent) 0%, transparent);
    transform: scale(0.86);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-showcase-state__pulse {
    animation: none;
  }
}
</style>
