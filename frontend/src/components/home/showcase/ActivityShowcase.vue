<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  CalendarCheck,
  Check,
  Gamepad2,
  Network,
  Sprout,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import { useTheme } from '@/composables/useTheme'
import type { HomeActivityId, HomeActivityPreview } from '@/types/homeShowcase'

import HomeSectionHeading from './HomeSectionHeading.vue'

const props = defineProps<{
  activities: readonly HomeActivityPreview[]
}>()

const { t, locale } = useI18n()
const { resolvedTheme } = useTheme()
const active = ref<HomeActivityId>('checkin')
const checkedIn = ref(false)
const inviteAdds = ref(0)
const farmUsageAdded = ref(0)
const gameCoinsEarned = ref(0)
const gameSpinning = ref(false)
const lastPrizeKey = ref('showcase.activities.game.pendingPrize')
const failedImages = ref(new Set<string>())
let spinTimer: ReturnType<typeof setTimeout> | undefined

const iconByActivity = {
  checkin: CalendarCheck,
  affiliate: Network,
  farm: Sprout,
  bigame: Gamepad2,
} as const

const tabs = computed(() =>
  props.activities.map((activity) => ({
    key: activity.id,
    label: t(activity.titleKey),
    icon: iconByActivity[activity.id],
  }))
)

const activeActivity = computed(
  () =>
    props.activities.find((activity) => activity.id === active.value) ??
    props.activities[0] ??
    null
)
const activeId = computed<HomeActivityId>(
  () => activeActivity.value?.id ?? 'checkin'
)
const activeIndex = computed(() =>
  Math.max(
    0,
    tabs.value.findIndex((tab) => tab.key === activeId.value)
  )
)
const activeImage = computed(() => {
  const activity = activeActivity.value
  if (!activity) return ''
  return resolvedTheme.value === 'dark'
    ? activity.nightAsset
    : activity.dayAsset
})
const imageAvailable = computed(
  () => Boolean(activeImage.value) && !failedImages.value.has(activeImage.value)
)

function findActivity(id: HomeActivityId): HomeActivityPreview | undefined {
  return props.activities.find((activity) => activity.id === id)
}

const checkedDays = computed(() => {
  const activity = findActivity('checkin')
  if (!activity) return 0
  return Math.min(activity.target, activity.current + (checkedIn.value ? 1 : 0))
})
const inviteMembers = computed(
  () => (findActivity('affiliate')?.current ?? 0) + inviteAdds.value
)
const farmUsage = computed(
  () => (findActivity('farm')?.current ?? 0) + farmUsageAdded.value
)
const farmOre = computed(() => Math.floor(farmUsage.value / 100_000))
const farmGrowth = computed(() => {
  const target = findActivity('farm')?.target ?? 0
  return target > 0
    ? Math.min(100, Math.round((farmUsage.value / target) * 100))
    : 0
})
const gameCoins = computed(
  () => (findActivity('bigame')?.current ?? 0) + gameCoinsEarned.value
)
const lastPrize = computed(() => t(lastPrizeKey.value))

function formatNumber(value: number) {
  return new Intl.NumberFormat(locale.value).format(value)
}

function activityReward(id: HomeActivityId): string {
  const activity = findActivity(id)
  return activity ? t(activity.rewardKey) : ''
}

function selectActivity(id: HomeActivityId): void {
  active.value = id
}

function onTabKeydown(event: KeyboardEvent, index: number): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  let target = index
  if (event.key === 'ArrowLeft')
    target = (index - 1 + tabs.value.length) % tabs.value.length
  if (event.key === 'ArrowRight') target = (index + 1) % tabs.value.length
  if (event.key === 'Home') target = 0
  if (event.key === 'End') target = tabs.value.length - 1
  const next = tabs.value[target]
  if (!next) return
  active.value = next.key
  nextTick(() => document.getElementById(`activity-tab-${next.key}`)?.focus())
}

function markImageFailed(): void {
  if (!activeImage.value) return
  failedImages.value = new Set(failedImages.value).add(activeImage.value)
}

function checkin(): void {
  checkedIn.value = true
}

function invite(): void {
  inviteAdds.value += 1
}

function growFarm(): void {
  farmUsageAdded.value += 250_000
}

function spin(): void {
  if (gameSpinning.value) return
  gameSpinning.value = true
  if (spinTimer !== undefined) clearTimeout(spinTimer)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  spinTimer = setTimeout(
    () => {
      gameCoinsEarned.value += 8
      lastPrizeKey.value = 'showcase.activities.game.prizes.badge'
      gameSpinning.value = false
      spinTimer = undefined
    },
    reduceMotion ? 0 : 700
  )
}

