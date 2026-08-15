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

// ── Global Config ───────────────────────────────────────────────────────────
const global = reactive({
  'global.pass_through_request_enabled': false,
  'general_setting.ping_interval_enabled': false,
  'general_setting.ping_interval_seconds': 60,
})
const globalSaving = reactive({ value: false })
const globalDirty = computed(() => {
  const s = settings.value
  return (
    global['global.pass_through_request_enabled'] !==
      s['global.pass_through_request_enabled'] ||
    global['general_setting.ping_interval_enabled'] !==
      s['general_setting.ping_interval_enabled'] ||
    global['general_setting.ping_interval_seconds'] !==
      s['general_setting.ping_interval_seconds']
  )
})
async function saveGlobal() {
  globalSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (
    global['global.pass_through_request_enabled'] !==
    s['global.pass_through_request_enabled']
  )
    patch['global.pass_through_request_enabled'] =
      global['global.pass_through_request_enabled']
  if (
    global['general_setting.ping_interval_enabled'] !==
    s['general_setting.ping_interval_enabled']
  )
    patch['general_setting.ping_interval_enabled'] =
      global['general_setting.ping_interval_enabled']
  if (
    global['general_setting.ping_interval_seconds'] !==
    s['general_setting.ping_interval_seconds']
  )
    patch['general_setting.ping_interval_seconds'] =
      global['general_setting.ping_interval_seconds']
  const ok = await saveOptions(patch)
  globalSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Routing Reliability ─────────────────────────────────────────────────────
const routing = reactive({
  RetryTimes: 0,
  ChannelDisableThreshold: 5,
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 60,
})
const routingSaving = reactive({ value: false })
const routingDirty = computed(() => {
  const s = settings.value
  return (
    routing.RetryTimes !== s.RetryTimes ||
    routing.ChannelDisableThreshold !== s.ChannelDisableThreshold ||
    routing.AutomaticDisableChannelEnabled !==
      s.AutomaticDisableChannelEnabled ||
    routing.AutomaticEnableChannelEnabled !== s.AutomaticEnableChannelEnabled ||
    routing['monitor_setting.auto_test_channel_enabled'] !==
      s['monitor_setting.auto_test_channel_enabled'] ||
    routing['monitor_setting.auto_test_channel_minutes'] !==
      s['monitor_setting.auto_test_channel_minutes']
  )
})
async function saveRouting() {
  routingSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (routing.RetryTimes !== s.RetryTimes) patch.RetryTimes = routing.RetryTimes
  if (routing.ChannelDisableThreshold !== s.ChannelDisableThreshold)
    patch.ChannelDisableThreshold = routing.ChannelDisableThreshold
  if (
    routing.AutomaticDisableChannelEnabled !== s.AutomaticDisableChannelEnabled
  )
    patch.AutomaticDisableChannelEnabled =
      routing.AutomaticDisableChannelEnabled
  if (routing.AutomaticEnableChannelEnabled !== s.AutomaticEnableChannelEnabled)
    patch.AutomaticEnableChannelEnabled = routing.AutomaticEnableChannelEnabled
  if (
    routing['monitor_setting.auto_test_channel_enabled'] !==
    s['monitor_setting.auto_test_channel_enabled']
  )
    patch['monitor_setting.auto_test_channel_enabled'] =
      routing['monitor_setting.auto_test_channel_enabled']
  if (
    routing['monitor_setting.auto_test_channel_minutes'] !==
    s['monitor_setting.auto_test_channel_minutes']
  )
    patch['monitor_setting.auto_test_channel_minutes'] =
      routing['monitor_setting.auto_test_channel_minutes']
  const ok = await saveOptions(patch)
  routingSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Channel Affinity ────────────────────────────────────────────────────────
const affinity = reactive({
  'channel_affinity_setting.enabled': false,
  'channel_affinity_setting.switch_on_success': false,
  'channel_affinity_setting.default_ttl_seconds': 3600,
})
const affinitySaving = reactive({ value: false })
const affinityDirty = computed(() => {
  const s = settings.value
  return (
    affinity['channel_affinity_setting.enabled'] !==
      s['channel_affinity_setting.enabled'] ||
    affinity['channel_affinity_setting.switch_on_success'] !==
      s['channel_affinity_setting.switch_on_success'] ||
    affinity['channel_affinity_setting.default_ttl_seconds'] !==
      s['channel_affinity_setting.default_ttl_seconds']
  )
})
async function saveAffinity() {
  affinitySaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (
    affinity['channel_affinity_setting.enabled'] !==
    s['channel_affinity_setting.enabled']
  )
    patch['channel_affinity_setting.enabled'] =
      affinity['channel_affinity_setting.enabled']
  if (
    affinity['channel_affinity_setting.switch_on_success'] !==
    s['channel_affinity_setting.switch_on_success']
  )
    patch['channel_affinity_setting.switch_on_success'] =
      affinity['channel_affinity_setting.switch_on_success']
  if (
    affinity['channel_affinity_setting.default_ttl_seconds'] !==
    s['channel_affinity_setting.default_ttl_seconds']
  )
    patch['channel_affinity_setting.default_ttl_seconds'] =
      affinity['channel_affinity_setting.default_ttl_seconds']
  const ok = await saveOptions(patch)
  affinitySaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Claude ──────────────────────────────────────────────────────────────────
const claude = reactive({
  'claude.default_max_tokens': 0,
  'claude.thinking_adapter_enabled': false,
})
const claudeSaving = reactive({ value: false })
const claudeDirty = computed(() => {
  const s = settings.value
  return (
    claude['claude.default_max_tokens'] !== s['claude.default_max_tokens'] ||
    claude['claude.thinking_adapter_enabled'] !==
      s['claude.thinking_adapter_enabled']
  )
})
async function saveClaude() {
  claudeSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (claude['claude.default_max_tokens'] !== s['claude.default_max_tokens'])
    patch['claude.default_max_tokens'] = claude['claude.default_max_tokens']
  if (
    claude['claude.thinking_adapter_enabled'] !==
    s['claude.thinking_adapter_enabled']
  )
    patch['claude.thinking_adapter_enabled'] =
      claude['claude.thinking_adapter_enabled']
  const ok = await saveOptions(patch)
  claudeSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

onMounted(async () => {
  await load()
  const s = settings.value
  Object.assign(global, {
    'global.pass_through_request_enabled':
      s['global.pass_through_request_enabled'],
    'general_setting.ping_interval_enabled':
      s['general_setting.ping_interval_enabled'],
    'general_setting.ping_interval_seconds':
      s['general_setting.ping_interval_seconds'],
  })
  Object.assign(routing, {
    RetryTimes: s.RetryTimes,
    ChannelDisableThreshold: s.ChannelDisableThreshold,
    AutomaticDisableChannelEnabled: s.AutomaticDisableChannelEnabled,
    AutomaticEnableChannelEnabled: s.AutomaticEnableChannelEnabled,
    'monitor_setting.auto_test_channel_enabled':
      s['monitor_setting.auto_test_channel_enabled'],
    'monitor_setting.auto_test_channel_minutes':
      s['monitor_setting.auto_test_channel_minutes'],
  })
  Object.assign(affinity, {
    'channel_affinity_setting.enabled': s['channel_affinity_setting.enabled'],
    'channel_affinity_setting.switch_on_success':
      s['channel_affinity_setting.switch_on_success'],
    'channel_affinity_setting.default_ttl_seconds':
      s['channel_affinity_setting.default_ttl_seconds'],
  })
  Object.assign(claude, {
    'claude.default_max_tokens': s['claude.default_max_tokens'],
    'claude.thinking_adapter_enabled': s['claude.thinking_adapter_enabled'],
  })
})
</script>

<template>
  <div class="space-y-6">
    <!-- Global Config -->
    <SysSettingsFormCard
      :title="t('systemSettings.models.globalConfig')"
      :saving="globalSaving.value"
      :dirty="globalDirty"
      @save="saveGlobal"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="global['global.pass_through_request_enabled']"
          :label="t('systemSettings.models.passThroughRequest')"
          :description="t('systemSettings.models.passThroughRequestDesc')"
        />
        <SysToggleRow
          v-model="global['general_setting.ping_interval_enabled']"
          :label="t('systemSettings.models.pingInterval')"
          :description="t('systemSettings.models.pingIntervalDesc')"
        />
      </div>
      <div v-if="global['general_setting.ping_interval_enabled']" class="mt-4">
        <SysInputRow
          :label="t('systemSettings.models.pingIntervalSeconds')"
          :model-value="String(global['general_setting.ping_interval_seconds'])"
          type="number"
          @update:model-value="
            global['general_setting.ping_interval_seconds'] =
              Number($event) || 60
          "
        />
      </div>
    </SysSettingsFormCard>

    <!-- Routing Reliability -->
    <SysSettingsFormCard
      :title="t('systemSettings.models.routingReliability')"
      :saving="routingSaving.value"
      :dirty="routingDirty"
      @save="saveRouting"
    >
      <div class="grid gap-4 sm:grid-cols-2 mb-4">
        <SysInputRow
          :label="t('systemSettings.models.retryTimes')"
          :description="t('systemSettings.models.retryTimesDesc')"
          :model-value="String(routing.RetryTimes)"
          type="number"
          @update:model-value="routing.RetryTimes = Number($event) || 0"
        />
        <SysInputRow
          :label="t('systemSettings.models.channelDisableThreshold')"
          :description="t('systemSettings.models.channelDisableThresholdDesc')"
          :model-value="String(routing.ChannelDisableThreshold)"
          type="number"
          @update:model-value="
            routing.ChannelDisableThreshold = Number($event) || 0
          "
        />
      </div>
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="routing.AutomaticDisableChannelEnabled"
          :label="t('systemSettings.models.autoDisableChannel')"
          :description="t('systemSettings.models.autoDisableChannelDesc')"
        />
        <SysToggleRow
          v-model="routing.AutomaticEnableChannelEnabled"
          :label="t('systemSettings.models.autoEnableChannel')"
          :description="t('systemSettings.models.autoEnableChannelDesc')"
        />
        <SysToggleRow
          v-model="routing['monitor_setting.auto_test_channel_enabled']"
          :label="t('systemSettings.models.autoTestChannel')"
          :description="t('systemSettings.models.autoTestChannelDesc')"
        />
      </div>
      <div
        v-if="routing['monitor_setting.auto_test_channel_enabled']"
        class="mt-4"
      >
        <SysInputRow
          :label="t('systemSettings.models.autoTestMinutes')"
          :model-value="
            String(routing['monitor_setting.auto_test_channel_minutes'])
          "
          type="number"
          @update:model-value="
            routing['monitor_setting.auto_test_channel_minutes'] =
              Number($event) || 60
          "
        />
      </div>
    </SysSettingsFormCard>

    <!-- Channel Affinity -->
    <SysSettingsFormCard
      :title="t('systemSettings.models.channelAffinity')"
      :saving="affinitySaving.value"
      :dirty="affinityDirty"
      @save="saveAffinity"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="affinity['channel_affinity_setting.enabled']"
          :label="t('systemSettings.models.channelAffinityEnabled')"
          :description="t('systemSettings.models.channelAffinityEnabledDesc')"
        />
        <SysToggleRow
          v-model="affinity['channel_affinity_setting.switch_on_success']"
          :label="t('systemSettings.models.channelAffinitySwitchOnSuccess')"
          :description="
            t('systemSettings.models.channelAffinitySwitchOnSuccessDesc')
          "
        />
      </div>
      <div class="mt-4">
        <SysInputRow
          :label="t('systemSettings.models.channelAffinityTtl')"
          :model-value="
            String(affinity['channel_affinity_setting.default_ttl_seconds'])
          "
          type="number"
          @update:model-value="
            affinity['channel_affinity_setting.default_ttl_seconds'] =
              Number($event) || 3600
          "
        />
      </div>
    </SysSettingsFormCard>

    <!-- Claude -->
    <SysSettingsFormCard
      :title="t('systemSettings.models.claude')"
      :saving="claudeSaving.value"
      :dirty="claudeDirty"
      @save="saveClaude"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="claude['claude.thinking_adapter_enabled']"
          :label="t('systemSettings.models.claudeThinkingAdapter')"
          :description="t('systemSettings.models.claudeThinkingAdapterDesc')"
        />
      </div>
      <div class="mt-4">
        <SysInputRow
          :label="t('systemSettings.models.claudeDefaultMaxTokens')"
          :description="t('systemSettings.models.claudeDefaultMaxTokensDesc')"
          :model-value="String(claude['claude.default_max_tokens'])"
          type="number"
          @update:model-value="
            claude['claude.default_max_tokens'] = Number($event) || 0
          "
        />
      </div>
    </SysSettingsFormCard>
  </div>
</template>
