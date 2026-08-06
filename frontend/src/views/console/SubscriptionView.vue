<script setup lang="ts">
import { AlertTriangle, RefreshCw } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHero from '@/components/console/PageHero.vue'
import CurrentPlanCard from '@/components/console/plans/CurrentPlanCard.vue'
import PlanCard from '@/components/console/plans/PlanCard.vue'
import TrafficPackList from '@/components/console/plans/TrafficPackList.vue'
import { useSubscription } from '@/composables/useSubscription'
import type { Plan } from '@/types/console'

const { t } = useI18n()

const {
  plans,
  trafficPlans,
  subscriptionPlans,
  subscription,
  trafficPacks,
  loading,
  purchasingId,
  initialError,
  load,
  purchase,
} = useSubscription()

const confirming = ref<Plan | null>(null)

const currentPlanId = computed(() => subscription.value?.plan_id ?? null)

/** Channel names the caller already holds, so cards can label them. */
const channelNames = computed(() => {
  const map = new Map<number, string>()
  if (subscription.value?.exclusive_channel) {
    map.set(
      subscription.value.plan_id,
      subscription.value.exclusive_channel.name
    )
  }
  for (const pack of trafficPacks.value) {
    if (pack.exclusive_channel) {
      map.set(pack.plan_id, pack.exclusive_channel.name)
    }
  }
  return map
})

async function confirmPurchase(): Promise<void> {
  const plan = confirming.value
  if (!plan) return
  const ok = await purchase(plan)
  if (ok) confirming.value = null
}

onMounted(() => void load())
</script>

<template>
  <div>
    <PageHero
      :title="t('plans.title')"
      :title-accent="t('plans.titleAccent')"
      :crumbs="[t('plans.breadcrumb.0'), t('plans.breadcrumb.1')]"
    >
      <template #actions>
        <ConsoleButton
          variant="secondary"
          size="sm"
          :loading="loading"
          @click="load()"
        >
          <RefreshCw v-if="!loading" :size="15" aria-hidden="true" />
          {{ t('plans.refresh') }}
        </ConsoleButton>
      </template>
    </PageHero>

    <ConsoleCard v-if="initialError" :padded="false">
      <div
        class="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center"
        role="alert"
      >
        <AlertTriangle :size="28" class="text-[var(--status-danger-text)]" />
        <p class="mt-3 font-semibold text-[var(--text-primary)]">
          {{ t('plans.loadFailed') }}
        </p>
        <p class="mt-1 max-w-md text-sm text-[var(--text-tertiary)]">
          {{ initialError }}
        </p>
        <ConsoleButton class="mt-5" variant="secondary" @click="load()">
          {{ t('plans.retry') }}
        </ConsoleButton>
      </div>
    </ConsoleCard>

    <template v-else>
      <!-- what the caller holds -->
      <div v-if="loading && !subscription" class="mb-6">
        <ConsoleCard :title="t('plans.currentSubscription')">
          <div class="space-y-3" aria-hidden="true">
            <div
              class="h-8 w-40 animate-pulse rounded bg-[var(--surface-muted)]"
            />
            <div
              class="h-2 w-full animate-pulse rounded bg-[var(--surface-muted)]"
            />
          </div>
        </ConsoleCard>
      </div>
      <div v-else class="mb-6 space-y-6">
        <CurrentPlanCard
          :subscription="subscription"
          :saving-auto-renew="false"
        />
        <TrafficPackList :packs="trafficPacks" />
      </div>

      <!-- storefront: loading skeleton spans both sections -->
      <div
        v-if="loading && plans.length === 0"
        class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        aria-hidden="true"
      >
        <div
          v-for="i in 3"
          :key="i"
          class="h-96 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
        />
      </div>

      <ConsoleCard v-else-if="plans.length === 0" :padded="false">
        <EmptyState
          :title="t('plans.emptyTitle')"
          :hint="t('plans.emptyHint')"
        />
      </ConsoleCard>

      <template v-else>
        <!-- traffic packs -->
        <section v-if="trafficPlans.length" class="mb-8">
          <h2 class="section-heading mb-1">{{ t('plans.trafficSection') }}</h2>
          <p class="mb-4 text-xs text-[var(--text-tertiary)]">
            {{ t('plans.trafficSectionHint') }}
          </p>
          <div class="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            <PlanCard
              v-for="plan in trafficPlans"
              :key="plan.id"
              :plan="plan"
              :channel-name="channelNames.get(plan.id) ?? ''"
              :loading="purchasingId === plan.id"
              :disabled="
                purchasingId !== null || plan.balance_pay_enabled === false
              "
              @buy="confirming = plan"
            />
          </div>
        </section>

        <!-- subscription packs -->
        <section v-if="subscriptionPlans.length">
          <h2 class="section-heading mb-1">
            {{ t('plans.subscriptionSection') }}
          </h2>
          <p class="mb-4 text-xs text-[var(--text-tertiary)]">
            {{ t('plans.subscriptionSectionHint') }}
          </p>
          <div class="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            <PlanCard
              v-for="plan in subscriptionPlans"
              :key="plan.id"
              :plan="plan"
              :active="plan.id === currentPlanId"
              :channel-name="channelNames.get(plan.id) ?? ''"
              :loading="purchasingId === plan.id"
              :disabled="
                purchasingId !== null || plan.balance_pay_enabled === false
              "
              @buy="confirming = plan"
            />
          </div>
        </section>
      </template>
    </template>

    <ConfirmDialog
      :open="confirming !== null"
      :title="
        confirming ? t('plans.confirmTitle', { name: confirming.name }) : ''
      "
      :message="
        confirming
          ? `${t('plans.confirmMessage', { price: confirming.price })} ${t('plans.purchaseHint')}`
          : ''
      "
      :confirm-text="t('plans.buy')"
      :loading="purchasingId !== null"
      @confirm="confirmPurchase"
      @cancel="confirming = null"
    />
  </div>
</template>
