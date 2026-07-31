<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Gauge,
  GripVertical,
  KeyRound,
  Network,
  Play,
  Power,
  Route,
  Shuffle,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import routingDay from '@/assets/home/capabilities/routing-day.webp'
import routingNight from '@/assets/home/capabilities/routing-night.webp'
import { useThemedAsset } from '@/composables/useThemedAsset'
import type {
  HomeRouteChannel,
  HomeRouteMode,
  HomeRouteSimulation,
  HomeTokenRoute,
} from '@/types/homeShowcase'

const props = defineProps<{
  tokens: HomeTokenRoute[]
  activeTokenId: HomeTokenRoute['id']
  activeToken: HomeTokenRoute
  simulation: HomeRouteSimulation
}>()

const emit = defineEmits<{
  'update:active-token': [tokenId: HomeTokenRoute['id']]
  'update:mode': [mode: HomeRouteMode]
  'update:load-balance': [enabled: boolean]
  reorder: [channelId: string, targetIndex: number]
  move: [channelId: string, direction: -1 | 1]
  weight: [channelId: string, value: number]
  toggle: [channelId: string]
  simulate: []
}>()

const { t } = useI18n()
const themedAsset = useThemedAsset(routingDay, routingNight)
const imageFailed = ref(false)
const draggedChannelId = ref<string | null>(null)
const dragTargetIndex = ref<number | null>(null)

const activeChannel = computed(() =>
  props.activeToken.channels.find(
    (channel) => channel.id === props.simulation.activeChannelId
  )
)
const simulationBusy = computed(() =>
  ['sending', 'failed', 'switching'].includes(props.simulation.phase)
)

function channelLabel(channel: HomeRouteChannel) {
  return channel.nameKey ? t(channel.nameKey) : channel.name
}

watch(themedAsset, () => {
  imageFailed.value = false
})

function setWeight(channelId: string, event: Event) {
  emit('weight', channelId, Number((event.target as HTMLInputElement).value))
}

