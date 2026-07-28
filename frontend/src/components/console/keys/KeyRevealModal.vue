<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError, type TokenSecretResponse } from '@/api/types'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  open: boolean
  tokenId: number | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const toast = useToast()

const fullKey = ref('')
const loading = ref(false)
let requestId = 0
let controller: AbortController | null = null

function clearSecret() {
  requestId += 1
  controller?.abort()
  controller = null
  fullKey.value = ''
  loading.value = false
}

watch(
  () => [props.open, props.tokenId] as const,
  async ([open, tokenId]) => {
    clearSecret()
    if (!open || tokenId === null) {
      return
    }

    const activeRequest = requestId
    const requestController = new AbortController()
    controller = requestController
    loading.value = true
    try {
      // Full-key read: rate-limited + cache-disabled on the real backend.
      const data = await api.get<TokenSecretResponse>(
        `/api/token/${tokenId}/key`,
        undefined,
        { signal: requestController.signal }
      )
      if (
        activeRequest !== requestId ||
        !props.open ||
        props.tokenId !== tokenId
      )
        return
      fullKey.value = data.key
    } catch (error) {
      if (activeRequest !== requestId || requestController.signal.aborted)
        return
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
      emit('close')
    } finally {
      if (activeRequest === requestId) loading.value = false
    }
  }
)

onBeforeUnmount(clearSecret)

async function copy() {
  try {
    await navigator.clipboard.writeText(fullKey.value)
    toast.success(t('common.copied'))
  } catch {
    toast.error(t('common.copyFailed'))
  }
}
</script>

<template>
  <ConsoleModal
    :open="open"
    :title="t('keys.revealTitle')"
    size="md"
    @close="emit('close')"
  >
    <div
      class="flex min-h-14 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 font-mono text-sm text-[var(--text-primary)]"
      style="word-break: break-all"
    >
      <span v-if="loading" class="animate-pulse text-[var(--text-tertiary)]"
        >••••••••</span
      >
      <span v-else>{{ fullKey }}</span>
    </div>
    <p class="mt-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
      {{ t('keys.revealNote') }}
    </p>
    <template #footer>
      <ConsoleButton size="lg" block :disabled="!fullKey" @click="copy">
        {{ t('common.copy') }}
      </ConsoleButton>
    </template>
  </ConsoleModal>
</template>
