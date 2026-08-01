<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  ChevronDown,
  Gauge,
  GripVertical,
  KeyRound,
  Layers3,
  Network,
  Play,
  Power,
  Route,
  Shuffle,
  Sparkles,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import routingDay from '@/assets/home/capabilities/routing-day.webp'
import routingNight from '@/assets/home/capabilities/routing-night.webp'
import { rankRouteChannels } from '@/composables/useHomeShowcase'
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
const expandedChannelId = ref<string | null>(null)
const draggedChannelId = ref<string | null>(null)
const dragTargetId = ref<string | null>(null)

const orderedChannels = computed(() =>
  props.activeToken.mode === 'auto'
    ? rankRouteChannels(props.activeToken.channels)
    : props.activeToken.channels
)
const enabledChannels = computed(() =>
  orderedChannels.value.filter((channel) => channel.enabled)
)
const activeChannel = computed(() =>
  props.activeToken.channels.find(
    (channel) => channel.id === props.simulation.activeChannelId
  )
)
const simulationBusy = computed(() =>
  ['sending', 'failed', 'switching'].includes(props.simulation.phase)
)
const signalChannel = computed(() =>
  activeChannel.value
    ? channelLabel(activeChannel.value)
    : enabledChannels.value[0]
      ? channelLabel(enabledChannels.value[0])
      : '---'
)

function channelLabel(channel: HomeRouteChannel) {
  return channel.nameKey ? t(channel.nameKey) : channel.name
}

watch(themedAsset, () => {
  imageFailed.value = false
})

watch(
  () => props.activeTokenId,
  () => {
    expandedChannelId.value = null
    draggedChannelId.value = null
    dragTargetId.value = null
  }
)

watch(
  () => props.activeToken.mode,
  () => {
    expandedChannelId.value = null
  }
)

function setWeight(channelId: string, event: Event) {
  emit('weight', channelId, Number((event.target as HTMLInputElement).value))
}

function toggleCandidate(channel: HomeRouteChannel) {
  if (channel.enabled && expandedChannelId.value === channel.id) {
    expandedChannelId.value = null
  }
  emit('toggle', channel.id)
}

function toggleDetails(channelId: string) {
  expandedChannelId.value =
    expandedChannelId.value === channelId ? null : channelId
}

function moveVisibleChannel(channelId: string, direction: -1 | 1) {
  if (props.activeToken.mode === 'auto') return
  const currentIndex = enabledChannels.value.findIndex(
    (channel) => channel.id === channelId
  )
  const target = enabledChannels.value[currentIndex + direction]
  if (!target) return
  const targetIndex = props.activeToken.channels.findIndex(
    (channel) => channel.id === target.id
  )
  emit('reorder', channelId, targetIndex)
}

