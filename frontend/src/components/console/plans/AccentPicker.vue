<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  PLAN_ACCENT_TOKENS,
  accentContrastWarning,
  planAccentColor,
  planAccentLabelKey,
} from '@/constants/adminPlans'
import type { PlanAccent } from '@/types/console'
import { normalizeOpaqueColor } from '@/utils/cssColor'

const model = defineModel<PlanAccent>({ required: true })

const { t } = useI18n()

const DEFAULT_CUSTOM = '#7f6bd6'

/** Swatch preview for each choice; custom shows the currently picked hex. */
function swatch(token: PlanAccent['token']): string {
  if (token !== 'custom') return `var(--${token})`
  return normalizeOpaqueColor(model.value.hex ?? '', DEFAULT_CUSTOM)
}

const customHex = computed<string>({
  get: () => normalizeOpaqueColor(model.value.hex ?? '', DEFAULT_CUSTOM),
  set: (value) => {
    model.value = { token: 'custom', hex: value }
  },
})

/** Free-text hex, committed only once it parses to a full colour. */
const hexText = computed<string>({
  get: () => customHex.value,
  set: (raw) => {
    const value = raw.trim()
    if (/^#([\da-f]{3}|[\da-f]{6})$/i.test(value)) {
      model.value = {
        token: 'custom',
        hex: normalizeOpaqueColor(value, DEFAULT_CUSTOM),
      }
    }
  },
})

function select(token: PlanAccent['token']): void {
  if (token === 'custom') {
    model.value = { token: 'custom', hex: customHex.value }
    return
  }
  model.value = { token }
}

const warning = computed(() => accentContrastWarning(model.value))
</script>

<template>
  <fieldset>
    <legend
      class="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
    >
      {{ t('planManagement.formAccent') }}
    </legend>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="token in PLAN_ACCENT_TOKENS"
        :key="token"
        type="button"
        class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors focus-ring"
        data-handdrawn="brand-option"
        :class="
          model.token === token
            ? 'border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-primary)]'
            : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'
        "
        :aria-pressed="model.token === token"
        @click="select(token)"
      >
        <span
          class="h-3.5 w-3.5 rounded-full"
          :style="{ background: swatch(token) }"
          aria-hidden="true"
        />
        {{ t(planAccentLabelKey(token)) }}
      </button>
    </div>

    <!-- custom colour controls: native picker plus a typable hex -->
    <div v-if="model.token === 'custom'" class="mt-3 flex items-center gap-3">
      <input
        v-model="customHex"
        type="color"
        class="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--border-default)] bg-transparent p-1"
        :aria-label="t('planManagement.formAccentPick')"
      />
      <input
        v-model="hexText"
        type="text"
        maxlength="7"
        spellcheck="false"
        class="pencil-control h-9 w-28 border bg-[var(--surface-solid)] px-2.5 font-mono text-sm uppercase text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        style="border-color: var(--border-default)"
        :aria-label="t('planManagement.formAccentHex')"
      />
      <p
        class="min-w-0 flex-1 text-[11px] text-[var(--text-tertiary)]"
        :style="warning ? 'color: var(--status-warning-text)' : undefined"
        role="status"
      >
        {{
          warning
            ? t('planManagement.formAccentContrast', {
                day: warning.day,
                night: warning.night,
              })
            : t('planManagement.formAccentHint')
        }}
      </p>
    </div>

    <!-- preview strip so the choice reads the same way the card renders it -->
    <div
      class="mt-3 h-[3px] w-full rounded-full"
      :style="{
        background: `linear-gradient(90deg, transparent, ${planAccentColor(model)} 20%, ${planAccentColor(model)} 80%, transparent)`,
      }"
      aria-hidden="true"
    />
  </fieldset>
</template>
