<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PageHero from '@/components/console/PageHero.vue'
import FarmHero from '@/components/console/farm/FarmHero.vue'
import PlotGrid from '@/components/console/farm/PlotGrid.vue'
import RanchRow from '@/components/console/farm/RanchRow.vue'
import FishingPanel from '@/components/console/farm/FishingPanel.vue'
import PetDock from '@/components/console/farm/PetDock.vue'
import LeaderTable from '@/components/console/farm/LeaderTable.vue'
import RewardTierCard from '@/components/console/farm/RewardTierCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useFarm } from '@/composables/useFarm'
import { useFeatureAccess } from '@/composables/useFeatureAccess'
import type { LeaderPeriod } from '@/types/farm'

const { t } = useI18n()
const { readOnly } = useFeatureAccess('farm', 'prototype')
const {
  loading,
  acting,
  farmState,
  plots,
  animals,
  fishing,
  pet,
  mine,
  leaderPeriod,
  leaderLoading,
  leaderEntries,
  rebateTiers,
  rebateState,
  rebateLoading,
  load,
  loadLeader,
  loadRebate,
  harvest,
  feedAnimal,
  collectAnimal,
  goFishing,
  feedPet,
} = useFarm()

const tab = ref('farm')
const farmPanelId = 'farm-tab-panel'

const tabItems = computed(() => [
  { key: 'farm', label: t('farm.tabFarm') },
  { key: 'leader', label: t('farm.tabLeader') },
  { key: 'rebate', label: t('farm.tabRebate') },
])

// Lazy-load leaderboard / rebate the first time their tab is opened.
const leaderLoaded = ref(false)
const rebateLoaded = ref(false)
watch(tab, (value) => {
  if (value === 'leader' && !leaderLoaded.value) {
    leaderLoaded.value = true
    loadLeader()
  }
  if (value === 'rebate' && !rebateLoaded.value) {
    rebateLoaded.value = true
    loadRebate()
  }
})

function onChangePeriod(period: LeaderPeriod) {
  loadLeader(period)
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHero
      v-model:tab="tab"
      :title="t('farm.title')"
      :crumbs="[$t('farm.breadcrumb.0'), $t('farm.breadcrumb.1')]"
      :tabs="tabItems"
      :tab-panel-id="farmPanelId"
    >
      <p class="mt-2 max-w-xl text-sm text-[var(--text-tertiary)]">
        {{ t('farm.subtitle') }}
      </p>
    </PageHero>

    <div
      :id="farmPanelId"
      role="tabpanel"
      :aria-labelledby="`${farmPanelId}-tab-${tab}`"
    >
      <!-- loading skeleton -->
      <div v-if="loading" class="grid gap-5 lg:grid-cols-2">
        <div
          v-for="i in 4"
          :key="i"
          class="h-56 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
        />
      </div>

      <template v-else>
        <!-- Tab: My Farm -->
        <div v-show="tab === 'farm'" class="space-y-5">
          <FarmHero v-if="farmState && mine" :state="farmState" :mine="mine" />
          <div class="grid gap-5 lg:grid-cols-2">
            <PlotGrid
              :plots="plots"
              :acting="acting"
              :readonly="readOnly"
              @harvest="harvest"
            />
            <RanchRow
              :animals="animals"
              :acting="acting"
              :readonly="readOnly"
              @feed-animal="feedAnimal"
              @collect-animal="collectAnimal"
            />
            <FishingPanel
              v-if="fishing"
              :fishing="fishing"
              :acting="acting"
              :readonly="readOnly"
              @fish="goFishing"
            />
            <PetDock
              v-if="pet"
              :pet="pet"
              :acting="acting"
              :readonly="readOnly"
              @feed-pet="feedPet"
            />
          </div>
        </div>

        <!-- Tab: Leaderboard (mounted on first visit, kept alive afterwards) -->
        <div v-if="leaderLoaded" v-show="tab === 'leader'">
          <LeaderTable
            :entries="leaderEntries"
            :period="leaderPeriod"
            :loading="leaderLoading"
            @change-period="onChangePeriod"
          />
          <EmptyState
            v-if="!leaderLoading && leaderEntries.length === 0"
            :title="t('farm.leader.emptyTitle')"
            :hint="t('farm.leader.emptyHint')"
          />
        </div>

        <!-- Tab: Rebate (mounted on first visit, kept alive afterwards) -->
        <div v-if="rebateLoaded" v-show="tab === 'rebate'">
          <RewardTierCard
            v-if="rebateState"
            :tiers="rebateTiers"
            :state="rebateState"
            :loading="rebateLoading"
          />
          <div
            v-else-if="rebateLoading"
            class="h-72 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
          />
        </div>
      </template>
    </div>
  </div>
</template>