function onDragStart(channelId: string, event: DragEvent) {
  draggedChannelId.value = channelId
  event.dataTransfer?.setData('text/plain', channelId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(index: number, event: DragEvent) {
  const channelId =
    draggedChannelId.value ?? event.dataTransfer?.getData('text/plain')
  if (channelId) emit('reorder', channelId, index)
  draggedChannelId.value = null
  dragTargetIndex.value = null
}

function endDrag() {
  draggedChannelId.value = null
  dragTargetIndex.value = null
}
</script>

<template>
  <section
    class="home-band routing-band"
    aria-labelledby="token-routing-title"
    data-home-token-routing
  >
    <div class="routing-backdrop" :class="{ 'is-fallback': imageFailed }">
      <img
        v-if="!imageFailed"
        :src="themedAsset"
        alt=""
        @error="imageFailed = true"
      />
    </div>

    <div class="routing-inner">
      <div class="routing-copy">
        <p class="routing-kicker">
          <Route :size="17" /> {{ t('showcase.routing.kicker') }}
        </p>
        <h2 id="token-routing-title">{{ t('showcase.routing.title') }}</h2>
        <p>{{ t('showcase.routing.description') }}</p>

        <div
          class="routing-mode"
          role="tablist"
          :aria-label="t('showcase.routing.modeLabel')"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="activeToken.mode === 'manual'"
            :class="{ 'is-active': activeToken.mode === 'manual' }"
            @click="emit('update:mode', 'manual')"
          >
            {{ t('showcase.routing.manual') }}
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeToken.mode === 'auto'"
            :class="{ 'is-active': activeToken.mode === 'auto' }"
            @click="emit('update:mode', 'auto')"
          >
            {{ t('showcase.routing.auto') }}
          </button>
        </div>

        <RouterLink :to="{ name: 'keys' }" class="routing-link">
          {{ t('showcase.routing.createToken') }}
          <ArrowRight :size="17" />
        </RouterLink>
      </div>

      <div class="routing-workbench">
        <div
          class="token-tabs"
          role="tablist"
          :aria-label="t('showcase.routing.tokens')"
        >
          <button
            v-for="token in tokens"
            :key="token.id"
            type="button"
            role="tab"
            :data-token-id="token.id"
            :aria-selected="activeTokenId === token.id"
            :class="{ 'is-active': activeTokenId === token.id }"
            @click="emit('update:active-token', token.id)"
          >
            <KeyRound :size="15" />
            <span>{{ token.name }}</span>
            <small>{{ token.channels.length }}</small>
          </button>
        </div>

        <Transition name="token-workbench" mode="out-in">
          <div :key="activeToken.id" class="token-workbench-panel">
            <header class="token-summary">
              <div>
                <small>{{ t('showcase.routing.activeToken') }}</small>
                <strong>{{ activeToken.maskedKey }}</strong>
              </div>
              <div class="token-summary-meta">
                <span>{{
                  t(`showcase.routing.modes.${activeToken.mode}`)
                }}</span>
                <span>
                  {{
                    t('showcase.routing.channelCount', {
                      count: activeToken.channels.length,
                    })
                  }}
                </span>
              </div>
            </header>

            <div
              class="route-candidates"
              :aria-label="t('showcase.routing.candidates')"
            >
              <span
                v-for="channel in activeToken.channels"
                :key="channel.id"
                :data-source="channel.source"
              >
                {{ t(`showcase.market.source.${channel.source}`) }} ·
                {{ channel.model }}
              </span>
            </div>

            <ol
              class="route-list"
              :aria-label="t('showcase.routing.orderLabel')"
            >
              <li
                v-for="(channel, index) in activeToken.channels"
                :key="channel.id"
                tabindex="0"
                :draggable="activeToken.mode === 'manual'"
                class="route-item"
                :data-channel-id="channel.id"
                :class="{
                  'is-disabled': !channel.enabled,
                  'is-active': simulation.activeChannelId === channel.id,
                  'is-dragging': draggedChannelId === channel.id,
                  'is-drop-target': dragTargetIndex === index,
                }"
                :data-health="channel.health"
                @dragstart="onDragStart(channel.id, $event)"
                @dragover.prevent="dragTargetIndex = index"
                @drop.prevent="onDrop(index, $event)"
                @dragend="endDrag"
                @keydown.up.prevent="emit('move', channel.id, -1)"
                @keydown.down.prevent="emit('move', channel.id, 1)"
              >
                <GripVertical
                  class="route-grip"
                  :size="17"
                  aria-hidden="true"
                />
                <span class="route-priority">{{ index + 1 }}</span>

                <div class="route-copy">
                  <div>
                    <strong>{{ channelLabel(channel) }}</strong>
                    <span class="route-health" :data-health="channel.health">
                      {{ t(`showcase.routing.health.${channel.health}`) }}
                    </span>
                  </div>
                  <small>{{ channel.provider }} · {{ channel.model }}</small>
                </div>

                <dl class="route-signals">
                  <div>
                    <dt><Gauge :size="12" /> ms</dt>
                    <dd>{{ channel.latency }}</dd>
                  </div>
                  <div>
                    <dt><BadgeCheck :size="12" /> QC</dt>
                    <dd>{{ channel.qualityScore }}</dd>
                  </div>
                </dl>

                <label class="route-weight">
                  <span>
                    {{ t('showcase.routing.weight') }}
                    <strong>{{ channel.weight }}%</strong>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    :value="channel.weight"
                    :disabled="!channel.enabled || activeToken.mode === 'auto'"
                    @input="setWeight(channel.id, $event)"
                  />
                </label>

                <div class="route-actions">
                  <button
                    type="button"
                    :disabled="index === 0 || activeToken.mode === 'auto'"
                    :aria-label="
                      t('showcase.routing.moveUp', {
                        channel: channelLabel(channel),
                      })
                    "
                    @click="emit('move', channel.id, -1)"
                  >
                    <ArrowUp :size="15" />
                  </button>
                  <button
                    type="button"
                    :disabled="
                      index === activeToken.channels.length - 1 ||
                      activeToken.mode === 'auto'
                    "
                    :aria-label="
                      t('showcase.routing.moveDown', {
                        channel: channelLabel(channel),
                      })
                    "
                    @click="emit('move', channel.id, 1)"
                  >
                    <ArrowDown :size="15" />
                  </button>
                  <button
                    type="button"
                    class="route-power"
                    :class="{ 'is-on': channel.enabled }"
                    :aria-label="
                      t('showcase.routing.toggle', {
                        channel: channelLabel(channel),
                      })
                    "
                    :aria-pressed="channel.enabled"
                    @click="emit('toggle', channel.id)"
                  >
                    <Power :size="15" />
                  </button>
                </div>
              </li>
            </ol>

            <div class="routing-controls">
              <button
                type="button"
                role="switch"
                class="balance-switch"
                :aria-checked="activeToken.loadBalance"
                @click="emit('update:load-balance', !activeToken.loadBalance)"
              >
                <span><Shuffle :size="16" /></span>
                <strong>{{ t('showcase.routing.loadBalance') }}</strong>
                <i
                  :class="{ 'is-on': activeToken.loadBalance }"
                  aria-hidden="true"
                >
                  <b />
                </i>
              </button>

              <button
                type="button"
                class="simulate-button"
                :disabled="simulationBusy"
                @click="emit('simulate')"
              >
                <Play :size="16" />
                {{ t('showcase.routing.simulate') }}
              </button>
            </div>

            <div
              class="route-simulation"
              :data-phase="simulation.phase"
              data-route-simulation
            >
              <div class="simulation-path" aria-hidden="true">
                <span><KeyRound :size="15" /></span>
                <i />
                <span><Network :size="15" /></span>
                <i />
                <span><Route :size="15" /></span>
              </div>
              <div class="simulation-copy" aria-live="polite">
                <strong>{{
                  t(`showcase.routing.simulation.${simulation.phase}`)
                }}</strong>
                <span v-if="activeChannel">
                  {{ channelLabel(activeChannel) }}
                  <template v-if="simulation.latency !== null">
                    · {{ simulation.latency }}ms
                  </template>
                </span>
                <span v-else>{{ t('showcase.routing.isolationHint') }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.routing-band {
  position: relative;
  min-height: 58rem;
  overflow: hidden;
  background: var(--showcase-capability-background-alt);
}

.routing-backdrop {
  position: absolute;
  inset: 0;
  background: var(--showcase-routing-fallback);
  pointer-events: none;
}

.routing-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  opacity: var(--showcase-routing-image-opacity);
}

.routing-backdrop::after {
  position: absolute;
  inset: 0;
  background: var(--showcase-routing-scrim);
  content: '';
}

.routing-inner {
  position: relative;
  z-index: 1;
  display: grid;
  width: min(100% - 2rem, 92rem);
  grid-template-columns: minmax(18rem, 0.68fr) minmax(35rem, 1.32fr);
  align-items: center;
  gap: clamp(3rem, 7vw, 7rem);
  margin-inline: auto;
  padding-block: clamp(5rem, 9vw, 8.5rem);
}

.routing-copy {
  align-self: start;
  padding-top: clamp(1rem, 5vw, 6rem);
}

.routing-kicker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--accent-text);
  font-family: var(--home-font-stamp);
  font-size: 0.72rem;
}

