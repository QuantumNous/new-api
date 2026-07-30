<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CircleDollarSign,
  Gauge,
  GripVertical,
  KeyRound,
  Network,
  Play,
  Radio,
  Send,
  ShieldCheck,
  Store,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import marketDayAsset from '@/assets/home/showcase/market-ledger-day.webp'
import marketNightAsset from '@/assets/home/showcase/market-operations-night.webp'
import { useTheme } from '@/composables/useTheme'
import type {
  HomeMarketJourneyStage,
  HomeMarketListing,
  HomeMarketSide,
  HomeRouteChannel,
  HomeRouteSimulation,
} from '@/types/homeShowcase'

import HomeSectionHeading from './HomeSectionHeading.vue'

const props = defineProps<{
  side: HomeMarketSide
  listings: HomeMarketListing[]
  journeyStage: HomeMarketJourneyStage
  channels: HomeRouteChannel[]
  loadBalance: boolean
  simulation: HomeRouteSimulation
}>()

const emit = defineEmits<{
  'update:side': [value: HomeMarketSide]
  publish: [listingId: string]
  purchase: [listingId: string]
  bind: [listingId: string]
  move: [channelId: string, direction: -1 | 1]
  reorder: [channelId: string, targetIndex: number]
  'toggle-channel': [channelId: string]
  'update-weight': [channelId: string, weight: number]
  'toggle-load-balance': []
  simulate: []
}>()

const { t } = useI18n()
const { resolvedTheme } = useTheme()
const draggedChannelId = ref<string | null>(null)
const failedBackdropAssets = ref(new Set<string>())

const backdropAsset = computed(() =>
  resolvedTheme.value === 'dark' ? marketNightAsset : marketDayAsset
)
const backdropAvailable = computed(
  () => !failedBackdropAssets.value.has(backdropAsset.value)
)

const journeySteps = computed(() => [
  { id: 'draft', label: t('showcase.market.journey.draft') },
  { id: 'listed', label: t('showcase.market.journey.listed') },
  { id: 'purchased', label: t('showcase.market.journey.purchased') },
  { id: 'bound', label: t('showcase.market.journey.bound') },
])

const journeyIndex = computed(() =>
  journeySteps.value.findIndex((step) => step.id === props.journeyStage)
)

const visibleListings = computed(() => {
  if (props.side === 'sell') {
    return props.listings.filter((listing) => listing.journey)
  }
  return props.listings.filter((listing) => listing.status !== 'draft')
})

const activeChannel = computed(() =>
  props.channels.find(
    (channel) => channel.id === props.simulation.activeChannelId
  )
)

const primaryChannel = computed(() =>
  props.channels.find(
    (channel) => channel.id === props.simulation.primaryChannelId
  )
)

const fallbackChannel = computed(() =>
  props.channels.find(
    (channel) => channel.id === props.simulation.fallbackChannelId
  )
)

const simulationCopy = computed(() => {
  if (props.simulation.phase === 'sending') {
    return t('showcase.market.routeSending', {
      channel: primaryChannel.value ? t(primaryChannel.value.nameKey) : '--',
    })
  }
  if (props.simulation.phase === 'failover') {
    return t('showcase.market.routeFailover', {
      channel: fallbackChannel.value ? t(fallbackChannel.value.nameKey) : '--',
    })
  }
  if (props.simulation.phase === 'responded') {
    return t('showcase.market.routeDone', {
      channel: activeChannel.value ? t(activeChannel.value.nameKey) : '--',
      latency: props.simulation.latencyMs ?? '--',
    })
  }
  if (props.simulation.phase === 'unavailable') {
    return t('showcase.market.routeUnavailable')
  }
  return t('showcase.market.routeReady')
})

function listingBound(listingId: string): boolean {
  return props.channels.some((channel) => channel.listingId === listingId)
}

function listingAction(
  listing: HomeMarketListing
): 'publish' | 'purchase' | 'bind' | 'done' {
  if (listing.status === 'draft') return 'publish'
  if (listing.status === 'listed') return 'purchase'
  if (!listingBound(listing.id)) return 'bind'
  return 'done'
}

function runListingAction(listing: HomeMarketListing): void {
  const action = listingAction(listing)
  if (action === 'publish') emit('publish', listing.id)
  if (action === 'purchase') emit('purchase', listing.id)
  if (action === 'bind') emit('bind', listing.id)
}

