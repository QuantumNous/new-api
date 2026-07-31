<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { storeToRefs } from 'pinia'

import { useHomeShowcase } from '@/composables/useHomeShowcase'
import { useAppStore } from '@/stores'

import ChannelExchangeShowcase from './ChannelExchangeShowcase.vue'
import RuntimePulseBand from './RuntimePulseBand.vue'
import TokenRoutingShowcase from './TokenRoutingShowcase.vue'

const root = ref<HTMLElement | null>(null)
const { uptimeLabel } = storeToRefs(useAppStore())
const showcase = useHomeShowcase()

if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
  showcase.setSectionVisible(false)
}

const { stop } = useIntersectionObserver(
  root,
  ([entry]) => showcase.setSectionVisible(Boolean(entry?.isIntersecting)),
  { threshold: 0 }
)

onBeforeUnmount(stop)
</script>

<template>
  <main ref="root" class="home-showcase no-handdrawn">
    <RuntimePulseBand
      :runtime="showcase.runtime.value"
      :requests="showcase.demoRequests.value"
      :uptime-label="uptimeLabel"
    />
    <ChannelExchangeShowcase
      :mode="showcase.marketMode.value"
      :stage="showcase.exchangeStage.value"
      :market-listings="showcase.marketListings.value"
      :sell-listings="showcase.sellListings.value"
      :active-token-name="showcase.activeToken.value.name"
      @update:mode="showcase.setMarketMode"
      @publish="showcase.publishListing"
      @purchase="showcase.purchaseListing"
      @bind="showcase.bindListing"
    />
    <TokenRoutingShowcase
      :tokens="showcase.tokens.value"
      :active-token-id="showcase.activeTokenId.value"
      :active-token="showcase.activeToken.value"
      :simulation="showcase.routeSimulation.value"
      @update:active-token="showcase.setActiveToken"
      @update:mode="showcase.setRouteMode"
      @update:load-balance="showcase.setLoadBalance"
      @reorder="showcase.reorderActiveChannel"
      @move="showcase.moveActiveChannel"
      @weight="showcase.setChannelWeight"
      @toggle="showcase.toggleChannel"
      @simulate="showcase.simulateRequest"
    />
  </main>
</template>