.routing-copy h2 {
  max-width: 8em;
  margin: 0.85rem 0 0;
  font-family: var(--home-font-display);
  font-size: 4rem;
  font-weight: 400;
  line-height: 1.08;
  letter-spacing: 0;
  font-synthesis: none;
  text-wrap: balance;
}

.routing-copy > p:nth-of-type(2) {
  margin: 1.1rem 0 0;
  color: var(--text-secondary);
  line-height: 1.85;
}

.routing-mode {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: min(100%, 19rem);
  margin-top: 2rem;
  border: 1px solid var(--showcase-rule-strong);
  padding: 0.25rem;
  background: var(--showcase-capability-panel);
}

.routing-mode button {
  min-height: 2.4rem;
  color: var(--text-tertiary);
  font-size: 0.75rem;
  font-weight: 700;
}

.routing-mode button.is-active {
  background: var(--showcase-selected-layer);
  color: var(--text-primary);
  box-shadow: var(--elevation-1);
}

.routing-link {
  display: flex;
  width: fit-content;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1.5rem;
  border-bottom: 1px solid var(--accent);
  color: var(--accent-text);
  font-size: 0.8rem;
  font-weight: 700;
}

.routing-workbench {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--showcase-rule-strong);
  background: var(--showcase-capability-workbench);
  box-shadow: var(--showcase-workbench-shadow);
}

.token-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-bottom: 1px solid var(--showcase-rule-strong);
}

.token-tabs button {
  display: grid;
  min-width: 0;
  min-height: 3.2rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding-inline: 1rem;
  color: var(--text-tertiary);
  text-align: left;
}

.token-tabs button + button {
  border-left: 1px solid var(--showcase-rule);
}

.token-tabs button.is-active {
  background: var(--showcase-selected-layer);
  color: var(--text-primary);
  box-shadow: inset 0 -2px 0 var(--accent);
}