function listingActionLabel(listing: HomeMarketListing): string {
  const action = listingAction(listing)
  if (action === 'publish') return t('showcase.market.publish')
  if (action === 'purchase') return t('showcase.market.purchaseAction')
  if (action === 'bind') return t('showcase.market.bindAction')
  return t('showcase.market.bound')
}

function listingActionIcon(listing: HomeMarketListing) {
  const action = listingAction(listing)
  if (action === 'publish') return Send
  if (action === 'purchase') return CircleDollarSign
  if (action === 'bind') return KeyRound
  return Check
}

function onDragStart(event: DragEvent, channelId: string): void {
  draggedChannelId.value = channelId
  event.dataTransfer?.setData('text/plain', channelId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(event: DragEvent, targetIndex: number): void {
  const channelId =
    draggedChannelId.value ?? event.dataTransfer?.getData('text/plain') ?? ''
  draggedChannelId.value = null
  if (channelId) emit('reorder', channelId, targetIndex)
}

function onRouteKeydown(event: KeyboardEvent, channelId: string): void {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    emit('move', channelId, -1)
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    emit('move', channelId, 1)
  }
}

function onWeightInput(channelId: string, event: Event): void {
  emit(
    'update-weight',
    channelId,
    Number((event.target as HTMLInputElement).value)
  )
}

function markBackdropFailed(): void {
  failedBackdropAssets.value = new Set(failedBackdropAssets.value).add(
    backdropAsset.value
  )
}
</script>

<template>
  <section id="market-route" class="home-showcase-band market-route-band">
    <div class="market-route-backdrop" aria-hidden="true">
      <img
        v-if="backdropAvailable"
        :src="backdropAsset"
        alt=""
        loading="lazy"
        @error="markBackdropFailed"
      />
    </div>
    <div class="home-showcase-inner">
      <HomeSectionHeading
        :eyebrow="t('showcase.market.eyebrow')"
        :title="t('showcase.market.title')"
        :description="t('showcase.market.description')"
      />

      <ol
        class="market-journey"
        :aria-label="t('showcase.market.journey.label')"
      >
        <li
          v-for="(step, index) in journeySteps"
          :key="step.id"
          :class="{
            'is-active': index === journeyIndex,
            'is-complete': index < journeyIndex,
          }"
        >
          <span>{{
            index < journeyIndex ? '✓' : String(index + 1).padStart(2, '0')
          }}</span>
          <strong>{{ step.label }}</strong>
          <ArrowRight
            v-if="index < journeySteps.length - 1"
            :size="15"
            aria-hidden="true"
          />
        </li>
      </ol>

      <div class="market-route-layout">
        <div class="market-ledger">
          <div class="market-ledger__header">
            <div>
              <p><Store :size="17" />{{ t('showcase.market.listingTitle') }}</p>
              <span>{{ t('showcase.market.listingHint') }}</span>
            </div>
            <div
              class="market-side-switch"
              role="group"
              :aria-label="t('showcase.market.sideLabel')"
            >
              <button
                type="button"
                :class="{ 'is-active': side === 'buy' }"
                :aria-pressed="side === 'buy'"
                @click="emit('update:side', 'buy')"
              >
                {{ t('showcase.market.buy') }}
              </button>
              <button
                type="button"
                :class="{ 'is-active': side === 'sell' }"
                :aria-pressed="side === 'sell'"
                @click="emit('update:side', 'sell')"
              >
                {{ t('showcase.market.sell') }}
              </button>
            </div>
          </div>

          <TransitionGroup
            name="market-listing"
            tag="div"
            class="market-listings"
          >
            <article
              v-for="listing in visibleListings"
              :key="listing.id"
              class="market-listing"
            >
              <div class="market-listing__topline">
                <span>{{ listing.vendor }}</span>
                <span>{{ listing.model }}</span>
                <span
                  class="market-listing__status"
                  :data-status="listing.status"
                >
                  {{ t(`showcase.market.status.${listing.status}`) }}
                </span>
              </div>
              <h3>{{ t(listing.titleKey) }}</h3>
              <p>{{ t(listing.detailKey) }}</p>
              <dl>
                <div>
                  <dt>{{ t('showcase.market.price') }}</dt>
                  <dd>${{ listing.unitPriceUsd.toFixed(2) }}</dd>
                </div>
                <div>
                  <dt>{{ t('showcase.market.availability') }}</dt>
                  <dd>{{ listing.availabilityPercent.toFixed(2) }}%</dd>
                </div>
                <div>
                  <dt>{{ t('showcase.market.qc') }}</dt>
                  <dd>{{ listing.qualityScore }}</dd>
                </div>
              </dl>
              <button
                type="button"
                class="market-listing__action"
                :class="{ 'is-complete': listingAction(listing) === 'done' }"
                :disabled="listingAction(listing) === 'done'"
                @click="runListingAction(listing)"
              >
                <component :is="listingActionIcon(listing)" :size="17" />
                {{ listingActionLabel(listing) }}
              </button>
            </article>
          </TransitionGroup>

          <p v-if="visibleListings.length === 0" class="market-listings__empty">
            {{ t('showcase.market.emptyListings') }}
          </p>

          <RouterLink :to="{ name: 'market' }" class="market-inline-link">
            {{ t('showcase.market.goMarket') }}<ArrowRight :size="15" />
          </RouterLink>
        </div>

        <div class="route-workbench">
          <div class="route-workbench__header">
            <div>
              <p><Network :size="17" />{{ t('showcase.market.routeTitle') }}</p>
              <span>{{ t('showcase.market.routeHint') }}</span>
            </div>
            <button
              type="button"
              class="route-balance-toggle"
              :class="{ 'is-active': loadBalance }"
              :aria-pressed="loadBalance"
              @click="emit('toggle-load-balance')"
            >
              <ToggleRight v-if="loadBalance" :size="23" />
              <ToggleLeft v-else :size="23" />
              {{ t('showcase.market.loadBalance') }}
            </button>
          </div>

          <ol
            class="route-channels"
            :aria-label="t('showcase.market.routeOrderLabel')"
          >
            <li
              v-for="(channel, index) in channels"
              :key="channel.id"
              class="route-channel"
              :class="{
                'is-disabled': !channel.enabled,
                'is-active': simulation.activeChannelId === channel.id,
                'is-degraded': channel.health === 'degraded',
              }"
              :draggable="true"
              tabindex="0"
              @dragstart="onDragStart($event, channel.id)"
              @dragover.prevent
              @drop.prevent="onDrop($event, index)"
              @dragend="draggedChannelId = null"
              @keydown="onRouteKeydown($event, channel.id)"
            >
              <GripVertical
                class="route-channel__grip"
                :size="18"
                aria-hidden="true"
              />
              <span class="route-channel__priority">{{
                channel.priority
              }}</span>
              <div class="route-channel__copy">
                <div>
                  <strong>{{ t(channel.nameKey) }}</strong>
                  <span class="route-health" :data-health="channel.health">
                    {{ t(`showcase.routing.health.${channel.health}`) }}
                  </span>
                </div>
                <small>{{ channel.vendor }} · {{ channel.model }}</small>
              </div>
              <dl class="route-channel__signals">
                <div>
                  <dt><Gauge :size="13" />ms</dt>
                  <dd>{{ channel.latencyMs }}</dd>
                </div>
                <div>
                  <dt><ShieldCheck :size="13" />QC</dt>
                  <dd>{{ channel.qualityScore }}</dd>
                </div>
              </dl>
              <label class="route-channel__weight">
                <span
                  >{{ t('showcase.market.weight') }} {{ channel.weight }}%</span
                >
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  :value="channel.weight"
                  :disabled="!loadBalance || !channel.enabled"
                  @input="onWeightInput(channel.id, $event)"
                />
              </label>
              <div class="route-channel__actions">
                <button
                  type="button"
                  :disabled="index === 0"
                  :title="t('showcase.common.previous')"
                  :aria-label="
                    t('showcase.market.moveChannelUp', {
                      channel: t(channel.nameKey),
                    })
                  "
                  @click="emit('move', channel.id, -1)"
                >
                  <ArrowUp :size="16" />
                </button>
                <button
                  type="button"
                  :disabled="index === channels.length - 1"
                  :title="t('showcase.common.next')"
                  :aria-label="
                    t('showcase.market.moveChannelDown', {
                      channel: t(channel.nameKey),
                    })
                  "
                  @click="emit('move', channel.id, 1)"
                >
                  <ArrowDown :size="16" />
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': channel.enabled }"
                  :title="
                    channel.enabled
                      ? t('showcase.common.enabled')
                      : t('showcase.common.disabled')
                  "
                  :aria-label="
                    t('showcase.market.toggleChannel', {
                      channel: t(channel.nameKey),
                    })
                  "
                  :aria-pressed="channel.enabled"
                  @click="emit('toggle-channel', channel.id)"
                >
                  <Radio :size="16" />
                </button>
              </div>
            </li>
          </ol>

          <p v-if="channels.length === 0" class="route-channels__empty">
            {{ t('showcase.market.emptyRoute') }}
          </p>

          <div class="route-simulator" :data-phase="simulation.phase">
            <div class="route-simulator__trace" aria-hidden="true">
              <span class="route-trace-node"><Send :size="15" /></span>
              <i />
              <span class="route-trace-node"><Network :size="15" /></span>
              <i />
              <span class="route-trace-node"><Zap :size="15" /></span>
            </div>
            <div class="route-simulator__copy" aria-live="polite">
              <strong>{{ simulationCopy }}</strong>
              <span v-if="activeChannel">{{ t(activeChannel.nameKey) }}</span>
              <span v-else>{{ t('showcase.market.mockIsolation') }}</span>
            </div>
            <button
              type="button"
              :disabled="
                simulation.phase === 'sending' ||
                simulation.phase === 'failover'
              "
              @click="emit('simulate')"
            >
              <Play :size="17" />
              {{ t('showcase.market.simulate') }}
            </button>
          </div>

          <RouterLink :to="{ name: 'keys' }" class="market-inline-link">
            {{ t('showcase.market.goKeys') }}<ArrowRight :size="15" />
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.market-route-band {
  position: relative;
  overflow: hidden;
  background: var(--page-background);
}

