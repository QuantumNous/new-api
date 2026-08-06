<script setup lang="ts">
import {
  Eye,
  LoaderCircle,
  Pencil,
  Power,
  PowerOff,
  SlidersHorizontal,
  Trash2,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/common/IconButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import type { TokenSummary } from '@/types/console'
import { formatDate, formatQuota } from '@/utils/format'

withDefaults(
  defineProps<{
    tokens: TokenSummary[]
    selectedIds: Array<string | number>
    allSelected: boolean
    toggleAllSelected: () => void
    toggleSelected: (token: TokenSummary) => void
    isToggling: (token: TokenSummary) => boolean
    toggleStatus: (token: TokenSummary) => void | Promise<void>
    viewKey: (token: TokenSummary) => void
    manageChannels: (token: TokenSummary) => void
    showChannels?: boolean
    editKey: (token: TokenSummary) => void
    deleteKey: (token: TokenSummary) => void
  }>(),
  { showChannels: true }
)

const { t } = useI18n()
</script>

<template>
  <div>
    <label
      class="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)]"
    >
      <input
        type="checkbox"
        class="checkbox-round"
        :checked="allSelected"
        :aria-label="t('common.selectAll')"
        @change="toggleAllSelected"
      />
      {{ t('common.selectAll') }}
    </label>

    <div class="divide-y divide-[var(--border-subtle)]">
      <article
        v-for="token in tokens"
        :key="token.id"
        data-key-mobile-row
        class="min-w-0 px-4 py-4 transition-colors"
        :class="
          token.status === 1 ? '' : 'bg-[var(--surface-muted)] opacity-80'
        "
      >
        <header class="flex min-w-0 items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-2.5">
            <input
              type="checkbox"
              class="checkbox-round mt-1 shrink-0"
              :checked="selectedIds.includes(token.id)"
              :aria-label="t('keys.selectKey', { name: token.name })"
              @change="toggleSelected(token)"
            />
            <div class="min-w-0">
              <h2
                class="truncate text-sm font-semibold text-[var(--text-primary)]"
                :title="token.name"
              >
                {{ token.name }}
              </h2>
              <p
                class="mt-1 truncate font-mono text-[11px] text-[var(--text-tertiary)]"
                :title="token.key_preview"
              >
                {{ token.key_preview }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-[var(--shape-control)] focus-ring"
            :disabled="isToggling(token)"
            :aria-label="t('keys.toggleKey')"
            @click="toggleStatus(token)"
          >
            <StatusChip :tone="token.status === 1 ? 'success' : 'neutral'">
              {{
                token.status === 1 ? t('common.enabled') : t('common.disabled')
              }}
            </StatusChip>
          </button>
        </header>

        <dl class="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div class="min-w-0">
            <dt class="text-[var(--text-tertiary)]">{{ t('keys.colType') }}</dt>
            <dd class="mt-1.5">
              <StatusChip :tone="token.type === 'auto' ? 'info' : 'accent'">
                {{ t(`keys.type.${token.type}`) }}
              </StatusChip>
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-[var(--text-tertiary)]">
              {{ t('keys.colUsage') }}
            </dt>
            <dd class="mt-1.5 text-[var(--text-secondary)]">
              {{ formatQuota(token.used_quota) }} /
              <span class="font-semibold text-[var(--text-primary)]">
                {{
                  token.unlimited
                    ? t('common.unlimited')
                    : formatQuota(token.remain_quota)
                }}
              </span>
            </dd>
          </div>
          <div class="col-span-2 min-w-0">
            <dt class="text-[var(--text-tertiary)]">
              {{ t('keys.colExpired') }}
            </dt>
            <dd class="mt-1.5 text-[var(--text-secondary)]">
              {{
                token.expired_time < 0
                  ? t('common.never')
                  : formatDate(token.expired_time)
              }}
            </dd>
          </div>
        </dl>

        <footer
          class="mt-4 flex items-center justify-end gap-1 border-t border-[var(--border-subtle)] pt-3"
        >
          <IconButton :label="t('keys.viewKey')" @click="viewKey(token)">
            <Eye :size="16" />
          </IconButton>
          <IconButton
            v-if="showChannels"
            :label="t('keys.manageChannels')"
            @click="manageChannels(token)"
          >
            <SlidersHorizontal :size="16" />
          </IconButton>
          <IconButton :label="t('keys.editKey')" @click="editKey(token)">
            <Pencil :size="16" />
          </IconButton>
          <IconButton
            :label="t('keys.toggleKey')"
            :disabled="isToggling(token)"
            @click="toggleStatus(token)"
          >
            <LoaderCircle
              v-if="isToggling(token)"
              :size="16"
              class="animate-spin"
            />
            <PowerOff v-else-if="token.status === 1" :size="16" />
            <Power v-else :size="16" />
          </IconButton>
          <IconButton
            :label="t('keys.deleteKey')"
            tone="danger"
            @click="deleteKey(token)"
          >
            <Trash2 :size="16" />
          </IconButton>
        </footer>
      </article>
    </div>
  </div>
</template>
