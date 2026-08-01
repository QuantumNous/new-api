<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import OverviewKpiStrip from '@/components/console/dashboard/OverviewKpiStrip.vue'
import BalanceCard from '@/components/console/dashboard/BalanceCard.vue'
import DiscountCard from '@/components/console/dashboard/DiscountCard.vue'
import TrendDualCard from '@/components/console/dashboard/TrendDualCard.vue'
import TokenTrendCard from '@/components/console/dashboard/TokenTrendCard.vue'
import ModelDistributionCard from '@/components/console/dashboard/ModelDistributionCard.vue'
import SystemStatusCard from '@/components/console/dashboard/SystemStatusCard.vue'
import StatsKpiRow from '@/components/console/dashboard/stats/StatsKpiRow.vue'
import StatsModelTable from '@/components/console/dashboard/stats/StatsModelTable.vue'
import StatsHourlyChart from '@/components/console/dashboard/stats/StatsHourlyChart.vue'
import StatsDualTrend from '@/components/console/dashboard/stats/StatsDualTrend.vue'
import AutoRoutePanel from '@/components/console/dashboard/autoroute/AutoRoutePanel.vue'
import ContactFloatBall from '@/components/console/ContactFloatBall.vue'
import PageHero from '@/components/console/PageHero.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import { useDashboard } from '@/composables/useDashboard'
import { useDashboardStats } from '@/composables/useDashboardStats'
import type { StatsRange } from '@/composables/useDashboardStats'
import { useAuthStore } from '@/stores/auth'
import { dateInputValue } from '@/utils/format'

const { t } = useI18n()
const auth = useAuthStore()
const {
  loading,
  stats,
  share,
  flow,
  tokenTrend,
  system,
  limits,
  discounts,
  load,
} = useDashboard()
const statsComposable = useDashboardStats()

onMounted(() => void load())

/**
 * Rolling 7-day burn feeds the balance runway estimate — steadier than
 * extrapolating from a single day, which swings wildly on quiet weekends.
 */
const dailyBurn = computed(() => {
  const tail = flow.value.slice(-7)
  if (!tail.length) return undefined
  return tail.reduce((sum, point) => sum + point.consume, 0) / tail.length
})

const greeting = computed(() =>
  t('dashboard.greeting', {
    name: auth.user?.display_name || auth.user?.username || '',
  })
)

const tabs = computed(() => [
  { key: 'overview', label: t('dashboard.tabOverview') },
  { key: 'stats', label: t('dashboard.tabStats') },
  { key: 'autoroute', label: t('dashboard.autoRoute.tabLabel') },
])
const activeTab = ref('overview')
const dashboardPanelId = 'dashboard-tab-panel'

watch(activeTab, (tab) => {
  if (
    tab === 'stats' &&
    !statsComposable.data.value &&
    !statsComposable.loading.value
  ) {
    void statsComposable.load()
  }
})

watch(statsComposable.range, (range) => {
  if (activeTab.value !== 'stats') return
  if (range === 'custom') {
    // Seed a sensible window on first switch so the panel is never blank.
    if (
      !statsComposable.customStart.value ||
      !statsComposable.customEnd.value
    ) {
      statsComposable.customStart.value = dateInputValue(-13)
      statsComposable.customEnd.value = dateInputValue()
    }
    return // the date watcher below issues the request
  }
  void statsComposable.load()
})

// Refetch as the custom window changes, but only once both ends are set.
watch(
  [statsComposable.customStart, statsComposable.customEnd],
  ([start, end]) => {
    if (activeTab.value !== 'stats') return
    if (statsComposable.range.value !== 'custom') return
    if (!start || !end) return
    void statsComposable.load()
  }
)

const rangeOptions = computed(() => [
  { key: 'today', label: t('dashboard.stats.rangeToday') },
  { key: '7d', label: t('dashboard.stats.range7d') },
  { key: '30d', label: t('dashboard.stats.range30d') },
  { key: 'custom', label: t('dashboard.stats.rangeCustom') },
])
</script>