.market-route-backdrop {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  opacity: 0.14;
  pointer-events: none;
}

.market-route-backdrop::after {
  position: absolute;
  inset: 0;
  background: var(--page-background);
  content: '';
  opacity: 0.52;
}

.market-route-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  filter: saturate(0.72) contrast(0.92);
}

.market-route-band::before {
  position: absolute;
  z-index: 1;
  inset: 0;
  background-image:
    linear-gradient(var(--border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
  background-size: 36px 36px;
  content: '';
  opacity: 0.42;
  pointer-events: none;
}

.market-journey {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 3rem 0 0;
  padding: 1.1rem 0;
  border-block: 1px solid var(--border-default);
  list-style: none;
}

.market-route-band > .home-showcase-inner {
  position: relative;
  z-index: 2;
}

html.dark .market-route-backdrop {
  opacity: 0.24;
}

html.dark .market-route-backdrop::after {
  opacity: 0.58;
}

.market-journey li {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  color: var(--text-tertiary);
}

.market-journey li > span {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--border-default);
  border-radius: 50%;
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 0.62rem;
}

.market-journey li > strong {
  overflow: hidden;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-journey li > svg {
  flex: 0 0 auto;
  color: var(--border-default);
}

.market-journey li.is-complete,
.market-journey li.is-active {
  color: var(--text-primary);
}

.market-journey li.is-complete > span {
  border-color: var(--status-success);
  background: var(--status-success-soft);
  color: var(--status-success-text);
}

.market-journey li.is-active > span {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: 0 0 0 5px var(--accent-soft);
}

.market-route-layout {
  position: relative;
  display: grid;
  gap: clamp(2.5rem, 5vw, 5rem);
  margin-top: 3rem;
}

.market-ledger__header,
.route-workbench__header {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--border-default);
}

.market-ledger__header p,
.route-workbench__header p {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--text-primary);
  font-weight: 780;
}

