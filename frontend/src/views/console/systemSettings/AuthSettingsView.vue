<script setup lang="ts">
import { reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useSystemSettings } from '@/composables/useSystemSettings'
import SysSettingsFormCard from '@/components/console/systemSettings/SysSettingsFormCard.vue'
import SysInputRow from '@/components/console/systemSettings/SysInputRow.vue'
import SysToggleRow from '@/components/console/systemSettings/SysToggleRow.vue'

const { t } = useI18n()
const toast = useToast()
const { settings, load, saveOptions } = useSystemSettings()

// ── Basic Auth ──────────────────────────────────────────────────────────────
const basic = reactive({
  PasswordLoginEnabled: true,
  RegisterEnabled: true,
  PasswordRegisterEnabled: true,
  EmailVerificationEnabled: false,
  EmailDomainRestrictionEnabled: false,
  EmailAliasRestrictionEnabled: false,
  EmailDomainWhitelist: '',
})
const basicSaving = reactive({ value: false })

const basicDirty = computed(() => {
  // EmailDomainWhitelist is stored as newline-separated locally but
  // comma-separated in settings; normalise both sides before comparing.
  const localWhitelist = basic.EmailDomainWhitelist
    .split('\n').map((d) => d.trim()).filter(Boolean).join(',')
  return basic.PasswordLoginEnabled !== settings.value.PasswordLoginEnabled ||
    basic.RegisterEnabled !== settings.value.RegisterEnabled ||
    basic.PasswordRegisterEnabled !== settings.value.PasswordRegisterEnabled ||
    basic.EmailVerificationEnabled !== settings.value.EmailVerificationEnabled ||
    basic.EmailDomainRestrictionEnabled !== settings.value.EmailDomainRestrictionEnabled ||
    basic.EmailAliasRestrictionEnabled !== settings.value.EmailAliasRestrictionEnabled ||
    localWhitelist !== settings.value.EmailDomainWhitelist
})

async function saveBasic() {
  basicSaving.value = true
  const s = settings.value
  const patch: Record<string, string | boolean> = {}
  if (basic.PasswordLoginEnabled !== s.PasswordLoginEnabled)
    patch.PasswordLoginEnabled = basic.PasswordLoginEnabled
  if (basic.RegisterEnabled !== s.RegisterEnabled)
    patch.RegisterEnabled = basic.RegisterEnabled
  if (basic.PasswordRegisterEnabled !== s.PasswordRegisterEnabled)
    patch.PasswordRegisterEnabled = basic.PasswordRegisterEnabled
  if (basic.EmailVerificationEnabled !== s.EmailVerificationEnabled)
    patch.EmailVerificationEnabled = basic.EmailVerificationEnabled
  if (basic.EmailDomainRestrictionEnabled !== s.EmailDomainRestrictionEnabled)
    patch.EmailDomainRestrictionEnabled = basic.EmailDomainRestrictionEnabled
  if (basic.EmailAliasRestrictionEnabled !== s.EmailAliasRestrictionEnabled)
    patch.EmailAliasRestrictionEnabled = basic.EmailAliasRestrictionEnabled
  if (basic.EmailDomainWhitelist !== s.EmailDomainWhitelist) {
    // normalize: newline-separated → comma-separated
    patch.EmailDomainWhitelist = basic.EmailDomainWhitelist
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean)
      .join(',')
  }
  const ok = await saveOptions(patch)
  basicSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── GitHub OAuth ────────────────────────────────────────────────────────────
