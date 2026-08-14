<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import SysInputRow from '@/components/console/systemSettings/SysInputRow.vue'
import SysSettingsFormCard from '@/components/console/systemSettings/SysSettingsFormCard.vue'
import SysToggleRow from '@/components/console/systemSettings/SysToggleRow.vue'
import { useSystemSettings } from '@/composables/useSystemSettings'
import { useToast } from '@/composables/useToast'
import type { AutoPricingStatus } from '@/types/systemSettings'

const { t } = useI18n()
const toast = useToast()
const { settings, load, saveOptions } = useSystemSettings()

const form = reactive({
  enabled: true,
  remoteUrl: '',
  hashUrl: '',
  checkIntervalMinutes: 60,
  fuzzyMatchEnabled: true,
})
const saving = ref(false)
const loading = ref(false)
const syncing = ref(false)
const status = ref<AutoPricingStatus | null>(null)

const dirty = computed(() => {
  const current = settings.value
  return (
    form.enabled !== current['auto_pricing.enabled'] ||
    form.remoteUrl !== current['auto_pricing.remote_url'] ||
    form.hashUrl !== current['auto_pricing.hash_url'] ||
    form.checkIntervalMinutes !==
      current['auto_pricing.check_interval_minutes'] ||
    form.fuzzyMatchEnabled !== current['auto_pricing.fuzzy_match_enabled']
  )
})

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : String(error)
}