.market-ledger__header span,
.route-workbench__header span {
  display: block;
  max-width: 28rem;
  margin-top: 0.45rem;
  color: var(--text-tertiary);
  font-size: 0.72rem;
  line-height: 1.55;
}

.market-side-switch {
  display: inline-grid;
  grid-template-columns: repeat(2, 1fr);
  min-width: min(100%, 13rem);
  padding: 0.2rem;
  border: 1px solid var(--border-default);
  border-radius: var(--shape-control);
  background: var(--surface-muted);
}

.market-side-switch button {
  min-height: 2.35rem;
  border-radius: calc(var(--shape-control) - 2px);
  padding-inline: 0.75rem;
  color: var(--text-tertiary);
  font-size: 0.72rem;
  font-weight: 730;
}

.market-side-switch button.is-active {
  background: var(--surface-solid);
  color: var(--text-primary);
  box-shadow: var(--card-shadow);
}

.market-listings {
  display: grid;
  gap: 0;
}

.market-listing {
  position: relative;
  padding: 1.45rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.market-listing__topline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.8rem;
  color: var(--text-tertiary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 0.62rem;
}

.market-listing__status {
  margin-left: auto;
  color: var(--status-warning-text);
}

.market-listing__status[data-status='purchased'] {
  color: var(--status-success-text);
}

.market-listing h3 {
  margin: 0.65rem 0 0;
  color: var(--text-primary);
  font-size: 1.05rem;
}

.market-listing > p {
  margin: 0.45rem 0 0;
  color: var(--text-secondary);
  font-size: 0.75rem;
  line-height: 1.55;
}

.market-listing dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 1rem 0 0;
}