const github = reactive({
  GitHubOAuthEnabled: false,
  GitHubClientId: '',
  GitHubClientSecret: '',
})
const githubSaving = reactive({ value: false })
const githubDirty = computed(() =>
  github.GitHubOAuthEnabled !== settings.value.GitHubOAuthEnabled ||
  github.GitHubClientId !== settings.value.GitHubClientId ||
  github.GitHubClientSecret !== settings.value.GitHubClientSecret
)
async function saveGithub() {
  githubSaving.value = true
  const s = settings.value
  const patch: Record<string, string | boolean> = {}
  if (github.GitHubOAuthEnabled !== s.GitHubOAuthEnabled)
    patch.GitHubOAuthEnabled = github.GitHubOAuthEnabled
  if (github.GitHubClientId !== s.GitHubClientId)
    patch.GitHubClientId = github.GitHubClientId
  if (github.GitHubClientSecret !== s.GitHubClientSecret)
    patch.GitHubClientSecret = github.GitHubClientSecret
  const ok = await saveOptions(patch)
  githubSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Discord OAuth ───────────────────────────────────────────────────────────
const discord = reactive({
  'discord.enabled': false,
  'discord.client_id': '',
  'discord.client_secret': '',
})
const discordSaving = reactive({ value: false })
const discordDirty = computed(() =>
  discord['discord.enabled'] !== settings.value['discord.enabled'] ||
  discord['discord.client_id'] !== settings.value['discord.client_id'] ||
  discord['discord.client_secret'] !== settings.value['discord.client_secret']
)
async function saveDiscord() {
  discordSaving.value = true
  const s = settings.value
  const patch: Record<string, string | boolean> = {}
  if (discord['discord.enabled'] !== s['discord.enabled'])
    patch['discord.enabled'] = discord['discord.enabled']
  if (discord['discord.client_id'] !== s['discord.client_id'])
    patch['discord.client_id'] = discord['discord.client_id']
  if (discord['discord.client_secret'] !== s['discord.client_secret'])
    patch['discord.client_secret'] = discord['discord.client_secret']
  const ok = await saveOptions(patch)
  discordSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Telegram OAuth ──────────────────────────────────────────────────────────
const telegram = reactive({
  TelegramOAuthEnabled: false,
  TelegramBotToken: '',
  TelegramBotName: '',
})
const telegramSaving = reactive({ value: false })
const telegramDirty = computed(() =>
  telegram.TelegramOAuthEnabled !== settings.value.TelegramOAuthEnabled ||
  telegram.TelegramBotToken !== settings.value.TelegramBotToken ||
  telegram.TelegramBotName !== settings.value.TelegramBotName
)
async function saveTelegram() {
  telegramSaving.value = true
  const s = settings.value
  const patch: Record<string, string | boolean> = {}
  if (telegram.TelegramOAuthEnabled !== s.TelegramOAuthEnabled)
    patch.TelegramOAuthEnabled = telegram.TelegramOAuthEnabled
  if (telegram.TelegramBotToken !== s.TelegramBotToken)
    patch.TelegramBotToken = telegram.TelegramBotToken
  if (telegram.TelegramBotName !== s.TelegramBotName)
    patch.TelegramBotName = telegram.TelegramBotName
  const ok = await saveOptions(patch)
  telegramSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Turnstile ───────────────────────────────────────────────────────────────
const turnstile = reactive({
  TurnstileCheckEnabled: false,
  TurnstileSiteKey: '',
  TurnstileSecretKey: '',
})
const turnstileSaving = reactive({ value: false })
const turnstileDirty = computed(() =>
  turnstile.TurnstileCheckEnabled !== settings.value.TurnstileCheckEnabled ||
  turnstile.TurnstileSiteKey !== settings.value.TurnstileSiteKey ||
  turnstile.TurnstileSecretKey !== settings.value.TurnstileSecretKey
)
async function saveTurnstile() {
  turnstileSaving.value = true
  const s = settings.value
  const patch: Record<string, string | boolean> = {}
  if (turnstile.TurnstileCheckEnabled !== s.TurnstileCheckEnabled)
    patch.TurnstileCheckEnabled = turnstile.TurnstileCheckEnabled
  if (turnstile.TurnstileSiteKey !== s.TurnstileSiteKey)
    patch.TurnstileSiteKey = turnstile.TurnstileSiteKey
  if (turnstile.TurnstileSecretKey !== s.TurnstileSecretKey)
    patch.TurnstileSecretKey = turnstile.TurnstileSecretKey
  const ok = await saveOptions(patch)
  turnstileSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

onMounted(async () => {
  await load()
  const s = settings.value
  Object.assign(basic, {
    PasswordLoginEnabled: s.PasswordLoginEnabled,
    RegisterEnabled: s.RegisterEnabled,
    PasswordRegisterEnabled: s.PasswordRegisterEnabled,
    EmailVerificationEnabled: s.EmailVerificationEnabled,
    EmailDomainRestrictionEnabled: s.EmailDomainRestrictionEnabled,
    EmailAliasRestrictionEnabled: s.EmailAliasRestrictionEnabled,
    // store newline-separated for textarea UX
    EmailDomainWhitelist: s.EmailDomainWhitelist
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
      .join('\n'),
  })
  Object.assign(github, {
    GitHubOAuthEnabled: s.GitHubOAuthEnabled,
    GitHubClientId: s.GitHubClientId,
    GitHubClientSecret: s.GitHubClientSecret,
  })
  Object.assign(discord, {
    'discord.enabled': s['discord.enabled'],
    'discord.client_id': s['discord.client_id'],
    'discord.client_secret': s['discord.client_secret'],
  })
  Object.assign(telegram, {
    TelegramOAuthEnabled: s.TelegramOAuthEnabled,
    TelegramBotToken: s.TelegramBotToken,
    TelegramBotName: s.TelegramBotName,
  })
  Object.assign(turnstile, {
    TurnstileCheckEnabled: s.TurnstileCheckEnabled,
    TurnstileSiteKey: s.TurnstileSiteKey,
    TurnstileSecretKey: s.TurnstileSecretKey,
  })
})
</script>

<template>
  <div class="space-y-6">
    <!-- Basic Auth -->
    <SysSettingsFormCard
      :title="t('systemSettings.auth.basicAuth')"
      :saving="basicSaving.value"
      :dirty="basicDirty"
      @save="saveBasic"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="basic.PasswordLoginEnabled"
          :label="t('systemSettings.auth.passwordLogin')"
          :description="t('systemSettings.auth.passwordLoginDesc')"
        />
        <SysToggleRow
          v-model="basic.RegisterEnabled"
          :label="t('systemSettings.auth.registerEnabled')"
          :description="t('systemSettings.auth.registerEnabledDesc')"
        />
        <SysToggleRow
          v-model="basic.PasswordRegisterEnabled"
          :label="t('systemSettings.auth.passwordRegister')"
          :description="t('systemSettings.auth.passwordRegisterDesc')"
        />
        <SysToggleRow
          v-model="basic.EmailVerificationEnabled"
          :label="t('systemSettings.auth.emailVerification')"
          :description="t('systemSettings.auth.emailVerificationDesc')"
        />
        <SysToggleRow
          v-model="basic.EmailDomainRestrictionEnabled"
          :label="t('systemSettings.auth.emailDomainRestriction')"
          :description="t('systemSettings.auth.emailDomainRestrictionDesc')"
        />
        <SysToggleRow
          v-model="basic.EmailAliasRestrictionEnabled"
          :label="t('systemSettings.auth.emailAliasRestriction')"
          :description="t('systemSettings.auth.emailAliasRestrictionDesc')"
        />
      </div>
      <div class="mt-4">
        <SysInputRow
          v-model="basic.EmailDomainWhitelist"
          :label="t('systemSettings.auth.emailDomainWhitelist')"
          :description="t('systemSettings.auth.emailDomainWhitelistDesc')"
          :placeholder="t('systemSettings.auth.emailDomainWhitelistPlaceholder')"
          :rows="4"
        />
      </div>
    </SysSettingsFormCard>

    <!-- GitHub OAuth -->
    <SysSettingsFormCard
      :title="t('systemSettings.auth.github')"
      :saving="githubSaving.value"
      :dirty="githubDirty"
      @save="saveGithub"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="github.GitHubOAuthEnabled"
          :label="t('systemSettings.auth.githubEnabled')"
        />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <SysInputRow
          v-model="github.GitHubClientId"
          :label="t('systemSettings.auth.githubClientId')"
          autocomplete="off"
        />
        <SysInputRow
          v-model="github.GitHubClientSecret"
          :label="t('systemSettings.auth.githubClientSecret')"
          type="password"
          autocomplete="off"
        />
      </div>
    </SysSettingsFormCard>

    <!-- Discord OAuth -->
    <SysSettingsFormCard
      :title="t('systemSettings.auth.discord')"
      :saving="discordSaving.value"
      :dirty="discordDirty"
      @save="saveDiscord"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="discord['discord.enabled']"
          :label="t('systemSettings.auth.discordEnabled')"
        />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <SysInputRow
          v-model="discord['discord.client_id']"
          :label="t('systemSettings.auth.discordClientId')"
          autocomplete="off"
        />
        <SysInputRow
          v-model="discord['discord.client_secret']"
          :label="t('systemSettings.auth.discordClientSecret')"
          type="password"
          autocomplete="off"
        />
      </div>
    </SysSettingsFormCard>

    <!-- Telegram OAuth -->
    <SysSettingsFormCard
      :title="t('systemSettings.auth.telegram')"
      :saving="telegramSaving.value"
      :dirty="telegramDirty"
      @save="saveTelegram"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="telegram.TelegramOAuthEnabled"
          :label="t('systemSettings.auth.telegramEnabled')"
        />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <SysInputRow
          v-model="telegram.TelegramBotToken"
          :label="t('systemSettings.auth.telegramBotToken')"
          type="password"
          autocomplete="off"
        />
        <SysInputRow
          v-model="telegram.TelegramBotName"
          :label="t('systemSettings.auth.telegramBotName')"
          placeholder="MyBot"
          autocomplete="off"
        />
      </div>
    </SysSettingsFormCard>

    <!-- Bot Protection -->
    <SysSettingsFormCard
      :title="t('systemSettings.auth.botProtection')"
      :saving="turnstileSaving.value"
      :dirty="turnstileDirty"
      @save="saveTurnstile"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="turnstile.TurnstileCheckEnabled"
          :label="t('systemSettings.auth.turnstileEnabled')"
          :description="t('systemSettings.auth.turnstileEnabledDesc')"
        />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <SysInputRow
          v-model="turnstile.TurnstileSiteKey"
          :label="t('systemSettings.auth.turnstileSiteKey')"
          autocomplete="off"
        />
        <SysInputRow
          v-model="turnstile.TurnstileSecretKey"
          :label="t('systemSettings.auth.turnstileSecretKey')"
          type="password"
          autocomplete="off"
        />
      </div>
    </SysSettingsFormCard>
  </div>
</template>