<template>
  <div>
    <PageHero
      v-model:tab="activeTab"
      :title="greeting"
      :crumbs="[$t('dashboard.breadcrumb.0'), $t('dashboard.breadcrumb.1')]"
      :tabs="tabs"
      :tab-panel-id="dashboardPanelId"
    />

    <div
      :id="dashboardPanelId"
      role="tabpanel"
      :aria-labelledby="`${dashboardPanelId}-tab-${activeTab}`"
    >
      <!-- ══════════════════════════════════════════
         Tab: Overview
    ══════════════════════════════════════════ -->
      <div v-if="activeTab === 'overview'" class="space-y-5">
        <!-- KPI strip — 4 clickable chips, jumps to Stats tab -->
        <OverviewKpiStrip
          :stats="stats"
          :flow="flow"
          :token-trend="tokenTrend"
          :limits="limits"
          :loading="loading"
          @switch-tab="activeTab = $event"
        />

        <!-- Skeleton -->
        <div v-if="loading" class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="i in 6"
            :key="i"
            class="h-48 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
          />
        </div>

        <!--
        Row-aligned grid, one narrow + one wide card per row, so every row shares
        a bottom edge and no column runs long leaving a blank strip beside the
        other. The rows pair by meaning — balance next to the spend it burns,
        system health next to token throughput, discount rate next to the
        per-model actual-vs-list table it sums up. Each card absorbs its row's
        height surplus internally (`stretch` + mt-auto/grow) instead of showing
        it as dead space in the middle. min-w-0 on every card: a grid item's
        automatic minimum size would let a chart canvas rendered at a wider
        viewport prop the track open — the canvas waits for its container to
        shrink and the container waits for the canvas, so the column never
        comes back down.
      -->
        <div v-else class="grid gap-5 xl:grid-cols-3">
          <!-- 总额度（限速已并入 KPI 条的 RPM 格） -->
          <BalanceCard
            class="min-w-0"
            :quota="stats?.quota ?? 0"
            :used-quota="stats?.used_quota ?? 0"
            :today-quota="stats?.today_quota"
            :daily-burn="dailyBurn"
          />
          <!-- 消费 / 请求 双轴趋势 -->
          <TrendDualCard
            class="min-w-0 xl:col-span-2"
            :stats="stats"
            :flow="flow"
            :loading="loading"
          />

          <!-- 系统状态 -->
          <SystemStatusCard class="min-w-0" :metrics="system" />
          <!-- Token 使用趋势 -->
          <TokenTrendCard
            class="min-w-0 xl:col-span-2"
            :points="tokenTrend"
            :loading="loading"
          />

          <!-- 折扣卡片 -->
          <DiscountCard
            class="min-w-0"
            :discounts="discounts"
            :models="share"
            :loading="loading"
          />
          <!-- 模型消费分布 -->
          <ModelDistributionCard
            class="min-w-0 xl:col-span-2"
            :items="share"
            :loading="loading"
          />
        </div>
      </div>

      <!-- ══════════════════════════════════════════
         Tab: Statistics
    ══════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'stats'" class="space-y-5">
        <!-- Range picker — same segmented control as the trend card's mode toggle -->
        <div class="flex flex-wrap items-center gap-3">
          <div
            class="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5 text-sm"
          >
            <button
              v-for="opt in rangeOptions"
              :key="opt.key"
              type="button"
              class="rounded-lg px-3 py-1.5 font-medium transition-all focus-ring"
              :class="
                statsComposable.range.value === opt.key
                  ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              "
              @click="statsComposable.range.value = opt.key as StatsRange"
            >
              {{ opt.label }}
            </button>
          </div>

          <DateRangePicker
            v-if="statsComposable.range.value === 'custom'"
            v-model:start="statsComposable.customStart.value"
            v-model:end="statsComposable.customEnd.value"
            class="w-full sm:w-64"
          />
        </div>

        <StatsKpiRow
          :kpi="statsComposable.data.value?.kpi ?? null"
          :flow="statsComposable.data.value?.flow ?? []"
          :loading="statsComposable.loading.value"
        />
        <StatsDualTrend
          :flow="statsComposable.data.value?.flow ?? []"
          :loading="statsComposable.loading.value"
        />
        <!--
        Row-aligned pair: the capped model table sets the height and the hourly
        chart grows to share its bottom edge. min-w-0 for the same canvas
        reason as the overview grid.
      -->
        <div class="grid gap-5 lg:grid-cols-2">
          <StatsModelTable
            class="min-w-0"
            :models="statsComposable.data.value?.models ?? []"
            :loading="statsComposable.loading.value"
          />
          <StatsHourlyChart
            class="min-w-0"
            :hourly="statsComposable.data.value?.hourly ?? []"
            :loading="statsComposable.loading.value"
          />
        </div>
      </div>

      <!-- ══════════════════════════════════════════
         Tab: Auto Route
    ══════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'autoroute'">
        <AutoRoutePanel />
      </div>
    </div>

    <ContactFloatBall />
  </div>
</template>
