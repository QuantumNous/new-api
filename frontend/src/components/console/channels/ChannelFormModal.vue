<script setup lang="ts">
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Settings,
  Shapes,
  X,
} from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiError } from '@/api/types'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import { useToast } from '@/composables/useToast'
import {
  ADMIN_CHANNEL_TYPE_META,
  adminChannelTypeMeta,
} from '@/constants/adminChannels'
import type {
  AdminChannel,
  AdminChannelCreateInput,
  AdminChannelFetchModelsParams,
  AdminChannelUpdateInput,
} from '@/types/console'

const props = defineProps<{
  open: boolean
  editing: AdminChannel | null
  save: (
    input: AdminChannelCreateInput | AdminChannelUpdateInput,
    options?: { batchKeys?: boolean }
  ) => Promise<boolean>
  fetchModels: (params: AdminChannelFetchModelsParams) => Promise<string[]>
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const toast = useToast()
const saving = ref(false)
const advancedOpen = ref(false)

// ── Type search dropdown ───────────────────────────────────────────────────
const typeSearch = ref('')
const typeDropdownOpen = ref(false)

const typeOptions = computed(() =>
  Object.entries(ADMIN_CHANNEL_TYPE_META)
    .map(([value, meta]) => ({ value: Number(value), label: meta.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
)

const filteredTypeOptions = computed(() => {
  const q = typeSearch.value.toLowerCase().trim()
  if (!q) return typeOptions.value
  return typeOptions.value.filter((opt) => opt.label.toLowerCase().includes(q))
})

function selectType(typeId: number) {
  form.type = typeId
  typeSearch.value = ''
  typeDropdownOpen.value = false
}

function closeTypeDropdown() {
  typeDropdownOpen.value = false
  typeSearch.value = ''
}

// ── Form state ─────────────────────────────────────────────────────────────
const form = reactive({
  name: '',
  type: 1,
  enabled: true,
  openaiOrg: '',
  // Credentials
  key: '',
  addMode: 'single' as 'single' | 'multi',
  baseUrl: '',
  // Models & groups
  models: '',
  modelMapping: '',
  group: 'default',
  // Advanced
  priority: 0,
  weight: 0,
  capacityTotal: 20,
  channelRatio: 1,
})

// ── Model mapping ──────────────────────────────────────────────────────────
const mappingRows = ref<Array<{ from: string; to: string }>>([])
const modelMappingTab = ref<'visual' | 'json'>('visual')
const modelMappingJson = ref('')

function syncJsonFromRows() {
  const obj: Record<string, string> = {}
  for (const row of mappingRows.value) {
    if (row.from.trim()) obj[row.from.trim()] = row.to.trim()
  }
  const json = Object.keys(obj).length ? JSON.stringify(obj, null, 2) : ''
  modelMappingJson.value = json
  form.modelMapping = json
}

function syncRowsFromJson() {
  try {
    const parsed = JSON.parse(modelMappingJson.value || '{}')
    mappingRows.value = Object.entries(parsed).map(([from, to]) => ({
      from,
      to: String(to),
    }))
    form.modelMapping = modelMappingJson.value
  } catch {
    // keep current rows on parse error
  }
}

function addMappingRow() {
  mappingRows.value.push({ from: '', to: '' })
  if (modelMappingTab.value !== 'visual') modelMappingTab.value = 'visual'
}

function removeMappingRow(index: number) {
  mappingRows.value.splice(index, 1)
  syncJsonFromRows()
}

function onSwitchToVisual() {
  syncRowsFromJson()
  modelMappingTab.value = 'visual'
}

function onSwitchToJson() {
  syncJsonFromRows()
  modelMappingTab.value = 'json'
}

// ── Model tags ─────────────────────────────────────────────────────────────
const modelTags = computed(() =>
  form.models
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
)
const modelInput = ref('')

function addModelTag(value: string) {
  const tags = value
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  const existing = new Set(modelTags.value)
  form.models = [
    ...modelTags.value,
    ...tags.filter((t) => !existing.has(t)),
  ].join(',')
  modelInput.value = ''
}

function removeModelTag(tag: string) {
  form.models = modelTags.value.filter((t) => t !== tag).join(',')
}

function onModelInputKeydown(e: KeyboardEvent) {
  const val = modelInput.value.trim()
  if ((e.key === 'Enter' || e.key === ',') && val) {
    e.preventDefault()
    addModelTag(val)
  } else if (
    e.key === 'Backspace' &&
    !modelInput.value &&
    modelTags.value.length
  ) {
    removeModelTag(modelTags.value[modelTags.value.length - 1]!)
  }
}

// ── Group tags ─────────────────────────────────────────────────────────────
const groupTags = computed(() =>
  form.group
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
)
const groupInput = ref('')

function addGroupTag(value: string) {
  const tags = value
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
  const existing = new Set(groupTags.value)
  form.group = [
    ...groupTags.value,
    ...tags.filter((t) => !existing.has(t)),
  ].join(',')
  groupInput.value = ''
}

function removeGroupTag(tag: string) {
  const next = groupTags.value.filter((g) => g !== tag).join(',')
  form.group = next || 'default'
}

function onGroupInputKeydown(e: KeyboardEvent) {
  const val = groupInput.value.trim()
  if ((e.key === 'Enter' || e.key === ',') && val) {
    e.preventDefault()
    addGroupTag(val)
  } else if (
    e.key === 'Backspace' &&
    !groupInput.value &&
    groupTags.value.length > 1
  ) {
    removeGroupTag(groupTags.value[groupTags.value.length - 1]!)
  }
}

// ── Quick actions ──────────────────────────────────────────────────────────
const fetchingUpstream = ref(false)
const canFetchUpstream = computed(
  () => props.editing !== null || form.key.trim().length > 0
)

/**
 * Discover upstream models: saved channels reuse stored credentials (by id),
 * unsaved ones probe with the key/address currently in the form.
 */
async function fetchUpstream() {
  if (fetchingUpstream.value || !canFetchUpstream.value) return
  fetchingUpstream.value = true
  try {
    const models = await props.fetchModels(
      props.editing !== null
        ? { channelId: props.editing.id }
        : {
            type: form.type,
            key: form.key.trim(),
            baseUrl: form.baseUrl.trim(),
          }
    )
    if (models.length > 0) addModelTag(models.join(','))
    toast.success(t('channels.upstreamFetched', { count: models.length }))
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    fetchingUpstream.value = false
  }
}

async function copyAllModels() {
  if (modelTags.value.length === 0) return
  try {
    await navigator.clipboard.writeText(form.models)
    toast.success(t('common.copied'))
  } catch {
    toast.error(t('common.copyFailed'))
  }
}

// ── Computed helpers ───────────────────────────────────────────────────────
const selectedTypeMeta = computed(() => adminChannelTypeMeta(form.type))
const isOpenAI = computed(() => form.type === 1)
const minimumCapacity = computed(() =>
  Math.max(1, props.editing?.capacity_used ?? 1)
)

const valid = computed(
  () =>
    form.name.trim().length > 0 &&
    (props.editing !== null || form.key.trim().length > 0) &&
    (props.editing !== null || modelTags.value.length > 0) &&
    Number.isSafeInteger(form.type) &&
    Object.hasOwn(ADMIN_CHANNEL_TYPE_META, form.type) &&
    Number.isSafeInteger(form.priority) &&
    form.priority >= 0 &&
    form.priority <= 1_000_000 &&
    Number.isSafeInteger(form.weight) &&
    form.weight >= 0 &&
    form.weight <= 1_000_000 &&
    Number.isSafeInteger(form.capacityTotal) &&
    form.capacityTotal >= minimumCapacity.value &&
    form.capacityTotal <= 1_000_000 &&
    Number.isFinite(form.channelRatio) &&
    form.channelRatio > 0 &&
    form.channelRatio <= 1000
)

// ── Reset on open ──────────────────────────────────────────────────────────
watch(
  () => props.open,
  (open) => {
    if (!open) return
    const ch = props.editing
    form.name = ch?.name ?? ''
    form.type = ch?.type ?? 1
    form.enabled = ch ? ch.status === 1 : true
    form.openaiOrg =
      (typeof ch?.openai_organization === 'string'
        ? ch.openai_organization
        : '') ?? ''
    form.key = ''
    form.addMode = 'single'
    form.baseUrl = ch?.base_url ?? ''
    form.models = ch?.models ?? ''
    form.modelMapping =
      typeof ch?.model_mapping === 'string' ? (ch.model_mapping ?? '') : ''
    form.group =
      typeof ch?.group === 'string' && ch.group ? ch.group : 'default'
    form.priority = ch?.priority ?? 0
    form.weight = ch?.weight ?? 0
    form.capacityTotal = ch?.capacity_total ?? 20
    form.channelRatio = ch?.channel_ratio ?? 1
    // parse mapping
    modelMappingJson.value = form.modelMapping
    try {
      const parsed = form.modelMapping ? JSON.parse(form.modelMapping) : {}
      mappingRows.value = Object.entries(parsed).map(([from, to]) => ({
        from,
        to: String(to),
      }))
    } catch {
      mappingRows.value = []
    }
    modelMappingTab.value = 'visual'
    typeSearch.value = ''
    typeDropdownOpen.value = false
    advancedOpen.value = false
    modelInput.value = ''
    groupInput.value = ''
  },
  { immediate: true }
)

// ── Submit ─────────────────────────────────────────────────────────────────
function close() {
  if (!saving.value) emit('close')
}

async function submit() {
  if (!valid.value || saving.value) return
  saving.value = true
  try {
    if (modelMappingTab.value === 'visual') syncJsonFromRows()
    const openaiOrg = isOpenAI.value ? form.openaiOrg.trim() : ''
    const base: AdminChannelUpdateInput = {
      name: form.name.trim(),
      type: form.type,
      base_url: form.baseUrl.trim(),
      models: form.models.trim(),
      model_mapping: form.modelMapping.trim(),
      group: form.group.trim() || 'default',
      priority: Number(form.priority),
      weight: Number(form.weight),
      capacity_total: Number(form.capacityTotal),
      channel_ratio: Number(form.channelRatio),
    }

    if (props.editing === null) {
      const input: AdminChannelCreateInput = {
        ...base,
        key: form.key.trim(),
        status: form.enabled ? 1 : 2,
        openai_organization: openaiOrg,
      }
      const created = await props.save(input, {
        batchKeys: form.addMode === 'multi',
      })
      if (created) emit('close')
      return
    }

    // Sensitive fields (key, OpenAI org) ride along only when actually
    // changed, so admins without ChannelSensitiveWrite can still save
    // routing-level edits.
    const replacementKey = form.key.trim()
    if (replacementKey) base.key = replacementKey
    if (openaiOrg !== props.editing.openai_organization) {
      base.openai_organization = openaiOrg
    }
    if (await props.save(base)) emit('close')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ConsoleModal
    :open="open"
    :title="editing ? t('channels.editTitle') : t('channels.createTitle')"
    size="lg"
    @close="close"
  >
    <div class="space-y-0 text-left">
      <!-- ══ Section: 基本信息 ══════════════════════════════════════════ -->
      <section class="channel-form-section">
        <div class="channel-form-section-header">
          <div class="channel-form-section-icon">
            <Shapes :size="16" />
          </div>
          <div>
            <p class="channel-form-section-title">
              {{ t('channels.sectionBasic') }}
            </p>
            <p class="channel-form-section-desc">
              {{ t('channels.sectionBasicDesc') }}
            </p>
          </div>
        </div>

        <!-- Type searchable dropdown + Name -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <p class="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">
              {{ t('channels.type') }}
              <span class="text-[var(--status-danger)]">*</span>
            </p>
            <!-- Custom searchable type selector -->
            <div class="relative" @keydown.esc="closeTypeDropdown">
              <button
                type="button"
                class="flex h-10 w-full items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-3 text-left text-sm focus-ring"
                :aria-expanded="typeDropdownOpen"
                @click="typeDropdownOpen = !typeDropdownOpen"
              >
                <VendorLogo :vendor="selectedTypeMeta.supplier" :size="20" />
                <span
                  class="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]"
                >
                  {{ selectedTypeMeta.label }}
                </span>
                <ChevronDown
                  :size="15"
                  class="shrink-0 text-[var(--text-tertiary)]"
                />
              </button>

              <div
                v-if="typeDropdownOpen"
                class="absolute left-0 top-[calc(100%+4px)] z-20 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-lg"
              >
                <div class="p-2">
                  <input
                    v-model="typeSearch"
                    type="text"
                    class="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm focus-ring outline-none placeholder:text-[var(--text-tertiary)]"
                    :placeholder="t('channels.typeFilter') + '...'"
                    autofocus
                    @click.stop
                  />
                </div>
                <ul
                  class="subtle-scroll max-h-52 overflow-y-auto pb-2"
                  role="listbox"
                  :aria-label="t('channels.type')"
                >
                  <li
                    v-for="opt in filteredTypeOptions"
                    :key="opt.value"
                    role="option"
                    :aria-selected="form.type === opt.value"
                    class="mx-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-muted)]"
                    :class="
                      form.type === opt.value
                        ? 'font-semibold text-[var(--accent)]'
                        : 'text-[var(--text-primary)]'
                    "
                    @click="selectType(opt.value)"
                  >
                    <VendorLogo
                      :vendor="adminChannelTypeMeta(opt.value).supplier"
                      :size="20"
                    />
                    {{ opt.label }}
                  </li>
                  <li
                    v-if="filteredTypeOptions.length === 0"
                    class="px-4 py-3 text-sm text-[var(--text-tertiary)]"
                  >
                    {{ t('common.noResults') }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <FormField :label="t('channels.channelName') + ' *'">
            <TextInput
              v-model="form.name"
              name="admin-channel-name"
              :placeholder="t('channels.channelNamePlaceholder')"
              autocomplete="off"
            />
          </FormField>
        </div>

        <!-- Enabled toggle (create only; existing channels toggle status from the table) -->
        <div
          v-if="editing === null"
          class="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium text-[var(--text-primary)]">
              {{ t('channels.enabledLabel') }}
            </p>
            <p class="text-xs text-[var(--text-tertiary)]">
              {{ t('channels.enabledDesc') }}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="form.enabled"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-ring"
            :class="
              form.enabled
                ? 'bg-[var(--accent)]'
                : 'bg-[var(--surface-muted)] border border-[var(--border-subtle)]'
            "
            @click="form.enabled = !form.enabled"
          >
            <span
              class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
              :class="form.enabled ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>

        <!-- OpenAI Organization (conditional) -->
        <FormField
          v-if="isOpenAI"
          :label="t('channels.openaiOrg')"
          :hint="t('channels.openaiOrgDesc')"
        >
          <TextInput
            v-model="form.openaiOrg"
            name="admin-channel-openai-org"
            :placeholder="t('channels.openaiOrgPlaceholder')"
            autocomplete="off"
          />
        </FormField>
      </section>

      <!-- ══ Section: 凭证 ══════════════════════════════════════════════ -->
      <section class="channel-form-section">
        <div class="channel-form-section-header">
          <div class="channel-form-section-icon">
            <KeyRound :size="16" />
          </div>
          <div>
            <p class="channel-form-section-title">
              {{ t('channels.sectionCredentials') }}
            </p>
            <p class="channel-form-section-desc">
              {{ t('channels.sectionCredentialsDesc') }}
            </p>
          </div>
        </div>

        <!-- API address -->
        <FormField
          :label="t('channels.apiAddress')"
          :hint="t('channels.apiAddressDesc')"
        >
          <TextInput
            v-model="form.baseUrl"
            name="admin-channel-base-url"
            :placeholder="t('channels.apiAddressPlaceholder')"
            autocomplete="url"
          />
        </FormField>

        <!-- Add mode selector (batch keys apply to creation only) -->
        <div>
          <div
            v-if="editing === null"
            class="mb-1.5 flex items-center justify-between"
          >
            <p class="text-sm font-medium text-[var(--text-secondary)]">
              {{ t('channels.addMode') }}
            </p>
            <div
              class="flex gap-1 rounded-lg bg-[var(--surface-muted)] p-0.5"
              role="radiogroup"
              :aria-label="t('channels.addMode')"
            >
              <button
                v-for="mode in [
                  { value: 'single', label: t('channels.addModeSingle') },
                  { value: 'multi', label: t('channels.addModeMulti') },
                ]"
                :key="mode.value"
                type="button"
                role="radio"
                :aria-checked="form.addMode === mode.value"
                class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                :class="
                  form.addMode === mode.value
                    ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                "
                @click="form.addMode = mode.value as 'single' | 'multi'"
              >
                {{ mode.label }}
              </button>
            </div>
          </div>

          <!-- API key input -->
          <FormField
            :label="t('channels.apiKeyLabel') + (editing === null ? ' *' : '')"
            :hint="
              form.addMode === 'multi'
                ? t('channels.apiKeyMultiHint')
                : t('channels.apiKeyHint')
            "
          >
            <template v-if="form.addMode === 'single'">
              <TextInput
                v-model="form.key"
                type="password"
                name="admin-channel-key"
                :placeholder="t('channels.apiKeyPlaceholder')"
                autocomplete="off"
              />
            </template>
            <template v-else>
              <textarea
                v-model="form.key"
                name="admin-channel-key-multi"
                rows="4"
                class="channel-form-textarea focus-ring"
                :placeholder="t('channels.apiKeyPlaceholder')"
                autocomplete="off"
              />
            </template>
          </FormField>
        </div>
      </section>

      <!-- ══ Section: 模型与分组 ══════════════════════════════════════ -->
      <section class="channel-form-section">
        <div class="channel-form-section-header">
          <div class="channel-form-section-icon">
            <BookOpen :size="16" />
          </div>
          <div>
            <p class="channel-form-section-title">
              {{ t('channels.sectionModels') }}
            </p>
            <p class="channel-form-section-desc">
              {{ t('channels.sectionModelsDesc') }}
            </p>
          </div>
        </div>

        <!-- Models tag input -->
        <div>
          <div class="mb-1.5 flex items-center justify-between">
            <p class="text-sm font-medium text-[var(--text-secondary)]">
              {{ t('channels.modelsLabel') }}
            </p>
            <span class="text-xs text-[var(--text-tertiary)]">
              {{
                t('channels.modelsSelectedCount', { count: modelTags.length })
              }}
            </span>
          </div>
          <div
            class="min-h-10 flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-3 py-2 focus-within:border-[var(--border-strong)]"
          >
            <span
              v-for="tag in modelTags"
              :key="tag"
              class="inline-flex items-center gap-1 rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]"
            >
              {{ tag }}
              <button
                type="button"
                :aria-label="`Remove ${tag}`"
                class="ml-0.5 rounded-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                @click="removeModelTag(tag)"
              >
                <X :size="11" />
              </button>
            </span>
            <input
              v-model="modelInput"
              type="text"
              class="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
              :placeholder="
                modelTags.length ? '' : t('channels.modelsSearchPlaceholder')
              "
              @keydown="onModelInputKeydown"
              @blur="modelInput.trim() && addModelTag(modelInput)"
            />
          </div>

          <!-- Quick actions -->
          <div class="mt-2">
            <p class="mb-1.5 text-xs text-[var(--text-tertiary)]">
              {{ t('channels.quickActionsDesc') }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                class="channel-form-quick-action"
                :disabled="fetchingUpstream || !canFetchUpstream"
                @click="fetchUpstream"
              >
                {{
                  fetchingUpstream
                    ? t('common.loading')
                    : t('channels.quickFetchUpstream')
                }}
              </button>
              <button
                type="button"
                class="channel-form-quick-action"
                :disabled="modelTags.length === 0"
                @click="copyAllModels"
              >
                {{ t('channels.quickCopyAll') }}
              </button>
              <button
                type="button"
                class="channel-form-quick-action"
                :disabled="modelTags.length === 0"
                @click="form.models = ''"
              >
                {{ t('channels.quickClearAll') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Model mapping -->
        <div>
          <div class="mb-2 flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-[var(--text-secondary)]">
                {{ t('channels.modelMapping') }}
              </p>
              <p class="text-xs text-[var(--text-tertiary)]">
                {{ t('channels.modelMappingDesc') }}
              </p>
            </div>
            <div class="flex gap-1 rounded-lg bg-[var(--surface-muted)] p-0.5">
              <button
                type="button"
                class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                :class="
                  modelMappingTab === 'visual'
                    ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)]'
                "
                @click="onSwitchToVisual"
              >
                {{ t('channels.modelMappingVisual') }}
              </button>
              <button
                type="button"
                class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                :class="
                  modelMappingTab === 'json'
                    ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)]'
                "
                @click="onSwitchToJson"
              >
                {{ t('channels.modelMappingJson') }}
              </button>
            </div>
          </div>

          <!-- Visual mapping editor -->
          <template v-if="modelMappingTab === 'visual'">
            <div
              v-if="mappingRows.length === 0"
              class="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-5 text-center text-sm text-[var(--text-tertiary)]"
            >
              {{ t('channels.modelMappingEmpty') }}
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(row, index) in mappingRows"
                :key="index"
                class="flex items-center gap-2"
              >
                <input
                  v-model="row.from"
                  type="text"
                  class="channel-form-input flex-1"
                  placeholder="gpt-4"
                  @change="syncJsonFromRows"
                />
                <span class="shrink-0 text-xs text-[var(--text-tertiary)]"
                  >→</span
                >
                <input
                  v-model="row.to"
                  type="text"
                  class="channel-form-input flex-1"
                  placeholder="gpt-4-turbo"
                  @change="syncJsonFromRows"
                />
                <button
                  type="button"
                  class="shrink-0 rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--status-danger)]"
                  @click="removeMappingRow(index)"
                >
                  <X :size="13" />
                </button>
              </div>
            </div>
            <button
              type="button"
              class="mt-2 w-full rounded-xl border border-dashed border-[var(--border-subtle)] py-2 text-sm text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] transition-colors"
              @click="addMappingRow"
            >
              {{ t('channels.addMapping') }}
            </button>
          </template>

          <!-- JSON mapping editor -->
          <template v-else>
            <textarea
              v-model="modelMappingJson"
              rows="5"
              class="channel-form-textarea focus-ring font-mono text-xs"
              placeholder='{"gpt-4": "gpt-4-turbo"}'
              @blur="syncRowsFromJson"
            />
          </template>
        </div>

        <!-- Group tag input -->
        <div>
          <p class="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">
            {{ t('channels.groupLabel') }}
            <span class="text-[var(--status-danger)]">*</span>
          </p>
          <p class="mb-2 text-xs text-[var(--text-tertiary)]">
            {{ t('channels.groupDesc') }}
          </p>
          <div
            class="min-h-10 flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-3 py-2 focus-within:border-[var(--border-strong)]"
          >
            <span
              v-for="tag in groupTags"
              :key="tag"
              class="inline-flex items-center gap-1 rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]"
            >
              {{ tag }}
              <button
                v-if="groupTags.length > 1"
                type="button"
                :aria-label="`Remove ${tag}`"
                class="ml-0.5 rounded-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                @click="removeGroupTag(tag)"
              >
                <X :size="11" />
              </button>
            </span>
            <input
              v-model="groupInput"
              type="text"
              class="min-w-[100px] flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
              :placeholder="t('channels.groupSearchPlaceholder')"
              @keydown="onGroupInputKeydown"
              @blur="groupInput.trim() && addGroupTag(groupInput)"
            />
          </div>
        </div>
      </section>

      <!-- ══ Section: 高级设置 (折叠) ═══════════════════════════════════ -->
      <section class="channel-form-section">
        <button
          type="button"
          class="channel-form-section-header w-full text-left"
          :aria-expanded="advancedOpen"
          @click="advancedOpen = !advancedOpen"
        >
          <div class="channel-form-section-icon">
            <Settings :size="16" />
          </div>
          <div class="flex-1">
            <p class="channel-form-section-title">
              {{ t('channels.sectionAdvanced') }}
            </p>
            <p class="channel-form-section-desc">
              {{ t('channels.sectionAdvancedDesc') }}
            </p>
          </div>
          <ChevronDown
            v-if="!advancedOpen"
            :size="16"
            class="shrink-0 text-[var(--text-tertiary)]"
          />
          <ChevronUp
            v-else
            :size="16"
            class="shrink-0 text-[var(--text-tertiary)]"
          />
        </button>

        <div v-show="advancedOpen" class="mt-4 space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <FormField :label="t('channels.priority')">
              <input
                v-model.number="form.priority"
                type="number"
                min="0"
                max="1000000"
                step="1"
                name="admin-channel-priority"
                :aria-label="t('channels.priority')"
                class="channel-form-number focus-ring"
              />
            </FormField>
            <FormField :label="t('channels.weight')">
              <input
                v-model.number="form.weight"
                type="number"
                min="0"
                max="1000000"
                step="1"
                name="admin-channel-weight"
                :aria-label="t('channels.weight')"
                class="channel-form-number focus-ring"
              />
            </FormField>
            <FormField
              :label="t('channels.capacityTotal')"
              :hint="t('channels.capacityTotalHint')"
            >
              <input
                v-model.number="form.capacityTotal"
                type="number"
                :min="minimumCapacity"
                max="1000000"
                step="1"
                name="admin-channel-capacity"
                :aria-label="t('channels.capacityTotal')"
                class="channel-form-number focus-ring"
              />
            </FormField>
            <FormField
              :label="t('channels.channelRatio')"
              :hint="t('channels.channelRatioHint')"
            >
              <div class="relative">
                <input
                  v-model.number="form.channelRatio"
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  name="admin-channel-ratio"
                  :aria-label="t('channels.channelRatio')"
                  class="channel-form-number pr-10 focus-ring"
                />
                <span
                  class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]"
                  aria-hidden="true"
                  >×</span
                >
              </div>
            </FormField>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <ConsoleButton
          variant="secondary"
          size="lg"
          :disabled="saving"
          @click="close"
        >
          {{ t('common.cancel') }}
        </ConsoleButton>
        <ConsoleButton
          size="lg"
          :loading="saving"
          :disabled="!valid"
          @click="submit"
        >
          {{ t('channels.saveChannel') }}
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>

<style scoped>
/* ── Section layout ──────────────────────────────────────────────────────── */
.channel-form-section {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--border-subtle);
}
.channel-form-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.channel-form-section-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.channel-form-section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: var(--surface-muted);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-top: 0.1rem;
}
.channel-form-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}
.channel-form-section-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}
/* ── Inputs ──────────────────────────────────────────────────────────────── */
.channel-form-number {
  width: 100%;
  height: 2.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-solid);
  padding: 0 1rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  outline: none;
}
.channel-form-number:focus {
  border-color: var(--border-strong);
}
.channel-form-quick-action {
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: var(--surface-muted);
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  transition:
    background-color 0.15s,
    color 0.15s;
}
.channel-form-quick-action:hover:not(:disabled) {
  background: var(--surface-solid);
  color: var(--text-primary);
}
.channel-form-quick-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.channel-form-input {
  height: 2.25rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.625rem;
  background: var(--surface-solid);
  padding: 0 0.75rem;
  color: var(--text-primary);
  font-size: 0.8125rem;
  outline: none;
}
.channel-form-input:focus {
  border-color: var(--border-strong);
}
.channel-form-textarea {
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-solid);
  padding: 0.625rem 0.875rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  resize: vertical;
  outline: none;
  min-height: 5.5rem;
}
.channel-form-textarea:focus {
  border-color: var(--border-strong);
}
</style>
