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

// ── Dashboard ───────────────────────────────────────────────────────────────
const dashboard = reactive({
  DataExportEnabled: true,
  DataExportInterval: 5,
})
const dashboardSaving = reactive({ value: false })
const dashboardDirty = computed(() => {
  const s = settings.value
  return (
    dashboard.DataExportEnabled !== s.DataExportEnabled ||
    dashboard.DataExportInterval !== s.DataExportInterval
  )
})
async function saveDashboard() {
  dashboardSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (dashboard.DataExportEnabled !== s.DataExportEnabled)
    patch.DataExportEnabled = dashboard.DataExportEnabled
  if (dashboard.DataExportInterval !== s.DataExportInterval)
    patch.DataExportInterval = dashboard.DataExportInterval
  const ok = await saveOptions(patch)
  dashboardSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Drawing ─────────────────────────────────────────────────────────────────
const drawingKeys = [
  'DrawingEnabled',
  'MjNotifyEnabled',
  'MjAccountFilterEnabled',
  'MjForwardUrlEnabled',
  'MjModeClearEnabled',
  'MjActionCheckSuccessEnabled',
] as const
type DrawingKey = (typeof drawingKeys)[number]

const drawing = reactive<Record<DrawingKey, boolean>>({
  DrawingEnabled: false,
  MjNotifyEnabled: false,
  MjAccountFilterEnabled: false,
  MjForwardUrlEnabled: false,
  MjModeClearEnabled: false,
  MjActionCheckSuccessEnabled: false,
})
const drawingSaving = reactive({ value: false })
const drawingDirty = computed(() =>
  drawingKeys.some((k) => drawing[k] !== settings.value[k])
)
async function saveDrawing() {
  drawingSaving.value = true
  const patch: Partial<Record<DrawingKey, boolean>> = {}
  drawingKeys.forEach((k) => {
    if (drawing[k] !== settings.value[k]) patch[k] = drawing[k]
  })
  const ok = await saveOptions(patch)
  drawingSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

const drawingSwitches: Array<{
  key: DrawingKey
  labelKey: string
  descKey: string
}> = [
  {
    key: 'DrawingEnabled',
    labelKey: 'systemSettings.content.drawingEnabled',
    descKey: 'systemSettings.content.drawingEnabledDesc',
  },
  {
    key: 'MjNotifyEnabled',
    labelKey: 'systemSettings.content.mjNotify',
    descKey: 'systemSettings.content.mjNotifyDesc',
  },
  {
    key: 'MjAccountFilterEnabled',
    labelKey: 'systemSettings.content.mjAccountFilter',
    descKey: 'systemSettings.content.mjAccountFilterDesc',
  },
  {
    key: 'MjForwardUrlEnabled',
    labelKey: 'systemSettings.content.mjForwardUrl',
    descKey: 'systemSettings.content.mjForwardUrlDesc',
  },
  {
    key: 'MjModeClearEnabled',
    labelKey: 'systemSettings.content.mjModeClear',
    descKey: 'systemSettings.content.mjModeClearDesc',
  },
  {
    key: 'MjActionCheckSuccessEnabled',
    labelKey: 'systemSettings.content.mjActionCheck',
    descKey: 'systemSettings.content.mjActionCheckDesc',
  },
]

onMounted(async () => {
  await load()
  const s = settings.value
  dashboard.DataExportEnabled = s.DataExportEnabled
  dashboard.DataExportInterval = s.DataExportInterval
  drawingKeys.forEach((k) => {
    drawing[k] = s[k]
  })
})
</script>

<template>
  <div class="space-y-6">
    <!-- Data Dashboard -->
    <SysSettingsFormCard
      :title="t('systemSettings.content.dashboard')"
      :saving="dashboardSaving.value"
      :dirty="dashboardDirty"
      @save="saveDashboard"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="dashboard.DataExportEnabled"
          :label="t('systemSettings.content.dataExportEnabled')"
          :description="t('systemSettings.content.dataExportEnabledDesc')"
        />
      </div>
      <div class="mt-4">
        <SysInputRow
          :label="t('systemSettings.content.dataExportInterval')"
          :model-value="String(dashboard.DataExportInterval)"
          type="number"
          @update:model-value="
            dashboard.DataExportInterval = Number($event) || 5
          "
        />
      </div>
    </SysSettingsFormCard>

    <!-- Drawing Features -->
    <SysSettingsFormCard
      :title="t('systemSettings.content.drawing')"
      :saving="drawingSaving.value"
      :dirty="drawingDirty"
      @save="saveDrawing"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-for="sw in drawingSwitches"
          :key="sw.key"
          v-model="drawing[sw.key]"
          :label="t(sw.labelKey)"
          :description="t(sw.descKey)"
        />
      </div>
    </SysSettingsFormCard>
  </div>
</template>