function onDragStart(channelId: string, event: DragEvent) {
  if (props.activeToken.mode === 'auto') return
  draggedChannelId.value = channelId
  event.dataTransfer?.setData('text/plain', channelId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(targetChannelId: string, event: DragEvent) {
  const channelId =
    draggedChannelId.value ?? event.dataTransfer?.getData('text/plain')
  const targetIndex = props.activeToken.channels.findIndex(
    (channel) => channel.id === targetChannelId
  )
  if (channelId && targetIndex >= 0) emit('reorder', channelId, targetIndex)
  endDrag()
}

function endDrag() {
  draggedChannelId.value = null
  dragTargetId.value = null
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
            data-route-mode="manual"
            :aria-selected="activeToken.mode === 'manual'"
            :class="{ 'is-active': activeToken.mode === 'manual' }"
            @click="emit('update:mode', 'manual')"
          >
            <Layers3 :size="15" />
            {{ t('showcase.routing.manual') }}
          </button>
          <button
            type="button"
            role="tab"
            data-route-mode="auto"
            :aria-selected="activeToken.mode === 'auto'"
            :class="{ 'is-active': activeToken.mode === 'auto' }"
            @click="emit('update:mode', 'auto')"
          >
            <Sparkles :size="15" />
            {{ t('showcase.routing.auto') }}
          </button>
        </div>

        <ul class="routing-features">
          <li>
            <KeyRound :size="16" />
            {{ t('showcase.routing.features.isolation') }}
          </li>
          <li>
            <Shuffle :size="16" /> {{ t('showcase.routing.features.priority') }}
          </li>
          <li>
            <BadgeCheck :size="16" />
            {{ t('showcase.routing.features.boundary') }}
          </li>
        </ul>

        <RouterLink :to="{ name: 'keys' }" class="routing-link">
          {{ t('showcase.routing.createToken') }}
          <ArrowRight :size="17" />
        </RouterLink>
      </div>

      <div class="routing-workbench">
        <header class="token-commandbar">
          <div
            class="token-switcher"
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
              <span>
                <strong>{{ token.name }}</strong>
                <small>{{
                  activeTokenId === token.id
                    ? token.maskedKey
                    : t('showcase.routing.channelCount', {
                        count: token.channels.filter(
                          (channel) => channel.enabled
                        ).length,
                      })
                }}</small>
              </span>
            </button>
          </div>
          <div class="token-mode-badge" :data-mode="activeToken.mode">
            <Sparkles v-if="activeToken.mode === 'auto'" :size="13" />
            <Layers3 v-else :size="13" />
            {{ t(`showcase.routing.modes.${activeToken.mode}`) }}
          </div>
        </header>

        <Transition name="token-workbench" mode="out-in">
          <div :key="activeToken.id" class="token-workbench-panel">
            <section
              class="candidate-bay"
              :aria-labelledby="`candidate-title-${activeToken.id}`"
            >
              <div class="workbench-section-heading">
                <div>
                  <small>{{ t('showcase.routing.candidates') }}</small>
                  <strong :id="`candidate-title-${activeToken.id}`">{{
                    t('showcase.routing.candidateHint')
                  }}</strong>
                </div>
                <span
                  >{{ enabledChannels.length }} /
                  {{ activeToken.channels.length }}</span
                >
              </div>

              <div class="route-candidates">
                <button
                  v-for="channel in activeToken.channels"
                  :key="channel.id"
                  type="button"
                  :data-source="channel.source"
                  :data-channel-id="channel.id"
                  :class="{ 'is-selected': channel.enabled }"
                  :aria-pressed="channel.enabled"
                  :aria-label="
                    t(
                      channel.enabled
                        ? 'showcase.routing.removeChannel'
                        : 'showcase.routing.addChannel',
                      { channel: channelLabel(channel) }
                    )
                  "
                  @click="toggleCandidate(channel)"
                >
                  <span aria-hidden="true">{{
                    channel.enabled ? '✓' : '+'
                  }}</span>
                  <strong>{{ channelLabel(channel) }}</strong>
                  <small>{{ channel.model }}</small>
                </button>
              </div>
            </section>

            <section
              class="route-priority-panel"
              :aria-labelledby="`priority-title-${activeToken.id}`"
            >
              <div class="workbench-section-heading route-priority-heading">
                <div>
                  <small>{{ t('showcase.routing.orderLabel') }}</small>
                  <strong :id="`priority-title-${activeToken.id}`">
                    {{
                      activeToken.mode === 'auto'
                        ? t('showcase.routing.autoRanking')
                        : t('showcase.routing.manualRanking')
                    }}
                  </strong>
                </div>

                <button
                  type="button"
                  role="switch"
                  class="balance-switch"
                  :aria-checked="activeToken.loadBalance"
                  @click="emit('update:load-balance', !activeToken.loadBalance)"
                >
                  <span aria-hidden="true"
                    ><b :class="{ 'is-on': activeToken.loadBalance }"
                  /></span>
                  {{ t('showcase.routing.loadBalance') }}
                </button>
              </div>

              <TransitionGroup
                v-if="enabledChannels.length"
                tag="ol"
                name="route-stack"
                class="route-list"
                :aria-label="t('showcase.routing.orderLabel')"
              >
                <li
                  v-for="(channel, index) in enabledChannels"
                  :key="channel.id"
                  class="route-item"
                  :data-channel-id="channel.id"
                  :data-health="channel.health"
                  :class="{
                    'is-active': simulation.activeChannelId === channel.id,
                    'is-expanded': expandedChannelId === channel.id,
                    'is-dragging': draggedChannelId === channel.id,
                    'is-drop-target': dragTargetId === channel.id,
                  }"
                  :draggable="activeToken.mode === 'manual'"
                  @dragstart="onDragStart(channel.id, $event)"
                  @dragover.prevent="dragTargetId = channel.id"
                  @drop.prevent="onDrop(channel.id, $event)"
                  @dragend="endDrag"
                >
                  <div
                    class="route-item-main"
                    tabindex="0"
                    @keydown.up.prevent="moveVisibleChannel(channel.id, -1)"
                    @keydown.down.prevent="moveVisibleChannel(channel.id, 1)"
                  >
                    <GripVertical
                      class="route-grip"
                      :size="16"
                      aria-hidden="true"
                    />
                    <span class="route-priority">{{ index + 1 }}</span>
                    <div class="route-copy">
                      <strong>{{ channelLabel(channel) }}</strong>
                      <small
                        >{{ channel.provider }} · {{ channel.model }}</small
                      >
                    </div>
                    <span class="route-health" :data-health="channel.health">
                      <i aria-hidden="true" />
                      {{ t(`showcase.routing.health.${channel.health}`) }}
                    </span>
                    <div class="route-order-actions">
                      <button
                        type="button"
                        :disabled="index === 0 || activeToken.mode === 'auto'"
                        :aria-label="
                          t('showcase.routing.moveUp', {
                            channel: channelLabel(channel),
                          })
                        "
                        @click="moveVisibleChannel(channel.id, -1)"
                      >
                        <ArrowUp :size="14" />
                      </button>
                      <button
                        type="button"
                        :disabled="
                          index === enabledChannels.length - 1 ||
                          activeToken.mode === 'auto'
                        "
                        :aria-label="
                          t('showcase.routing.moveDown', {
                            channel: channelLabel(channel),
                          })
                        "
                        @click="moveVisibleChannel(channel.id, 1)"
                      >
                        <ArrowDown :size="14" />
                      </button>
                      <button
                        type="button"
                        class="route-detail-toggle"
                        :aria-expanded="expandedChannelId === channel.id"
                        :aria-label="
                          t('showcase.routing.details', {
                            channel: channelLabel(channel),
                          })
                        "
                        @click="toggleDetails(channel.id)"
                      >
                        <ChevronDown :size="15" />
                      </button>
                    </div>
                  </div>

                  <Transition name="route-details">
                    <div
                      v-if="expandedChannelId === channel.id"
                      class="route-details"
                    >
                      <dl class="route-metrics">
                        <div>
                          <dt>
                            <Gauge :size="13" />
                            {{ t('showcase.routing.latency') }}
                          </dt>
                          <dd>{{ channel.latency }}ms</dd>
                        </div>
                        <div>
                          <dt>
                            <BadgeCheck :size="13" />
                            {{ t('showcase.routing.quality') }}
                          </dt>
                          <dd>{{ channel.qualityScore }}</dd>
                        </div>
                        <div>
                          <dt>
                            <Network :size="13" />
                            {{ t('showcase.routing.source') }}
                          </dt>
                          <dd>
                            {{ t(`showcase.market.source.${channel.source}`) }}
                          </dd>
                        </div>
                      </dl>

                      <label class="route-weight">
                        <span
                          >{{ t('showcase.routing.weight') }}
                          <strong>{{ channel.weight }}%</strong></span
                        >
                        <input
                          type="range"
                          min="1"
                          max="100"
                          step="1"
                          :value="channel.weight"
                          :disabled="activeToken.mode === 'auto'"
                          @input="setWeight(channel.id, $event)"
                        />
                      </label>

                      <button
                        type="button"
                        class="route-remove"
                        @click="toggleCandidate(channel)"
                      >
                        <Power :size="14" />
                        {{ t('showcase.routing.removeFromRoute') }}
                      </button>
                    </div>
                  </Transition>
                </li>
              </TransitionGroup>

              <div v-else class="route-empty" data-route-empty>
                <Network :size="22" />
                <strong>{{ t('showcase.routing.noActiveRoutes') }}</strong>
                <span>{{ t('showcase.routing.noActiveHint') }}</span>
              </div>
            </section>

            <section
              class="route-theater"
              :data-phase="simulation.phase"
              :data-event-id="simulation.eventId"
              data-route-simulation
              aria-labelledby="route-theater-title"
            >
              <div class="route-theater-heading">
                <div>
                  <small>LIVE ROUTE</small>
                  <strong id="route-theater-title">{{
                    t('showcase.routing.signalTheater')
                  }}</strong>
                </div>
                <button
                  type="button"
                  class="simulate-button"
                  :disabled="simulationBusy"
                  @click="emit('simulate')"
                >
                  <Play :size="15" />
                  {{ t('showcase.routing.simulate') }}
                </button>
              </div>

              <div class="signal-stage" aria-hidden="true">
                <div class="signal-node signal-node--key">
                  <strong>KEY</strong>
                </div>
                <div class="signal-rail signal-rail--request"><i /></div>
                <div class="signal-node signal-node--gateway">
                  <strong>GW</strong>
                </div>
                <div class="signal-rail signal-rail--dispatch"><i /></div>
                <div class="signal-node signal-node--channel">
                  <strong>CHANNEL</strong>
                  <small>{{ signalChannel }}</small>
                </div>
                <div class="signal-rail signal-rail--response"><i /></div>
                <div class="signal-node signal-node--model">
                  <strong>MODELS</strong>
                </div>
              </div>

              <div class="simulation-copy" aria-live="polite">
                <strong>{{
                  t(`showcase.routing.simulation.${simulation.phase}`)
                }}</strong>
                <span v-if="activeChannel">
                  {{ channelLabel(activeChannel) }}
                  <template v-if="simulation.latency !== null">
                    · {{ simulation.latency }}ms</template
                  >
                </span>
                <span v-else>{{ t('showcase.routing.isolationHint') }}</span>
              </div>
            </section>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.routing-band {
  position: relative;
  min-height: 52rem;
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
  grid-template-columns: minmax(18rem, 0.72fr) minmax(36rem, 1.28fr);
  align-items: center;
  gap: clamp(3rem, 6vw, 6rem);
  margin-inline: auto;
  padding-block: clamp(4.5rem, 7vw, 7rem);
}

.routing-copy {
  align-self: center;
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
  font-size: clamp(3.3rem, 5vw, 4.4rem);
  font-weight: 400;
  line-height: 1.08;
  letter-spacing: 0;
  font-synthesis: none;
  text-wrap: balance;
}

.routing-copy > p:nth-of-type(2) {
  max-width: 34rem;
  margin: 1.1rem 0 0;
  color: var(--text-secondary);
  line-height: 1.85;
}

.routing-mode {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: min(100%, 19rem);
  margin-top: 1.8rem;
  border: 1px solid var(--showcase-rule-strong);
  padding: 0.25rem;
  background: var(--showcase-capability-panel);
}

.routing-mode button {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  color: var(--text-tertiary);
  font-size: 0.75rem;
  font-weight: 700;
}

.routing-mode button.is-active {
  background: var(--showcase-selected-layer);
  color: var(--text-primary);
  box-shadow: var(--elevation-1);
}

.routing-features {
  display: grid;
  gap: 0.75rem;
  margin: 1.8rem 0 0;
  padding: 0;
  color: var(--text-secondary);
  list-style: none;
}

.routing-features li {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.78rem;
}

.routing-features svg {
  color: var(--accent-text);
}

.routing-link {
  display: flex;
  width: fit-content;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1.35rem;
  border-bottom: 1px solid var(--accent);
  color: var(--accent-text);
  font-size: 0.8rem;
  font-weight: 700;
}

.routing-workbench {
  --routing-ui-font:
    'Ren2Inter', 'Ren2NotoSansSC', 'Noto Sans SC', system-ui, sans-serif;
  --routing-code-font:
    'Ren2JetBrainsMono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
  --home-font-stamp: var(--routing-code-font);
  position: relative;
  isolation: isolate;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--showcase-rule-strong);
  border-radius: var(--sketch-border-radius-lg);
  background: var(--showcase-capability-workbench);
  box-shadow: var(--showcase-workbench-shadow);
  font-family: var(--routing-ui-font);
  font-synthesis: none;
}

.token-commandbar {
  display: flex;
  min-height: 4.4rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--showcase-rule-strong);
  padding: 0.65rem 0.8rem;
  background: color-mix(
    in srgb,
    var(--showcase-capability-panel) 88%,
    transparent
  );
}

