<script setup lang="ts">
import {
  AlertTriangle,
  AtSign,
  Github,
  KeyRound,
  Link2,
  LockKeyhole,
  Mail,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Terminal,
  Trash2,
  UserRound,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { isMockApi } from '@/api/client'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FormField from '@/components/common/FormField.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TextInput from '@/components/common/TextInput.vue'
import { useToast } from '@/composables/useToast'
import { useSettingsPrototypeStore } from '@/stores/settingsPrototype'
import type {
  PrototypeBinding,
  PrototypeBindingId,
} from '@/stores/settingsPrototype'
import type { UserInfo } from '@/types/auth'

import SettingsSectionHeading from './SettingsSectionHeading.vue'

const props = defineProps<{ user: UserInfo | null }>()

const emit = defineEmits<{
  editProfile: []
  changePassword: []
  deleteAccount: []
}>()

const { t } = useI18n()
const toast = useToast()
const prototype = isMockApi ? useSettingsPrototypeStore() : null

const passkeyRegisterOpen = ref(false)
const passkeyRemoveOpen = ref(false)
const twoFASetupOpen = ref(false)
const twoFACode = ref('')
const twoFAAction = ref<'regenerate' | 'disable' | null>(null)
const backupCodesOpen = ref(false)
const visibleBackupCodes = ref<string[]>([])
const bindTarget = ref<PrototypeBindingId | null>(null)
const unbindTarget = ref<PrototypeBindingId | null>(null)
const bindingEmail = ref('')
const bindingCode = ref('')

const qrCells = Array.from({ length: 49 }, (_, index) =>
  [
    0, 1, 2, 4, 5, 6, 7, 9, 11, 13, 14, 15, 16, 18, 19, 20, 24, 26, 28, 29, 30,
    31, 33, 35, 37, 38, 40, 42, 43, 44, 46, 48,
  ].includes(index)
)

const bindingMeta = {
  email: { icon: Mail, labelKey: 'settings.bindingEmail' },
  github: { icon: Github, labelKey: 'settings.bindingGithub' },
  linuxdo: { icon: Terminal, labelKey: 'settings.bindingLinuxDO' },
  discord: { icon: MessageCircle, labelKey: 'settings.bindingDiscord' },
  wechat: { icon: MessagesSquare, labelKey: 'settings.bindingWeChat' },
  telegram: { icon: Send, labelKey: 'settings.bindingTelegram' },
} as const

const readonlyBindings = computed<PrototypeBinding[]>(() => [
  {
    id: 'email',
    bound: Boolean(props.user?.email),
    account: props.user?.email?.trim() ?? '',
  },
  {
    id: 'github',
    bound: Boolean(props.user?.github_id),
    account: props.user?.github_id?.trim() ?? '',
  },
  {
    id: 'linuxdo',
    bound: Boolean(props.user?.linux_do_id),
    account: props.user?.linux_do_id?.trim() ?? '',
  },
  {
    id: 'discord',
    bound: Boolean(props.user?.discord_id),
    account: props.user?.discord_id?.trim() ?? '',
  },
  {
    id: 'wechat',
    bound: Boolean(props.user?.wechat_id),
    account: props.user?.wechat_id?.trim() ?? '',
  },
  {
    id: 'telegram',
    bound: Boolean(props.user?.telegram_id),
    account: props.user?.telegram_id?.trim() ?? '',
  },
])

const bindings = computed(() => prototype?.bindings ?? readonlyBindings.value)
const passkeyEnabled = computed(() => prototype?.passkeyEnabled ?? false)
const passkeyLastUsedAt = computed(() => prototype?.passkeyLastUsedAt ?? null)
const twoFAEnabled = computed(() => prototype?.twoFAEnabled ?? false)
const backupCodesRemaining = computed(
  () => prototype?.backupCodesRemaining ?? 0
)

const bindingItems = computed(() =>
  bindings.value.map((binding) => ({
    ...binding,
    icon: bindingMeta[binding.id].icon,
    label: t(bindingMeta[binding.id].labelKey),
  }))
)

const currentBindLabel = computed(() =>
  bindTarget.value ? t(bindingMeta[bindTarget.value].labelKey) : ''
)

const currentUnbindLabel = computed(() =>
  unbindTarget.value ? t(bindingMeta[unbindTarget.value].labelKey) : ''
)

const emailBinding = computed(() =>
  bindings.value.find((item) => item.id === 'email')!
)

function allowPrototypeAction(): boolean {
  if (isMockApi) return true
  toast.error(t('settings.prototypeSecurityNotice'))
  return false
}

function registerPasskey(): void {
  if (!allowPrototypeAction()) return
  prototype?.registerPasskey()
  passkeyRegisterOpen.value = false
  toast.success(t('settings.prototypePasskeyEnabled'))
}

function removePasskey(): void {
  if (!allowPrototypeAction()) return
  prototype?.removePasskey()
  passkeyRemoveOpen.value = false
  toast.success(t('settings.prototypePasskeyRemoved'))
}

function openTwoFASetup(): void {
  if (!allowPrototypeAction()) return
  twoFACode.value = ''
  twoFASetupOpen.value = true
}

function confirmTwoFASetup(): void {
  if (!allowPrototypeAction()) return
  if (!/^\d{6}$/.test(twoFACode.value)) return
  visibleBackupCodes.value = prototype?.enableTwoFA() ?? []
  twoFASetupOpen.value = false
  backupCodesOpen.value = true
  toast.success(t('settings.prototypeTwoFAEnabled'))
}

function openTwoFAAction(action: 'regenerate' | 'disable'): void {
  if (!allowPrototypeAction()) return
  twoFACode.value = ''
  twoFAAction.value = action
}

function confirmTwoFAAction(): void {
  if (!allowPrototypeAction()) return
  if (!/^\d{6}$/.test(twoFACode.value) || !twoFAAction.value) return
  if (twoFAAction.value === 'regenerate') {
    visibleBackupCodes.value = prototype?.regenerateBackupCodes() ?? []
    backupCodesOpen.value = true
    toast.success(t('settings.prototypeBackupCodesRegenerated'))
  } else {
    prototype?.disableTwoFA()
    toast.success(t('settings.prototypeTwoFADisabled'))
  }
  twoFAAction.value = null
}

async function copyBackupCodes(): Promise<void> {
  try {
    await navigator.clipboard.writeText(visibleBackupCodes.value.join('\n'))
    toast.success(t('settings.prototypeBackupCodesCopied'))
  } catch {
    toast.error(t('common.failed'))
  }
}

function openBinding(binding: PrototypeBinding): void {
  if (!allowPrototypeAction()) return
  if (binding.bound) {
    unbindTarget.value = binding.id
    return
  }
  bindTarget.value = binding.id
  bindingEmail.value = binding.id === 'email' ? (props.user?.email ?? '') : ''
  bindingCode.value = ''
}

function confirmBinding(): void {
  if (!allowPrototypeAction()) return
  if (!bindTarget.value) return
  if (bindTarget.value === 'email') {
    if (
      !bindingEmail.value.includes('@') ||
      !/^\d{6}$/.test(bindingCode.value)
    ) {
      toast.error(t('settings.prototypeEmailBindingInvalid'))
      return
    }
    prototype?.bindAccount('email', bindingEmail.value)
  } else {
    const username = props.user?.username || 'demo'
    prototype?.bindAccount(bindTarget.value, `${bindTarget.value}-${username}`)
  }
  toast.success(t('settings.prototypeBindingSaved'))
  bindTarget.value = null
}

function confirmUnbind(): void {
  if (!allowPrototypeAction()) return
  if (!unbindTarget.value) return
  prototype?.unbindAccount(unbindTarget.value)
  toast.success(t('settings.prototypeBindingRemoved'))
  unbindTarget.value = null
}
</script>

<template>
  <ConsoleCard :padded="false" class="overflow-hidden">
    <header
      class="flex items-center justify-between gap-5 border-b border-[var(--border-subtle)] px-6 py-6 sm:px-7"
    >
      <div class="flex min-w-0 items-center gap-3">
        <ShieldCheck
          :size="20"
          :stroke-width="1.8"
          class="shrink-0 text-[var(--text-tertiary)]"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <h2 class="truncate text-xl font-semibold text-[var(--text-primary)]">
            {{ t('settings.accountSecurityPanel') }}
          </h2>
          <p class="mt-1 text-sm leading-5 text-[var(--text-tertiary)]">
            {{ t('settings.accountSecuritySubtitle') }}
          </p>
        </div>
      </div>
      <span
        class="font-mono text-[10px] tracking-[0.16em] text-[var(--text-tertiary)]"
        >SECURITY</span
      >
    </header>

    <section>
      <SettingsSectionHeading
        index="01"
        :icon="UserRound"
        :title="t('settings.accountProfile')"
      />
      <div
        class="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]"
      >
        <div class="settings-ledger-row">
          <span class="settings-ledger-label">{{
            t('settings.displayName')
          }}</span>
          <span class="settings-ledger-value">{{
            user?.display_name || '—'
          }}</span>
          <button
            type="button"
            class="settings-row-action"
            @click="emit('editProfile')"
          >
            {{ t('common.edit') }}
          </button>
        </div>
        <div class="settings-ledger-row">
          <span class="settings-ledger-label">{{
            t('settings.username')
          }}</span>
          <span class="settings-ledger-value font-mono text-xs"
            >@{{ user?.username || '—' }}</span
          >
          <span class="settings-row-note">{{ t('settings.readonly') }}</span>
        </div>
        <div class="settings-ledger-row">
          <span class="settings-ledger-label">{{
            t('settings.loginEmail')
          }}</span>
          <span class="settings-ledger-value break-all">{{
            emailBinding?.account || t('settings.unbound')
          }}</span>
          <button
            type="button"
            class="settings-row-action"
            @click="openBinding(emailBinding)"
          >
            {{
              emailBinding?.bound ? t('settings.rebind') : t('settings.bind')
            }}
          </button>
        </div>
        <div class="settings-ledger-row">
          <span class="settings-ledger-label">{{
            t('settings.loginPassword')
          }}</span>
          <span class="settings-ledger-value font-mono tracking-[0.2em]"
            >••••••••••</span
          >
          <button
            type="button"
            class="settings-row-action"
            @click="emit('changePassword')"
          >
            {{ t('common.edit') }}
          </button>
        </div>
      </div>
    </section>

    <section class="border-t border-[var(--border-subtle)]">
      <SettingsSectionHeading
        index="02"
        :icon="KeyRound"
        :title="t('settings.passkeyLogin')"
      />
      <div class="border-t border-[var(--border-subtle)] px-5 py-5 sm:px-6">
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="flex min-w-0 items-start gap-3">
            <span class="settings-icon-tile"
              ><KeyRound :size="19" aria-hidden="true"
            /></span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-[var(--text-primary)]">
                  {{ t('settings.passkeyAuth') }}
                </p>
                <StatusChip :tone="passkeyEnabled ? 'success' : 'neutral'">
                  {{
                    passkeyEnabled
                      ? t('settings.enabled')
                      : t('settings.disabled')
                  }}
                </StatusChip>
              </div>
              <p class="mt-1 text-sm text-[var(--text-tertiary)]">
                {{ t('settings.lastUsed') }}：{{
                  passkeyLastUsedAt || t('settings.neverUsed')
                }}
              </p>
            </div>
          </div>
          <ConsoleButton
            :variant="passkeyEnabled ? 'secondary' : 'primary'"
            size="sm"
            class="w-full sm:w-auto"
            :disabled="!isMockApi"
            @click="
              passkeyEnabled
                ? (passkeyRemoveOpen = true)
                : (passkeyRegisterOpen = true)
            "
          >
            {{
              passkeyEnabled
                ? t('settings.removePasskey')
                : t('settings.enablePasskey')
            }}
          </ConsoleButton>
        </div>
      </div>
    </section>

    <section class="border-t border-[var(--border-subtle)]">
      <SettingsSectionHeading
        index="03"
        :icon="LockKeyhole"
        :title="t('settings.twoFA')"
      />
      <div class="border-t border-[var(--border-subtle)] px-5 py-5 sm:px-6">
        <div class="flex flex-col gap-4">
          <div class="flex items-start gap-3">
            <span class="settings-icon-tile"
              ><ShieldCheck :size="19" aria-hidden="true"
            /></span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-[var(--text-primary)]">
                  {{ t('settings.twoFA') }}
                </p>
                <StatusChip :tone="twoFAEnabled ? 'success' : 'neutral'">
                  {{
                    twoFAEnabled
                      ? t('settings.enabled')
                      : t('settings.disabled')
                  }}
                </StatusChip>
              </div>
              <p class="mt-1 text-sm text-[var(--text-tertiary)]">
                {{
                  twoFAEnabled
                    ? t('settings.backupCodesRemaining', {
                        count: backupCodesRemaining,
                      })
                    : t('settings.twoFADesc')
                }}
              </p>
            </div>
          </div>
          <div v-if="twoFAEnabled" class="grid gap-2 sm:grid-cols-2">
            <ConsoleButton
              variant="secondary"
              size="sm"
              :disabled="!isMockApi"
              @click="openTwoFAAction('regenerate')"
            >
              <RefreshCw :size="15" aria-hidden="true" />
              {{ t('settings.regenerateBackupCodes') }}
            </ConsoleButton>
            <ConsoleButton
              variant="danger"
              size="sm"
              :disabled="!isMockApi"
              @click="openTwoFAAction('disable')"
            >
              <AlertTriangle :size="15" aria-hidden="true" />
              {{ t('settings.disableTwoFA') }}
            </ConsoleButton>
          </div>
          <ConsoleButton
            v-else
            size="sm"
            class="w-full sm:w-fit"
            :disabled="!isMockApi"
            @click="openTwoFASetup"
          >
            {{ t('settings.enableTwoFA') }}
          </ConsoleButton>
        </div>
      </div>
    </section>

    <section class="border-t border-[var(--border-subtle)]">
      <SettingsSectionHeading
        index="04"
        :icon="Link2"
        :title="t('settings.authSources')"
      >
        <span class="text-xs text-[var(--text-tertiary)]">{{
          t('settings.boundCount', {
            count: bindings.filter((item) => item.bound).length,
            total: bindings.length,
          })
        }}</span>
      </SettingsSectionHeading>
      <div class="grid border-t border-[var(--border-subtle)] sm:grid-cols-2">
        <div
          v-for="(binding, index) in bindingItems"
          :key="binding.id"
          class="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6"
          :class="{ 'sm:border-r': index % 2 === 0 }"
        >
          <div class="flex min-w-0 items-center gap-3">
            <span class="settings-icon-tile size-9">
              <component :is="binding.icon" :size="17" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <p
                class="truncate text-sm font-semibold text-[var(--text-primary)]"
              >
                {{ binding.label }}
              </p>
              <p class="truncate text-xs text-[var(--text-tertiary)]">
                {{ binding.bound ? binding.account : t('settings.unbound') }}
              </p>
            </div>
          </div>
          <ConsoleButton
            :variant="binding.bound ? 'ghost' : 'secondary'"
            size="sm"
            :disabled="!isMockApi"
            @click="openBinding(binding)"
          >
            {{ binding.bound ? t('settings.unbind') : t('settings.bind') }}
          </ConsoleButton>
        </div>
      </div>
    </section>

    <section class="border-t border-[var(--status-danger-soft)]">
      <SettingsSectionHeading
        index="05"
        :icon="AlertTriangle"
        :title="t('settings.dangerTitle')"
        danger
      />
      <div
        class="flex flex-col gap-4 border-t border-[var(--border-subtle)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <div>
          <p class="font-semibold text-[var(--status-danger-text)]">
            {{ t('settings.deleteAccount') }}
          </p>
          <p class="mt-1 text-sm text-[var(--text-tertiary)]">
            {{ t('settings.deleteAccountDesc') }}
          </p>
        </div>
        <ConsoleButton
          variant="danger"
          class="w-full sm:w-auto"
          @click="emit('deleteAccount')"
        >
          <Trash2 :size="16" aria-hidden="true" />
          {{ t('settings.deleteAccount') }}
        </ConsoleButton>
      </div>
    </section>
  </ConsoleCard>

  <ConsoleModal
    :open="passkeyRegisterOpen"
    :title="t('settings.enablePasskey')"
    size="sm"
    @close="passkeyRegisterOpen = false"
  >
    <div class="settings-context-callout">
      <KeyRound :size="20" aria-hidden="true" />
      <p>{{ t('settings.prototypePasskeyPrompt') }}</p>
    </div>
    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <ConsoleButton
          variant="secondary"
          size="lg"
          @click="passkeyRegisterOpen = false"
          >{{ t('common.cancel') }}</ConsoleButton
        >
        <ConsoleButton size="lg" @click="registerPasskey">{{
          t('common.confirm')
        }}</ConsoleButton>
      </div>
    </template>
  </ConsoleModal>

  <ConfirmDialog
    :open="passkeyRemoveOpen"
    :title="t('settings.removePasskey')"
    :message="t('settings.prototypeRemovePasskeyConfirm')"
    @confirm="removePasskey"
    @cancel="passkeyRemoveOpen = false"
  />

  <ConsoleModal
    :open="twoFASetupOpen"
    :title="t('settings.twoFASetup')"
    size="sm"
    @close="twoFASetupOpen = false"
  >
    <div class="flex flex-col items-center gap-5">
      <div
        class="grid size-36 grid-cols-7 gap-1 rounded-lg border border-[var(--border-subtle)] bg-white p-3"
        aria-hidden="true"
      >
        <span
          v-for="(active, index) in qrCells"
          :key="index"
          class="rounded-[1px]"
          :class="active ? 'bg-black' : 'bg-white'"
        />
      </div>
      <div
        class="w-full rounded-lg bg-[var(--surface-muted)] px-4 py-3 text-center font-mono text-xs text-[var(--text-secondary)]"
      >
        REN2-TOTP-SETUP
      </div>
      <FormField
        :label="t('settings.twoFACode')"
        :hint="t('settings.prototypeSixDigitHint')"
        class="w-full"
      >
        <TextInput
          v-model="twoFACode"
          inputmode="numeric"
          maxlength="6"
          placeholder="000000"
        />
      </FormField>
    </div>
    <template #footer>
      <ConsoleButton
        block
        size="lg"
        :disabled="!/^\d{6}$/.test(twoFACode)"
        @click="confirmTwoFASetup"
      >
        {{ t('settings.enableTwoFA') }}
      </ConsoleButton>
    </template>
  </ConsoleModal>

  <ConsoleModal
    :open="twoFAAction !== null"
    :title="
      twoFAAction === 'regenerate'
        ? t('settings.regenerateBackupCodes')
        : t('settings.disableTwoFA')
    "
    size="sm"
    @close="twoFAAction = null"
  >
    <FormField
      :label="t('settings.twoFACode')"
      :hint="t('settings.prototypeSixDigitHint')"
    >
      <TextInput
        v-model="twoFACode"
        inputmode="numeric"
        maxlength="6"
        placeholder="000000"
      />
    </FormField>
    <template #footer>
      <ConsoleButton
        block
        size="lg"
        :variant="twoFAAction === 'disable' ? 'danger' : 'primary'"
        :disabled="!/^\d{6}$/.test(twoFACode)"
        @click="confirmTwoFAAction"
      >
        {{ t('common.confirm') }}
      </ConsoleButton>
    </template>
  </ConsoleModal>

  <ConsoleModal
    :open="backupCodesOpen"
    :title="t('settings.backupCodes')"
    size="sm"
    @close="backupCodesOpen = false"
  >
    <div class="grid grid-cols-2 gap-2">
      <code
        v-for="code in visibleBackupCodes"
        :key="code"
        class="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-center text-xs text-[var(--text-primary)]"
        >{{ code }}</code
      >
    </div>
    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <ConsoleButton variant="secondary" size="lg" @click="copyBackupCodes">{{
          t('common.copy')
        }}</ConsoleButton>
        <ConsoleButton size="lg" @click="backupCodesOpen = false">{{
          t('common.close')
        }}</ConsoleButton>
      </div>
    </template>
  </ConsoleModal>

  <ConsoleModal
    :open="bindTarget !== null"
    :title="t('settings.bindProvider', { provider: currentBindLabel })"
    size="sm"
    @close="bindTarget = null"
  >
    <div v-if="bindTarget === 'email'" class="space-y-4">
      <FormField :label="t('settings.email')">
        <TextInput
          v-model="bindingEmail"
          type="email"
          placeholder="name@example.com"
        />
      </FormField>
      <FormField
        :label="t('settings.twoFACode')"
        :hint="t('settings.prototypeEmailCodeHint')"
      >
        <TextInput
          v-model="bindingCode"
          inputmode="numeric"
          maxlength="6"
          placeholder="000000"
        />
      </FormField>
    </div>
    <div v-else class="settings-context-callout">
      <AtSign :size="20" aria-hidden="true" />
      <p>
        {{ t('settings.prototypeOAuthPrompt', { provider: currentBindLabel }) }}
      </p>
    </div>
    <template #footer>
      <ConsoleButton block size="lg" @click="confirmBinding">{{
        t('settings.bind')
      }}</ConsoleButton>
    </template>
  </ConsoleModal>

  <ConfirmDialog
    :open="unbindTarget !== null"
    :title="t('settings.unbindProvider', { provider: currentUnbindLabel })"
    :message="t('settings.prototypeUnbindConfirm')"
    @confirm="confirmUnbind"
    @cancel="unbindTarget = null"
  />
</template>

<style scoped>
.settings-ledger-row {
  display: grid;
  grid-template-columns: minmax(7rem, 0.8fr) minmax(0, 1.4fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 4.5rem;
  padding: 0.875rem 1.5rem;
}

.settings-ledger-label,
.settings-row-note {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.settings-ledger-value {
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.settings-row-note {
  text-align: right;
}

.settings-row-action {
  border-radius: 0.375rem;
  padding: 0.25rem 0.375rem;
  font-size: 0.75rem;
  color: var(--accent-text);
}

.settings-row-action:hover {
  background: var(--surface-muted);
}

.settings-icon-tile {
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 0.625rem;
  background: var(--accent-soft);
  color: var(--accent-text);
}

.settings-context-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-muted);
  padding: 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

@media (max-width: 639px) {
  .settings-ledger-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.375rem 0.75rem;
    padding-inline: 1.25rem;
  }

  .settings-ledger-value {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .settings-row-action,
  .settings-row-note {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
