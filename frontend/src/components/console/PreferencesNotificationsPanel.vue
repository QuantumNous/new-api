<script setup lang="ts">
import {
  Bell,
  BellRing,
  EyeOff,
  Languages,
  Mail,
  Palette,
  RadioTower,
  Server,
  SlidersHorizontal,
  Webhook,
} from 'lucide-vue-next'
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { isMockApi } from '@/api/client'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import SegmentedToggle from '@/components/common/SegmentedToggle.vue'
import { useBalanceVisibility } from '@/composables/useDashboard'
import { useTheme, type ThemePreference } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { setLocale } from '@/i18n'
import { useSettingsPrototypeStore } from '@/stores/settingsPrototype'
import type {
  PrototypeNotificationSettings,
  PrototypeNotifyType,
} from '@/stores/settingsPrototype'

import SettingsSectionHeading from './SettingsSectionHeading.vue'

defineProps<{ isAdmin: boolean }>()

const { t, locale } = useI18n()
const toast = useToast()
const prototype = isMockApi ? useSettingsPrototypeStore() : null
const { preference: themeMode } = useTheme()
const { hidden: balanceHidden } = useBalanceVisibility()

const readonlyNotification: PrototypeNotificationSettings = {
  notifyType: 'email',
  quotaWarningThreshold: 500_000,
  notificationEmail: '',
  webhookUrl: '',
  webhookSecret: '',
  barkUrl: '',
  gotifyUrl: '',
  gotifyToken: '',
  gotifyPriority: 5,
  walletReminder: false,
  subscriptionReminder: false,
  upstreamModelUpdateNotify: false,
  acceptUnsetModelPrice: false,
  recordIpLog: false,
}

const draft = reactive<PrototypeNotificationSettings>({
  ...(prototype?.notification ?? readonlyNotification),
})
const errors = reactive<Record<string, string>>({})

watch(
  () => prototype?.notification,
  (value) => {
    if (value) Object.assign(draft, value)
  },
  { immediate: true }
)

const notificationMethods = [
  { value: 'email' as const, icon: Mail, labelKey: 'settings.notifyEmail' },
  {
    value: 'webhook' as const,
    icon: Webhook,
    labelKey: 'settings.notifyWebhook',
  },
  { value: 'bark' as const, icon: BellRing, labelKey: 'settings.notifyBark' },
  {
    value: 'gotify' as const,
    icon: Server,
    labelKey: 'settings.notifyGotify',
  },
]

const localeOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
]

const themeOptions = [
  { value: 'auto', label: t('settings.themeAuto') },
  { value: 'light', label: t('settings.themeLight') },
  { value: 'dark', label: t('settings.themeDark') },
]

