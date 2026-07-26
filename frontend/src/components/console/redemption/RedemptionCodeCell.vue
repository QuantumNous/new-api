<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/composables/useToast'
import { maskRedemptionCode } from '@/constants/adminRedemption'

const props = defineProps<{
  code: string
}>()

const { t } = useI18n()
const toast = useToast()

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code)
    toast.success(t('redemption.codeCopied'))
  } catch {
    // Fallback for environments without clipboard API
    const el = document.createElement('textarea')
    el.value = props.code
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    toast.success(t('redemption.codeCopied'))
  }
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-1.5">
    <span
      class="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]"
      :title="code"
    >
      {{ maskRedemptionCode(code) }}
    </span>
    <button
      type="button"
      class="shrink-0 rounded p-0.5 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      :aria-label="t('redemption.copyCode')"
      @click.stop="copyCode"
    >
      <Copy :size="12" aria-hidden="true" />
    </button>
  </div>
</template>