.token-switcher {
  display: flex;
  min-width: 0;
  gap: 0.35rem;
}

.token-switcher button {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.65rem;
  color: var(--text-tertiary);
  text-align: left;
}

.token-switcher button.is-active {
  background: var(--showcase-selected-layer);
  color: var(--text-primary);
  box-shadow: inset 0 -2px 0 var(--accent);
}

.token-switcher button > span,
.token-switcher strong,
.token-switcher small {
  display: block;
  min-width: 0;
}

.token-switcher strong {
  overflow: hidden;
  font-family: var(--home-font-stamp);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-switcher small {
  margin-top: 0.2rem;
  overflow: hidden;
  color: var(--text-tertiary);
  font-family: var(--home-font-stamp);
  font-size: 0.52rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-mode-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--showcase-rule-strong);
  padding: 0.38rem 0.55rem;
  color: var(--accent-text);
  font-family: var(--home-font-stamp);
  font-size: 0.56rem;
}

.token-workbench-panel {
  padding: 0 1.1rem 1.1rem;
}

.candidate-bay,
.route-priority-panel,
.route-theater {
  padding-block: 1rem;
}

.candidate-bay,
.route-priority-panel {
  border-bottom: 1px solid var(--showcase-rule);
}

.workbench-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.workbench-section-heading small,
.workbench-section-heading strong {
  display: block;
}

