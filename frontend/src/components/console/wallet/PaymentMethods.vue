<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{ modelValue?: string }>(), {
  modelValue: 'epay',
})

const emit = defineEmits<{
  'update:modelValue': [method: string]
}>()

const { t } = useI18n()

const methods = computed(() => [
  { value: 'epay', label: t('wallet.payEpay') },
  { value: 'stripe', label: t('wallet.payStripe') },
  { value: 'creem', label: t('wallet.payCreem') },
])
</script>

<template>
  <div>
    <p class="mb-2 text-xs text-[var(--text-tertiary)]">
      {{ t('wallet.payMethodLabel') }}
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="method in methods"
        :key="method.value"
        type="button"
        class="h-9 rounded-xl px-4 text-xs font-medium transition-all focus-ring"
        :style="
          props.modelValue === method.value
            ? 'background:var(--accent);color:var(--accent-contrast)'
            : 'background:var(--surface-muted);color:var(--text-secondary)'
        "
        @click="emit('update:modelValue', method.value)"
      >
        {{ method.label }}
      </button>
    </div>
  </div>
</template>
