<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import AuthLayout from '@/components/layout/AuthLayout.vue'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()

const email = ref('')
const loading = ref(false)
const sent = ref(false)

async function submit() {
  loading.value = true
  try {
    await authApi.resetPassword(email.value)
    sent.value = true
    toast.success(t('auth.resetSent'))
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <RouterLink
      :to="{ name: 'sign-in' }"
      class="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
    >
      ← {{ t('common.back') }}
    </RouterLink>
    <h1 class="display-title text-3xl font-bold text-[var(--text-primary)]">
      {{ t('auth.resetTitle') }}
    </h1>
    <p class="mt-2 text-sm text-[var(--text-tertiary)]">
      {{ t('auth.resetSubtitle') }}
    </p>

    <form class="mt-8 space-y-4" @submit.prevent="submit">
      <FormField :label="t('auth.email')">
        <TextInput
          v-model="email"
          type="email"
          :placeholder="t('auth.email')"
          autocomplete="email"
        />
      </FormField>
      <ConsoleButton
        type="submit"
        size="lg"
        block
        :loading="loading"
        :disabled="sent"
      >
        {{ sent ? `✓ ${t('auth.resetSent')}` : t('auth.sendReset') }}
      </ConsoleButton>
    </form>
  </AuthLayout>
</template>