function onVisibilityChange(): void {
  if (document.visibilityState !== 'hidden' || !gameSpinning.value) return
  if (spinTimer !== undefined) clearTimeout(spinTimer)
  spinTimer = undefined
  gameSpinning.value = false
}

onMounted(() =>
  document.addEventListener('visibilitychange', onVisibilityChange)
)

onBeforeUnmount(() => {
  if (spinTimer !== undefined) clearTimeout(spinTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <section id="activities" class="home-showcase-band activity-showcase-band">
    <div class="home-showcase-inner">
      <HomeSectionHeading
        :eyebrow="t('showcase.activities.eyebrow')"
        :title="t('showcase.activities.title')"
        :description="t('showcase.activities.description')"
      />

      <div class="activity-switcher" role="tablist">
        <button
          v-for="(tab, index) in tabs"
          :id="`activity-tab-${tab.key}`"
          :key="tab.key"
          type="button"
          role="tab"
          class="activity-switcher__tab"
          :class="{ 'is-active': activeId === tab.key }"
          :aria-selected="activeId === tab.key"
          :aria-controls="`activity-panel-${tab.key}`"
          :tabindex="activeId === tab.key ? 0 : -1"
          @click="selectActivity(tab.key)"
          @keydown="onTabKeydown($event, index)"
        >
          <component :is="tab.icon" :size="18" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <div
        v-if="activeActivity"
        :id="`activity-panel-${activeId}`"
        class="activity-stage"
        role="tabpanel"
        :aria-labelledby="`activity-tab-${activeId}`"
      >
        <div class="activity-stage__media" aria-hidden="true">
          <img
            v-if="imageAvailable"
            :src="activeImage"
            alt=""
            loading="lazy"
            @error="markImageFailed"
          />
          <div v-else class="activity-stage__media-fallback">
            <component :is="iconByActivity[activeId]" :size="44" />
          </div>
          <div class="activity-stage__media-scrim" />
        </div>

        <div class="activity-stage__copy">
          <p class="activity-stage__index">
            {{ String(activeIndex + 1).padStart(2, '0') }} /
            {{ String(tabs.length).padStart(2, '0') }}
          </p>
          <h3>{{ t(activeActivity.titleKey) }}</h3>
          <p>{{ t(activeActivity.detailKey) }}</p>

          <button
            v-if="activeId === 'checkin'"
            type="button"
            class="activity-action"
            :class="{ 'is-complete': checkedIn }"
            :disabled="checkedIn"
            @click="checkin"
          >
            <Check v-if="checkedIn" :size="18" />
            <CalendarCheck v-else :size="18" />
            {{
              checkedIn
                ? t('showcase.activities.checkin.done')
                : t('showcase.activities.checkin.action')
            }}
          </button>
          <button
            v-else-if="activeId === 'affiliate'"
            type="button"
            class="activity-action"
            @click="invite"
          >
            <Network :size="18" />
            {{ t('showcase.activities.affiliate.action') }}
          </button>
          <button
            v-else-if="activeId === 'farm'"
            type="button"
            class="activity-action"
            @click="growFarm"
          >
            <Sprout :size="18" />
            {{ t('showcase.activities.farm.action') }}
          </button>
          <button
            v-else
            type="button"
            class="activity-action"
            :disabled="gameSpinning"
            @click="spin"
          >
            <Gamepad2 :size="18" />
            {{
              gameSpinning
                ? t('showcase.activities.game.spinning')
                : t('showcase.activities.game.action')
            }}
          </button>
        </div>

        <div class="activity-stage__instrument" aria-live="polite">
          <template v-if="activeId === 'checkin'">
            <div class="checkin-calendar">
              <span
                v-for="day in 7"
                :key="day"
                :class="{ 'is-done': day <= checkedDays }"
              >
                <Check v-if="day <= checkedDays" :size="16" />
                <b v-else>{{ day }}</b>
              </span>
            </div>
            <p class="activity-stage__reward">
              {{ activityReward('checkin') }}
            </p>
          </template>

          <template v-else-if="activeId === 'affiliate'">
            <div class="affiliate-network" aria-hidden="true">
              <span class="affiliate-network__hub">R2</span>
              <i v-for="node in 6" :key="node" :style="{ '--node': node }" />
            </div>
            <dl class="activity-mini-stats">
              <div>
                <dt>{{ t('showcase.activities.affiliate.members') }}</dt>
                <dd>{{ inviteMembers }}</dd>
              </div>
              <div>
                <dt>{{ t('showcase.activities.affiliate.rebate') }}</dt>
                <dd>{{ activityReward('affiliate') }}</dd>
              </div>
            </dl>
          </template>

          <template v-else-if="activeId === 'farm'">
            <div class="farm-plots" aria-hidden="true">
              <span
                v-for="plot in 8"
                :key="plot"
                :class="{ 'is-grown': plot / 8 <= farmGrowth / 100 }"
              >
                <Sprout :size="20" />
              </span>
            </div>
            <dl class="activity-mini-stats">
              <div>
                <dt>{{ t('showcase.activities.farm.ore') }}</dt>
                <dd>{{ formatNumber(farmOre) }}</dd>
              </div>
              <div>
                <dt>{{ t('showcase.activities.farm.growth') }}</dt>
                <dd>{{ farmGrowth }}%</dd>
              </div>
            </dl>
          </template>

          <template v-else>
            <div
              class="game-wheel"
              :class="{ 'is-spinning': gameSpinning }"
              aria-hidden="true"
            >
              <span
                v-for="segment in 8"
                :key="segment"
                :style="{ '--segment': segment }"
              />
              <b>R2</b>
            </div>
            <dl class="activity-mini-stats">
              <div>
                <dt>{{ t('showcase.activities.game.coins') }}</dt>
                <dd>{{ gameCoins }}</dd>
              </div>
              <div>
                <dt>{{ t('showcase.activities.game.lastPrize') }}</dt>
                <dd>{{ lastPrize }}</dd>
              </div>
            </dl>
          </template>
        </div>
      </div>

      <div v-else class="activity-empty" role="status">
        <Sprout :size="30" />
        <p>{{ t('showcase.activities.empty') }}</p>
      </div>

      <div class="activity-showcase-footer">
        <p>{{ t('showcase.activities.equityNote') }}</p>
        <RouterLink :to="{ name: 'activity' }">
          {{ t('showcase.activities.goActivities') }}
          <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.activity-showcase-band {
  background: var(--page-background);
}

.activity-switcher {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 3rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}

.activity-switcher__tab {
  display: flex;
  min-width: 0;
  min-height: 3.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border-radius: var(--shape-control);
  color: var(--text-tertiary);
  font-size: 0.82rem;
  font-weight: 700;
  transition:
    color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
}

.activity-switcher__tab:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.activity-switcher__tab.is-active {
  background: var(--accent-soft);
  color: var(--accent-text);
}

.activity-switcher__tab:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.activity-stage {
  display: grid;
  min-height: 30rem;
  overflow: hidden;
  border-bottom: 1px solid var(--border-subtle);
}

.activity-stage__media {
  position: relative;
  min-height: 15rem;
  overflow: hidden;
}

.activity-stage__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 700ms cubic-bezier(0.22, 0.72, 0.25, 1);
}

.activity-stage__media-fallback {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 15rem;
  place-items: center;
  background:
    linear-gradient(var(--border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px),
    var(--surface-muted);
  background-size: 28px 28px;
  color: var(--signal);
}

.activity-stage:hover .activity-stage__media img {
  transform: scale(1.025);
}

.activity-stage__media-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 35%, var(--page-background));
}

.activity-stage__copy,
.activity-stage__instrument {
  padding: clamp(1.25rem, 3vw, 2.25rem);
}

.activity-stage__copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
}

