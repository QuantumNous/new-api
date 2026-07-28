<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import type { TokenSummary, TokenType } from '@/types/console'
import AmountInput from '@/components/common/AmountInput.vue'
import ChipPicker from '@/components/common/ChipPicker.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import { useToast } from '@/composables/useToast'
import { QUOTA_PER_DOLLAR } from '@/utils/format'

const props = defineProps<{
  open: boolean
  /** null = create mode */
  editing: TokenSummary | null
  models: string[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()

const form = reactive({
  type: 'auto' as TokenType,
  name: '',
  customKey: '',
  model_limits: [] as string[],
  quotaDollars: null as number | null,
  unlimited: false,
  ipText: '',
  rateLimit: null as number | null,
  maxRatio: null as number | null,
  expireDate: '',
})
const saving = ref(false)
const advancedOpen = ref(false)
const advancedSectionId = useId()

/** Which optional sections are expanded (hidden by default). */
const vis = reactive({
  rateLimit: false,
  expiry: false,
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const e = props.editing
    form.type = e?.type ?? 'auto'
    form.name = e?.name ?? ''
    form.customKey = ''
    form.model_limits = e?.model_limits ? [...e.model_limits] : []
    form.quotaDollars =
      e && !e.unlimited ? e.remain_quota / QUOTA_PER_DOLLAR : null
    form.unlimited = e?.unlimited ?? true
    form.ipText = e?.ip_limits?.join('\n') ?? ''
    form.rateLimit = e && e.rate_limit > 0 ? e.rate_limit : null
    form.maxRatio = e?.max_ratio ?? null
    form.expireDate =
      e && e.expired_time > 0
        ? new Date(e.expired_time * 1000).toISOString().slice(0, 10)
        : ''

    vis.rateLimit = (form.rateLimit ?? 0) > 0
    vis.expiry = form.expireDate.length > 0
    advancedOpen.value = Boolean(
      e &&
      (form.model_limits.length > 0 ||
        form.ipText.trim().length > 0 ||
        vis.rateLimit)
    )
  },
  { immediate: true }
)

const typeCards = computed(() => [
  {
    value: 'manual' as const,
    title: t('keys.type.manual'),
    desc: t('keys.type.manualDesc'),
  },
  {
    value: 'auto' as const,
    title: t('keys.type.auto'),
    desc: t('keys.type.autoDesc'),
  },
])

const advancedConfiguredCount = computed(() => {
  let count = 0
  if (!props.editing && form.customKey.trim()) count++
  if (form.model_limits.length > 0) count++
  if (vis.rateLimit) count++
  if (form.ipText.trim()) count++
  return count
})

/** Adaptive step size for the rate-limit stepper. */
function rateLimitStepSize(value: number): number {
  if (value <= 30) return 5
  if (value <= 120) return 10
  if (value <= 600) return 30
  return 60
}

function adjustRateLimit(direction: 1 | -1) {
  const cur = form.rateLimit ?? 60
  const step = rateLimitStepSize(direction > 0 ? cur : Math.max(1, cur - 1))
  form.rateLimit = Math.max(1, cur + direction * step)
}

function onRateLimitWheel(e: WheelEvent) {
  adjustRateLimit(e.deltaY < 0 ? 1 : -1)
}

const RATE_PRESETS = [10, 30, 60, 120, 300, 600]

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const payload: Record<string, unknown> = {
      name: form.name,
      model_limits: form.model_limits,
      unlimited: form.unlimited,
      remain_quota: form.unlimited
        ? 0
        : Math.round((form.quotaDollars ?? 0) * QUOTA_PER_DOLLAR),
      ip_limits: form.ipText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      rate_limit: vis.rateLimit ? (form.rateLimit ?? 0) : 0,
      max_ratio: form.maxRatio ?? undefined,
      expired_time:
        vis.expiry && form.expireDate
          ? Math.floor(new Date(form.expireDate).getTime() / 1000)
          : -1,
    }
    if (props.editing) {
      await api.put(`/api/token/${props.editing.id}`, payload)
      toast.success(t('keys.updated'))
    } else {
      payload.type = form.type
      if (form.customKey.trim()) payload.key = form.customKey.trim()
      await api.post('/api/token/', payload)
      toast.success(t('keys.created'))
    }
    emit('saved')
    emit('close')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ConsoleModal
    :open="open"
    :title="editing ? t('keys.editTitle') : t('keys.createTitle')"
    size="lg"
    @close="emit('close')"
  >
    <div class="space-y-4 text-left">
      <!-- Token type is fixed after creation. -->
      <FormField :label="t('keys.type.label')">
        <div
          class="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          :aria-label="t('keys.type.label')"
        >
          <button
            v-for="card in typeCards"
            :key="card.value"
            type="button"
            role="radio"
            :aria-checked="form.type === card.value"
            :disabled="editing !== null"
            class="rounded-xl border px-3.5 py-3 text-left transition-colors focus-ring disabled:cursor-not-allowed"
            :class="
              form.type === card.value
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-solid)] hover:border-[var(--border-strong)] disabled:opacity-50'
            "
            @click="form.type = card.value"
          >
            <span
              class="block text-sm font-semibold"
              :class="
                form.type === card.value
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-primary)]'
              "
            >
              {{ card.title }}
            </span>
            <span
              class="mt-0.5 block text-xs leading-relaxed text-[var(--text-tertiary)]"
              >{{ card.desc }}</span
            >
          </button>
        </div>
      </FormField>

      <FormField :label="t('keys.nameLabel')">
        <TextInput
          v-model="form.name"
          name="token-name"
          :placeholder="t('keys.namePlaceholder')"
        />
      </FormField>

      <!-- expiry: toggle-hidden -->
      <div
        class="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] px-4 py-2.5"
      >
        <span class="text-sm text-[var(--text-secondary)]">{{
          t('keys.expireLabel')
        }}</span>
        <ConsoleToggle v-model="vis.expiry" :label="t('keys.expireLabel')" />
      </div>
      <div v-if="vis.expiry">
        <input
          v-model="form.expireDate"
          type="date"
          name="token-expiration"
          :aria-label="t('keys.expireLabel')"
          class="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--border-strong)] focus-ring"
        />
      </div>

      <!-- quota: unlimited by default; toggle to set a cap -->
      <div
        class="overflow-hidden rounded-xl border border-[var(--border-subtle)]"
      >
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="text-sm text-[var(--text-secondary)]">{{
            t('keys.quotaLabel')
          }}</span>
          <label
            class="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
          >
            <ConsoleToggle
              v-model="form.unlimited"
              :label="t('keys.unlimitedQuota')"
            />
            {{ t('keys.unlimitedQuota') }}
          </label>
        </div>
        <div
          v-if="!form.unlimited"
          class="border-t border-[var(--border-subtle)] px-4 pb-3 pt-2"
        >
          <AmountInput
            v-model="form.quotaDollars"
            name="token-quota"
            :aria-label="t('keys.quotaLabel')"
            placeholder="20"
            :min="0"
          />
        </div>
      </div>

      <FormField :label="t('keys.maxRatio')" :hint="t('keys.maxRatioHint')">
        <AmountInput
          v-model="form.maxRatio"
          name="token-max-ratio"
          :aria-label="t('keys.maxRatio')"
          placeholder="2"
          :min="0"
        />
      </FormField>

      <section
        class="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)]"
      >
        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)] focus-ring"
          :aria-expanded="advancedOpen"
          :aria-controls="advancedSectionId"
          @click="advancedOpen = !advancedOpen"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]"
            aria-hidden="true"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="8" cy="17" r="2" />
            </svg>
          </span>
          <span class="min-w-0 flex-1">
            <span
              class="block text-sm font-semibold text-[var(--text-primary)]"
            >
              {{ t('keys.advancedTitle') }}
            </span>
            <span class="block truncate text-xs text-[var(--text-tertiary)]">
              {{ t('keys.advancedSummary') }}
            </span>
          </span>
          <span
            v-if="advancedConfiguredCount > 0"
            class="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-text)]"
          >
            {{
              t('keys.advancedConfigured', { count: advancedConfiguredCount })
            }}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0 text-[var(--text-tertiary)] transition-transform"
            :class="{ 'rotate-180': advancedOpen }"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <div
          v-if="advancedOpen"
          :id="advancedSectionId"
          class="space-y-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 px-4 py-4"
        >
          <FormField
            v-if="!editing"
            :label="t('keys.customKey')"
            :hint="t('keys.customKeyHint')"
          >
            <TextInput
              v-model="form.customKey"
              name="token-custom-key"
              placeholder="sk-…"
            />
          </FormField>

          <FormField :label="t('keys.modelsLabel')">
            <ChipPicker
              v-model="form.model_limits"
              :options="models"
              :placeholder="t('keys.modelsPlaceholder')"
            />
          </FormField>

          <div class="space-y-2">
            <div
              class="flex items-center justify-between gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-3 py-2.5"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-[var(--text-primary)]">
                  {{ t('keys.rateLimit') }}
                </p>
                <p class="text-xs text-[var(--text-tertiary)]">
                  {{ t('keys.rateLimitHint') }}
                </p>
              </div>
              <ConsoleToggle
                v-model="vis.rateLimit"
                :label="t('keys.rateLimit')"
              />
            </div>
            <div
              v-if="vis.rateLimit"
              class="overflow-hidden rounded-lg border border-[var(--accent)] bg-[var(--surface-solid)]"
            >
              <div
                class="flex select-none items-center"
                @wheel.prevent="onRateLimitWheel"
              >
                <button
                  type="button"
                  class="flex h-14 w-12 shrink-0 items-center justify-center text-xl font-light text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] active:bg-[var(--accent-soft)]"
                  :aria-label="t('keys.rateLimit') + ' -'"
                  @click="adjustRateLimit(-1)"
                >
                  −
                </button>
                <div class="flex flex-1 flex-col items-center py-2">
                  <div class="flex items-baseline gap-1">
                    <input
                      v-model.number="form.rateLimit"
                      type="number"
                      min="1"
                      name="token-rate-limit"
                      :aria-label="t('keys.rateLimit')"
                      class="w-20 bg-transparent text-center text-3xl font-bold text-[var(--accent-text)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span
                      class="text-sm font-medium text-[var(--text-tertiary)]"
                      >RPM</span
                    >
                  </div>
                  <p class="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
                    {{ t('keys.rateLimitEditHint') }}
                  </p>
                </div>
                <button
                  type="button"
                  class="flex h-14 w-12 shrink-0 items-center justify-center text-xl font-light text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] active:bg-[var(--accent-soft)]"
                  :aria-label="t('keys.rateLimit') + ' +'"
                  @click="adjustRateLimit(1)"
                >
                  +
                </button>
              </div>
              <div
                class="flex gap-1.5 border-t border-[var(--border-subtle)] px-3 py-2"
              >
                <button
                  v-for="p in RATE_PRESETS"
                  :key="p"
                  type="button"
                  class="flex-1 rounded-lg py-1 text-xs font-medium transition-colors focus-ring"
                  :class="
                    form.rateLimit === p
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                      : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-solid)] hover:text-[var(--text-primary)]'
                  "
                  @click="form.rateLimit = p"
                >
                  {{ p }}
                </button>
              </div>
            </div>
          </div>

          <FormField :label="t('keys.ipLabel')">
            <textarea
              v-model="form.ipText"
              rows="2"
              name="token-ip-limits"
              :aria-label="t('keys.ipLabel')"
              :placeholder="t('keys.ipPlaceholder')"
              class="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 py-2.5 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors focus:border-[var(--border-strong)] focus-ring"
            />
          </FormField>
        </div>
      </section>
    </div>

    <template #footer>
      <ConsoleButton
        size="lg"
        block
        :loading="saving"
        :disabled="!form.name.trim()"
        @click="save"
      >
        {{ t('common.confirm') }}
      </ConsoleButton>
    </template>
  </ConsoleModal>
</template>
