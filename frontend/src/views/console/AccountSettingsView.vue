<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { isMockApi } from '@/api/client'
import { ApiError } from '@/api/types'
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import AccountSecurityPanel from '@/components/console/AccountSecurityPanel.vue'
import PageHero from '@/components/console/PageHero.vue'
import PreferencesNotificationsPanel from '@/components/console/PreferencesNotificationsPanel.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSettingsPrototypeStore } from '@/stores/settingsPrototype'

const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false,
})

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const prototype = isMockApi ? useSettingsPrototypeStore() : null

const profileOpen = ref(false)
const displayName = ref(auth.user?.display_name ?? '')
const savingProfile = ref(false)
const passwordOpen = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const savingPassword = ref(false)
const deleteOpen = ref(false)
const deleteConfirmText = ref('')
const deleting = ref(false)

watch(
  () => auth.user,
  (user) => {
    prototype?.initialize(user)
  },
  { immediate: true }
)

function openProfile(): void {
  displayName.value = auth.user?.display_name ?? ''
  profileOpen.value = true
}

async function saveProfile(): Promise<void> {
  if (!displayName.value.trim()) return
  savingProfile.value = true
  try {
    await auth.updateProfile({ display_name: displayName.value.trim() })
    toast.success(t('settings.profileSaved'))
    profileOpen.value = false
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    savingProfile.value = false
  }
}

function openPassword(): void {
  oldPassword.value = ''
  newPassword.value = ''
  passwordOpen.value = true
}

async function changePassword(): Promise<void> {
  savingPassword.value = true
  try {
    await auth.changePassword(oldPassword.value, newPassword.value)
    toast.success(t('settings.passwordChanged'))
    passwordOpen.value = false
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    savingPassword.value = false
  }
}

async function deleteAccount(): Promise<void> {
  if (deleting.value || deleteConfirmText.value !== auth.user?.username) return
  deleting.value = true
  try {
    await auth.deleteAccount()
    await router.push({ name: 'sign-in' })
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-6" data-handdrawn-page="settings">
    <PageHero
      v-if="!props.embedded"
      :title="t('settings.title')"
      :crumbs="[t('nav.profile'), t('settings.title')]"
    >
      <p class="mt-1 max-w-2xl text-sm text-[var(--text-tertiary)]">
        {{ t('settings.pageSubtitle') }}
      </p>
    </PageHero>

    <div class="grid items-start gap-8 2xl:grid-cols-2 2xl:gap-10">
      <AccountSecurityPanel
        :user="auth.user"
        @edit-profile="openProfile"
        @change-password="openPassword"
        @delete-account="deleteOpen = true"
      />
      <PreferencesNotificationsPanel :is-admin="auth.isAdmin" />
    </div>

    <ConsoleModal
      :open="profileOpen"
      :title="t('settings.editDisplayName')"
      size="sm"
      @close="profileOpen = false"
    >
      <FormField :label="t('settings.displayName')">
        <TextInput
          v-model="displayName"
          name="display-name"
          maxlength="50"
          autocomplete="name"
        />
      </FormField>
      <template #footer>
        <ConsoleButton
          block
          size="lg"
          :loading="savingProfile"
          :disabled="!displayName.trim()"
          @click="saveProfile"
        >
          {{ t('settings.saveProfile') }}
        </ConsoleButton>
      </template>
    </ConsoleModal>

    <ConsoleModal
      :open="passwordOpen"
      :title="t('settings.changePassword')"
      size="sm"
      @close="passwordOpen = false"
    >
      <div class="space-y-4">
        <FormField :label="t('settings.oldPassword')">
          <TextInput
            v-model="oldPassword"
            type="password"
            autocomplete="current-password"
          />
        </FormField>
        <FormField
          :label="t('auth.newPassword')"
          :hint="t('auth.passwordHint')"
        >
          <TextInput
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
          />
        </FormField>
        <PasswordStrengthMeter :password="newPassword" />
      </div>
      <template #footer>
        <ConsoleButton
          block
          size="lg"
          :loading="savingPassword"
          :disabled="!oldPassword || newPassword.length < 8"
          @click="changePassword"
        >
          {{ t('common.save') }}
        </ConsoleButton>
      </template>
    </ConsoleModal>

    <ConfirmDialog
      :open="deleteOpen"
      :title="t('settings.deleteAccount')"
      :message="t('settings.deleteAccountConfirm')"
      :confirm-text="t('common.delete')"
      :loading="deleting"
      @confirm="deleteAccount"
      @cancel="deleteOpen = false"
    >
      <FormField
        :label="t('settings.typeNameToConfirm', { name: auth.user?.username })"
        class="mt-4 w-full text-left"
      >
        <TextInput
          v-model="deleteConfirmText"
          :placeholder="auth.user?.username"
        />
      </FormField>
    </ConfirmDialog>
  </div>
</template>
