<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import bigameDayBanner from '@/assets/activity/bigame-banner-day-sketch.webp'
import bigameNightBanner from '@/assets/activity/bigame-banner.webp'
import farmDayBanner from '@/assets/activity/farm-banner-day-sketch.webp'
import farmNightBanner from '@/assets/activity/farm-banner.webp'
import ActivityHero from '@/components/console/activity/ActivityHero.vue'
import ActivityCard from '@/components/console/activity/ActivityCard.vue'
import CheckinCard from '@/components/console/activity/CheckinCard.vue'
import TurnstileWidget from '@/components/auth/TurnstileWidget.vue'
import NewcomerCard from '@/components/console/activity/NewcomerCard.vue'
import ActivityEntryCard from '@/components/console/ActivityEntryCard.vue'
import ErrorBanner from '@/components/common/ErrorBanner.vue'
import SectionHeading from '@/components/common/SectionHeading.vue'
import SkeletonBlock from '@/components/common/SkeletonBlock.vue'
import StatTileGrid, {
  type StatTile,
} from '@/components/common/StatTileGrid.vue'
import { useActivity } from '@/composables/useActivity'
import { useFeatureAccess } from '@/composables/useFeatureAccess'
import { useThemedAsset } from '@/composables/useThemedAsset'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import type { Activity } from '@/types/console'
import { formatQuota } from '@/utils/format'

const { t } = useI18n()
const router = useRouter()
const app = useAppStore()
const toast = useToast()
const { activities, loading, loadError, claiming, load, checkin, claim } =
  useActivity()
const farmBanner = useThemedAsset(farmDayBanner, farmNightBanner)
const bigameBanner = useThemedAsset(bigameDayBanner, bigameNightBanner)
const { disabled: farmDisabled } = useFeatureAccess('farm', 'disabled')
const { disabled: bigameDisabled } = useFeatureAccess('bigame', 'disabled')

const refreshing = ref(false)
const pendingCheckinId = ref<number | null>(null)
const turnstileToken = ref('')
const turnstileUnavailable = ref(false)
const turnstileWidget = ref<InstanceType<typeof TurnstileWidget> | null>(null)

async function handleCheckin(id: number) {
  await app.initialize()
  if (!app.turnstileEnabled) {
    await checkin(id)
    return
  }
  if (!app.turnstileSiteKey || turnstileUnavailable.value) {
    toast.error(t('common.turnstileUnavailable'))
    return
  }
  pendingCheckinId.value = id
  if (!turnstileToken.value) {
    toast.error(t('common.turnstileRequired'))
    return
  }
  await checkin(id, turnstileToken.value)
  pendingCheckinId.value = null
  turnstileWidget.value?.reset()
}

async function handleTurnstileVerified(token: string) {
  turnstileToken.value = token
  if (!token || pendingCheckinId.value === null) return
  const id = pendingCheckinId.value
  pendingCheckinId.value = null
  await checkin(id, token)
  turnstileWidget.value?.reset()
}

async function refresh() {
  refreshing.value = true
  try {
    await load()
  } finally {
    refreshing.value = false
  }
}

// Direct typed accessors — no tab filtering needed for 3 static activity types.
const checkinAct = computed(
  () =>
    activities.value.find((a) => a.kind === 'checkin') as
      Extract<Activity, { kind: 'checkin' }> | undefined
)
const newcomerAct = computed(
  () =>
    activities.value.find((a) => a.kind === 'newcomer') as
      Extract<Activity, { kind: 'newcomer' }> | undefined
)
const inviteAct = computed(
  () =>
    activities.value.find((a) => a.kind === 'invite') as
      Extract<Activity, { kind: 'invite' }> | undefined
)