.market-listing dl > div {
  min-width: 0;
  border-left: 1px solid var(--border-default);
  padding-left: 0.65rem;
}

.market-listing dt,
.market-listing dd {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-listing dt {
  color: var(--text-tertiary);
  font-size: 0.62rem;
}

.market-listing dd {
  margin-top: 0.3rem;
  color: var(--text-primary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  font-weight: 730;
}

.market-listing__action {
  display: inline-flex;
  min-height: 2.45rem;
  align-items: center;
  gap: 0.45rem;
  margin-top: 1rem;
  border-radius: var(--shape-control);
  background: var(--accent);
  padding: 0.55rem 0.85rem;
  color: var(--accent-contrast);
  font-size: 0.72rem;
  font-weight: 760;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.market-listing__action:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--button-shadow-hover);
}

.market-listing__action.is-complete {
  background: var(--status-success-soft);
  color: var(--status-success-text);
}

.market-listings__empty,
.route-channels__empty {
  padding: 2rem;
  border: 1px dashed var(--border-default);
  color: var(--text-tertiary);
  font-size: 0.75rem;
  text-align: center;
}

.route-balance-toggle {
  display: inline-flex;
  min-height: 2.45rem;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--border-default);
  border-radius: var(--shape-control);
  padding: 0.45rem 0.7rem;
  color: var(--text-tertiary);
  font-size: 0.7rem;
  font-weight: 730;
}

.route-balance-toggle.is-active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}

.route-channels {
  display: grid;
  gap: 0.65rem;
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;
}

.route-channel {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: 0.7rem;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--surface-solid) 92%, transparent);
  padding: 0.85rem;
  transition:
    border-color 180ms ease,
    opacity 180ms ease,
    transform 180ms ease;
}

.route-channel:hover,
.route-channel:focus-within,
.route-channel.is-active {
  border-color: var(--border-default);
}

.route-channel.is-active {
  box-shadow: inset 3px 0 0 var(--accent);
}

.route-channel.is-degraded {
  box-shadow: inset 3px 0 0 var(--status-warning);
}

.route-channel.is-disabled {
  opacity: 0.52;
}

.route-channel:focus-visible,
.market-side-switch button:focus-visible,
.market-listing__action:focus-visible,
.route-balance-toggle:focus-visible,
.route-simulator button:focus-visible,
.route-channel__actions button:focus-visible,
.route-channel__weight input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

.route-channel__grip {
  color: var(--text-tertiary);
  cursor: grab;
}

.route-channel__priority {
  display: grid;
  width: 1.8rem;
  height: 1.8rem;
  place-items: center;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-primary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 0.68rem;
}

.route-channel__copy {
  min-width: 0;
}

.route-channel__copy > div {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
}

.route-channel__copy strong,
.route-channel__copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-channel__copy strong {
  color: var(--text-primary);
  font-size: 0.78rem;
}

.route-channel__copy small {
  margin-top: 0.35rem;
  color: var(--text-tertiary);
  font-size: 0.64rem;
}

.route-health {
  flex: 0 0 auto;
  color: var(--status-success-text);
  font-size: 0.6rem;
}

.route-health[data-health='degraded'] {
  color: var(--status-warning-text);
}

.route-health[data-health='offline'] {
  color: var(--status-danger-text);
}