.token-tabs span {
  overflow: hidden;
  font-family: var(--home-font-stamp);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-tabs small {
  display: grid;
  width: 1.45rem;
  height: 1.45rem;
  place-items: center;
  border: 1px solid var(--showcase-rule-strong);
  border-radius: 50%;
  font-family: var(--home-font-stamp);
  font-size: 0.58rem;
}

.token-workbench-panel {
  padding: 1.25rem;
}

.token-summary {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.token-summary small,
.token-summary strong {
  display: block;
}

.token-summary small {
  color: var(--text-tertiary);
  font-size: 0.62rem;
}

.token-summary strong {
  margin-top: 0.4rem;
  font-family: var(--home-font-stamp);
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

.token-summary-meta {
  display: flex;
  gap: 0.45rem;
}

.token-summary-meta span,
.route-candidates span {
  border: 1px solid var(--showcase-rule);
  background: var(--showcase-capability-panel);
  padding: 0.32rem 0.5rem;
  color: var(--text-tertiary);
  font-size: 0.6rem;
}

.route-candidates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 1rem;
}

.route-candidates span[data-source='market'] {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--showcase-rule));
  color: var(--accent-text);
}

.route-list {
  display: grid;
  gap: 0.55rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.route-item {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  border: 1px solid var(--showcase-rule);
  background: var(--showcase-route-row);
  padding: 0.8rem;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    opacity 180ms ease,
    transform 180ms ease;
}

.route-item:hover,
.route-item:focus-visible,
.route-item.is-active {
  border-color: var(--accent);
}

.route-item.is-active {
  box-shadow: inset 3px 0 0 var(--accent);
}

.route-item[data-health='degraded'] {
  box-shadow: inset 3px 0 0 var(--status-warning);
}

.route-item.is-disabled {
  opacity: 0.48;
}

.route-item.is-dragging {
  opacity: 0.35;
}

.route-item.is-drop-target {
  transform: translateY(0.18rem);
  border-top-color: var(--accent);
}

.route-grip {
  color: var(--text-tertiary);
  cursor: grab;
}

.route-priority {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border: 1px solid var(--showcase-rule);
  border-radius: 50%;
  background: var(--showcase-capability-panel);
  font-family: var(--home-font-stamp);
  font-size: 0.66rem;
}

.route-copy {
  min-width: 0;
}

.route-copy > div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.route-copy strong,
.route-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-copy strong {
  font-size: 0.78rem;
}

.route-copy small {
  margin-top: 0.32rem;
  color: var(--text-tertiary);
  font-size: 0.62rem;
}

.route-health {
  flex: 0 0 auto;
  color: var(--status-success-text);
  font-size: 0.58rem;
}

.route-health[data-health='degraded'] {
  color: var(--status-warning-text);
}

.route-health[data-health='offline'] {
  color: var(--status-danger-text);
}

.route-signals {
  display: flex;
  gap: 0.7rem;
  margin: 0;
}

.route-signals dt {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--text-tertiary);
  font-size: 0.56rem;
}

.route-signals dd {
  margin: 0.2rem 0 0;
  font-family: var(--home-font-stamp);
  font-size: 0.66rem;
}

.route-weight {
  grid-column: 3 / -1;
  display: grid;
  grid-template-columns: auto minmax(5rem, 1fr);
  align-items: center;
  gap: 0.8rem;
  color: var(--text-tertiary);
  font-size: 0.6rem;
}

.route-weight span {
  min-width: 6.5rem;
}

.route-weight strong {
  color: var(--text-primary);
  font-family: var(--home-font-stamp);
}

.route-weight input {
  width: 100%;
  height: 1rem;
  appearance: none;
  background: transparent;
}

.route-weight input::-webkit-slider-runnable-track {
  height: 4px;
  border: 1px solid var(--showcase-rule);
  background: var(--showcase-capability-panel);
}

.route-weight input::-webkit-slider-thumb {
  width: 0.9rem;
  height: 0.9rem;
  margin-top: -0.4rem;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: var(--elevation-1);
}

.route-weight input::-moz-range-track {
  height: 4px;
  border: 1px solid var(--showcase-rule);
  background: var(--showcase-capability-panel);
}

.route-weight input::-moz-range-thumb {
  width: 0.9rem;
  height: 0.9rem;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
}

.route-actions {
  grid-column: 1 / 3;
  grid-row: 2;
  display: flex;
  gap: 0.3rem;
}

.route-actions button {
  display: grid;
  width: 1.85rem;
  height: 1.85rem;
  place-items: center;
  border: 1px solid var(--showcase-rule);
  color: var(--text-tertiary);
}

.route-actions button:hover:not(:disabled) {
  background: var(--state-hover-layer);
  color: var(--text-primary);
}

.route-actions button:disabled {
  opacity: 0.28;
}

.route-actions .route-power.is-on {
  background: var(--status-success-soft);
  color: var(--status-success-text);
}

.routing-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  border-top: 1px solid var(--showcase-rule);
  padding-top: 1rem;
}

.balance-switch {
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: center;
  gap: 0.55rem;
  color: var(--text-secondary);
  font-size: 0.7rem;
}