.workbench-section-heading small {
  color: var(--accent-text);
  font-family: var(--home-font-stamp);
  font-size: 0.52rem;
  text-transform: uppercase;
}

.workbench-section-heading strong {
  margin-top: 0.2rem;
  font-size: 0.7rem;
}

.workbench-section-heading > span {
  color: var(--text-tertiary);
  font-family: var(--home-font-stamp);
  font-size: 0.58rem;
}

.route-candidates {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.route-candidates button {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 3.3rem;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: center;
  gap: 0.12rem 0.45rem;
  overflow: hidden;
  border: 1px solid var(--showcase-rule);
  padding: 0.55rem 0.65rem;
  color: var(--text-tertiary);
  text-align: left;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
}

.route-candidates button > span {
  grid-row: 1 / 3;
  align-self: center;
  font-family: var(--home-font-stamp);
  font-size: 0.7rem;
}

.route-candidates button strong,
.route-candidates button small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-candidates button strong {
  font-size: 0.65rem;
}

.route-candidates button small {
  font-family: var(--home-font-stamp);
  font-size: 0.52rem;
}

.route-candidates button:hover,
.route-candidates button:focus-visible {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.route-candidates button.is-selected {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--showcase-rule));
  background: var(--showcase-selected-layer);
  color: var(--text-primary);
  box-shadow: inset 2px 0 0 var(--accent);
}

