<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { InviteRecordStatus } from '@/types/console'
import InviteAffiliateCard from '@/components/console/invite/InviteAffiliateCard.vue'
import InviteMonthChart from '@/components/console/invite/InviteMonthChart.vue'
import InviteQualificationCard from '@/components/console/invite/InviteQualificationCard.vue'
import InviteRebateCard from '@/components/console/invite/InviteRebateCard.vue'
import PageHero from '@/components/console/PageHero.vue'
import AmountInput from '@/components/common/AmountInput.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { useInvite } from '@/composables/useInvite'
import { formatDate, formatQuota, QUOTA_PER_DOLLAR } from '@/utils/format'

const { t } = useI18n()
const {
  info,
  inviteLink,
  avgReward,
  rebatePercent,
  transferOpen,
  transferDollars,
  transferring,
  load,
  copyCode,
  copyLink,
  shareX,
  shareTelegram,
  shareEmail,
  transfer,
} = useInvite()

type SortMode = 'recent' | 'early'
const sort = ref<SortMode>('recent')

const sortedRecords = computed(() => {
  const rows = info.value?.records ?? []
  return sort.value === 'recent' ? rows : [...rows].reverse()
})

const statusTone: Record<
  InviteRecordStatus,
  'success' | 'warning' | 'neutral'
> = {
  valid: 'success',
  pending: 'warning',
  invalid: 'neutral',
}

/** Anonymize the invitee handle: user_1042 → u***2 (contract: no raw id). */
function maskInvitee(handle: string): string {
  if (handle.length <= 2) return handle
  return `${handle[0]}***${handle[handle.length - 1]}`
}

const howSteps = [1, 2, 3, 4]
const faqs = [1, 2, 3, 4]

onMounted(load)
</script>

