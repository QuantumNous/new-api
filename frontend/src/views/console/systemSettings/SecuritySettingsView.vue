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

// ── Rate Limit ──────────────────────────────────────────────────────────────
const rate = reactive({
  ModelRequestRateLimitEnabled: false,
  ModelRequestRateLimitCount: 60,
  ModelRequestRateLimitDurationMinutes: 1,
})
const rateSaving = reactive({ value: false })
const rateDirty = computed(() => {
  const s = settings.value
  return (
    rate.ModelRequestRateLimitEnabled !== s.ModelRequestRateLimitEnabled ||
    rate.ModelRequestRateLimitCount !== s.ModelRequestRateLimitCount ||
    rate.ModelRequestRateLimitDurationMinutes !==
      s.ModelRequestRateLimitDurationMinutes
  )
})
async function saveRate() {
  rateSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (rate.ModelRequestRateLimitEnabled !== s.ModelRequestRateLimitEnabled)
    patch.ModelRequestRateLimitEnabled = rate.ModelRequestRateLimitEnabled
  if (rate.ModelRequestRateLimitCount !== s.ModelRequestRateLimitCount)
    patch.ModelRequestRateLimitCount = rate.ModelRequestRateLimitCount
  if (
    rate.ModelRequestRateLimitDurationMinutes !==
    s.ModelRequestRateLimitDurationMinutes
  )
    patch.ModelRequestRateLimitDurationMinutes =
      rate.ModelRequestRateLimitDurationMinutes
  const ok = await saveOptions(patch)
  rateSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Sensitive Words ─────────────────────────────────────────────────────────
const sensitive = reactive({
  CheckSensitiveEnabled: false,
  CheckSensitiveOnPromptEnabled: false,
  SensitiveWords: '',
})
const sensitiveSaving = reactive({ value: false })
const sensitiveDirty = computed(() => {
  const s = settings.value
  return (
    sensitive.CheckSensitiveEnabled !== s.CheckSensitiveEnabled ||
    sensitive.CheckSensitiveOnPromptEnabled !==
      s.CheckSensitiveOnPromptEnabled ||
    sensitive.SensitiveWords !== s.SensitiveWords
  )
})
async function saveSensitive() {
  sensitiveSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | string> = {}
  if (sensitive.CheckSensitiveEnabled !== s.CheckSensitiveEnabled)
    patch.CheckSensitiveEnabled = sensitive.CheckSensitiveEnabled
  if (
    sensitive.CheckSensitiveOnPromptEnabled !== s.CheckSensitiveOnPromptEnabled
  )
    patch.CheckSensitiveOnPromptEnabled =
      sensitive.CheckSensitiveOnPromptEnabled
  if (sensitive.SensitiveWords !== s.SensitiveWords)
    patch.SensitiveWords = sensitive.SensitiveWords
  const ok = await saveOptions(patch)
  sensitiveSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── SSRF & Token Limits ─────────────────────────────────────────────────────
const ssrf = reactive({
  'fetch_setting.enable_ssrf_protection': false,
  'fetch_setting.allow_private_ip': false,
  'token_setting.max_user_tokens': 0,
})
const ssrfSaving = reactive({ value: false })
const ssrfDirty = computed(() => {
  const s = settings.value
  return (
    ssrf['fetch_setting.enable_ssrf_protection'] !==
      s['fetch_setting.enable_ssrf_protection'] ||
    ssrf['fetch_setting.allow_private_ip'] !==
      s['fetch_setting.allow_private_ip'] ||
    ssrf['token_setting.max_user_tokens'] !== s['token_setting.max_user_tokens']
  )
})
async function saveSsrf() {
  ssrfSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (
    ssrf['fetch_setting.enable_ssrf_protection'] !==
    s['fetch_setting.enable_ssrf_protection']
  )
    patch['fetch_setting.enable_ssrf_protection'] =
      ssrf['fetch_setting.enable_ssrf_protection']
  if (
    ssrf['fetch_setting.allow_private_ip'] !==
    s['fetch_setting.allow_private_ip']
  )
    patch['fetch_setting.allow_private_ip'] =
      ssrf['fetch_setting.allow_private_ip']
  if (
    ssrf['token_setting.max_user_tokens'] !== s['token_setting.max_user_tokens']
  )
    patch['token_setting.max_user_tokens'] =
      ssrf['token_setting.max_user_tokens']
  const ok = await saveOptions(patch)
  ssrfSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

onMounted(async () => {
  await load()
  const s = settings.value
  Object.assign(rate, {
    ModelRequestRateLimitEnabled: s.ModelRequestRateLimitEnabled,
    ModelRequestRateLimitCount: s.ModelRequestRateLimitCount,
    ModelRequestRateLimitDurationMinutes:
      s.ModelRequestRateLimitDurationMinutes,
  })
  Object.assign(sensitive, {
    CheckSensitiveEnabled: s.CheckSensitiveEnabled,
    CheckSensitiveOnPromptEnabled: s.CheckSensitiveOnPromptEnabled,
    SensitiveWords: s.SensitiveWords,
  })
  Object.assign(ssrf, {
    'fetch_setting.enable_ssrf_protection':
      s['fetch_setting.enable_ssrf_protection'],
    'fetch_setting.allow_private_ip': s['fetch_setting.allow_private_ip'],
    'token_setting.max_user_tokens': s['token_setting.max_user_tokens'],
  })
})
</script>

<template>
  <div class="space-y-6">
    <!-- Rate Limiting -->
    <SysSettingsFormCard
      :title="t('systemSettings.security.rateLimit')"
      :saving="rateSaving.value"
      :dirty="rateDirty"
      @save="saveRate"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="rate.ModelRequestRateLimitEnabled"
          :label="t('systemSettings.security.rateLimitEnabled')"
          :description="t('systemSettings.security.rateLimitEnabledDesc')"
        />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <SysInputRow
          :label="t('systemSettings.security.rateLimitCount')"
          :description="t('systemSettings.security.rateLimitCountDesc')"
          :model-value="String(rate.ModelRequestRateLimitCount)"
          type="number"
          @update:model-value="
            rate.ModelRequestRateLimitCount = Number($event) || 60
          "
        />
        <SysInputRow
          :label="t('systemSettings.security.rateLimitDuration')"
          :model-value="String(rate.ModelRequestRateLimitDurationMinutes)"
          type="number"
          @update:model-value="
            rate.ModelRequestRateLimitDurationMinutes = Number($event) || 1
          "
        />
      </div>
    </SysSettingsFormCard>

    <!-- Sensitive Words -->
    <SysSettingsFormCard
      :title="t('systemSettings.security.sensitiveWords')"
      :saving="sensitiveSaving.value"
      :dirty="sensitiveDirty"
      @save="saveSensitive"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="sensitive.CheckSensitiveEnabled"
          :label="t('systemSettings.security.sensitiveWordsEnabled')"
          :description="t('systemSettings.security.sensitiveWordsEnabledDesc')"
        />
        <SysToggleRow
          v-model="sensitive.CheckSensitiveOnPromptEnabled"
          :label="t('systemSettings.security.sensitiveWordsOnPrompt')"
          :description="t('systemSettings.security.sensitiveWordsOnPromptDesc')"
        />
      </div>
      <div class="mt-4">
        <SysInputRow
          v-model="sensitive.SensitiveWords"
          :label="t('systemSettings.security.sensitiveWordsList')"
          :description="t('systemSettings.security.sensitiveWordsListDesc')"
          :placeholder="
            t('systemSettings.security.sensitiveWordsListPlaceholder')
          "
          :rows="6"
        />
      </div>
    </SysSettingsFormCard>

    <!-- SSRF + Token Limits -->
    <SysSettingsFormCard
      :title="t('systemSettings.security.ssrfProtection')"
      :saving="ssrfSaving.value"
      :dirty="ssrfDirty"
      @save="saveSsrf"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="ssrf['fetch_setting.enable_ssrf_protection']"
          :label="t('systemSettings.security.ssrfEnabled')"
          :description="t('systemSettings.security.ssrfEnabledDesc')"
        />
        <SysToggleRow
          v-model="ssrf['fetch_setting.allow_private_ip']"
          :label="t('systemSettings.security.ssrfAllowPrivateIp')"
          :description="t('systemSettings.security.ssrfAllowPrivateIpDesc')"
        />
      </div>
      <div class="mt-4 border-t border-[var(--border-subtle)] pt-4">
        <p class="mb-3 text-sm font-semibold text-[var(--text-primary)]">
          {{ t('systemSettings.security.tokenLimits') }}
        </p>
        <SysInputRow
          :label="t('systemSettings.security.maxUserTokens')"
          :description="t('systemSettings.security.maxUserTokensDesc')"
          :model-value="String(ssrf['token_setting.max_user_tokens'])"
          type="number"
          @update:model-value="
            ssrf['token_setting.max_user_tokens'] = Number($event) || 0
          "
        />
      </div>
    </SysSettingsFormCard>
  </div>
</template>
