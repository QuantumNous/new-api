<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CustomOAuthProvidersPanel from '@/components/console/systemSettings/CustomOAuthProvidersPanel.vue'
import SysSettingsFormCard from '@/components/console/systemSettings/SysSettingsFormCard.vue'
import SystemSettingsMaintenanceActions from '@/components/console/systemSettings/SystemSettingsMaintenanceActions.vue'
import SystemSettingsField from '@/components/console/systemSettings/SystemSettingsField.vue'
import WaffoPancakePanel from '@/components/console/systemSettings/WaffoPancakePanel.vue'
import {
  getSystemSettingsDomain,
  type SystemSettingsDomainId,
} from '@/constants/systemSettingsCatalog'
import {
  useSystemSettings,
  type SystemSettingValue,
} from '@/composables/useSystemSettings'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ domain: SystemSettingsDomainId }>()

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { load, rawOptions, rawValue, isSecretConfigured, saveOptions } =
  useSystemSettings()

const domainConfig = computed(() => getSystemSettingsDomain(props.domain))
const activeSection = computed(() => {
  const domain = domainConfig.value
  if (!domain) return undefined
  const requested = String(route.params.section ?? '')
  return (
    domain.sections.find((section) => section.id === requested) ??
    domain.sections.find((section) => section.id === domain.defaultSection)
  )
})

const draft = reactive<Record<string, SystemSettingValue>>({})
const saving = reactive({ value: false })

function readField(key: string, fallback: SystemSettingValue) {
  return rawValue(key, fallback)
}

function syncDraft() {
  const section = activeSection.value
  if (!section) return
  for (const field of section.fields) {
    draft[field.key] = readField(field.key, field.defaultValue)
  }
}

function serialize(value: SystemSettingValue) {
  return String(value)
}

const dirty = computed(() => {
  const section = activeSection.value
  if (!section) return false
  return section.fields.some((field) => {
    const next = draft[field.key]
    if (
      (field.kind === 'secret' || field.kind === 'secret-textarea') &&
      !String(next ?? '').trim()
    )
      return false
    return (
      serialize(next) !== serialize(readField(field.key, field.defaultValue))
    )
  })
})

function toSection(section: string) {
  router.push({
    name: `system-settings-${props.domain}`,
    params: { section },
  })
}

function normalizeRoute() {
  const domain = domainConfig.value
  if (!domain || activeSection.value?.id === route.params.section) return
  router.replace({
    name: `system-settings-${props.domain}`,
    params: { section: domain.defaultSection },
  })
}

async function saveSection() {
  const section = activeSection.value
  if (!section || !dirty.value) return
  const patch: Record<string, SystemSettingValue> = {}

  for (const field of section.fields) {
    const next = draft[field.key]
    if (
      (field.kind === 'secret' || field.kind === 'secret-textarea') &&
      !String(next ?? '').trim()
    )
      continue
    if (field.kind === 'json') {
      try {
        JSON.parse(String(next))
      } catch {
        toast.error(`${field.label} 不是有效的 JSON。`)
        return
      }
    }
    if (
      serialize(next) !== serialize(readField(field.key, field.defaultValue))
    ) {
      patch[field.key] = next
    }
  }

  saving.value = true
  const ok = await saveOptions(patch)
  saving.value = false
  if (ok) {
    syncDraft()
    toast.success(t('systemSettings.saved'))
  }
}

watch(
  () => [props.domain, route.params.section, rawOptions.value],
  () => {
    normalizeRoute()
    syncDraft()
  },
  { immediate: true }
)

onMounted(() => load())
</script>

<template>
  <div v-if="domainConfig && activeSection" class="settings-domain-layout">
    <!-- Left Section Navigation Rail -->
    <aside class="settings-section-aside">
      <nav class="settings-section-nav" :aria-label="domainConfig.titleKey">
        <button
          v-for="section in domainConfig.sections"
          :key="section.id"
          type="button"
          class="settings-section-link focus-ring"
          :class="section.id === activeSection.id ? 'is-active' : ''"
          :aria-current="section.id === activeSection.id ? 'page' : undefined"
          @click="toSection(section.id)"
        >
          <span class="truncate">{{ section.title }}</span>
        </button>
      </nav>
    </aside>

    <div class="min-w-0 flex-1">
      <header class="settings-section-heading">
        <span
          class="inline-block rounded-md bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-text)]"
        >
          {{ t(domainConfig.titleKey) }}
        </span>
        <h2
          class="display-title mt-1.5 text-2xl font-bold text-[var(--text-primary)]"
        >
          {{ activeSection.title }}
        </h2>
        <p class="mt-1 max-w-2xl text-xs text-[var(--text-secondary)]">
          {{ activeSection.description }}
        </p>
      </header>

      <SysSettingsFormCard
        :title="activeSection.title"
        :description="activeSection.description"
        :saving="saving.value"
        :dirty="dirty"
        @save="saveSection"
      >
        <div class="settings-fields-grid">
          <SystemSettingsField
            v-for="field in activeSection.fields"
            :key="field.key"
            v-model="draft[field.key]"
            :field="field"
            :secret-configured="
              (field.kind === 'secret' || field.kind === 'secret-textarea') &&
              isSecretConfigured(field.key)
            "
          />
        </div>

        <CustomOAuthProvidersPanel
          v-if="activeSection.integration === 'custom-oauth'"
        />
        <WaffoPancakePanel
          v-else-if="activeSection.integration === 'waffo-pancake'"
          @saved="load(true)"
        />
        <SystemSettingsMaintenanceActions
          v-else-if="activeSection.integration === 'channel-affinity'"
          kind="channel-affinity"
        />
        <SystemSettingsMaintenanceActions
          v-else-if="activeSection.integration === 'performance'"
          kind="performance"
        />
      </SysSettingsFormCard>
    </div>
  </div>
</template>

<style scoped>
.settings-domain-layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 1.75rem;
  align-items: start;
}
.settings-section-aside {
  position: sticky;
  top: 1rem;
}
.settings-section-nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem;
  border-radius: 1rem;
  border: 1px solid var(--border-subtle);
  background: var(--surface-solid);
  box-shadow: var(--card-shadow);
}
.settings-section-link {
  min-height: 2.25rem;
  border: 0;
  border-radius: 0.625rem;
  background: transparent;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.15s ease;
  position: relative;
}
.settings-section-link:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}
.settings-section-link.is-active {
  color: var(--accent-text);
  font-weight: 700;
  background: var(--accent-soft);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.settings-section-link.is-active::before {
  content: '';
  position: absolute;
  left: 0.25rem;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 3px;
  border-radius: 9999px;
  background: var(--accent);
}
.settings-section-heading {
  margin-bottom: 1.25rem;
}
.settings-fields-grid {
  display: grid;
  gap: 1.25rem 1.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.settings-fields-grid > :deep(.settings-field-toggle) {
  grid-column: 1 / -1;
}
.settings-fields-grid > :deep(.settings-field-control) {
  min-width: 0;
}
.settings-fields-grid > :deep(.settings-json-editor) {
  grid-column: 1 / -1;
}
.settings-fields-grid > :deep(.settings-field-wide) {
  grid-column: 1 / -1;
}
@media (max-width: 860px) {
  .settings-domain-layout {
    display: block;
  }
  .settings-section-aside {
    position: static;
    margin-bottom: 1.25rem;
  }
  .settings-section-nav {
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .settings-section-nav::-webkit-scrollbar {
    display: none;
  }
  .settings-section-link {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .settings-section-link.is-active::before {
    display: none;
  }
  .settings-fields-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
