<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PageHero from '@/components/console/PageHero.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { adminUserRoleTone } from '@/constants/adminUsers'
import { useAuthStore } from '@/stores/auth'
import { useSettingsPrototypeStore } from '@/stores/settingsPrototype'
import { useDashboard } from '@/composables/useDashboard'
import { formatQuota, formatCompact, formatDate } from '@/utils/format'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const settingsPrototype = useSettingsPrototypeStore()
const { stats, load: loadDash } = useDashboard()

settingsPrototype.initialize(auth.user)

onMounted(() => {
  void loadDash()
})

// ── derived user fields ───────────────────────────────────
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
// Shared with the user-management table so both read the same role ladder.
const roleChipTone = computed(() => adminUserRoleTone(auth.user?.role ?? 0))

// Join date: approx 35 days before today
const joinDate = computed(() => {
  const ts = Math.floor(Date.now() / 1000) - 35 * 86_400
  return formatDate(ts)
})
const joinedDays = 35

// ── tier (5-level from farm rebate ladder) ────────────────
const tier = computed(() => {
  const used = auth.user?.used_quota ?? 0
  if (used >= 50_000_000)
    return {
      name: t('profile.tierDiamond'),
      badge: '👑',
      pct: 100,
      nextName: '',
      next: null as null | number,
    }
  if (used >= 20_000_000)
    return {
      name: t('profile.tierPlatinum'),
      badge: '💎',
      pct: Math.round(((used - 20_000_000) / 30_000_000) * 100),
      nextName: t('profile.tierDiamond'),
      next: 50_000_000,
    }
  if (used >= 5_000_000)
    return {
      name: t('profile.tierGold'),
      badge: '🥇',
      pct: Math.round(((used - 5_000_000) / 15_000_000) * 100),
      nextName: t('profile.tierPlatinum'),
      next: 20_000_000,
    }
  if (used >= 1_000_000)
    return {
      name: t('profile.tierSilver'),
      badge: '🥈',
      pct: Math.round(((used - 1_000_000) / 4_000_000) * 100),
      nextName: t('profile.tierGold'),
      next: 5_000_000,
    }
  return {
    name: t('profile.tierBronze'),
    badge: '🥉',
    pct: Math.round((used / 1_000_000) * 100),
    nextName: t('profile.tierSilver'),
    next: 1_000_000,
  }
})

const emailBound = computed(() => Boolean(auth.user?.email))

// ── quick nav items ───────────────────────────────────────
const navItems = computed(() => [
  {
    label: t('profile.goWallet'),
    icon: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6ZM3 10h18M8 15h4',
    route: 'wallet',
  },
  {
    label: t('profile.goInvite'),
    icon: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM19 8v6M22 11h-6',
    route: 'invite',
  },
  {
    label: t('profile.goKeys'),
    icon: 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 0 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4zM16.5 7.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z',
    route: 'keys',
  },
  {
    label: t('profile.goLogs'),
    icon: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2ZM9 13h6M9 17h6',
    route: 'logs',
  },
  {
    label: t('profile.goSettings'),
    icon: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    route: 'settings',
  },
])
</script>