function setNotifyType(value: PrototypeNotifyType): void {
  draft.notifyType = value
  Object.keys(errors).forEach((key) => delete errors[key])
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function validate(): boolean {
  Object.keys(errors).forEach((key) => delete errors[key])

  if (
    !Number.isFinite(draft.quotaWarningThreshold) ||
    draft.quotaWarningThreshold <= 0
  ) {
    errors.quotaWarningThreshold = t('settings.errorPositiveThreshold')
  }
  if (
    draft.notifyType === 'email' &&
    draft.notificationEmail &&
    !/^\S+@\S+\.\S+$/.test(draft.notificationEmail)
  ) {
    errors.notificationEmail = t('settings.errorEmail')
  }
  if (draft.notifyType === 'webhook' && !isHttpUrl(draft.webhookUrl)) {
    errors.webhookUrl = t('settings.errorHttpUrl')
  }
  if (draft.notifyType === 'bark' && !isHttpUrl(draft.barkUrl)) {
    errors.barkUrl = t('settings.errorHttpUrl')
  }
  if (draft.notifyType === 'gotify') {
    if (!isHttpUrl(draft.gotifyUrl)) {
      errors.gotifyUrl = t('settings.errorHttpUrl')
    }
    if (!draft.gotifyToken.trim()) {
      errors.gotifyToken = t('settings.errorRequired')
    }
    if (
      !Number.isInteger(draft.gotifyPriority) ||
      draft.gotifyPriority < 0 ||
      draft.gotifyPriority > 10
    ) {
      errors.gotifyPriority = t('settings.errorGotifyPriority')
    }
  }

  return Object.keys(errors).length === 0
}

function saveNotification(): void {
  if (!isMockApi) {
    toast.error(t('settings.prototypeSecurityNotice'))
    return
  }
  if (!validate()) return
  prototype?.saveNotification({ ...draft })
  toast.success(t('settings.prototypeNotificationSaved'))
}

function changeLocale(value: string): void {
  setLocale(value)
}

function changeTheme(value: string): void {
  themeMode.value = value as ThemePreference
}
</script>

<template>
  <ConsoleCard :padded="false" class="overflow-hidden">
    <header
      class="flex items-center justify-between gap-5 border-b border-[var(--border-subtle)] px-6 py-6 sm:px-7"
    >
      <div class="flex min-w-0 items-center gap-3">
        <SlidersHorizontal
          :size="20"
          :stroke-width="1.8"
          class="shrink-0 text-[var(--text-tertiary)]"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <h2 class="truncate text-xl font-semibold text-[var(--text-primary)]">
            {{ t('settings.preferencesPanel') }}
          </h2>
          <p class="mt-1 text-sm leading-5 text-[var(--text-tertiary)]">
            {{ t('settings.preferencesSubtitle') }}
          </p>
        </div>
      </div>
      <span
        class="font-mono text-[10px] tracking-[0.16em] text-[var(--text-tertiary)]"
        >PREFERENCES</span
      >
    </header>

    <section>
      <SettingsSectionHeading
        index="01"
        :icon="Bell"
        :title="t('settings.notificationSettings')"
      />
      <div
        class="space-y-6 border-t border-[var(--border-subtle)] px-5 py-5 sm:px-6"
      >
        <div>
          <p class="settings-field-label">
            {{ t('settings.notificationMethod') }}
          </p>
          <div
            class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="radiogroup"
            :aria-label="t('settings.notificationMethod')"
          >
            <button
              v-for="method in notificationMethods"
              :key="method.value"
              type="button"
              role="radio"
              :aria-checked="draft.notifyType === method.value"
              :disabled="!isMockApi"
              class="notification-method focus-ring"
              :class="{
                'notification-method-active': draft.notifyType === method.value,
              }"
              @click="setNotifyType(method.value)"
            >
              <component :is="method.icon" :size="19" aria-hidden="true" />
              <span>{{ t(method.labelKey) }}</span>
            </button>
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <label class="block sm:col-span-2">
            <span class="settings-field-label">{{
              t('settings.quotaWarningThreshold')
            }}</span>
            <input
              v-model.number="draft.quotaWarningThreshold"
              type="number"
              min="1"
              :disabled="!isMockApi"
              class="settings-input mt-2"
              :aria-invalid="Boolean(errors.quotaWarningThreshold)"
            />
            <span
              v-if="errors.quotaWarningThreshold"
              class="settings-field-error"
              >{{ errors.quotaWarningThreshold }}</span
            >
            <span v-else class="settings-field-hint">{{
              t('settings.quotaWarningHint')
            }}</span>
          </label>

          <label
            v-if="draft.notifyType === 'email'"
            class="block sm:col-span-2"
          >
            <span class="settings-field-label">{{
              t('settings.notificationEmail')
            }}</span>
            <input
              v-model.trim="draft.notificationEmail"
              type="email"
              :disabled="!isMockApi"
              class="settings-input mt-2"
              :placeholder="t('settings.notificationEmailPlaceholder')"
              :aria-invalid="Boolean(errors.notificationEmail)"
            />
            <span
              v-if="errors.notificationEmail"
              class="settings-field-error"
              >{{ errors.notificationEmail }}</span
            >
          </label>

          <template v-if="draft.notifyType === 'webhook'">
            <label class="block sm:col-span-2">
              <span class="settings-field-label">{{
                t('settings.webhookUrl')
              }}</span>
              <input
                v-model.trim="draft.webhookUrl"
                type="url"
                :disabled="!isMockApi"
                class="settings-input mt-2"
                placeholder="https://example.com/webhook"
                :aria-invalid="Boolean(errors.webhookUrl)"
              />
              <span v-if="errors.webhookUrl" class="settings-field-error">{{
                errors.webhookUrl
              }}</span>
            </label>
            <label class="block sm:col-span-2">
              <span class="settings-field-label">{{
                t('settings.webhookSecret')
              }}</span>
              <input
                v-model="draft.webhookSecret"
                type="password"
                :disabled="!isMockApi"
                class="settings-input mt-2"
                autocomplete="off"
              />
            </label>
          </template>

          <label v-if="draft.notifyType === 'bark'" class="block sm:col-span-2">
            <span class="settings-field-label">{{
              t('settings.barkUrl')
            }}</span>
            <input
              v-model.trim="draft.barkUrl"
              type="url"
              :disabled="!isMockApi"
              class="settings-input mt-2"
              placeholder="https://api.day.app/key/{{title}}/{{content}}"
              :aria-invalid="Boolean(errors.barkUrl)"
            />
            <span v-if="errors.barkUrl" class="settings-field-error">{{
              errors.barkUrl
            }}</span>
          </label>

          <template v-if="draft.notifyType === 'gotify'">
            <label class="block sm:col-span-2">
              <span class="settings-field-label">{{
                t('settings.gotifyUrl')
              }}</span>
              <input
                v-model.trim="draft.gotifyUrl"
                type="url"
                :disabled="!isMockApi"
                class="settings-input mt-2"
                placeholder="https://gotify.example.com"
                :aria-invalid="Boolean(errors.gotifyUrl)"
              />
              <span v-if="errors.gotifyUrl" class="settings-field-error">{{
                errors.gotifyUrl
              }}</span>
            </label>
            <label class="block">
              <span class="settings-field-label">{{
                t('settings.gotifyToken')
              }}</span>
              <input
                v-model="draft.gotifyToken"
                type="password"
                :disabled="!isMockApi"
                class="settings-input mt-2"
                autocomplete="off"
                :aria-invalid="Boolean(errors.gotifyToken)"
              />
              <span v-if="errors.gotifyToken" class="settings-field-error">{{
                errors.gotifyToken
              }}</span>
            </label>
            <label class="block">
              <span class="settings-field-label">{{
                t('settings.gotifyPriority')
              }}</span>
              <input
                v-model.number="draft.gotifyPriority"
                type="number"
                min="0"
                max="10"
                :disabled="!isMockApi"
                class="settings-input mt-2"
                :aria-invalid="Boolean(errors.gotifyPriority)"
              />
              <span v-if="errors.gotifyPriority" class="settings-field-error">{{
                errors.gotifyPriority
              }}</span>
            </label>
          </template>
        </div>

        <div
          class="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]"
        >
          <div class="settings-toggle-row">
            <div>
              <p class="settings-toggle-title">
                {{ t('settings.walletQuotaReminder') }}
              </p>
              <p class="settings-toggle-description">
                {{ t('settings.walletQuotaReminderDesc') }}
              </p>
            </div>
            <ConsoleToggle
              v-model="draft.walletReminder"
              :label="t('settings.walletQuotaReminder')"
              :disabled="!isMockApi"
            />
          </div>
          <div class="settings-toggle-row">
            <div>
              <p class="settings-toggle-title">
                {{ t('settings.subscriptionQuotaReminder') }}
              </p>
              <p class="settings-toggle-description">
                {{ t('settings.subscriptionQuotaReminderDesc') }}
              </p>
            </div>
            <ConsoleToggle
              v-model="draft.subscriptionReminder"
              :label="t('settings.subscriptionQuotaReminder')"
              :disabled="!isMockApi"
            />
          </div>
        </div>

        <div class="flex justify-end">
          <ConsoleButton :disabled="!isMockApi" @click="saveNotification">{{
            t('settings.saveNotificationSettings')
          }}</ConsoleButton>
        </div>
      </div>
    </section>

    <section class="border-t border-[var(--border-subtle)]">
      <SettingsSectionHeading
        index="02"
        :icon="Palette"
        :title="t('settings.appearanceInterface')"
      />
      <div
        class="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]"
      >
        <div class="settings-preference-row">
          <div class="flex min-w-0 items-center gap-3">
            <Languages
              :size="18"
              class="shrink-0 text-[var(--text-tertiary)]"
              aria-hidden="true"
            />
            <span class="settings-toggle-title">{{
              t('settings.language')
            }}</span>
          </div>
          <FilterSelect
            :model-value="locale"
            :options="localeOptions"
            :label="t('settings.language')"
            class="w-full sm:w-44"
            @update:model-value="changeLocale"
          />
        </div>
        <div class="settings-preference-row">
          <div class="flex min-w-0 items-center gap-3">
            <Palette
              :size="18"
              class="shrink-0 text-[var(--text-tertiary)]"
              aria-hidden="true"
            />
            <span class="settings-toggle-title">{{ t('settings.theme') }}</span>
          </div>
          <SegmentedToggle
            :model-value="themeMode"
            :options="themeOptions"
            :label="t('settings.theme')"
            size="sm"
            @update:model-value="changeTheme"
          />
        </div>
        <div class="settings-toggle-row">
          <div class="flex min-w-0 items-start gap-3">
            <EyeOff
              :size="18"
              class="mt-0.5 shrink-0 text-[var(--text-tertiary)]"
              aria-hidden="true"
            />
            <div>
              <p class="settings-toggle-title">
                {{ t('settings.hideBalance') }}
              </p>
              <p class="settings-toggle-description">
                {{ t('settings.hideBalanceDesc') }}
              </p>
            </div>
          </div>
          <ConsoleToggle
            v-model="balanceHidden"
            :label="t('settings.hideBalance')"
          />
        </div>
      </div>
    </section>

    <section class="border-t border-[var(--border-subtle)]">
      <SettingsSectionHeading
        index="03"
        :icon="RadioTower"
        :title="t('settings.behaviorPreferences')"
      />
      <div
        class="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]"
      >
        <div v-if="isAdmin" class="settings-toggle-row">
          <div>
            <p class="settings-toggle-title">
              {{ t('settings.upstreamModelUpdates') }}
            </p>
            <p class="settings-toggle-description">
              {{ t('settings.upstreamModelUpdatesDesc') }}
            </p>
          </div>
          <ConsoleToggle
            v-model="draft.upstreamModelUpdateNotify"
            :label="t('settings.upstreamModelUpdates')"
            :disabled="!isMockApi"
          />
        </div>
        <div class="settings-toggle-row">
          <div>
            <p class="settings-toggle-title">
              {{ t('settings.acceptUnpricedModels') }}
            </p>
            <p class="settings-toggle-description">
              {{ t('settings.acceptUnpricedModelsDesc') }}
            </p>
          </div>
          <ConsoleToggle
            v-model="draft.acceptUnsetModelPrice"
            :label="t('settings.acceptUnpricedModels')"
            :disabled="!isMockApi"
          />
        </div>
        <div class="settings-toggle-row">
          <div>
            <p class="settings-toggle-title">
              {{ t('settings.recordIpAddress') }}
            </p>
            <p class="settings-toggle-description">
              {{ t('settings.recordIpAddressDesc') }}
            </p>
          </div>
          <ConsoleToggle
            v-model="draft.recordIpLog"
            :label="t('settings.recordIpAddress')"
            :disabled="!isMockApi"
          />
        </div>
      </div>
    </section>
  </ConsoleCard>
</template>

<style scoped>
.notification-method {
  display: flex;
  min-width: 0;
  min-height: 4.5rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  transition:
    border-color 150ms ease,
    background-color 150ms ease,
    color 150ms ease;
}

.notification-method:hover,
.notification-method-active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}

.settings-field-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-input {
  width: 100%;
  height: 2.75rem;
  border: 1px solid var(--border-default);
  border-radius: 0.625rem;
  background: var(--surface-solid);
  padding: 0 0.875rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  outline: none;
}

.settings-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.settings-input[aria-invalid='true'] {
  border-color: var(--status-danger);
}

.settings-field-hint,
.settings-field-error {
  display: block;
  margin-top: 0.375rem;
  font-size: 0.75rem;
}

.settings-field-hint {
  color: var(--text-tertiary);
}

.settings-field-error {
  color: var(--status-danger-text);
}

.settings-toggle-row,
.settings-preference-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 4.75rem;
  padding: 1rem 1.5rem;
}

.settings-toggle-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-toggle-description {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-tertiary);
}

@media (max-width: 639px) {
  .settings-preference-row {
    align-items: stretch;
    flex-direction: column;
  }

  .settings-toggle-row,
  .settings-preference-row {
    padding-inline: 1.25rem;
  }
}
</style>
