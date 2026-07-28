<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { Merchant } from '@/types/console'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import { formatDate } from '@/utils/format'

defineProps<{
  open: boolean
  merchant: Merchant | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>

<template>
  <ConsoleModal
    :open="open && merchant != null"
    :title="t('market.commentsTitle')"
    size="md"
    @close="emit('close')"
  >
    <div v-if="merchant" class="space-y-4">
      <div class="flex items-center gap-3">
        <VendorLogo :vendor="merchant.name" :size="36" />
        <div>
          <p class="text-sm font-semibold text-[var(--text-primary)]">
            {{ merchant.name }}
          </p>
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('market.comments', { n: merchant.comments.length }) }}
          </p>
        </div>
      </div>

      <p
        v-if="merchant.comments.length === 0"
        class="py-8 text-center text-sm text-[var(--text-tertiary)]"
      >
        {{ t('market.noComments') }}
      </p>

      <ul v-else class="space-y-3">
        <li
          v-for="c in merchant.comments"
          :key="c.id"
          class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
        >
          <div class="mb-1 flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-[var(--text-secondary)]">{{
              c.user
            }}</span>
            <span class="text-xs text-[var(--text-tertiary)]">{{
              formatDate(c.createdAt)
            }}</span>
          </div>
          <p class="text-sm leading-relaxed text-[var(--text-primary)]">
            {{ c.content }}
          </p>
        </li>
      </ul>
    </div>
  </ConsoleModal>
</template>
