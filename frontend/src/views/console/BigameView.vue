<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PageHero from '@/components/console/PageHero.vue'
import GameHero from '@/components/console/bigame/GameHero.vue'
import MilestoneTrack from '@/components/console/bigame/MilestoneTrack.vue'
import SpinWheelCard from '@/components/console/bigame/SpinWheelCard.vue'
import BlindBoxCard from '@/components/console/bigame/BlindBoxCard.vue'
import PrizeInventory from '@/components/console/bigame/PrizeInventory.vue'
import { useBigame } from '@/composables/useBigame'

const { t } = useI18n()
const {
  loading,
  spinning,
  opening,
  wallet,
  milestones,
  prizes,
  records,
  lastSpinPrize,
  lastBoxPrize,
  load,
  spin,
  openBox,
  claimMilestone,
} = useBigame()

const claimingId = ref<string | null>(null)

async function onClaim(id: string) {
  claimingId.value = id
  try {
    await claimMilestone(id)
  } finally {
    claimingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHero
      :title="t('bigame.title')"
      :crumbs="[$t('bigame.breadcrumb.0'), $t('bigame.breadcrumb.1')]"
    >
      <p class="mt-2 max-w-xl text-sm text-[var(--text-tertiary)]">
        {{ t('bigame.subtitle') }}
      </p>
    </PageHero>

    <!-- loading skeleton -->
    <div v-if="loading" class="grid gap-5 lg:grid-cols-2">
      <div
        v-for="i in 4"
        :key="i"
        class="h-56 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
      />
    </div>

    <template v-else>
      <GameHero v-if="wallet" :wallet="wallet" />

      <!-- earn section -->
      <MilestoneTrack
        :milestones="milestones"
        :claiming="claimingId"
        @claim="onClaim"
      />

      <!-- game hall -->
      <div>
        <h2
          class="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
        >
          {{ t('bigame.gameHall') }}
        </h2>
        <div class="grid gap-5 lg:grid-cols-2">
          <SpinWheelCard
            :prizes="prizes"
            :spinning="spinning"
            :balance="wallet?.balance ?? 0"
            :last-prize="lastSpinPrize"
            @spin="spin"
          />
          <BlindBoxCard
            :opening="opening"
            :balance="wallet?.balance ?? 0"
            :last-prize="lastBoxPrize"
            @open-box="openBox"
          />
        </div>
      </div>

      <!-- prize history -->
      <PrizeInventory :records="records" />
    </template>
  </div>
</template>