.route-candidates button[data-source='market'].is-selected {
  box-shadow: inset 2px 0 0 var(--status-success);
}

.route-priority-heading {
  align-items: end;
}

.balance-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-secondary);
  font-size: 0.62rem;
}

.balance-switch > span {
  position: relative;
  width: 2.15rem;
  height: 1.12rem;
  border: 1px solid var(--showcase-rule-strong);
  border-radius: 999px;
  background: var(--showcase-capability-panel);
}

.balance-switch b {
  position: absolute;
  top: 0.13rem;
  left: 0.15rem;
  width: 0.72rem;
  height: 0.72rem;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: transform 180ms ease;
}

.balance-switch b.is-on {
  background: var(--accent);
  transform: translateX(1rem);
}

.route-list {
  position: relative;
  display: grid;
  gap: 0.5rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.route-item {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--showcase-rule);
  background: var(--showcase-route-row);
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    opacity 180ms ease,
    transform 220ms ease;
}

.route-item::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: var(--accent);
  content: '';
  opacity: 0;
  transform: scaleY(0.35);
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.route-item:hover,
.route-item:focus-within,
.route-item.is-expanded,
.route-item.is-active {
  border-color: color-mix(in srgb, var(--accent) 64%, var(--showcase-rule));
}

.route-item.is-expanded::before,
.route-item.is-active::before {
  opacity: 1;
  transform: scaleY(1);
}

.route-item.is-active {
  background: var(--showcase-selected-layer);
  box-shadow: var(--showcase-active-halo);
}

.route-item[data-health='degraded']::before {
  background: var(--status-warning);
}

.route-item.is-dragging {
  opacity: 0.35;
}

.route-item.is-drop-target {
  transform: translateY(0.18rem);
}

.route-item-main {
  display: grid;
  min-width: 0;
  min-height: 3.35rem;
  grid-template-columns: auto auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.65rem;
}

