<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import AuthLayout from '@/components/layout/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/api/types'
import { sanitizeRedirect } from '@/router'
import { useAppStore } from '@/stores'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const app = useAppStore()
const toast = useToast()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

async function submit() {
  if (loading.value) return
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    toast.success(t('toast.loginSuccess'))
    const redirect = sanitizeRedirect(route.query.redirect)
    await router.push(redirect || { name: 'dashboard' })
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <div class="text-center">
      <p class="text-xs italic tracking-wide text-[var(--text-tertiary)]">
        {{ t('auth.cardMotto') }}
      </p>
      <h1
        class="display-title mt-3 text-3xl font-bold text-[var(--text-primary)]"
      >
        {{ t('auth.signInTitle') }}
      </h1>
      <p class="mt-2 text-sm text-[var(--text-tertiary)]">
        {{ t('auth.signInSubtitle') }}
      </p>
    </div>

    <form class="mt-8 space-y-4" @submit.prevent="submit">
      <FormField :label="t('auth.username')">
        <TextInput
          v-model="username"
          :placeholder="t('auth.username')"
          autocomplete="username"
        />
      </FormField>

      <FormField :label="t('auth.password')">
        <div class="relative">
          <TextInput
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            :placeholder="t('auth.password')"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
            :aria-label="
              showPassword ? t('auth.hidePassword') : t('auth.showPassword')
            "
            @click="showPassword = !showPassword"
          >
            <svg
              v-if="showPassword"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M3 3l18 18M10.5 10.7a3 3 0 0 0 4.2 4.2M7.4 7.6C4.8 9.3 3 12 3 12s3.5 6 9 6c1.6 0 3-.4 4.3-1M12 6c5.5 0 9 6 9 6s-.6 1.1-1.8 2.3"
              />
            </svg>
            <svg
              v-else
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </FormField>

      <div class="flex justify-end">
        <RouterLink
          :to="{ name: 'reset' }"
          class="text-xs font-medium text-[var(--accent-text)] hover:underline"
        >
          {{ t('auth.forgot') }}
        </RouterLink>
      </div>

      <ConsoleButton type="submit" size="lg" block :loading="loading">
        {{ t('auth.signIn') }}
      </ConsoleButton>
    </form>

    <p
      v-if="app.registerEnabled"
      class="mt-6 text-center text-sm text-[var(--text-tertiary)]"
    >
      {{ t('auth.noAccount') }}
      <RouterLink
        :to="{ name: 'sign-up' }"
        class="font-semibold text-[var(--accent-text)] hover:underline"
      >
        {{ t('auth.goSignUp') }}
      </RouterLink>
    </p>
  </AuthLayout>
</template>