function isHttpUrl(value: string, optional = false): boolean {
  const normalized = value.trim()
  if (optional && normalized === '') return true
  try {
    const parsed = new URL(normalized)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function refreshStatus(showError = true) {
  loading.value = true
  try {
    const nextStatus = await api.get<AutoPricingStatus>(
      '/api/auto_pricing/status'
    )
    status.value = nextStatus
  } catch (error) {
    if (showError) toast.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!isHttpUrl(form.remoteUrl)) {
    toast.error(t('systemSettings.billing.autoPricing.invalidCatalogUrl'))
    return
  }
  if (!isHttpUrl(form.hashUrl, true)) {
    toast.error(t('systemSettings.billing.autoPricing.invalidChecksumUrl'))
    return
  }
  if (
    !Number.isInteger(form.checkIntervalMinutes) ||
    form.checkIntervalMinutes < 5 ||
    form.checkIntervalMinutes > 10080
  ) {
    toast.error(t('systemSettings.billing.autoPricing.invalidInterval'))
    return
  }

  saving.value = true
  const current = settings.value
  const patch: Record<string, string | boolean | number> = {}
  if (form.enabled !== current['auto_pricing.enabled'])
    patch['auto_pricing.enabled'] = form.enabled
  if (form.remoteUrl !== current['auto_pricing.remote_url'])
    patch['auto_pricing.remote_url'] = form.remoteUrl.trim()
  if (form.hashUrl !== current['auto_pricing.hash_url'])
    patch['auto_pricing.hash_url'] = form.hashUrl.trim()
  if (
    form.checkIntervalMinutes !== current['auto_pricing.check_interval_minutes']
  )
    patch['auto_pricing.check_interval_minutes'] = form.checkIntervalMinutes
  if (form.fuzzyMatchEnabled !== current['auto_pricing.fuzzy_match_enabled'])
    patch['auto_pricing.fuzzy_match_enabled'] = form.fuzzyMatchEnabled

  const ok = await saveOptions(patch)
  saving.value = false
  if (!ok) return
  toast.success(t('systemSettings.saved'))
  if (form.enabled) await refreshStatus(false)
}

async function syncNow() {
  syncing.value = true
  try {
    status.value = await api.post<AutoPricingStatus>('/api/auto_pricing/sync')
    toast.success(t('systemSettings.billing.autoPricing.synced'))
    await refreshStatus(false)
  } catch (error) {
    toast.error(errorMessage(error))
    await refreshStatus(false)
  } finally {
    syncing.value = false
  }
}

function formatTime(value?: string): string {
  if (!value) return t('systemSettings.billing.autoPricing.never')
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

onMounted(async () => {
  await load()
  const current = settings.value
  Object.assign(form, {
    enabled: current['auto_pricing.enabled'],
    remoteUrl: current['auto_pricing.remote_url'],
    hashUrl: current['auto_pricing.hash_url'],
    checkIntervalMinutes: current['auto_pricing.check_interval_minutes'],
    fuzzyMatchEnabled: current['auto_pricing.fuzzy_match_enabled'],
  })
  if (form.enabled) await refreshStatus()
})
</script>

<template>
  <SysSettingsFormCard
    :title="t('systemSettings.billing.autoPricing.title')"
    :description="t('systemSettings.billing.autoPricing.description')"
    :saving="saving"
    :dirty="dirty"
    @save="save"
  >
    <div class="divide-y divide-[var(--border-subtle)]">
      <SysToggleRow
        v-model="form.enabled"
        :label="t('systemSettings.billing.autoPricing.enabled')"
        :description="t('systemSettings.billing.autoPricing.enabledDesc')"
      />
      <SysToggleRow
        v-if="form.enabled"
        v-model="form.fuzzyMatchEnabled"
        :label="t('systemSettings.billing.autoPricing.fuzzy')"
        :description="t('systemSettings.billing.autoPricing.fuzzyDesc')"
      />
    </div>

    <template v-if="form.enabled">
      <div class="mt-5 grid gap-5 sm:grid-cols-2">
        <SysInputRow
          v-model="form.remoteUrl"
          class="sm:col-span-2"
          type="url"
          :label="t('systemSettings.billing.autoPricing.catalogUrl')"
        />
        <SysInputRow
          v-model="form.hashUrl"
          type="url"
          :label="t('systemSettings.billing.autoPricing.checksumUrl')"
        />
        <SysInputRow
          :model-value="String(form.checkIntervalMinutes)"
          type="number"
          :label="t('systemSettings.billing.autoPricing.interval')"
          @update:model-value="form.checkIntervalMinutes = Number($event)"
        />
      </div>

      <div class="mt-6 border-t border-[var(--border-subtle)] pt-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 text-sm">
            <p class="font-semibold text-[var(--text-primary)]">
              {{ t('systemSettings.billing.autoPricing.status') }}
            </p>
            <p class="mt-1 text-[var(--text-secondary)]">
              <template v-if="loading">{{ t('common.loading') }}</template>
              <template v-else-if="status?.loaded">
                {{
                  t('systemSettings.billing.autoPricing.catalogSummary', {
                    count: status.model_count,
                  })
                }}
              </template>
              <template v-else>{{
                t('systemSettings.billing.autoPricing.notLoaded')
              }}</template>
            </p>
            <p v-if="status" class="mt-1 text-xs text-[var(--text-tertiary)]">
              {{ t('systemSettings.billing.autoPricing.lastSuccess') }}:
              {{ formatTime(status.last_successful_at) }} ·
              {{
                t('systemSettings.billing.autoPricing.pending', {
                  count: status.pending_count,
                })
              }}
            </p>
            <p
              v-if="status?.last_error"
              class="mt-2 break-words text-sm text-[var(--status-danger)]"
            >
              {{ status.last_error }}
            </p>
          </div>
          <ConsoleButton
            variant="secondary"
            size="sm"
            :loading="syncing"
            :disabled="loading"
            @click="syncNow"
          >
            <RefreshCw class="h-4 w-4" aria-hidden="true" />
            {{ t('systemSettings.billing.autoPricing.sync') }}
          </ConsoleButton>
        </div>

        <div
          v-if="status?.sources.length"
          class="mt-4 grid gap-x-6 sm:grid-cols-2"
        >
          <div
            v-for="source in status.sources"
            :key="source.source"
            class="min-w-0 border-t border-[var(--border-subtle)] py-3 text-xs"
          >
            <p class="font-semibold text-[var(--text-primary)]">
              {{ source.source }}
            </p>
            <p
              class="truncate text-[var(--text-tertiary)]"
              :title="source.version"
            >
              {{
                source.version ||
                t('systemSettings.billing.autoPricing.noVersion')
              }}
            </p>
            <p
              v-if="source.error"
              class="mt-1 break-words text-[var(--status-danger)]"
            >
              {{ source.error }}
            </p>
          </div>
        </div>
      </div>

    </template>
  </SysSettingsFormCard>
</template>
