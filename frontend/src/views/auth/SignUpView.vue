<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter.vue'
import TurnstileWidget from '@/components/auth/TurnstileWidget.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import AuthLayout from '@/components/layout/AuthLayout.vue'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import {
  clearAffiliateAttribution,
  getAffiliateAttribution,
  storeAffiliateAttribution,
} from '@/utils/affiliate'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const app = useAppStore()

const username = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const affiliateCode = ref('')
const affiliateValidating = ref(false)
const loading = ref(false)
const turnstileToken = ref('')
const turnstileUnavailable = ref(false)
const turnstileWidget = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const errors = reactive({
  username: '',
  email: '',
  password: '',
  confirm: '',
  affiliate: '',
})
const affiliateRequired = computed(() => app.affiliateRegistrationRequired)

async function validateAffiliateCode(): Promise<boolean> {
  errors.affiliate = ''
  const code = affiliateCode.value.trim()
  if (!code) {
    if (affiliateRequired.value) {
      errors.affiliate = t('auth.inviteCodeRequired')
      return false
    }
    return true
  }
  affiliateValidating.value = true
  try {
    await authApi.validateAffiliate(code)
    affiliateCode.value = code
    storeAffiliateAttribution(code)
    return true
  } catch (error) {
    errors.affiliate =
      error instanceof ApiError ? error.message : t('auth.inviteCodeInvalid')
    return false
  } finally {
    affiliateValidating.value = false
  }
}

// Mirrors the backend's minimal rules so obvious mistakes fail before the
// request instead of as an opaque server error.
function validate(): boolean {
  errors.username = ''
  errors.email = ''
  errors.password = ''
  errors.confirm = ''
  errors.affiliate = ''
  let valid = true
  if (!username.value.trim()) {
    errors.username = t('auth.usernameRequired')
    valid = false
  }
  if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) {
    errors.email = t('auth.emailInvalid')
    valid = false
  }
  if (password.value.length < 8) {
    errors.password = t('auth.passwordTooShort')
    valid = false
  }
  if (password.value !== confirm.value) {
    errors.confirm = t('auth.mismatch')
    valid = false
  }
  if (affiliateRequired.value && !affiliateCode.value.trim()) {
    errors.affiliate = t('auth.inviteCodeRequired')
    valid = false
  }
  return valid
}

async function submit() {
  if (loading.value || !validate() || !(await validateAffiliateCode())) return
  await app.initialize()
  if (app.turnstileEnabled) {
    if (!app.turnstileSiteKey || turnstileUnavailable.value) {
      toast.error(t('common.turnstileUnavailable'))
      return
    }
    if (!turnstileToken.value) {
      toast.error(t('common.turnstileRequired'))
      return
    }
  }
  loading.value = true
  try {
    await authApi.register(
      {
        username: username.value.trim(),
        email: email.value.trim(),
        password: password.value,
        aff_code: affiliateCode.value.trim() || undefined,
      },
      turnstileToken.value || undefined
    )
    clearAffiliateAttribution()
    toast.success(t('toast.registerSuccess'))
    await router.push({ name: 'sign-in' })
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
    if (app.turnstileEnabled) turnstileWidget.value?.reset()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await app.initialize()
  const queryCode = typeof route.query.aff === 'string' ? route.query.aff : ''
  const storedCode = getAffiliateAttribution()
  affiliateCode.value = queryCode.trim() || storedCode
  if (queryCode.trim() && !(await validateAffiliateCode()) && storedCode) {
    affiliateCode.value = storedCode
    errors.affiliate = ''
  }
})
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
        {{ t('auth.signUpTitle') }}
      </h1>
      <p class="mt-2 text-sm text-[var(--text-tertiary)]">
        {{ t('auth.signUpSubtitle') }}
      </p>
    </div>

    <form class="mt-8 space-y-4" @submit.prevent="submit">
      <FormField :label="t('auth.username')">
        <TextInput
          v-model="username"
          :placeholder="t('auth.username')"
          autocomplete="username"
        />
        <span
          v-if="errors.username"
          class="mt-1.5 block text-xs text-[var(--status-danger-text)]"
        >
          {{ errors.username }}
        </span>
      </FormField>
      <FormField :label="t('auth.email')">
        <TextInput
          v-model="email"
          type="email"
          :placeholder="t('auth.email')"
          autocomplete="email"
        />
        <span
          v-if="errors.email"
          class="mt-1.5 block text-xs text-[var(--status-danger-text)]"
        >
          {{ errors.email }}
        </span>
      </FormField>
      <FormField :label="t('auth.newPassword')" :hint="t('auth.passwordHint')">
        <TextInput
          v-model="password"
          type="password"
          :placeholder="t('auth.newPassword')"
          autocomplete="new-password"
        />
        <span
          v-if="errors.password"
          class="mt-1.5 block text-xs text-[var(--status-danger-text)]"
        >
          {{ errors.password }}
        </span>
      </FormField>
      <PasswordStrengthMeter :password="password" />
      <FormField :label="t('auth.confirmPassword')">
        <TextInput
          v-model="confirm"
          type="password"
          :placeholder="t('auth.confirmPassword')"
          autocomplete="new-password"
        />
        <span
          v-if="errors.confirm"
          class="mt-1.5 block text-xs text-[var(--status-danger-text)]"
        >
          {{ errors.confirm }}
        </span>
      </FormField>
      <FormField
        :label="t('auth.inviteCode')"
        :hint="
          affiliateRequired
            ? t('auth.inviteCodeRequiredHint')
            : t('auth.inviteCodeOptionalHint')
        "
      >
        <TextInput
          v-model="affiliateCode"
          :placeholder="t('auth.inviteCodePlaceholder')"
          autocomplete="off"
          @blur="validateAffiliateCode"
        />
        <span
          v-if="errors.affiliate"
          class="mt-1.5 block text-xs text-[var(--status-danger-text)]"
        >
          {{ errors.affiliate }}
        </span>
      </FormField>

      <TurnstileWidget
        v-if="app.turnstileEnabled"
        ref="turnstileWidget"
        :site-key="app.turnstileSiteKey"
        @verified="turnstileToken = $event"
        @unavailable="turnstileUnavailable = true"
      />

      <ConsoleButton
        type="submit"
        size="lg"
        block
        :loading="loading || affiliateValidating"
        :disabled="
          app.turnstileEnabled && (!turnstileToken || turnstileUnavailable)
        "
      >
        {{ t('auth.continue') }}
      </ConsoleButton>
    </form>

    <p class="mt-6 text-center text-sm text-[var(--text-tertiary)]">
      {{ t('auth.hasAccount') }}
      <RouterLink
        :to="{ name: 'sign-in' }"
        class="font-semibold text-[var(--accent-text)] hover:underline"
      >
        {{ t('auth.goSignIn') }}
      </RouterLink>
    </p>
  </AuthLayout>
</template>
