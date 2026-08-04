<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Activity,
  ArrowUpRight,
  Award,
  BarChart3,
  WalletCards,
} from 'lucide-vue-next'

import PageHero from '@/components/console/PageHero.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { adminUserRoleTone } from '@/constants/adminUsers'
import { useDashboard } from '@/composables/useDashboard'
import { useAuthStore } from '@/stores/auth'
import { formatCompact, formatDate, formatQuota } from '@/utils/format'
import AccountSettingsView from '@/views/console/AccountSettingsView.vue'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const { stats, load: loadDashboard } = useDashboard()

onMounted(() => {
  void loadDashboard()
})

const initial = computed(() =>
  (auth.user?.display_name || auth.user?.username || 'U')
    .slice(0, 1)
    .toUpperCase()
)

const memberNo = computed(
  () => `RH-${String(auth.user?.id ?? 0).padStart(7, '0')}`
)

const roleName = computed(() => {
  const role = auth.user?.role ?? 0
  if (role >= 100) return t('profile.roleRoot')
  if (role >= 10) return t('profile.roleAdmin')
  return t('profile.roleUser')
})

const roleChipTone = computed(() => adminUserRoleTone(auth.user?.role ?? 0))
const joinedDays = 35
const joinDate = computed(() => {
  const timestamp = Math.floor(Date.now() / 1000) - joinedDays * 86_400
  return formatDate(timestamp)
})

const tier = computed(() => {
  const used = auth.user?.used_quota ?? 0
  if (used >= 50_000_000) {
    return {
      name: t('profile.tierDiamond'),
      progress: 100,
      nextName: '',
      next: null as null | number,
    }
  }
  if (used >= 20_000_000) {
    return {
      name: t('profile.tierPlatinum'),
      progress: Math.round(((used - 20_000_000) / 30_000_000) * 100),
      nextName: t('profile.tierDiamond'),
      next: 50_000_000,
    }
  }
  if (used >= 5_000_000) {
    return {
      name: t('profile.tierGold'),
      progress: Math.round(((used - 5_000_000) / 15_000_000) * 100),
      nextName: t('profile.tierPlatinum'),
      next: 20_000_000,
    }
  }
  if (used >= 1_000_000) {
    return {
      name: t('profile.tierSilver'),
      progress: Math.round(((used - 1_000_000) / 4_000_000) * 100),
      nextName: t('profile.tierGold'),
      next: 5_000_000,
    }
  }
  return {
    name: t('profile.tierBronze'),
    progress: Math.round((used / 1_000_000) * 100),
    nextName: t('profile.tierSilver'),
    next: 1_000_000,
  }
})

const accountStats = computed(() => [
  {
    label: t('profile.balance'),
    value: formatQuota(auth.user?.quota ?? 0),
    destination: t('nav.wallet'),
    route: 'wallet',
    icon: WalletCards,
  },
  {
    label: t('profile.totalUsage'),
    value: formatQuota(auth.user?.used_quota ?? 0),
    destination: t('nav.logs'),
    route: 'logs',
    icon: BarChart3,
  },
  {
    label: t('profile.apiRequests'),
    value: formatCompact(stats.value?.total_requests ?? 0),
    destination: t('nav.logs'),
    route: 'logs',
    icon: Activity,
  },
])
</script>