.activity-stage__index {
  margin: 0;
  color: var(--accent-text);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 0.7rem;
}

.activity-stage__copy h3 {
  margin: 0.65rem 0 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.8rem);
  line-height: 1.1;
}

.activity-stage__copy > p:not(.activity-stage__index) {
  max-width: 32rem;
  margin: 0.85rem 0 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.activity-action {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1.5rem;
  border-radius: var(--shape-control);
  background: var(--accent);
  padding: 0.65rem 1.1rem;
  color: var(--accent-contrast);
  font-size: 0.86rem;
  font-weight: 750;
  box-shadow: var(--button-shadow);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.activity-action:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--button-shadow-hover);
}

.activity-action:disabled {
  cursor: default;
  opacity: 0.75;
}

.activity-action:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

.activity-stage__instrument {
  display: grid;
  align-content: center;
  gap: 1.5rem;
  background: color-mix(in srgb, var(--surface-muted) 72%, transparent);
}

.checkin-calendar,
.farm-plots {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.7rem;
}

.checkin-calendar span,
.farm-plots span {
  display: grid;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid var(--border-subtle);
  border-radius: var(--shape-control);
  background: var(--surface-solid);
  color: var(--text-tertiary);
}

.checkin-calendar span.is-done,
.farm-plots span.is-grown {
  border-color: var(--status-success);
  background: var(--status-success-soft);
  color: var(--status-success-text);
}

