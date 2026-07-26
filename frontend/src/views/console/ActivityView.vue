<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import ActivityHero from '@/components/console/activity/ActivityHero.vue'
import ActivityCard from '@/components/console/activity/ActivityCard.vue'
import CheckinCard from '@/components/console/activity/CheckinCard.vue'
import NewcomerCard from '@/components/console/activity/NewcomerCard.vue'
import ActivityEntryCard from '@/components/console/ActivityEntryCard.vue'
import { useActivity } from '@/composables/useActivity'
import type { Activity } from '@/types/console'
import farmBanner from '@/assets/activity/farm-banner.webp'
import bigameBanner from '@/assets/activity/bigame-banner.webp'

const { t } = useI18n()
const router = useRouter()
const { activities, loading, claiming, load, checkin, claim } = useActivity()

const refreshing = ref(false)

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
      <p
        class="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]"
      >
        {{ t('activity.bigActivities') }}
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        <ActivityEntryCard
          :title="$t('nav.farm')"
          :subtitle="$t('farm.subtitle')"
          :tag="$t('nav.groupActivity')"
          :image="farmBanner"
          gradient="linear-gradient(120deg, var(--signal-strong) 0%, var(--support-strong) 55%, var(--accent) 100%)"
          emoji="🌾"
          :cta="$t('common.viewMore')"
          @enter="router.push({ name: 'farm' })"
        />
        <ActivityEntryCard
          :title="$t('nav.bigame')"
          :subtitle="$t('bigame.subtitle')"
          :tag="$t('nav.groupActivity')"
          :image="bigameBanner"
          gradient="linear-gradient(120deg, var(--signal-deep) 0%, var(--support-strong) 50%, var(--accent) 100%)"
          emoji="🎮"
          :cta="$t('common.viewMore')"
          @enter="router.push({ name: 'bigame' })"
        />
      </div>
    </section>

    <!-- ③ 日常任务 -->
    <section>
      <!-- section header + refresh -->
      <div class="mb-4 flex items-center justify-between">
        <p
          class="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]"
        >
          {{ t('activity.dailyTasks') }}
        </p>
        <button
          type="button"
          class="rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)] focus-ring"
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
        <div
          v-for="i in 3"
          :key="i"
          class="h-64 animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
          :class="{ 'lg:col-span-2': i === 3 }"
        />
      </div>

      <!-- activity cards grid -->
      <div v-else class="grid gap-5 lg:grid-cols-2">
        <!-- 每日签到 -->
        <CheckinCard
          v-if="checkinAct"
          :activity="checkinAct"
          :claiming="claiming"
          @checkin="(id) => checkin(id)"
        />

        <!-- 新人礼包 -->
        <NewcomerCard
          v-if="newcomerAct"
          :activity="newcomerAct"
          :claiming="claiming"
          @claim="(id) => claim(id)"
        />

        <!-- 邀请返利：跨 2 列独占一行 -->
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
            <div class="flex flex-wrap gap-3 sm:flex-nowrap">
              <div
                class="flex flex-1 items-center justify-between rounded-xl border border-[var(--border-subtle)] px-4 py-3"
              >
                <span class="text-sm text-[var(--text-secondary)]">{{
                  t('activity.invite.invited')
                }}</span>
                <span class="font-semibold text-[var(--text-primary)]">{{
                  inviteAct.invite.invited
                }}</span>
              </div>
              <div
                class="flex flex-1 items-center justify-between rounded-xl border border-[var(--border-subtle)] px-4 py-3"
              >
                <span class="text-sm text-[var(--text-secondary)]">{{
                  t('activity.invite.rewardTotal')
                }}</span>
                <span class="font-semibold text-[var(--accent-text)]"
                  >+{{
                    (inviteAct.invite.reward_total / 10000).toFixed(0)
                  }}</span
                >
              </div>
              <div
                class="flex flex-1 items-center justify-between rounded-xl border border-[var(--border-subtle)] px-4 py-3"
              >
                <span class="text-sm text-[var(--text-secondary)]">{{
                  t('activity.invite.rate')
                }}</span>
                <span class="font-semibold text-[var(--text-primary)]"
                  >{{ (inviteAct.invite.rate * 100).toFixed(0) }}%</span
                >
              </div>
            </div>
          </ActivityCard>
        </div>
      </div>
    </section>
  </div>
</template>
