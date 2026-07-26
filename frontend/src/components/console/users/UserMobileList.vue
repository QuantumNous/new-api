<script setup lang="ts">
import {
  Coins,
  LoaderCircle,
  Pencil,
  Power,
  PowerOff,
  Trash2,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/common/IconButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import {
  type AdminUserOptionalField,
  adminUserRoleLabelKey,
  adminUserRoleTone,
  adminUserStatusLabelKey,
  adminUserStatusTone,
} from '@/constants/adminUsers'
import type { AdminUser } from '@/types/console'
import { formatTime, relativeTime } from '@/utils/format'

import UserAvatar from './UserAvatar.vue'
import UserInviteCell from './UserInviteCell.vue'
import UserQuotaCell from './UserQuotaCell.vue'

type UserAction = 'status' | 'quota'

defineProps<{
  users: AdminUser[]
  visibleFields: AdminUserOptionalField[]
  selectedIds: number[]
  allSelected: boolean
  selectionDisabled: boolean
  toggleAllSelected: () => void
  toggleSelected: (user: AdminUser) => void
  canManage: (user: AdminUser) => boolean
  isSelf: (user: AdminUser) => boolean
  isBusy: (id: number, action: UserAction) => boolean
  isRowBusy: (id: number) => boolean
  editUser: (user: AdminUser) => void
  toggleStatus: (user: AdminUser) => Promise<boolean>
  adjustQuota: (user: AdminUser) => void
  deleteUser: (user: AdminUser) => void
}>()

const { t, locale } = useI18n()
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
        :disabled="selectionDisabled"
        :aria-label="t('users.selectPage')"
        @change="toggleAllSelected"
      />
      {{ t('users.selectPage') }}
    </label>

    <div class="divide-y divide-[var(--border-subtle)]">
      <article
        v-for="user in users"
        :key="user.id"
        data-user-mobile-row
        class="min-w-0 px-4 py-4 transition-colors"
        :class="user.status === 1 ? '' : 'bg-[var(--surface-muted)] opacity-75'"
      >
        <header class="flex min-w-0 items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-2.5">
            <input
              type="checkbox"
              class="checkbox-round mt-2 shrink-0"
              :checked="selectedIds.includes(user.id)"
              :disabled="selectionDisabled || !canManage(user)"
              :aria-label="t('users.selectUser', { name: user.username })"
              @click.stop
              @change="toggleSelected(user)"
            />
            <UserAvatar
              :username="user.username"
              :display-name="user.display_name"
              :size="36"
            />
            <div class="min-w-0">
              <h2
                class="display-title truncate text-sm font-semibold text-[var(--text-primary)]"
                :title="user.username"
              >
                {{ user.username }}
              </h2>
              <p class="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">
                {{ user.display_name || user.email || '—' }}
              </p>
              <p
                v-if="visibleFields.includes('id')"
                class="display-number mt-0.5 font-mono text-[11px] text-[var(--text-tertiary)]"
              >
                #{{ user.id }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <StatusChip
              v-if="visibleFields.includes('status')"
              :tone="adminUserStatusTone(user.status)"
            >
              {{ t(adminUserStatusLabelKey(user.status)) }}
            </StatusChip>
            <span
              v-if="isSelf(user)"
              class="text-[10px] text-[var(--text-tertiary)]"
            >
              {{ t('users.selfHint') }}
            </span>
          </div>
        </header>
        <dl class="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 text-xs">
          <div v-if="visibleFields.includes('role')" class="min-w-0">
            <dt class="text-[var(--text-tertiary)]">{{ t('users.role') }}</dt>
            <dd class="mt-1.5">
              <StatusChip :tone="adminUserRoleTone(user.role)">
                {{ t(adminUserRoleLabelKey(user.role)) }}
              </StatusChip>
            </dd>
          </div>
          <div v-if="visibleFields.includes('lastLogin')" class="min-w-0">
            <dt class="text-[var(--text-tertiary)]">
              {{ t('users.lastLogin') }}
            </dt>
            <dd class="mt-1.5 text-[var(--text-secondary)]">
              {{
                user.last_login_time > 0
                  ? relativeTime(user.last_login_time, locale)
                  : t('users.neverLoggedIn')
              }}
            </dd>
          </div>
          <div v-if="visibleFields.includes('quota')" class="min-w-0">
            <dt class="text-[var(--text-tertiary)]">{{ t('users.quota') }}</dt>
            <dd class="mt-1.5">
              <UserQuotaCell :user="user" />
            </dd>
          </div>
          <div v-if="visibleFields.includes('invite')" class="min-w-0">
            <dt class="text-[var(--text-tertiary)]">{{ t('users.invite') }}</dt>
            <dd class="mt-1.5">
              <UserInviteCell :user="user" />
            </dd>
          </div>
          <div v-if="visibleFields.includes('createdTime')" class="min-w-0">
            <dt class="text-[var(--text-tertiary)]">
              {{ t('users.createdTime') }}
            </dt>
            <dd class="mt-1.5 text-[var(--text-secondary)]">
              {{ formatTime(user.created_time) }}
            </dd>
          </div>
        </dl>

        <footer
          class="mt-4 flex items-center justify-end gap-1 border-t border-[var(--border-subtle)] pt-3"
        >
          <IconButton
            :label="t('users.editUser')"
            :disabled="!canManage(user) || isRowBusy(user.id)"
            @click="editUser(user)"
          >
            <Pencil :size="16" />
          </IconButton>
          <IconButton
            :label="t('users.adjustQuota')"
            :disabled="!canManage(user) || isRowBusy(user.id)"
            @click="adjustQuota(user)"
          >
            <Coins :size="16" />
          </IconButton>
          <IconButton
            :label="
              user.status === 1 ? t('users.disableUser') : t('users.enableUser')
            "
            :tone="user.status === 1 ? 'danger' : 'default'"
            :disabled="!canManage(user) || isRowBusy(user.id)"
            @click="toggleStatus(user)"
          >
            <LoaderCircle
              v-if="isBusy(user.id, 'status')"
              :size="16"
              class="animate-spin"
            />
            <PowerOff v-else-if="user.status === 1" :size="16" />
            <Power v-else :size="16" />
          </IconButton>
          <IconButton
            :label="t('users.deleteUser')"
            tone="danger"
            :disabled="!canManage(user) || isRowBusy(user.id)"
            @click="deleteUser(user)"
          >
            <Trash2 :size="16" />
          </IconButton>
        </footer>
      </article>
    </div>
  </div>
</template>
