<script setup lang="ts">
import { Mail } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import IconButton from '@/components/common/IconButton.vue'
import { formatQuota } from '@/utils/format'

defineProps<{
  code: string
  inviteLink: string
  rewardPerInvite: number
}>()

const emit = defineEmits<{
  copyCode: []
  copyLink: []
  shareX: []
  shareTelegram: []
  shareEmail: []
}>()

const { t } = useI18n()
</script>

<template>
  <section
    class="pencil-surface sketch-card min-w-0 border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-6"
    data-handdrawn="surface"
  >
    <span
      class="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold uppercase text-[var(--accent-text)]"
    >
      {{ t('invite.affiliateTag') }}
    </span>

    <h2 class="mt-4 text-2xl font-bold leading-snug text-[var(--text-primary)]">
      {{ t('invite.affiliateHeadline') }}
      <span class="text-[var(--accent-text)]">
        {{
          t('invite.affiliateHeadlineAccent', {
            reward: formatQuota(rewardPerInvite),
          })
        }}
      </span>
    </h2>
    <p
      class="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-tertiary)]"
    >
      {{ t('invite.affiliateSubheadline') }}
    </p>

    <div class="mt-6 grid gap-4 md:grid-cols-2">
      <div>
        <p class="mb-1.5 text-xs text-[var(--text-tertiary)]">
          {{ t('invite.inviteCode') }}
        </p>
        <div class="flex gap-2">
          <code
            class="flex min-w-0 flex-1 items-center truncate rounded-xl bg-[var(--surface-muted)] px-4 py-2.5 font-mono text-lg font-bold text-[var(--text-primary)]"
          >
            {{ code || '…' }}
          </code>
          <ConsoleButton variant="secondary" @click="emit('copyCode')">
            {{ t('invite.copyCode') }}
          </ConsoleButton>
        </div>
      </div>

      <div>
        <p class="mb-1.5 text-xs text-[var(--text-tertiary)]">
          {{ t('invite.inviteLink') }}
        </p>
        <div class="flex gap-2">
          <code
            class="min-w-0 flex-1 truncate rounded-xl bg-[var(--surface-muted)] px-4 py-2.5 text-sm text-[var(--text-secondary)]"
          >
            {{ inviteLink || '…' }}
          </code>
          <ConsoleButton @click="emit('copyLink')">
            {{ t('invite.copyLink') }}
          </ConsoleButton>
        </div>
      </div>
    </div>

    <div
      class="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4"
    >
      <span class="mr-1 text-xs text-[var(--text-tertiary)]">
        {{ t('invite.shareLabel') }}
      </span>
      <IconButton :label="t('invite.shareX')" @click="emit('shareX')">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"
          />
        </svg>
      </IconButton>
      <IconButton
        :label="t('invite.shareTelegram')"
        @click="emit('shareTelegram')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M21.94 4.6 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.46-2.27 2.18c-.25.25-.46.46-.94.46l.33-4.78 8.7-7.86c.38-.34-.08-.53-.59-.19L6.98 13.2l-4.63-1.45c-1-.31-1.03-1 .21-1.48l18.1-6.98c.84-.31 1.57.2 1.28 1.31Z"
          />
        </svg>
      </IconButton>
      <IconButton :label="t('invite.shareEmail')" @click="emit('shareEmail')">
        <Mail :size="16" />
      </IconButton>
      <p class="ml-auto text-xs text-[var(--text-tertiary)]">
        {{ t('invite.affiliateDisclaimer') }}
      </p>
    </div>
  </section>
</template>