<template>
  <div class="space-y-6" data-handdrawn-page="profile">
    <!-- ① Page title -->
    <PageHero
      :title="t('profile.title')"
      :crumbs="[$t('profile.breadcrumb.0'), $t('profile.breadcrumb.1')]"
    >
      <p class="mt-1 max-w-xl text-sm text-[var(--text-tertiary)]">
        {{ t('profile.subtitle') }}
      </p>
    </PageHero>

    <!-- ② Identity card — pure CSS gradient, on-theme -->
    <section
      class="profile-identity pencil-surface-strong rounded-2xl border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)] sm:p-8"
      data-handdrawn="surface-strong"
      style="
        background: linear-gradient(
          105deg,
          var(--signal-soft) 0%,
          var(--surface-solid) 48%,
          var(--accent-soft) 100%
        );
      "
    >
      <div
        class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 sm:gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto]"
      >
        <!-- avatar -->
        <div
          class="flex size-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold shadow-[var(--card-shadow)]"
          style="background: var(--accent); color: var(--accent-contrast)"
        >
          {{ initial }}
        </div>

        <!-- name + badges -->
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2
              class="min-w-0 break-words text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              {{ auth.user?.display_name || auth.user?.username }}
            </h2>
            <StatusChip :tone="roleChipTone">{{ roleName }}</StatusChip>
          </div>
          <p
            class="mt-1 flex flex-wrap items-center gap-x-1.5 font-mono text-sm text-[var(--text-tertiary)]"
          >
            <span>@{{ auth.user?.username }}</span>
            <span aria-hidden="true" class="opacity-40">·</span>
            <span class="whitespace-nowrap">{{ memberNo }}</span>
          </p>
          <div class="mt-2.5 flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
              style="background: var(--accent-soft); color: var(--accent-text)"
            >
              {{ tier.badge }} {{ tier.name }}
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
              style="
                background: var(--status-success-soft);
                color: var(--status-success-text);
              "
            >
              <span class="size-1.5 rounded-full bg-[var(--status-success)]" />
              {{ t('profile.accountStatus') }} · {{ t('profile.normal') }}
            </span>
          </div>
        </div>

        <!-- right meta grid -->
        <div
          class="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 text-left sm:grid-cols-4 md:col-span-1 md:grid-cols-2 md:gap-x-8 md:text-right"
        >
          <div>
            <p
              class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]"
            >
              {{ t('profile.joinDate') }}
            </p>
            <p class="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
              {{ joinDate }}
            </p>
          </div>
          <div>
            <p
              class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]"
            >
              {{ t('profile.memberDuration') }}
            </p>
            <p class="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
              {{ t('profile.days', { n: joinedDays }) }}
            </p>
          </div>
          <div>
            <p
              class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]"
            >
              {{ t('profile.totalCalls') }}
            </p>
            <p class="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
              {{ formatCompact(stats?.total_requests ?? 0) }}
            </p>
          </div>
          <div>
            <p
              class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]"
            >
              {{ t('profile.maxConcurrency') }}
            </p>
            <p class="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
              500
            </p>
          </div>
        </div>
      </div>

      <!-- tier progress -->
      <div class="mt-5 border-t border-[var(--border-subtle)] pt-4">
        <div
          class="mb-2 flex flex-col items-start gap-2 text-xs sm:flex-row sm:items-center sm:justify-between"
        >
          <span class="font-semibold text-[var(--text-primary)]">
            {{ tier.badge }} {{ tier.name }}
          </span>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span v-if="tier.next" class="text-[var(--text-tertiary)]">
              {{ t('profile.progressToNext', { tier: tier.nextName }) }}
              <span class="ml-1 font-semibold text-[var(--accent-text)]"
                >{{ tier.pct }}%</span
              >
            </span>
            <button
              type="button"
              class="text-[var(--accent-text)] transition-opacity hover:opacity-70"
              @click="router.push({ name: 'farm' })"
            >
              {{ t('profile.viewTierBenefits') }}
            </button>
          </div>
        </div>
        <div
          class="pencil-progress h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
        >
          <div
            class="h-full rounded-full transition-all duration-700"
            style="background: var(--accent)"
            :style="{ width: `${tier.pct}%` }"
          />
        </div>
      </div>
    </section>

    <!-- ③ Account stats row -->
    <section class="grid gap-4 sm:grid-cols-3">
      <div
        v-for="stat in [
          {
            label: t('profile.balance'),
            value: formatQuota(auth.user?.quota ?? 0),
            icon: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6ZM3 10h18M8 15h4',
            sub: t('nav.wallet'),
            route: 'wallet',
          },
          {
            label: t('profile.totalUsage'),
            value: formatQuota(auth.user?.used_quota ?? 0),
            icon: 'M18 20V10M12 20V4M6 20v-6',
            sub: t('nav.logs'),
            route: 'logs',
          },
          {
            label: t('profile.apiRequests'),
            value: formatCompact(stats?.total_requests ?? 0),
            icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
            sub: t('nav.logs'),
            route: 'logs',
          },
        ]"
        :key="stat.label"
        class="pencil-surface group cursor-pointer rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-5 py-4 shadow-[var(--card-shadow)] transition-all hover:border-[var(--border-strong)] hover:shadow-[var(--card-shadow-hover)] focus-ring"
        data-handdrawn="surface"
        tabindex="0"
        role="button"
        @click="router.push({ name: stat.route })"
        @keydown.enter="router.push({ name: stat.route })"
        @keydown.space.prevent="router.push({ name: stat.route })"
      >
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs text-[var(--text-tertiary)]">{{ stat.label }}</p>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-text)"
            stroke-width="1.8"
            class="shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          >
            <path :d="stat.icon" />
          </svg>
        </div>
        <p class="mt-2 text-2xl font-bold text-[var(--text-primary)]">
          {{ stat.value }}
        </p>
        <p class="mt-1 text-[10px] text-[var(--text-tertiary)]">
          → {{ stat.sub }}
        </p>
      </div>
    </section>

    <!-- ④ Two-column content -->
    <div class="grid gap-5 lg:grid-cols-3">
      <!-- LEFT: personal info + security -->
      <div class="space-y-5 lg:col-span-2">
        <!-- 个人资料 -->
        <article
          class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)]"
          data-handdrawn="surface"
        >
          <header
            class="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4"
          >
            <div class="flex items-center gap-2.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-text)"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <path
                  d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.3 3-5 7-5s7 1.7 7 5v1H5v-1Z"
                />
              </svg>
              <h3 class="text-sm font-semibold text-[var(--text-primary)]">
                {{ t('profile.personalInfo') }}
              </h3>
            </div>
            <button
              type="button"
              class="text-xs text-[var(--accent-text)] transition-opacity hover:opacity-70 focus-ring rounded-md px-1"
              @click="router.push({ name: 'settings' })"
            >
              {{ t('profile.editInSettings') }}
            </button>
          </header>

          <div
            class="divide-y divide-[var(--border-subtle)]"
            data-handdrawn="ledger-rows"
          >
            <div
              v-for="row in [
                {
                  label: t('profile.displayName'),
                  value: auth.user?.display_name || '—',
                },
                {
                  label: t('profile.username'),
                  value: auth.user?.username || '—',
                },
                { label: t('profile.email'), value: auth.user?.email || '—' },
                { label: t('profile.memberNo'), value: memberNo, mono: true },
                {
                  label: t('profile.userId'),
                  value: `#${auth.user?.id}`,
                  mono: true,
                },
              ]"
              :key="row.label"
              class="flex items-center justify-between px-5 py-3"
            >
              <span class="text-sm text-[var(--text-secondary)]">{{
                row.label
              }}</span>
              <span
                class="profile-row-value text-sm font-medium text-[var(--text-primary)]"
                :class="{ 'font-mono text-xs': 'mono' in row && row.mono }"
              >
                {{ row.value }}
              </span>
            </div>
          </div>
        </article>

        <!-- 账户安全 -->
        <article
          class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)]"
          data-handdrawn="surface"
        >
          <header
            class="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4"
          >
            <div class="flex items-center gap-2.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-text)"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <path
                  d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3Z"
                />
              </svg>
              <h3 class="text-sm font-semibold text-[var(--text-primary)]">
                {{ t('profile.security') }}
              </h3>
            </div>
            <button
              type="button"
              class="text-xs text-[var(--accent-text)] transition-opacity hover:opacity-70 focus-ring rounded-md px-1"
              @click="router.push({ name: 'settings' })"
            >
              {{ t('profile.toSettings') }}
            </button>
          </header>

          <div
            class="divide-y divide-[var(--border-subtle)]"
            data-handdrawn="ledger-rows"
          >
            <!-- password -->
            <div class="flex items-center justify-between px-5 py-3">
              <span class="text-sm text-[var(--text-secondary)]">{{
                t('profile.passwordStatus')
              }}</span>
              <StatusChip tone="success">{{
                t('profile.passwordSet')
              }}</StatusChip>
            </div>

            <!-- 2FA -->
            <div class="flex items-center justify-between px-5 py-3">
              <span class="text-sm text-[var(--text-secondary)]">{{
                t('profile.twoFA')
              }}</span>
              <StatusChip
                :tone="settingsPrototype.twoFAEnabled ? 'success' : 'neutral'"
              >
                {{
                  settingsPrototype.twoFAEnabled
                    ? t('profile.twoFAEnabled')
                    : t('profile.twoFADisabled')
                }}
              </StatusChip>
            </div>

            <!-- bindings -->
            <div class="px-5 py-4">
              <p class="mb-3 text-xs font-medium text-[var(--text-tertiary)]">
                {{ t('profile.bindings') }}
              </p>
              <div class="space-y-2">
                <div
                  v-for="binding in [
                    {
                      label: t('profile.bindingEmail'),
                      bound: emailBound,
                      value: auth.user?.email,
                    },
                    {
                      label: t('profile.bindingGithub'),
                      bound: settingsPrototype.githubBound,
                      value: null,
                    },
                  ]"
                  :key="binding.label"
                  class="profile-binding-row flex items-center justify-between rounded-xl border border-[var(--border-subtle)] px-4 py-2.5"
                >
                  <span class="text-sm text-[var(--text-primary)]">{{
                    binding.label
                  }}</span>
                  <div class="profile-binding-value flex items-center gap-2">
                    <span
                      v-if="binding.bound && binding.value"
                      class="profile-binding-text font-mono text-xs text-[var(--text-tertiary)]"
                      >{{ binding.value }}</span
                    >
                    <StatusChip :tone="binding.bound ? 'success' : 'neutral'">
                      {{
                        binding.bound
                          ? t('profile.bindingBound')
                          : t('profile.bindingUnbound')
                      }}
                    </StatusChip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <!-- RIGHT: quick nav -->
      <div class="space-y-5">
        <!-- 快速导航 -->
        <article
          class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)]"
          data-handdrawn="surface"
        >
          <header
            class="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-5 py-4"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-text)"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t('profile.quickNav') }}
            </h3>
          </header>

          <div
            class="divide-y divide-[var(--border-subtle)]"
            data-handdrawn="ledger-rows"
          >
            <button
              v-for="item in navItems"
              :key="item.route"
              type="button"
              class="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--surface-muted)] focus-ring"
              @click="router.push({ name: item.route })"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-text)"
                stroke-width="1.8"
                class="shrink-0 opacity-70"
                aria-hidden="true"
              >
                <path :d="item.icon" />
              </svg>
              <span class="flex-1 text-sm text-[var(--text-primary)]">{{
                item.label
              }}</span>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-tertiary)"
                stroke-width="2"
                class="shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