.balance-switch > span {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  place-items: center;
  background: var(--showcase-capability-panel);
}

.balance-switch > i {
  position: relative;
  display: block;
  width: 2.5rem;
  height: 1.35rem;
  border: 1px solid var(--showcase-rule-strong);
  border-radius: 999px;
  background: var(--showcase-capability-panel);
}

.balance-switch > i > b {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: transform 180ms ease;
}

.balance-switch > i.is-on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.balance-switch > i.is-on > b {
  background: var(--accent);
  transform: translateX(1.12rem);
}

.simulate-button {
  display: inline-flex;
  min-height: 2.45rem;
  align-items: center;
  gap: 0.45rem;
  background: var(--accent);
  padding-inline: 0.9rem;
  color: var(--accent-contrast);
  font-size: 0.72rem;
  font-weight: 750;
}

.simulate-button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.route-simulation {
  display: grid;
  grid-template-columns: minmax(10rem, 0.8fr) minmax(0, 1fr);
  align-items: center;
  gap: 1.25rem;
  margin-top: 1rem;
  border-top: 1px solid var(--showcase-rule);
  padding-top: 1rem;
}

.simulation-path {
  display: flex;
  align-items: center;
}

.simulation-path span {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--showcase-rule-strong);
  border-radius: 50%;
  background: var(--showcase-capability-panel);
  color: var(--text-tertiary);
}

.simulation-path i {
  position: relative;
  height: 1px;
  flex: 1;
  overflow: hidden;
  background: var(--showcase-rule-strong);
}

.simulation-path i::after {
  position: absolute;
  inset: 0;
  background: var(--showcase-flow-line);
  content: '';
  transform: translateX(-100%);
}

.route-simulation[data-phase='sending'] .simulation-path i:first-of-type::after,
.route-simulation[data-phase='failed'] .simulation-path i:first-of-type::after,
.route-simulation[data-phase='switching'] .simulation-path i::after {
  animation: route-signal 720ms linear infinite;
}

.route-simulation[data-phase='failed'] .simulation-path span:nth-of-type(2) {
  border-color: var(--status-danger);
  color: var(--status-danger-text);
}

.route-simulation[data-phase='responded'] .simulation-path span {
  border-color: var(--status-success);
  color: var(--status-success-text);
}

.simulation-copy strong,
.simulation-copy span {
  display: block;
}

.simulation-copy strong {
  font-size: 0.75rem;
}

.simulation-copy span {
  margin-top: 0.3rem;
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 0.62rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.routing-mode button:focus-visible,
.routing-link:focus-visible,
.token-tabs button:focus-visible,
.route-actions button:focus-visible,
.route-weight input:focus-visible,
.balance-switch:focus-visible,
.simulate-button:focus-visible,
.route-item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

.token-workbench-enter-active,
.token-workbench-leave-active {
  transition:
    opacity 240ms ease,
    transform 240ms ease;
}

.token-workbench-enter-from {
  opacity: 0;
  transform: translateX(1rem);
}

.token-workbench-leave-to {
  opacity: 0;
  transform: translateX(-1rem);
}

@keyframes route-signal {
  to {
    transform: translateX(100%);
  }
}

@media (max-width: 1080px) {
  .routing-inner {
    grid-template-columns: 1fr;
  }

  .routing-copy {
    max-width: 48rem;
    padding-top: 0;
  }
}

@media (max-width: 680px) {
  .routing-band {
    min-height: auto;
  }

  .routing-inner {
    width: min(100% - 1rem, 92rem);
    gap: 2.5rem;
    padding-block: 4rem;
  }

  .routing-copy h2 {
    font-size: 2.5rem;
  }

  .token-tabs button {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .token-tabs small {
    display: none;
  }

  .token-summary,
  .routing-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .token-summary-meta {
    flex-wrap: wrap;
  }

  .route-item {
    grid-template-columns: auto auto minmax(0, 1fr);
  }

  .route-signals {
    grid-column: 3;
  }

  .route-weight {
    grid-column: 3;
  }

  .route-actions {
    grid-row: 3;
  }

  .route-simulation {
    grid-template-columns: 1fr;
  }

  .simulate-button {
    justify-content: center;
  }
}

@media (max-width: 380px) {
  .token-workbench-panel {
    padding: 0.8rem;
  }

  .route-item {
    gap: 0.45rem;
    padding: 0.7rem 0.55rem;
  }

  .route-weight {
    grid-column: 1 / -1;
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .route-simulation .simulation-path i::after,
  .route-item,
  .balance-switch > i > b,
  .token-workbench-enter-active,
  .token-workbench-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
