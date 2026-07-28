<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import PageHero from '@/components/console/PageHero.vue'
import FlowChart from '@/components/console/wallet/FlowChart.vue'
import RedeemPanel from '@/components/console/wallet/RedeemPanel.vue'
import TopupPanel from '@/components/console/wallet/TopupPanel.vue'
import TopupRecords from '@/components/console/wallet/TopupRecords.vue'
import type { DashboardStats, FlowPoint } from '@/composables/useDashboard'
import { useBalanceVisibility } from '@/composables/useDashboard'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import { formatMoney, formatQuota, QUOTA_PER_DOLLAR } from '@/utils/format'

interface WalletStats extends DashboardStats {
  month_topup?: number
  month_topup_count?: number
  total_topup?: number
  total_topup_since?: string
}

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { hidden, toggle } = useBalanceVisibility()

const stats = ref<WalletStats | null>(null)
const flow = ref<FlowPoint[]>([])
const refreshKey = ref(0)
const paymentMethod = ref('epay')
const loading = ref(false)
const statsRequest = useLatestRequest()

const activePanel = computed<'topup' | 'redeem'>(() =>
  route.query.panel === 'redeem' ? 'redeem' : 'topup'
)

const balanceTotalCents = computed(() =>
  stats.value ? Math.round(stats.value.quota / (QUOTA_PER_DOLLAR / 100)) : 0
)
const balanceDollars = computed(() => Math.floor(balanceTotalCents.value / 100))
const balanceCents = computed(() =>
  String(balanceTotalCents.value % 100).padStart(2, '0')
)
const dayCount = computed(() => flow.value.length || 30)

const statCards = computed(() => {
  const current = stats.value
  if (!current) return []
  const average = flow.value.length
    ? Math.round(
        flow.value.reduce((sum, point) => sum + point.consume, 0) /
          flow.value.length
      )
    : 0
  return [
    {
      label: t('wallet.statMonthTopup'),
      value: formatMoney(current.month_topup ?? 0, 0),
      sub: t('wallet.statMonthTopupSub', {
        count: current.month_topup_count ?? 0,
      }),
    },
    {
      label: t('wallet.statMonthConsume'),
      value: formatQuota(current.used_quota),
      sub: t('wallet.statMonthConsumeSub'),
    },
    {
      label: t('wallet.statDailyAvg'),
      value: formatQuota(average),
      sub: t('wallet.statDailyAvgSub', { days: dayCount.value }),
    },
    {
      label: t('wallet.statTotalTopup'),
      value: formatMoney(current.total_topup ?? 0, 0),
      sub: t('wallet.statTotalTopupSub', {
        since: current.total_topup_since ?? '2026-01',
      }),
    },
  ]
})

async function loadStats(): Promise<void> {
  loading.value = true
  const result = await statsRequest.run((signal) =>
    Promise.all([
      api.get<WalletStats & { model_share: unknown }>(
        '/api/data/self',
        undefined,
        { signal }
      ),
      api.get<FlowPoint[]>('/api/data/flow/self', undefined, { signal }),
    ])
  )
  if (result.stale) return
  loading.value = false
  if (!result.ok) {
    toast.error(
      result.error instanceof ApiError
        ? result.error.message
        : String(result.error)
    )
    return
  }
  const [data, flowData] = result.value
  const { model_share: _modelShare, ...walletStats } = data
  stats.value = walletStats
  flow.value = flowData
}

function handlePaymentDone(): void {
  refreshKey.value += 1
  void loadStats()
}

onMounted(() => void loadStats())
</script>

<template>
  <div>
    <PageHero
      :title="t('wallet.title')"
      :title-accent="t('wallet.titleAccent')"
      :crumbs="[t('wallet.breadcrumb.0'), t('wallet.breadcrumb.1')]"
    >
      <template #actions>
        <div class="flex items-center gap-3" :aria-busy="loading">
          <p class="font-mono tracking-tight text-[var(--text-primary)]">
            <span class="text-lg text-[var(--text-tertiary)]">$</span>
            <span class="text-5xl font-bold">
              {{ hidden ? '••••••' : stats ? balanceDollars : '—' }}
            </span>
            <span
              v-if="!hidden && stats"
              class="text-xl text-[var(--text-secondary)]"
            >
              .{{ balanceCents }}
            </span>
          </p>
          <button
            type="button"
            class="text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-ring"
            :aria-label="
              hidden ? t('wallet.showBalance') : t('wallet.hideBalance')
            "
            @click="toggle"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                v-if="hidden"
                d="M3 3l18 18M10.5 10.7a3 3 0 0 0 4.2 4.2M7.4 7.6C4.8 9.3 3 12 3 12s3.5 6 9 6c1.6 0 3-.4 4.3-1M12 6c5.5 0 9 6 9 6s-.6 1.1-1.8 2.3"
              />
              <template v-else>
                <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                <circle cx="12" cy="12" r="3" />
              </template>
            </svg>
          </button>
        </div>
      </template>
    </PageHero>

    <ConsoleCard :padded="false" class="mb-6">
      <div
        class="grid grid-cols-2 divide-x divide-y divide-[var(--border-subtle)] lg:grid-cols-4 lg:divide-y-0"
      >
        <div v-for="card in statCards" :key="card.label" class="px-5 py-4">
          <p class="text-xs text-[var(--text-tertiary)]">{{ card.label }}</p>
          <p
            class="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]"
          >
            {{ card.value }}
          </p>
          <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
            {{ card.sub }}
          </p>
        </div>
      </div>
    </ConsoleCard>

    <div class="mb-6 grid gap-6 xl:grid-cols-[1fr_380px]">
      <TopupPanel
        v-model:payment-method="paymentMethod"
        :balance-quota="stats?.quota ?? null"
        @done="handlePaymentDone"
      />
      <RedeemPanel
        :auto-focus="activePanel === 'redeem'"
        :refresh-key="refreshKey"
        @done="handlePaymentDone"
      />
    </div>

    <div class="space-y-6">
      <FlowChart />
      <TopupRecords v-model:refresh-key="refreshKey" />
    </div>
  </div>
</template>