.route-grip {
  color: var(--text-tertiary);
  cursor: grab;
}

.route-priority {
  display: grid;
  width: 1.55rem;
  height: 1.55rem;
  place-items: center;
  border: 1px solid var(--showcase-rule);
  border-radius: 50%;
  background: var(--showcase-capability-panel);
  font-family: var(--home-font-stamp);
  font-size: 0.6rem;
}

.route-copy {
  min-width: 0;
}

.route-copy strong,
.route-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-copy strong {
  font-size: 0.72rem;
}

.route-copy small {
  margin-top: 0.2rem;
  color: var(--text-tertiary);
  font-size: 0.55rem;
}

.route-health {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--status-success-text);
  font-family: var(--home-font-stamp);
  font-size: 0.54rem;
  white-space: nowrap;
}

.route-health i {
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 7px currentColor;
}

.route-health[data-health='degraded'] {
  color: var(--status-warning-text);
}

.route-health[data-health='offline'] {
  color: var(--status-danger-text);
}

.route-order-actions {
  display: flex;
  gap: 0.22rem;
}

.route-order-actions button {
  display: grid;
  width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  border: 1px solid transparent;
  color: var(--text-tertiary);
}

.route-order-actions button:hover:not(:disabled) {
  border-color: var(--showcase-rule);
  background: var(--state-hover-layer);
  color: var(--text-primary);
}

.route-order-actions button:disabled {
  opacity: 0.22;
}

.route-detail-toggle svg {
  transition: transform 180ms ease;
}

.route-item.is-expanded .route-detail-toggle svg {
  transform: rotate(180deg);
}

.route-details {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(10rem, 1fr) auto;
  align-items: center;
  gap: 1rem;
  border-top: 1px solid var(--showcase-rule);
  padding: 0.75rem 0.8rem 0.8rem 3.5rem;
  background: color-mix(
    in srgb,
    var(--showcase-capability-panel) 70%,
    transparent
  );
}

.route-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
  margin: 0;
}

.route-metrics dt {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-tertiary);
  font-size: 0.52rem;
}

.route-metrics dd {
  margin: 0.22rem 0 0;
  font-family: var(--home-font-stamp);
  font-size: 0.6rem;
}

.route-weight {
  display: grid;
  gap: 0.3rem;
  color: var(--text-tertiary);
  font-size: 0.55rem;
}

.route-weight span {
  display: flex;
  justify-content: space-between;
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
  height: 3px;
  border: 1px solid var(--showcase-rule);
  background: var(--showcase-capability-panel);
}

.route-weight input::-webkit-slider-thumb {
  width: 0.8rem;
  height: 0.8rem;
  margin-top: -0.35rem;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: var(--elevation-1);
}

.route-weight input::-moz-range-track {
  height: 3px;
  border: 1px solid var(--showcase-rule);
  background: var(--showcase-capability-panel);
}

.route-weight input::-moz-range-thumb {
  width: 0.8rem;
  height: 0.8rem;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
}

.route-remove {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--showcase-rule);
  padding-inline: 0.55rem;
  color: var(--text-tertiary);
  font-size: 0.55rem;
}

.route-remove:hover {
  border-color: var(--status-danger);
  color: var(--status-danger-text);
}

.route-empty {
  display: grid;
  min-height: 9.2rem;
  place-items: center;
  align-content: center;
  gap: 0.4rem;
  margin-top: 0.75rem;
  border: 1px dashed var(--showcase-rule-strong);
  color: var(--text-tertiary);
  text-align: center;
}

.route-empty strong {
  color: var(--text-secondary);
  font-size: 0.72rem;
}

.route-empty span {
  font-size: 0.58rem;
}

.route-theater {
  padding-bottom: 0;
}

.route-theater-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.route-theater-heading small,
.route-theater-heading strong {
  display: block;
}

.route-theater-heading small {
  color: var(--accent-text);
  font-family: var(--home-font-stamp);
  font-size: 0.5rem;
}

.route-theater-heading strong {
  margin-top: 0.15rem;
  font-size: 0.68rem;
}

.simulate-button {
  display: inline-flex;
  min-height: 2.3rem;
  align-items: center;
  gap: 0.4rem;
  background: var(--accent);
  padding-inline: 0.8rem;
  color: var(--accent-contrast);
  font-size: 0.65rem;
  font-weight: 750;
}