const inviteTiles = computed<StatTile[]>(() => {
  const invite = inviteAct.value?.invite
  if (!invite) return []
  return [
    { label: t('activity.invite.invited'), value: String(invite.invited) },
    {
      label: t('activity.invite.rewardTotal'),
      value: formatQuota(invite.reward_total),
    },
    {
      label: t('activity.invite.effectiveRate'),
      value: `${invite.effective_rate_percent}%`,
    },
    {
      label: t('activity.invite.frozenReward'),
      value: formatQuota(invite.frozen_reward),
    },
  ]
})

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <!-- ① Hero banner -->
    <ActivityHero
      :title="t('activity.title')"
      :subtitle="t('activity.heroSubtitle')"
      :pill="t('activity.heroPill')"
    />

    <!-- ② 大型玩法入口 -->
    <section>
      <SectionHeading class="mb-3">
        {{ t('activity.bigActivities') }}
      </SectionHeading>
      <div class="grid gap-4 md:grid-cols-2">
        <ActivityEntryCard
          :title="$t('nav.farm')"
          :subtitle="$t('farm.subtitle')"
          :tag="$t('nav.groupActivity')"
          :image="farmBanner"
          gradient="linear-gradient(120deg, var(--signal-strong) 0%, var(--support-strong) 55%, var(--accent) 100%)"
          emoji="🌾"
          :cta="farmDisabled ? $t('nav.comingSoon') : $t('common.viewMore')"
          :disabled="farmDisabled"
          @enter="router.push({ name: 'farm' })"
        />
        <ActivityEntryCard
          :title="$t('nav.bigame')"
          :subtitle="$t('bigame.subtitle')"
          :tag="$t('nav.groupActivity')"
          :image="bigameBanner"
          gradient="linear-gradient(120deg, var(--signal-deep) 0%, var(--support-strong) 50%, var(--accent) 100%)"
          emoji="🎮"
          :cta="bigameDisabled ? $t('nav.comingSoon') : $t('common.viewMore')"
          :disabled="bigameDisabled"
          @enter="router.push({ name: 'bigame' })"
        />
      </div>
    </section>

    <!-- ③ 日常任务 -->
    <section>
      <!-- section header + refresh -->
      <div class="mb-4 flex items-center justify-between">
        <SectionHeading>
          {{ t('activity.dailyTasks') }}
        </SectionHeading>
        <button
          type="button"
          class="rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--state-hover-layer)] hover:text-[var(--text-secondary)] focus-ring"
          :disabled="refreshing"
          :aria-label="t('activity.refresh')"
          :title="t('activity.refresh')"
          @click="refresh"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            :class="{ 'animate-spin': refreshing }"
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      <!-- loading skeleton -->
      <div v-if="loading" class="grid gap-5 lg:grid-cols-2">
        <SkeletonBlock
          v-for="i in 3"
          :key="i"
          bordered
          class="h-64"
          :class="{ 'lg:col-span-2': i === 3 }"
        />
      </div>

      <!-- activity cards grid -->
      <ErrorBanner v-else-if="loadError" :message="loadError" @retry="load()" />

      <div v-else class="grid gap-5 lg:grid-cols-2">
        <TurnstileWidget
          v-if="app.turnstileEnabled"
          ref="turnstileWidget"
          class="lg:col-span-2"
          :site-key="app.turnstileSiteKey"
          @verified="handleTurnstileVerified"
          @unavailable="turnstileUnavailable = true"
        />

        <!-- 每日签到 -->
        <CheckinCard
          v-if="checkinAct"
          :activity="checkinAct"
          :claiming="claiming"
          @checkin="handleCheckin"
        />

        <!-- 新人礼包 -->
        <NewcomerCard
          v-if="newcomerAct"
          :activity="newcomerAct"
          :claiming="claiming"
          @claim="(id) => claim(id)"
        />

        <!-- 邀请奖励：跨 2 列独占一行 -->
        <div v-if="inviteAct" class="lg:col-span-2">
          <ActivityCard
            :id="inviteAct.id"
            :kind="inviteAct.kind"
            :title="inviteAct.title"
            :tagline="inviteAct.tagline"
            :status="inviteAct.status"
            :end="inviteAct.end"
            :icon="inviteAct.icon"
            :claim-label="t('activity.invite.goInvite')"
            @claim="router.push({ name: 'invite' })"
          >
            <StatTileGrid :tiles="inviteTiles" :columns="4" />
          </ActivityCard>
        </div>
      </div>
    </section>
  </div>
</template>
