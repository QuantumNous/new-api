<script setup lang="ts">
import { UserPlus } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AdminUser } from '@/types/console'
import { formatQuota } from '@/utils/format'

/**
 * Referral state by exception. Roughly half of all accounts have neither
 * invitees nor an inviter, and spelling that out as "0 invited / $0.00 / no
 * referrer" gave those rows the same visual weight as active ones. Zeroes are
 * dropped entirely so the rows that carry signal are the ones that stand out.
 */
const props = defineProps<{
  user: Pick<AdminUser, 'invited_count' | 'affiliate_quota' | 'inviter_id'>
}>()

const { t } = useI18n()

const hasInvitees = computed(() => props.user.invited_count > 0)
const hasEarnings = computed(() => props.user.affiliate_quota > 0)
const hasInviter = computed(() => props.user.inviter_id > 0)
const isDormant = computed(() => !hasInvitees.value && !hasInviter.value)

/** Symbols alone are not an accessible signal, so the block says it in full. */
const ariaLabel = computed(() => {
  if (isDormant.value) return t('users.inviteNone')
  const parts: string[] = []
  if (hasInvitees.value) {
    parts.push(t('users.invitedCount', { count: props.user.invited_count }))
  }
  if (hasEarnings.value) {
    parts.push(
      t('users.affiliateEarned', {
        amount: formatQuota(props.user.affiliate_quota),
      })
    )
  }
  if (hasInviter.value) {
    parts.push(t('users.inviterId', { id: props.user.inviter_id }))
  }
  return parts.join('，')
})
</script>

<template>
  <p
    v-if="isDormant"
    data-user-invite="dormant"
    class="text-xs text-[var(--text-tertiary)]"
  >
    <span aria-hidden="true">—</span>
    <span class="sr-only">{{ ariaLabel }}</span>
  </p>

  <div
    v-else
    data-user-invite="active"
    class="min-w-0 text-xs"
    :aria-label="ariaLabel"
    role="group"
  >
    <div v-if="hasInvitees" class="flex min-w-0 items-center gap-1.5">
      <span
        class="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold tabular-nums"
        style="background: var(--accent-soft); color: var(--accent-text)"
        aria-hidden="true"
      >
        <UserPlus :size="11" />
        {{ user.invited_count }}
      </span>
      <span
        v-if="hasEarnings"
        class="truncate tabular-nums text-[var(--text-secondary)]"
        aria-hidden="true"
      >
        {{ formatQuota(user.affiliate_quota) }}
      </span>
    </div>

    <p
      v-if="hasInviter"
      class="truncate text-[11px] text-[var(--text-tertiary)]"
      :class="{ 'mt-1': hasInvitees }"
      aria-hidden="true"
    >
      ↗ #{{ user.inviter_id }}
    </p>
  </div>
</template>