<template>
  <div class="space-y-8 lg:space-y-10" data-handdrawn-page="profile">
    <PageHero
      :title="t('profile.title')"
      :crumbs="[t('profile.breadcrumb.0'), t('profile.breadcrumb.1')]"
      title-side="right"
    >
      <p class="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-tertiary)]">
        {{ t('profile.subtitle') }}
      </p>
    </PageHero>

    <section
      class="profile-identity pencil-surface-strong relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-6 shadow-[var(--card-shadow)] sm:p-8"
      data-handdrawn="surface-strong"
    >
      <div
        class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-6"
      >
        <div
          class="flex size-16 shrink-0 items-center justify-center rounded-xl text-2xl font-bold shadow-[var(--card-shadow)]"
          style="background: var(--accent); color: var(--accent-contrast)"
          aria-hidden="true"
        >
          {{ initial }}
        </div>

        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2.5">
            <h2
              class="min-w-0 break-words text-xl font-bold text-[var(--text-primary)] sm:text-2xl"
            >
              {{ auth.user?.display_name || auth.user?.username }}
            </h2>
            <StatusChip :tone="roleChipTone">{{ roleName }}</StatusChip>
          </div>
          <p
            class="mt-1.5 flex flex-wrap items-center gap-x-2 font-mono text-sm text-[var(--text-tertiary)]"
          >
            <span>@{{ auth.user?.username }}</span>
            <span aria-hidden="true" class="opacity-40">&middot;</span>
            <span class="whitespace-nowrap">{{ memberNo }}</span>
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style="background: var(--accent-soft); color: var(--accent-text)"
            >
              <Award :size="13" aria-hidden="true" />
              {{ tier.name }}
            </span>
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style="
                background: var(--status-success-soft);
                color: var(--status-success-text);
              "
            >
              <span class="size-1.5 rounded-full bg-[var(--status-success)]" />
              {{ t('profile.accountStatus') }} &middot;
              {{ t('profile.normal') }}
            </span>
          </div>
        </div>

        <dl
          class="col-span-2 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--border-subtle)] pt-5 text-left sm:grid-cols-4 md:col-span-1 md:grid-cols-2 md:border-l md:border-t-0 md:pl-8 md:pt-0 md:text-right"
        >
          <div>
            <dt class="text-[11px] text-[var(--text-tertiary)]">
              {{ t('profile.joinDate') }}
            </dt>
            <dd class="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {{ joinDate }}
            </dd>
          </div>
          <div>
            <dt class="text-[11px] text-[var(--text-tertiary)]">
              {{ t('profile.memberDuration') }}
            </dt>
            <dd class="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {{ t('profile.days', { n: joinedDays }) }}
            </dd>
          </div>
          <div>
            <dt class="text-[11px] text-[var(--text-tertiary)]">
              {{ t('profile.totalCalls') }}
            </dt>
            <dd class="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {{ formatCompact(stats?.total_requests ?? 0) }}
            </dd>
          </div>
          <div>
            <dt class="text-[11px] text-[var(--text-tertiary)]">
              {{ t('profile.maxConcurrency') }}
            </dt>
            <dd class="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              500
            </dd>
          </div>
        </dl>
      </div>

      <div class="mt-6 border-t border-[var(--border-subtle)] pt-5">
        <div
          class="mb-2.5 flex flex-col items-start gap-2 text-xs sm:flex-row sm:items-center sm:justify-between"
        >
          <span
            class="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]"
          >
            <Award
              :size="14"
              class="text-[var(--accent-text)]"
              aria-hidden="true"
            />
            {{ tier.name }}
          </span>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span v-if="tier.next" class="text-[var(--text-tertiary)]">
              {{ t('profile.progressToNext', { tier: tier.nextName }) }}
              <strong class="ml-1 text-[var(--accent-text)]"
                >{{ tier.progress }}%</strong
              >
            </span>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-md px-1 text-[var(--accent-text)] transition-opacity hover:opacity-70 focus-ring"
              @click="router.push({ name: 'farm' })"
            >
              {{ t('profile.viewTierBenefits') }}
              <ArrowUpRight :size="13" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div
          class="pencil-progress h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
        >
          <div
            class="h-full rounded-full transition-all duration-700"
            style="background: var(--accent)"
            :style="{ width: `${tier.progress}%` }"
          />
        </div>
      </div>
    </section>

    <section
      class="grid gap-5 sm:grid-cols-3"
      :aria-label="t('profile.accountStats')"
    >
      <button
        v-for="stat in accountStats"
        :key="stat.label"
        type="button"
        class="pencil-surface group min-h-32 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-5 py-5 text-left shadow-[var(--card-shadow)] transition-all hover:border-[var(--border-strong)] hover:shadow-[var(--card-shadow-hover)] focus-ring sm:px-6"
        data-handdrawn="surface"
        @click="router.push({ name: stat.route })"
      >
        <span class="flex items-start justify-between gap-4">
          <span class="text-xs text-[var(--text-tertiary)]">{{
            stat.label
          }}</span>
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--accent-text)]"
          >
            <component :is="stat.icon" :size="16" aria-hidden="true" />
          </span>
        </span>
        <strong class="mt-3 block text-2xl text-[var(--text-primary)]">{{
          stat.value
        }}</strong>
        <span
          class="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--accent-text)]"
        >
          {{ stat.destination }}
          <ArrowUpRight :size="12" aria-hidden="true" />
        </span>
      </button>
    </section>

    <section class="space-y-7 pt-2" data-testid="profile-settings">
      <header class="profile-settings-heading" data-handdrawn="section-heading">
        <div class="min-w-0">
          <p
            class="font-mono text-[10px] font-semibold text-[var(--accent-text)]"
          >
            {{ t('profile.settingsSectionEyebrow') }}
          </p>
          <h2
            class="gesture-mark mt-2 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl"
          >
            {{ t('profile.settingsSectionTitle') }}
          </h2>
          <p
            class="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-tertiary)]"
          >
            {{ t('profile.settingsSectionSubtitle') }}
          </p>
        </div>
        <span class="profile-settings-stroke" aria-hidden="true" />
      </header>

      <AccountSettingsView embedded />
    </section>
  </div>
</template>

<style scoped>
.profile-identity::before {
  position: absolute;
  top: 0.75rem;
  right: 8%;
  left: 4%;
  height: 1px;
  background: var(--border-subtle);
  content: '';
  opacity: 0.65;
  transform: rotate(-0.18deg);
}

.profile-settings-heading {
  display: grid;
  grid-template-columns: minmax(16rem, auto) minmax(3rem, 1fr);
  align-items: end;
  gap: 2rem;
}

.profile-settings-stroke {
  height: 2px;
  margin-bottom: 0.45rem;
  background: var(--border-strong);
  box-shadow: 0 5px 0 -4px var(--accent);
  opacity: 0.75;
  transform: rotate(-0.22deg);
}

@media (max-width: 640px) {
  .profile-settings-heading {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }

  .profile-settings-stroke {
    margin-bottom: 0;
  }
}
</style>