.simulate-button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.signal-stage {
  display: grid;
  grid-template-columns:
    minmax(4rem, auto) minmax(2rem, 1fr) minmax(4rem, auto)
    minmax(2rem, 1fr) minmax(6.25rem, auto) minmax(2rem, 1fr)
    minmax(4.5rem, auto);
  align-items: center;
  margin-top: 0.75rem;
}

.signal-node {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 0;
  min-height: 2.55rem;
  place-items: center;
  align-content: center;
  gap: 0.1rem;
  border: 1px solid var(--showcase-rule-strong);
  background: var(--showcase-capability-panel);
  color: var(--text-tertiary);
  transition:
    border-color 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.signal-node strong {
  font-family: var(--home-font-stamp);
  font-size: 0.56rem;
}

.signal-node small {
  max-width: 6rem;
  overflow: hidden;
  font-family: var(--home-font-stamp);
  font-size: 0.43rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.signal-node--gateway::after {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--status-success);
  box-shadow: 0 0 8px var(--status-success);
  content: '';
  animation: gateway-beacon 2.4s ease-in-out infinite;
}

.signal-rail {
  position: relative;
  height: 1px;
  overflow: visible;
  background: var(--showcase-rule-strong);
}

.signal-rail::before,
.signal-rail::after {
  position: absolute;
  top: 50%;
  border-radius: 50%;
  content: '';
  transform: translate(-50%, -50%);
}

.signal-rail::before {
  left: 50%;
  width: 0.38rem;
  height: 0.38rem;
  background: currentColor;
  color: var(--text-tertiary);
  box-shadow: 0 0 0 0 transparent;
  animation: signal-idle 2.8s ease-in-out infinite;
}

.signal-rail--request::before {
  color: var(--accent);
}

.signal-rail--dispatch::before {
  color: var(--status-warning);
  animation-delay: 420ms;
}

.signal-rail--response::before {
  color: var(--status-success);
  animation-delay: 840ms;
}

.signal-rail::after {
  left: 0;
  width: 0.5rem;
  height: 0.5rem;
  background: var(--accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 72%, transparent);
  opacity: 0;
}

.route-theater[data-phase='sending'] .signal-rail::after {
  opacity: 1;
  animation: signal-forward 760ms ease-in-out infinite;
}

.route-theater[data-phase='sending'] .signal-rail--dispatch::after {
  animation-delay: 140ms;
}

.route-theater[data-phase='sending'] .signal-rail--response::after {
  animation-delay: 280ms;
}

.route-theater[data-phase='sending'] .signal-node--key,
.route-theater[data-phase='sending'] .signal-node--gateway,
.route-theater[data-phase='sending'] .signal-node--channel {
  border-color: var(--accent);
  color: var(--accent-text);
}

.route-theater[data-phase='failed'] .signal-node--channel {
  border-color: var(--status-danger);
  color: var(--status-danger-text);
  animation: channel-fault 260ms ease-in-out 2;
}

.route-theater[data-phase='failed'] .signal-rail--dispatch {
  background: repeating-linear-gradient(
    90deg,
    var(--status-danger) 0 5px,
    transparent 5px 10px
  );
}

.route-theater[data-phase='switching'] .signal-rail--dispatch::after,
.route-theater[data-phase='switching'] .signal-rail--response::after {
  opacity: 1;
  animation: signal-switch 480ms cubic-bezier(0.22, 1, 0.36, 1) infinite;
}

.route-theater[data-phase='switching'] .signal-node--gateway,
.route-theater[data-phase='switching'] .signal-node--channel,
.route-theater[data-phase='switching'] .signal-node--model {
  border-color: var(--status-warning);
  color: var(--status-warning-text);
}

.route-theater[data-phase='responded'] .signal-node {
  border-color: var(--status-success);
  color: var(--status-success-text);
  box-shadow: 0 0 14px
    color-mix(in srgb, var(--status-success) 18%, transparent);
}

.route-theater[data-phase='responded'] .signal-node--model {
  animation: response-arrival 520ms ease-out;
}

.route-theater[data-phase='responded'] .signal-rail::before {
  color: var(--status-success);
  box-shadow: 0 0 8px var(--status-success);
}

.route-theater[data-phase='unavailable'] .signal-stage {
  opacity: 0.38;
}

.route-theater[data-phase='unavailable'] .signal-node--gateway::after {
  background: var(--status-danger);
  box-shadow: 0 0 8px var(--status-danger);
}

.simulation-copy {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.65rem;
  color: var(--text-tertiary);
  font-size: 0.56rem;
}

.simulation-copy strong {
  color: var(--text-secondary);
}

.simulation-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.routing-mode button:focus-visible,
.routing-link:focus-visible,
.token-switcher button:focus-visible,
.route-candidates button:focus-visible,
.balance-switch:focus-visible,
.route-item-main:focus-visible,
.route-order-actions button:focus-visible,
.route-weight input:focus-visible,
.route-remove:focus-visible,
.simulate-button:focus-visible {
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

.route-stack-move,
.route-stack-enter-active,
.route-stack-leave-active {
  transition:
    opacity 240ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.route-stack-enter-from,
.route-stack-leave-to {
  opacity: 0;
  transform: translateY(-0.75rem) scale(0.985);
}

.route-stack-leave-active {
  position: absolute;
  right: 0;
  left: 0;
}

.route-details-enter-active,
.route-details-leave-active {
  overflow: hidden;
  transition:
    max-height 220ms ease,
    opacity 180ms ease;
}

.route-details-enter-from,
.route-details-leave-to {
  max-height: 0;
  opacity: 0;
}

.route-details-enter-to,
.route-details-leave-from {
  max-height: 8rem;
}

@keyframes gateway-beacon {
  50% {
    box-shadow:
      0 0 0 5px color-mix(in srgb, var(--status-success) 12%, transparent),
      0 0 10px var(--status-success);
  }
}

@keyframes signal-idle {
  50% {
    box-shadow: 0 0 8px currentColor;
    transform: translate(-50%, -50%) scale(1.18);
  }
}

@keyframes signal-forward {
  to {
    left: 100%;
  }
}

@keyframes signal-switch {
  0% {
    left: 0;
    transform: translate(-50%, -50%) scale(0.65);
  }
  55% {
    transform: translate(-50%, -90%) scale(1.35);
  }
  100% {
    left: 100%;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes channel-fault {
  25% {
    transform: translateX(-2px);
  }
  75% {
    transform: translateX(2px);
  }
}

@keyframes response-arrival {
  50% {
    transform: scale(1.04);
  }
}

@media (max-width: 1080px) {
  .routing-inner {
    grid-template-columns: 1fr;
  }

  .routing-copy {
    max-width: 48rem;
  }

  .routing-copy h2 {
    max-width: 10em;
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
    font-size: 2.6rem;
  }

  .routing-copy > p:nth-of-type(2) {
    line-height: 1.7;
  }

  .routing-workbench {
    border-radius: var(--sketch-border-radius-md);
  }

  .token-commandbar {
    align-items: stretch;
    flex-direction: column;
  }

  .token-switcher {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .token-mode-badge {
    width: fit-content;
  }

  .token-workbench-panel {
    padding-inline: 0.75rem;
  }

  .route-candidates {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .route-item-main {
    grid-template-columns: auto auto minmax(0, 1fr) auto;
  }

  .route-health {
    grid-column: 3;
    width: fit-content;
  }

  .route-order-actions {
    grid-column: 4;
    grid-row: 1 / 3;
  }

  .route-details {
    grid-template-columns: 1fr;
    padding-left: 0.8rem;
  }

  .signal-stage {
    grid-template-columns:
      minmax(3.2rem, auto) minmax(0.75rem, 1fr) minmax(3.2rem, auto)
      minmax(0.75rem, 1fr) minmax(4.8rem, auto) minmax(0.75rem, 1fr)
      minmax(3.8rem, auto);
  }

  .signal-node {
    min-height: 2.45rem;
  }

  .signal-node small {
    max-width: 4rem;
  }

  .simulation-copy {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.3rem;
  }
}

@media (max-width: 380px) {
  .route-candidates {
    grid-template-columns: 1fr;
  }

  .route-order-actions button {
    width: 1.45rem;
  }

  .route-metrics {
    grid-template-columns: 1fr;
  }

  .signal-node strong {
    font-size: 0.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .routing-workbench *,
  .routing-workbench *::before,
  .routing-workbench *::after {
    animation: none !important;
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
</style>