.route-channel__signals {
  display: flex;
  gap: 0.85rem;
  margin: 0;
}

.route-channel__signals dt {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-tertiary);
  font-size: 0.58rem;
}

.route-channel__signals dd {
  margin: 0.2rem 0 0;
  color: var(--text-primary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 0.68rem;
}

.route-channel__weight {
  grid-column: 3 / -1;
  display: grid;
  grid-template-columns: auto minmax(6rem, 1fr);
  align-items: center;
  gap: 0.7rem;
  color: var(--text-tertiary);
  font-size: 0.6rem;
}

.route-channel__weight input {
  width: 100%;
  accent-color: var(--accent);
}

.route-channel__actions {
  grid-column: 1 / 3;
  grid-row: 2;
  display: flex;
  gap: 0.35rem;
}

.route-channel__actions button {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  place-items: center;
  border: 1px solid var(--border-subtle);
  border-radius: var(--shape-control);
  color: var(--text-tertiary);
}

.route-channel__actions button.is-active {
  background: var(--status-success-soft);
  color: var(--status-success-text);
}

.route-channel__actions button:disabled {
  opacity: 0.3;
}

.route-simulator {
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
  border-block: 1px solid var(--border-default);
  padding-block: 1.25rem;
}

.route-simulator__trace {
  display: flex;
  align-items: center;
}

.route-trace-node {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--border-default);
  border-radius: 50%;
  background: var(--surface-solid);
  color: var(--text-tertiary);
}

.route-simulator__trace i {
  position: relative;
  height: 1px;
  flex: 1;
  overflow: hidden;
  background: var(--border-default);
}

.route-simulator__trace i::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  content: '';
  transform: translateX(-100%);
}

.route-simulator[data-phase='sending']
  .route-simulator__trace
  i:first-of-type::after,
.route-simulator[data-phase='failover'] .route-simulator__trace i::after {
  animation: route-signal 720ms linear infinite;
}

.route-simulator[data-phase='responded'] .route-trace-node {
  border-color: var(--status-success);
  color: var(--status-success-text);
}

.route-simulator__copy {
  min-width: 0;
}

.route-simulator__copy strong,
.route-simulator__copy span {
  display: block;
}

.route-simulator__copy strong {
  color: var(--text-primary);
  font-size: 0.78rem;
}

.route-simulator__copy span {
  margin-top: 0.35rem;
  color: var(--text-tertiary);
  font-size: 0.65rem;
}

.route-simulator button {
  display: inline-flex;
  min-height: 2.55rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: var(--shape-control);
  background: var(--text-primary);
  padding-inline: 0.9rem;
  color: var(--page-background);
  font-size: 0.72rem;
  font-weight: 750;
}

.market-inline-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1.2rem;
  color: var(--accent-text);
  font-size: 0.72rem;
  font-weight: 750;
}

.market-listing-enter-active,
.market-listing-leave-active,
.market-listing-move {
  transition:
    opacity 240ms ease,
    transform 240ms ease;
}

.market-listing-enter-from,
.market-listing-leave-to {
  opacity: 0;
  transform: translateY(0.75rem);
}

@keyframes route-signal {
  to {
    transform: translateX(100%);
  }
}

@media (min-width: 980px) {
  .market-route-layout {
    grid-template-columns: minmax(18rem, 0.78fr) minmax(31rem, 1.22fr);
  }

  .route-workbench {
    border-left: 1px solid var(--border-default);
    padding-left: clamp(2rem, 5vw, 5rem);
  }

  .route-simulator {
    grid-template-columns: minmax(9rem, 0.65fr) minmax(0, 1fr) auto;
    align-items: center;
  }
}

@media (max-width: 720px) {
  .market-journey {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 0;
  }

  .market-journey li:nth-child(2) > svg {
    display: none;
  }

  .route-channel {
    grid-template-columns: auto auto minmax(0, 1fr);
  }

  .route-channel__signals {
    grid-column: 3;
  }

  .route-channel__weight {
    grid-column: 3;
  }

  .route-channel__actions {
    grid-column: 1 / 3;
    grid-row: 3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .route-simulator__trace i::after,
  .market-listing-enter-active,
  .market-listing-leave-active,
  .market-listing-move,
  .market-listing__action,
  .route-channel {
    animation: none;
    transition: none;
  }
}
</style>
