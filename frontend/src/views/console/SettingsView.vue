<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter.vue'
import PageHero from '@/components/console/PageHero.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import { useBalanceVisibility } from '@/composables/useDashboard'
import { useTheme, type ThemePreference } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { setLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'

const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { preference: mode } = useTheme()
const { hidden: balanceHidden } = useBalanceVisibility()

type PanelKey = 'profile' | 'security' | 'appearance' | 'bindings' | 'danger'
const active = ref<PanelKey>('profile')

const menus = computed<Array<{ key: PanelKey; label: string; icon: string }>>(
  () => [
    {
      key: 'profile',
      label: t('settings.menuProfile'),
      icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.3 3-5 7-5s7 1.7 7 5v1H5v-1Z',
    },
    {
      key: 'security',
      label: t('settings.menuSecurity'),
      icon: 'M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3Z',
    },
    {
      key: 'appearance',
      label: t('settings.menuAppearance'),
      icon: 'M4 4h16v12H4zM4 16l4 4M20 16l-4 4M9 9h6M9 12h4',
    },
    {
      key: 'bindings',
      label: t('settings.menuBindings'),
      icon: 'M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8',
    },
    {
      key: 'danger',
      label: t('settings.menuDanger'),
      icon: 'M12 9v4m0 4h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    },
  ]
)

/* ---------- profile ---------- */
const displayName = ref(auth.user?.display_name ?? '')
const savingProfile = ref(false)
async function saveProfile() {
  savingProfile.value = true
  try {
    await auth.updateProfile({ display_name: displayName.value })
    toast.success(t('settings.profileSaved'))
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    savingProfile.value = false
  }
}

/* ---------- security ---------- */
const oldPassword = ref('')
const newPassword = ref('')
const savingPw = ref(false)
const twoFAEnabled = ref(false)
const twoFAOpen = ref(false)
const twoFACode = ref('')
const passkeys = ref<string[]>([])

async function changePassword() {
  savingPw.value = true
  try {
    await api.put('/api/user/self/password', {
      old_password: oldPassword.value,
      new_password: newPassword.value,
    })
    toast.success(t('settings.passwordChanged'))
    oldPassword.value = ''
    newPassword.value = ''
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    savingPw.value = false
  }
}

function confirmTwoFA() {
  if (twoFACode.value.length === 6) {
    twoFAEnabled.value = true
    twoFAOpen.value = false
    toast.success(t('settings.twoFA'))
  }
}

/* ---------- appearance ---------- */
const localeOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
]
const themeOptions = computed<Array<{ value: ThemePreference; label: string }>>(
  () => [
    { value: 'auto', label: t('settings.themeAuto') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ]
)
function changeLocale(value: string) {
  setLocale(value)
}

/* ---------- bindings (demo-only: state lives in this component) ---------- */
const providers = ref([
  { id: 'github', name: 'GitHub', bound: true, account: 'ren2-demo' },
  { id: 'discord', name: 'Discord', bound: false, account: '' },
  { id: 'linuxdo', name: 'LinuxDO', bound: false, account: '' },
  { id: 'wechat', name: 'WeChat', bound: false, account: '' },
  { id: 'telegram', name: 'Telegram', bound: false, account: '' },
])
function toggleBind(p: { bound: boolean }) {
  p.bound = !p.bound
  toast.success(t('common.success'))
}

/* ---------- danger ---------- */
const deleteOpen = ref(false)
const deleteConfirmText = ref('')
const deleting = ref(false)
async function deleteAccount() {
  if (deleting.value || deleteConfirmText.value !== auth.user?.username) return
  deleting.value = true
  try {
    await auth.deleteAccount()
    await router.push({ name: 'sign-in' })
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <PageHero
      :title="t('settings.title')"
      :crumbs="[
        t('settings.breadcrumb.0'),
        t(`settings.menu${active[0].toUpperCase()}${active.slice(1)}`),
      ]"
    />

    <div class="grid gap-5 lg:grid-cols-[240px_1fr]">
      <!-- left menu -->
      <ConsoleCard :padded="false" class="h-fit">
        <nav class="p-2">
          <button
            v-for="menu in menus"
            :key="menu.key"
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all focus-ring"
            :style="
              active === menu.key
                ? 'background:var(--text-primary);color:var(--page-background)'
                : 'color:var(--text-secondary)'
            "
            :class="{ 'hover:bg-[var(--surface-muted)]': active !== menu.key }"
            @click="active = menu.key"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path :d="menu.icon" />
            </svg>
            <span class="flex-1 text-left">{{ menu.label }}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </nav>
      </ConsoleCard>

      <!-- right panel -->
      <ConsoleCard :padded="false">
        <!-- panel title -->
        <div class="border-b border-[var(--border-subtle)] px-6 py-5">
          <h2 class="text-xl font-bold text-[var(--text-primary)]">
            {{ t(`settings.${active}Title`) }}
          </h2>
        </div>

        <!-- profile -->
        <template v-if="active === 'profile'">
          <div class="divide-y divide-[var(--border-subtle)]">
            <div class="flex items-center justify-between gap-6 px-6 py-4">
              <div class="w-36 shrink-0">
                <p class="text-sm font-medium text-[var(--text-primary)]">
                  {{ t('settings.displayName') }}
                </p>
              </div>
              <TextInput
                v-model="displayName"
                name="display-name"
                :aria-label="t('settings.displayName')"
                class="max-w-sm flex-1"
              />
            </div>
            <div class="flex items-center justify-between gap-6 px-6 py-4">
              <div class="w-36 shrink-0">
                <p class="text-sm font-medium text-[var(--text-primary)]">
                  {{ t('settings.username') }}
                </p>
              </div>
              <TextInput
                :model-value="auth.user?.username ?? ''"
                :aria-label="t('settings.username')"
                readonly
                class="max-w-sm flex-1"
              />
            </div>
            <div class="flex items-center justify-between gap-6 px-6 py-4">
              <div class="w-36 shrink-0">
                <p class="text-sm font-medium text-[var(--text-primary)]">
                  {{ t('settings.email') }}
                </p>
              </div>
              <TextInput
                :model-value="auth.user?.email ?? ''"
                type="email"
                :aria-label="t('settings.email')"
                readonly
                class="max-w-sm flex-1"
              />
            </div>
            <div class="px-6 py-4">
              <ConsoleButton :loading="savingProfile" @click="saveProfile">
                {{ t('settings.saveProfile') }}
              </ConsoleButton>
            </div>
          </div>
        </template>

        <!-- security -->
        <template v-else-if="active === 'security'">
          <div class="divide-y divide-[var(--border-subtle)]">
            <div class="px-6 py-5">
              <p
                class="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]"
              >
                {{ t('settings.changePassword') }}
              </p>
              <div class="max-w-md space-y-3">
                <FormField :label="t('settings.oldPassword')">
                  <TextInput
                    v-model="oldPassword"
                    type="password"
                    autocomplete="current-password"
                  />
                </FormField>
                <FormField
                  :label="t('auth.newPassword')"
                  :hint="t('auth.passwordHint')"
                >
                  <TextInput
                    v-model="newPassword"
                    type="password"
                    autocomplete="new-password"
                  />
                </FormField>
                <PasswordStrengthMeter :password="newPassword" />
                <ConsoleButton
                  :loading="savingPw"
                  :disabled="!oldPassword || newPassword.length < 8"
                  @click="changePassword"
                >
                  {{ t('common.save') }}
                </ConsoleButton>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <p class="text-sm font-semibold text-[var(--text-primary)]">
                  {{ t('settings.twoFA') }}
                  <span
                    class="ml-1.5 rounded bg-[var(--surface-muted)] px-1.5 py-px text-[10px] font-medium text-[var(--text-tertiary)]"
                  >
                    {{ t('settings.demoBadge') }}
                  </span>
                </p>
                <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {{ t('settings.twoFADesc') }}
                </p>
              </div>
              <ConsoleToggle
                :model-value="twoFAEnabled"
                :label="t('settings.twoFA')"
                @update:model-value="
                  (v: boolean) =>
                    v ? (twoFAOpen = true) : (twoFAEnabled = false)
                "
              />
            </div>
            <div class="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <p class="text-sm font-semibold text-[var(--text-primary)]">
                  {{ t('settings.passkeys') }}
                  <span
                    class="ml-1.5 rounded bg-[var(--surface-muted)] px-1.5 py-px text-[10px] font-medium text-[var(--text-tertiary)]"
                  >
                    {{ t('settings.demoBadge') }}
                  </span>
                </p>
                <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {{ t('settings.passkeysDesc') }}
                </p>
                <ul v-if="passkeys.length" class="mt-2 space-y-1">
                  <li
                    v-for="pk in passkeys"
                    :key="pk"
                    class="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      style="background: var(--status-success)"
                    />
                    {{ pk }}
                  </li>
                </ul>
              </div>
              <ConsoleButton
                variant="secondary"
                size="sm"
                @click="passkeys.push(`Passkey ${passkeys.length + 1}`)"
              >
                + {{ t('settings.addPasskey') }}
              </ConsoleButton>
            </div>
          </div>
        </template>

        <!-- appearance -->
        <template v-else-if="active === 'appearance'">
          <div class="divide-y divide-[var(--border-subtle)]">
            <div class="flex items-center justify-between gap-6 px-6 py-4">
              <div>
                <p class="text-sm font-semibold text-[var(--text-primary)]">
                  {{ t('settings.language') }}
                </p>
              </div>
              <FilterSelect
                :model-value="locale"
                :options="localeOptions"
                :label="t('settings.language')"
                class="w-48"
                @update:model-value="changeLocale"
              />
            </div>
            <div class="flex items-center justify-between gap-6 px-6 py-4">
              <div>
                <p class="text-sm font-semibold text-[var(--text-primary)]">
                  {{ t('settings.theme') }}
                </p>
              </div>
              <div class="flex gap-1.5">
                <button
                  v-for="opt in themeOptions"
                  :key="opt.value"
                  type="button"
                  class="h-9 rounded-xl px-4 text-xs font-medium transition-all focus-ring"
                  :style="
                    mode === opt.value
                      ? 'background:var(--accent);color:var(--accent-contrast)'
                      : 'background:var(--surface-muted);color:var(--text-secondary)'
                  "
                  :aria-pressed="mode === opt.value"
                  @click="mode = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <p class="text-sm font-semibold text-[var(--text-primary)]">
                  {{ t('settings.hideBalance') }}
                </p>
                <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {{ t('settings.hideBalanceDesc') }}
                </p>
              </div>
              <ConsoleToggle
                v-model="balanceHidden"
                :label="t('settings.hideBalance')"
              />
            </div>
          </div>
        </template>

        <!-- bindings -->
        <template v-else-if="active === 'bindings'">
          <p class="px-6 pt-4 text-xs text-[var(--text-tertiary)]">
            {{ t('settings.demoOnly') }}
          </p>
          <ul class="divide-y divide-[var(--border-subtle)]">
            <li
              v-for="p in providers"
              :key="p.id"
              class="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div class="flex items-center gap-3">
                <span
                  class="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-sm font-bold text-[var(--text-secondary)]"
                >
                  {{ p.name.slice(0, 1) }}
                </span>
                <div>
                  <p class="text-sm font-semibold text-[var(--text-primary)]">
                    {{ p.name }}
                  </p>
                  <p class="text-xs text-[var(--text-tertiary)]">
                    {{
                      p.bound
                        ? `${t('settings.bound')} · ${p.account}`
                        : t('settings.unbound')
                    }}
                  </p>
                </div>
              </div>
              <ConsoleButton
                :variant="p.bound ? 'secondary' : 'primary'"
                size="sm"
                @click="toggleBind(p)"
              >
                {{ p.bound ? t('settings.unbind') : t('settings.bind') }}
              </ConsoleButton>
            </li>
          </ul>
        </template>

        <!-- danger -->
        <template v-else-if="active === 'danger'">
          <div
            class="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
          >
            <div>
              <p
                class="text-sm font-semibold"
                style="color: var(--status-danger-text)"
              >
                {{ t('settings.deleteAccount') }}
              </p>
              <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
                {{ t('settings.deleteAccountDesc') }} ·
                {{ t('settings.demoOnly') }}
              </p>
            </div>
            <ConsoleButton variant="danger" @click="deleteOpen = true">
              {{ t('settings.deleteAccount') }}
            </ConsoleButton>
          </div>
        </template>
      </ConsoleCard>
    </div>

    <!-- 2FA setup modal -->
    <ConsoleModal
      :open="twoFAOpen"
      :title="t('settings.twoFASetup')"
      size="sm"
      @close="twoFAOpen = false"
    >
      <div class="flex flex-col items-center gap-4">
        <div
          class="flex h-40 w-40 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]"
        >
          <svg
            width="96"
            height="96"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            stroke-width="1"
          >
            <path
              d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v6M14 20h3"
            />
          </svg>
        </div>
        <FormField :label="t('settings.twoFACode')" class="w-full">
          <TextInput v-model="twoFACode" placeholder="000000" />
        </FormField>
      </div>
      <template #footer>
        <ConsoleButton
          size="lg"
          block
          :disabled="twoFACode.length !== 6"
          @click="confirmTwoFA"
        >
          {{ t('common.confirm') }}
        </ConsoleButton>
      </template>
    </ConsoleModal>

    <!-- delete account -->
    <ConfirmDialog
      :open="deleteOpen"
      :title="t('settings.deleteAccount')"
      :message="t('settings.deleteAccountConfirm')"
      :confirm-text="t('common.delete')"
      :loading="deleting"
      @confirm="deleteAccount"
      @cancel="deleteOpen = false"
    >
      <FormField
        :label="t('settings.typeNameToConfirm', { name: auth.user?.username })"
        class="mt-4 w-full text-left"
      >
        <TextInput
          v-model="deleteConfirmText"
          :placeholder="auth.user?.username"
        />
      </FormField>
    </ConfirmDialog>
  </div>
</template>