<template>
  <div>
    <PageHero
      :title="t('invite.title')"
      :crumbs="[$t('invite.breadcrumb.0'), $t('invite.breadcrumb.1')]"
    >
      <template #actions>
        <div class="text-right">
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('invite.heroTotal') }}
          </p>
          <p
            class="text-3xl font-bold tracking-tight text-[var(--text-primary)]"
          >
            {{ info ? formatQuota(info.reward_total) : '--' }}
          </p>
        </div>
      </template>
    </PageHero>

    <!-- stat cards -->
    <div class="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <ConsoleCard>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('invite.invitedCount') }}
        </p>
        <p class="mt-1.5 text-2xl font-bold text-[var(--text-primary)]">
          {{ info ? t('invite.people', { count: info.invited }) : '--' }}
        </p>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]">
          {{ t('invite.invitedCountHint') }}
        </p>
      </ConsoleCard>

      <ConsoleCard>
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs text-[var(--text-tertiary)]">
              {{ t('invite.transferable') }}
            </p>
            <p class="mt-1.5 text-2xl font-bold text-[var(--accent-text)]">
              {{ info ? formatQuota(info.transferable) : '--' }}
            </p>
          </div>
          <ConsoleButton
            size="sm"
            :disabled="!info?.transferable"
            @click="transferOpen = true"
          >
            {{ t('invite.transfer') }}
          </ConsoleButton>
        </div>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]">
          {{ t('invite.transferableHint') }}
        </p>
      </ConsoleCard>

      <ConsoleCard>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('invite.rate') }}
        </p>
        <p class="mt-1.5 text-2xl font-bold text-[var(--accent-text)]">
          {{ info ? `${rebatePercent}%` : '--' }}
        </p>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]">
          {{ t('invite.rateHint') }}
        </p>
      </ConsoleCard>

      <ConsoleCard>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('invite.avgReward') }}
        </p>
        <p class="mt-1.5 text-2xl font-bold text-[var(--text-primary)]">
          {{ info ? formatQuota(avgReward) : '--' }}
        </p>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]">
          {{ t('invite.avgRewardHint') }}
        </p>
      </ConsoleCard>
    </div>

    <!-- affiliate + invitees -->
    <div class="grid gap-5 lg:grid-cols-[1fr_360px]">
      <InviteAffiliateCard
        :code="info?.code ?? ''"
        :invite-link="inviteLink"
        :rebate-percent="rebatePercent"
        @copy-code="copyCode"
        @copy-link="copyLink"
        @share-x="shareX"
        @share-telegram="shareTelegram"
        @share-email="shareEmail"
      />

      <!-- Wrapper contributes no intrinsic height on desktop (its child is
           absolute), so the affiliate card alone drives the row height — no
           blank space there. The invitee card fills that height and its list
           scrolls. On mobile (no lg:) it's static and fully expands. -->
      <div class="lg:relative">
        <section
          class="flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)] lg:absolute lg:inset-0"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-3 px-5 pt-4"
          >
            <h3
              class="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
            >
              {{ t('invite.invitees') }}
              <StatusChip tone="neutral">{{
                t('invite.people', { count: info?.invited ?? 0 })
              }}</StatusChip>
            </h3>
            <div class="flex gap-1 rounded-lg bg-[var(--surface-muted)] p-0.5">
              <button
                v-for="s in ['recent', 'early'] as SortMode[]"
                :key="s"
                type="button"
                class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                :style="
                  sort === s
                    ? 'background:var(--surface-solid);color:var(--text-primary)'
                    : 'color:var(--text-tertiary)'
                "
                @click="sort = s"
              >
                {{
                  s === 'recent'
                    ? t('invite.sortRecent')
                    : t('invite.sortEarly')
                }}
              </button>
            </div>
          </div>

          <ul
            class="subtle-scroll mt-2 divide-y divide-[var(--border-subtle)] px-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          >
            <li
              v-for="record in sortedRecords"
              :key="record.id"
              class="flex items-center justify-between gap-3 py-3"
            >
              <div class="flex min-w-0 items-center gap-2.5">
                <span
                  class="inline-flex shrink-0 items-center rounded-md bg-[var(--surface-muted)] px-2.5 py-0.5 font-mono text-xs tracking-wide text-[var(--text-secondary)]"
                >
                  {{ maskInvitee(record.invitee) }}
                </span>
                <StatusChip :tone="statusTone[record.status]">
                  {{ t(`invite.status.${record.status}`) }}
                </StatusChip>
              </div>
              <div class="text-right">
                <p class="text-sm font-semibold text-[var(--text-primary)]">
                  {{
                    record.reward > 0 ? `+${formatQuota(record.reward)}` : '—'
                  }}
                </p>
                <p class="text-xs text-[var(--text-tertiary)]">
                  {{ formatDate(record.created) }}
                </p>
              </div>
            </li>
            <li
              v-if="info && info.records.length === 0"
              class="py-10 text-center text-sm text-[var(--text-tertiary)]"
            >
              {{ t('common.none') }}
            </li>
          </ul>

          <p
            class="shrink-0 border-t border-[var(--border-subtle)] px-5 py-3 text-xs text-[var(--text-tertiary)]"
          >
            {{ t('invite.inviteesNote') }}
          </p>
        </section>
      </div>
    </div>

    <!-- qualification -->
    <div v-if="info" class="mt-5">
      <InviteQualificationCard
        :qualification="info.qualification"
        :channels="info.unlock_channels"
      />
    </div>

    <!-- chart + rebate -->
    <div class="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
      <InviteMonthChart v-if="info" :series="info.monthly_series" />
      <div
        v-else
        class="h-72 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
      />

      <InviteRebateCard
        v-if="info"
        :transferable="info.transferable"
        :pending-reward="info.pending_reward"
        :reward-total="info.reward_total"
        :invited="info.invited"
        @transfer="transferOpen = true"
      />
      <div
        v-else
        class="h-72 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
      />
    </div>

    <!-- how it works -->
    <section class="mt-8">
      <h3 class="mb-4 text-lg font-bold text-[var(--text-primary)]">
        {{ t('invite.howTitle') }}
      </h3>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="n in howSteps"
          :key="n"
          class="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5"
        >
          <span class="text-2xl font-bold text-[var(--accent-text)]"
            >0{{ n }}</span
          >
          <p class="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {{ t(`invite.howStep${n}Title`) }}
          </p>
          <p class="mt-1.5 text-xs leading-relaxed text-[var(--text-tertiary)]">
            {{ t(`invite.howStep${n}Desc`, { rate: rebatePercent }) }}
          </p>
        </div>
      </div>
    </section>

    <!-- faq -->
    <section class="mt-8">
      <h3 class="mb-4 text-lg font-bold text-[var(--text-primary)]">
        {{ t('invite.faqTitle') }}
      </h3>
      <div class="space-y-3">
        <details
          v-for="n in faqs"
          :key="n"
          class="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-5"
        >
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-medium text-[var(--text-primary)]"
          >
            {{ t(`invite.faqQ${n}`) }}
            <svg
              class="shrink-0 text-[var(--text-tertiary)] transition-transform group-open:rotate-180"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <p class="pb-4 text-sm leading-relaxed text-[var(--text-tertiary)]">
            {{ t(`invite.faqA${n}`, { rate: rebatePercent }) }}
          </p>
        </details>
      </div>
    </section>

    <!-- transfer modal -->
    <ConsoleModal
      :open="transferOpen"
      :title="t('invite.transferTitle')"
      :subtitle="t('invite.transferHint')"
      size="sm"
      @close="transferOpen = false"
    >
      <div class="space-y-3">
        <AmountInput
          v-model="transferDollars"
          :placeholder="formatQuota(info?.transferable ?? 0)"
          :min="0"
        />
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('invite.transferable') }}:
          {{ formatQuota(info?.transferable ?? 0) }}
        </p>
      </div>
      <template #footer>
        <ConsoleButton
          size="lg"
          block
          :loading="transferring"
          :disabled="
            !transferDollars ||
            (info?.transferable ?? 0) < transferDollars * QUOTA_PER_DOLLAR
          "
          @click="transfer"
        >
          {{ t('common.confirm') }}
        </ConsoleButton>
      </template>
    </ConsoleModal>
  </div>
</template>
