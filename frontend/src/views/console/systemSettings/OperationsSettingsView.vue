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

// ── System Behavior ─────────────────────────────────────────────────────────
const behavior = reactive({
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
})
const behaviorSaving = reactive({ value: false })
const behaviorDirty = computed(() => {
  const s = settings.value
  return (
    behavior.DefaultCollapseSidebar !== s.DefaultCollapseSidebar ||
    behavior.DemoSiteEnabled !== s.DemoSiteEnabled ||
    behavior.SelfUseModeEnabled !== s.SelfUseModeEnabled
  )
})
async function saveBehavior() {
  behaviorSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean> = {}
  if (behavior.DefaultCollapseSidebar !== s.DefaultCollapseSidebar)
    patch.DefaultCollapseSidebar = behavior.DefaultCollapseSidebar
  if (behavior.DemoSiteEnabled !== s.DemoSiteEnabled)
    patch.DemoSiteEnabled = behavior.DemoSiteEnabled
  if (behavior.SelfUseModeEnabled !== s.SelfUseModeEnabled)
    patch.SelfUseModeEnabled = behavior.SelfUseModeEnabled
  const ok = await saveOptions(patch)
  behaviorSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── SMTP ────────────────────────────────────────────────────────────────────
const smtp = reactive({
  SMTPServer: '',
  SMTPPort: '',
  SMTPAccount: '',
  SMTPFrom: '',
  SMTPToken: '',
  SMTPSSLEnabled: false,
  SMTPStartTLSEnabled: false,
  SMTPInsecureSkipVerify: false,
  SMTPForceAuthLogin: false,
})
const smtpSaving = reactive({ value: false })
const smtpDirty = computed(() => {
  const s = settings.value
  return (
    smtp.SMTPServer !== s.SMTPServer ||
    smtp.SMTPPort !== s.SMTPPort ||
    smtp.SMTPAccount !== s.SMTPAccount ||
    smtp.SMTPFrom !== s.SMTPFrom ||
    smtp.SMTPToken !== '' ||
    smtp.SMTPSSLEnabled !== s.SMTPSSLEnabled ||
    smtp.SMTPStartTLSEnabled !== s.SMTPStartTLSEnabled ||
    smtp.SMTPInsecureSkipVerify !== s.SMTPInsecureSkipVerify ||
    smtp.SMTPForceAuthLogin !== s.SMTPForceAuthLogin
  )
})

// SSL/TLS radio helper
type SmtpSecurity = 'none' | 'ssl_tls' | 'starttls'
const smtpSecurity = computed<SmtpSecurity>({
  get() {
    if (smtp.SMTPSSLEnabled) return 'ssl_tls'
    if (smtp.SMTPStartTLSEnabled) return 'starttls'
    return 'none'
  },
  set(v) {
    smtp.SMTPSSLEnabled = v === 'ssl_tls'
    smtp.SMTPStartTLSEnabled = v === 'starttls'
  },
})

async function saveSmtp() {
  smtpSaving.value = true
  const s = settings.value
  const patch: Record<string, string | boolean> = {}
  if (smtp.SMTPServer.trim() !== s.SMTPServer)
    patch.SMTPServer = smtp.SMTPServer.trim()
  if (smtp.SMTPPort.trim() !== s.SMTPPort) patch.SMTPPort = smtp.SMTPPort.trim()
  if (smtp.SMTPAccount.trim() !== s.SMTPAccount)
    patch.SMTPAccount = smtp.SMTPAccount.trim()
  if (smtp.SMTPFrom.trim() !== s.SMTPFrom) patch.SMTPFrom = smtp.SMTPFrom.trim()
  if (smtp.SMTPToken.trim()) patch.SMTPToken = smtp.SMTPToken.trim()
  if (smtp.SMTPSSLEnabled !== s.SMTPSSLEnabled)
    patch.SMTPSSLEnabled = smtp.SMTPSSLEnabled
  if (smtp.SMTPStartTLSEnabled !== s.SMTPStartTLSEnabled)
    patch.SMTPStartTLSEnabled = smtp.SMTPStartTLSEnabled
  if (smtp.SMTPInsecureSkipVerify !== s.SMTPInsecureSkipVerify)
    patch.SMTPInsecureSkipVerify = smtp.SMTPInsecureSkipVerify
  if (smtp.SMTPForceAuthLogin !== s.SMTPForceAuthLogin)
    patch.SMTPForceAuthLogin = smtp.SMTPForceAuthLogin
  const ok = await saveOptions(patch)
  if (ok) smtp.SMTPToken = '' // clear password field after save
  smtpSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Monitoring ──────────────────────────────────────────────────────────────
const monitoring = reactive({
  QuotaRemindThreshold: 1000,
  LogConsumeEnabled: true,
})
const monitoringSaving = reactive({ value: false })
const monitoringDirty = computed(() => {
  const s = settings.value
  return (
    monitoring.QuotaRemindThreshold !== s.QuotaRemindThreshold ||
    monitoring.LogConsumeEnabled !== s.LogConsumeEnabled
  )
})
async function saveMonitoring() {
  monitoringSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (monitoring.QuotaRemindThreshold !== s.QuotaRemindThreshold)
    patch.QuotaRemindThreshold = monitoring.QuotaRemindThreshold
  if (monitoring.LogConsumeEnabled !== s.LogConsumeEnabled)
    patch.LogConsumeEnabled = monitoring.LogConsumeEnabled
  const ok = await saveOptions(patch)
  monitoringSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Worker ──────────────────────────────────────────────────────────────────
const worker = reactive({
  WorkerUrl: '',
  WorkerValidKey: '',
})
const workerSaving = reactive({ value: false })
const workerDirty = computed(() => {
  const s = settings.value
  return (
    worker.WorkerUrl !== s.WorkerUrl ||
    worker.WorkerValidKey !== s.WorkerValidKey
  )
})
async function saveWorker() {
  workerSaving.value = true
  const s = settings.value
  const patch: Record<string, string> = {}
  if (worker.WorkerUrl !== s.WorkerUrl) patch.WorkerUrl = worker.WorkerUrl
  if (worker.WorkerValidKey !== s.WorkerValidKey)
    patch.WorkerValidKey = worker.WorkerValidKey
  const ok = await saveOptions(patch)
  workerSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Performance ─────────────────────────────────────────────────────────────
const perf = reactive({
  'performance_setting.disk_cache_enabled': false,
  'performance_setting.disk_cache_threshold_mb': 10,
  'performance_setting.disk_cache_max_size_mb': 1024,
  'performance_setting.disk_cache_path': '',
  'performance_setting.monitor_enabled': false,
  'performance_setting.monitor_cpu_threshold': 90,
  'performance_setting.monitor_memory_threshold': 90,
  'performance_setting.monitor_disk_threshold': 95,
})
const perfSaving = reactive({ value: false })
const perfKeys = Object.keys(perf) as Array<keyof typeof perf>
const perfDirty = computed(() =>
  perfKeys.some((k) => perf[k] !== settings.value[k])
)
async function savePerf() {
  perfSaving.value = true
  const patch: Record<string, boolean | number | string> = {}
  perfKeys.forEach((k) => {
    if (perf[k] !== settings.value[k]) patch[k] = perf[k]
  })
  const ok = await saveOptions(patch)
  perfSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

onMounted(async () => {
  await load()
  const s = settings.value
  Object.assign(behavior, {
    DefaultCollapseSidebar: s.DefaultCollapseSidebar,
    DemoSiteEnabled: s.DemoSiteEnabled,
    SelfUseModeEnabled: s.SelfUseModeEnabled,
  })
  Object.assign(smtp, {
    SMTPServer: s.SMTPServer,
    SMTPPort: s.SMTPPort,
    SMTPAccount: s.SMTPAccount,
    SMTPFrom: s.SMTPFrom,
    SMTPToken: '',
    SMTPSSLEnabled: s.SMTPSSLEnabled,
    SMTPStartTLSEnabled: s.SMTPStartTLSEnabled,
    SMTPInsecureSkipVerify: s.SMTPInsecureSkipVerify,
    SMTPForceAuthLogin: s.SMTPForceAuthLogin,
  })
  Object.assign(monitoring, {
    QuotaRemindThreshold: s.QuotaRemindThreshold,
    LogConsumeEnabled: s.LogConsumeEnabled,
  })
  Object.assign(worker, {
    WorkerUrl: s.WorkerUrl,
    WorkerValidKey: s.WorkerValidKey,
  })
  perfKeys.forEach((k) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(perf as any)[k] = (s as any)[k]
  })
})
</script>

<template>
  <div class="space-y-6">
    <!-- System Behavior -->
    <SysSettingsFormCard
      :title="t('systemSettings.operations.behavior')"
      :saving="behaviorSaving.value"
      :dirty="behaviorDirty"
      @save="saveBehavior"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="behavior.DefaultCollapseSidebar"
          :label="t('systemSettings.operations.defaultCollapseSidebar')"
          :description="
            t('systemSettings.operations.defaultCollapseSidebarDesc')
          "
        />
        <SysToggleRow
          v-model="behavior.DemoSiteEnabled"
          :label="t('systemSettings.operations.demoMode')"
          :description="t('systemSettings.operations.demoModeDesc')"
        />
        <SysToggleRow
          v-model="behavior.SelfUseModeEnabled"
          :label="t('systemSettings.operations.selfUseMode')"
          :description="t('systemSettings.operations.selfUseModeDesc')"
        />
      </div>
    </SysSettingsFormCard>

    <!-- SMTP Email -->
    <SysSettingsFormCard
      :title="t('systemSettings.operations.smtp')"
      :saving="smtpSaving.value"
      :dirty="smtpDirty"
      @save="saveSmtp"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <SysInputRow
          v-model="smtp.SMTPServer"
          :label="t('systemSettings.operations.smtpServer')"
          :description="t('systemSettings.operations.smtpServerDesc')"
          :placeholder="t('systemSettings.operations.smtpServerPlaceholder')"
          class="sm:col-span-2"
          autocomplete="off"
        />
        <SysInputRow
          v-model="smtp.SMTPPort"
          :label="t('systemSettings.operations.smtpPort')"
          :description="t('systemSettings.operations.smtpPortDesc')"
          placeholder="587"
          type="number"
        />
        <!-- Encryption selector -->
        <div class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-[var(--text-secondary)]">
            {{ t('systemSettings.operations.smtpEncryption') }}
          </span>
          <div class="flex flex-col gap-2">
            <label
              v-for="opt in [
                {
                  value: 'none',
                  label: t('systemSettings.operations.smtpNoEncryption'),
                },
                {
                  value: 'ssl_tls',
                  label: t('systemSettings.operations.smtpSslTls'),
                },
                {
                  value: 'starttls',
                  label: t('systemSettings.operations.smtpStarttls'),
                },
              ]"
              :key="opt.value"
              class="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                :value="opt.value"
                :checked="smtpSecurity === opt.value"
                class="accent-[var(--accent)]"
                @change="smtpSecurity = opt.value as SmtpSecurity"
              />
              {{ opt.label }}
            </label>
          </div>
        </div>
        <SysInputRow
          v-model="smtp.SMTPAccount"
          :label="t('systemSettings.operations.smtpAccount')"
          :description="t('systemSettings.operations.smtpAccountDesc')"
          :placeholder="t('systemSettings.operations.smtpAccountPlaceholder')"
          autocomplete="off"
        />
        <SysInputRow
          v-model="smtp.SMTPFrom"
          :label="t('systemSettings.operations.smtpFrom')"
          :description="t('systemSettings.operations.smtpFromDesc')"
          autocomplete="off"
        />
        <SysInputRow
          v-model="smtp.SMTPToken"
          :label="t('systemSettings.operations.smtpToken')"
          :description="t('systemSettings.operations.smtpTokenDesc')"
          :placeholder="t('systemSettings.operations.smtpTokenPlaceholder')"
          type="password"
          autocomplete="new-password"
          class="sm:col-span-2"
        />
      </div>
      <div class="mt-4 border-t border-[var(--border-subtle)]">
        <SysToggleRow
          v-model="smtp.SMTPInsecureSkipVerify"
          :label="t('systemSettings.operations.smtpInsecureSkipVerify')"
          :description="
            t('systemSettings.operations.smtpInsecureSkipVerifyDesc')
          "
        />
        <SysToggleRow
          v-model="smtp.SMTPForceAuthLogin"
          :label="t('systemSettings.operations.smtpForceAuthLogin')"
          :description="t('systemSettings.operations.smtpForceAuthLoginDesc')"
        />
      </div>
    </SysSettingsFormCard>

    <!-- Monitoring & Logs -->
    <SysSettingsFormCard
      :title="t('systemSettings.operations.monitoring')"
      :saving="monitoringSaving.value"
      :dirty="monitoringDirty"
      @save="saveMonitoring"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="monitoring.LogConsumeEnabled"
          :label="t('systemSettings.operations.logConsumeEnabled')"
          :description="t('systemSettings.operations.logConsumeEnabledDesc')"
        />
      </div>
      <div class="mt-4">
        <SysInputRow
          :label="t('systemSettings.operations.quotaRemindThreshold')"
          :description="t('systemSettings.operations.quotaRemindThresholdDesc')"
          :model-value="String(monitoring.QuotaRemindThreshold)"
          type="number"
          @update:model-value="
            monitoring.QuotaRemindThreshold = Number($event) || 0
          "
        />
      </div>
    </SysSettingsFormCard>

    <!-- Worker Proxy -->
    <SysSettingsFormCard
      :title="t('systemSettings.operations.worker')"
      :saving="workerSaving.value"
      :dirty="workerDirty"
      @save="saveWorker"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <SysInputRow
          v-model="worker.WorkerUrl"
          :label="t('systemSettings.operations.workerUrl')"
          :description="t('systemSettings.operations.workerUrlDesc')"
          type="url"
          class="sm:col-span-2"
        />
        <SysInputRow
          v-model="worker.WorkerValidKey"
          :label="t('systemSettings.operations.workerValidKey')"
          :description="t('systemSettings.operations.workerValidKeyDesc')"
          type="password"
          autocomplete="off"
        />
      </div>
    </SysSettingsFormCard>

    <!-- Performance -->
    <SysSettingsFormCard
      :title="t('systemSettings.operations.performance')"
      :saving="perfSaving.value"
      :dirty="perfDirty"
      @save="savePerf"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="perf['performance_setting.disk_cache_enabled']"
          :label="t('systemSettings.operations.diskCacheEnabled')"
          :description="t('systemSettings.operations.diskCacheEnabledDesc')"
        />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <SysInputRow
          :label="t('systemSettings.operations.diskCacheThreshold')"
          :description="t('systemSettings.operations.diskCacheThresholdDesc')"
          :model-value="
            String(perf['performance_setting.disk_cache_threshold_mb'])
          "
          type="number"
          :readonly="!perf['performance_setting.disk_cache_enabled']"
          @update:model-value="
            perf['performance_setting.disk_cache_threshold_mb'] =
              Number($event) || 10
          "
        />
        <SysInputRow
          :label="t('systemSettings.operations.diskCacheMaxSize')"
          :model-value="
            String(perf['performance_setting.disk_cache_max_size_mb'])
          "
          type="number"
          :readonly="!perf['performance_setting.disk_cache_enabled']"
          @update:model-value="
            perf['performance_setting.disk_cache_max_size_mb'] =
              Number($event) || 1024
          "
        />
        <SysInputRow
          v-model="perf['performance_setting.disk_cache_path']"
          :label="t('systemSettings.operations.diskCachePath')"
          :description="t('systemSettings.operations.diskCachePathDesc')"
          :placeholder="t('systemSettings.operations.diskCachePathPlaceholder')"
          :readonly="!perf['performance_setting.disk_cache_enabled']"
          class="sm:col-span-2"
        />
      </div>

      <div class="mt-6 border-t border-[var(--border-subtle)] pt-4">
        <div class="divide-y divide-[var(--border-subtle)]">
          <SysToggleRow
            v-model="perf['performance_setting.monitor_enabled']"
            :label="t('systemSettings.operations.monitorEnabled')"
            :description="t('systemSettings.operations.monitorEnabledDesc')"
          />
        </div>
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <SysInputRow
            :label="t('systemSettings.operations.monitorCpuThreshold')"
            :model-value="
              String(perf['performance_setting.monitor_cpu_threshold'])
            "
            type="number"
            :readonly="!perf['performance_setting.monitor_enabled']"
            @update:model-value="
              perf['performance_setting.monitor_cpu_threshold'] =
                Number($event) || 90
            "
          />
          <SysInputRow
            :label="t('systemSettings.operations.monitorMemoryThreshold')"
            :model-value="
              String(perf['performance_setting.monitor_memory_threshold'])
            "
            type="number"
            :readonly="!perf['performance_setting.monitor_enabled']"
            @update:model-value="
              perf['performance_setting.monitor_memory_threshold'] =
                Number($event) || 90
            "
          />
          <SysInputRow
            :label="t('systemSettings.operations.monitorDiskThreshold')"
            :model-value="
              String(perf['performance_setting.monitor_disk_threshold'])
            "
            type="number"
            :readonly="!perf['performance_setting.monitor_enabled']"
            @update:model-value="
              perf['performance_setting.monitor_disk_threshold'] =
                Number($event) || 95
            "
          />
        </div>
      </div>
    </SysSettingsFormCard>
  </div>
</template>