.activity-stage__reward {
  margin: 0;
  color: var(--accent-text);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 1.15rem;
  font-weight: 750;
  text-align: center;
}

.activity-mini-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 0;
}

.activity-mini-stats > div {
  min-width: 0;
  border-top: 1px solid var(--border-subtle);
  padding-top: 0.85rem;
}

.activity-mini-stats dt {
  color: var(--text-tertiary);
  font-size: 0.72rem;
}

.activity-mini-stats dd {
  overflow-wrap: anywhere;
  margin: 0.35rem 0 0;
  color: var(--text-primary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 1.3rem;
  font-weight: 750;
}

.affiliate-network {
  position: relative;
  width: min(100%, 18rem);
  aspect-ratio: 1;
  margin-inline: auto;
  border: 1px dashed var(--border-default);
  border-radius: 50%;
}

.affiliate-network::before,
.affiliate-network::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 68%;
  height: 1px;
  background: var(--signal);
  content: '';
  opacity: 0.45;
  transform-origin: left center;
}

.affiliate-network::before {
  transform: rotate(30deg);
}

.affiliate-network::after {
  transform: rotate(150deg);
}

.affiliate-network__hub,
.affiliate-network i {
  position: absolute;
  display: grid;
  place-items: center;
  border-radius: 50%;
}

.affiliate-network__hub {
  top: 50%;
  left: 50%;
  z-index: 2;
  width: 4rem;
  height: 4rem;
  background: var(--accent);
  color: var(--accent-contrast);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-weight: 800;
  transform: translate(-50%, -50%);
}

.affiliate-network i {
  --angle: calc((var(--node) - 1) * 60deg);
  top: 50%;
  left: 50%;
  width: 2rem;
  height: 2rem;
  border: 5px solid var(--surface-solid);
  background: var(--signal);
  box-shadow: 0 0 0 1px var(--border-default);
  transform: translate(-50%, -50%) rotate(var(--angle)) translateX(7.4rem)
    rotate(calc(var(--angle) * -1));
}

.game-wheel {
  position: relative;
  width: min(100%, 17rem);
  aspect-ratio: 1;
  margin-inline: auto;
  overflow: hidden;
  border: 0.6rem solid var(--surface-solid);
  border-radius: 50%;
  background: conic-gradient(
    var(--accent) 0 12.5%,
    var(--signal) 12.5% 25%,
    var(--support) 25% 37.5%,
    var(--glow) 37.5% 50%,
    var(--accent) 50% 62.5%,
    var(--signal) 62.5% 75%,
    var(--support) 75% 87.5%,
    var(--glow) 87.5% 100%
  );
  box-shadow:
    0 0 0 1px var(--border-default),
    var(--card-shadow);
}

.game-wheel b {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 4.25rem;
  height: 4.25rem;
  place-items: center;
  border-radius: 50%;
  background: var(--surface-solid);
  color: var(--text-primary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  transform: translate(-50%, -50%);
}

.game-wheel.is-spinning {
  animation: home-game-spin 700ms cubic-bezier(0.2, 0.8, 0.25, 1);
}

.activity-showcase-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.5rem;
  color: var(--text-tertiary);
  font-size: 0.76rem;
}

.activity-empty {
  display: grid;
  min-height: 22rem;
  place-items: center;
  align-content: center;
  margin-top: 2rem;
  border: 1px dashed var(--border-default);
  color: var(--text-tertiary);
  text-align: center;
}

.activity-empty p {
  margin: 0.75rem 0 0;
}

.activity-showcase-footer p {
  margin: 0;
}

.activity-showcase-footer a {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--accent-text);
  font-weight: 750;
}

@keyframes home-game-spin {
  to {
    transform: rotate(900deg);
  }
}

@media (min-width: 900px) {
  .activity-stage {
    grid-template-columns: minmax(0, 0.86fr) minmax(18rem, 0.72fr) minmax(
        18rem,
        0.72fr
      );
  }

  .activity-stage__media-scrim {
    background: linear-gradient(90deg, transparent 40%, var(--page-background));
  }
}

@media (max-width: 720px) {
  .activity-switcher {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .activity-switcher__tab {
    justify-content: flex-start;
    padding-inline: 0.85rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .activity-stage__media img,
  .activity-action,
  .game-wheel.is-spinning {
    animation: none;
    transition: none;
  }
}
</style>
