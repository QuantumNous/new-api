<script setup lang="ts">
import { CheckCircle, Copy, Download } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  open: boolean
  codes: string[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const toast = useToast()
const copying = ref(false)

async function copyAll() {
  if (props.codes.length === 0) return
  copying.value = true
  try {
    await navigator.clipboard.writeText(props.codes.join('\n'))
    toast.success(t('redemption.allCopied'))
  } catch {
    const el = document.createElement('textarea')
    el.value = props.codes.join('\n')
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    toast.success(t('redemption.allCopied'))
  } finally {
    copying.value = false
  }
}

function download() {
  const content = props.codes.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `redemption-codes-${new Date().toISOString().slice(0, 10)}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <ConsoleModal
    :open="open"
    size="sm"
    :aria-label="t('redemption.successTitle')"
    @close="emit('close')"
  >
    <!-- Success header -->
    <div class="mb-4 flex flex-col items-center gap-3 text-center">
      <div
        class="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--status-success-bg)]"
      >
        <CheckCircle
          :size="24"
          class="text-[var(--status-success-text)]"
          aria-hidden="true"
        />
      </div>
      <div>
        <p class="text-lg font-bold text-[var(--text-primary)]">
          {{ t('redemption.successTitle') }}
        </p>
        <p class="mt-0.5 text-sm text-[var(--text-tertiary)]">
          {{ t('redemption.successSubtitle', { count: codes.length }) }}
        </p>
      </div>
    </div>

    <!-- Code list -->
    <div
      class="max-h-48 overflow-y-auto rounded-xl bg-[var(--surface-muted)] p-4"
    >
      <ul class="space-y-1">
        <li
          v-for="code in codes"
          :key="code"
          class="font-mono text-xs leading-relaxed text-[var(--text-secondary)] break-all"
        >
          {{ code }}
        </li>
      </ul>
    </div>

    <template #footer>
      <div class="flex gap-2">
        <ConsoleButton
          variant="secondary"
          class="flex-1"
          :loading="copying"
          @click="copyAll"
        >
          <Copy :size="14" aria-hidden="true" />
          {{ t('redemption.copyAll') }}
        </ConsoleButton>
        <ConsoleButton class="flex-1" @click="download">
          <Download :size="14" aria-hidden="true" />
          {{ t('redemption.download') }}
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>
