<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'
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
const twoFactorCode = ref('')
const twoFactorFlowToken = ref('')
const twoFactorExpiresAt = ref(0)
const showPassword = ref(false)
const loading = ref(false)

function resetTwoFactor() {
  twoFactorFlowToken.value = ''
  twoFactorCode.value = ''
  twoFactorExpiresAt.value = 0
}

async function submit() {
  if (loading.value) return
  loading.value = true
  try {
    if (twoFactorFlowToken.value) {
      if (Date.now() >= twoFactorExpiresAt.value * 1000) {
        resetTwoFactor()
        toast.error(t('auth.twoFactorExpired'))
        return
      }
      await auth.verifyTwoFactor(
        twoFactorFlowToken.value,
        twoFactorCode.value.trim()
      )
    } else {
      const challenge = await auth.login(username.value, password.value)
      if (challenge) {
        twoFactorFlowToken.value = challenge.flow_token
        twoFactorExpiresAt.value = challenge.expires_at
        return
      }
    }
    toast.success(t('auth.loginSuccess'))
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
      <h1
        class="auth-huiwen-title display-title mt-3 text-3xl font-bold text-[var(--text-primary)]"
      >
        {{ t('auth.signInTitle') }}
      </h1>
      <p class="mt-2 text-xs italic tracking-wide text-[var(--text-tertiary)]">
        {{ t('auth.cardMotto') }}
      </p>
    </div>

    <form class="mt-8 space-y-4" @submit.prevent="submit">
      <template v-if="!twoFactorFlowToken">
        <FormField :label="t('auth.username')">
          <TextInput
            v-model="username"
            :placeholder="t('auth.usernameOrEmailPlaceholder')"
            autocomplete="username"
          />
        </FormField>

        <FormField :label="t('auth.password')">
          <div class="relative">
            <TextInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :placeholder="t('auth.passwordPlaceholder')"
              autocomplete="current-password"
              class="[&_input]:pr-12"
            />
            <button
              type="button"
              class="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring"
              :aria-label="
                showPassword ? t('auth.hidePassword') : t('auth.showPassword')
              "
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" :size="18" />
              <Eye v-else :size="18" />
            </button>
          </div>
        </FormField>
      </template>

      <FormField v-else :label="t('auth.twoFactorCode')">
        <TextInput
          v-model="twoFactorCode"
          autocomplete="one-time-code"
          maxlength="32"
          :placeholder="t('auth.twoFactorPlaceholder')"
        />
      </FormField>

      <div v-if="!twoFactorFlowToken" class="flex justify-end">
        <RouterLink
          :to="{ name: 'reset' }"
          class="text-xs font-medium text-[var(--accent-text)] hover:underline"
        >
          {{ t('auth.forgot') }}
        </RouterLink>
      </div>

      <ConsoleButton type="submit" size="lg" block :loading="loading">
        {{ twoFactorFlowToken ? t('auth.verifyTwoFactor') : t('auth.signIn') }}
      </ConsoleButton>
      <button
        v-if="twoFactorFlowToken"
        type="button"
        class="w-full text-center text-xs font-medium text-[var(--accent-text)] hover:underline focus-ring"
        @click="resetTwoFactor"
      >
        {{ t('auth.backToPassword') }}
      </button>
    </form>

    <p
      v-if="app.registerEnabled && !twoFactorFlowToken"
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

<style scoped>
.auth-huiwen-title {
  font-family: 'Ren2AuthHuiwen', var(--font-display);
  font-weight: 400;
  letter-spacing: 0;
  font-synthesis: none;
}
</style>
