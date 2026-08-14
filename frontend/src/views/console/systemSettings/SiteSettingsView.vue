<script setup lang="ts">
import { reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useSystemSettings } from '@/composables/useSystemSettings'
import { BRAND_NAME } from '@/constants/branding'
import SysSettingsFormCard from '@/components/console/systemSettings/SysSettingsFormCard.vue'
import SysInputRow from '@/components/console/systemSettings/SysInputRow.vue'

const { t } = useI18n()
const toast = useToast()
const { settings, load, saveOptions } = useSystemSettings()

// ── System Info section ────────────────────────────────────────────────────
const info = reactive({
  SystemName: '',
  ServerAddress: '',
  Logo: '',
  Footer: '',
  About: '',
  HomePageContent: '',
  'legal.user_agreement': '',
  'legal.privacy_policy': '',
})
const infoSaving = reactive({ value: false })

function syncInfo() {
  info.SystemName = settings.value.SystemName
  info.ServerAddress = settings.value.ServerAddress
  info.Logo = settings.value.Logo
  info.Footer = settings.value.Footer
  info.About = settings.value.About
  info.HomePageContent = settings.value.HomePageContent
  info['legal.user_agreement'] = settings.value['legal.user_agreement']
  info['legal.privacy_policy'] = settings.value['legal.privacy_policy']
}

const infoDirty = computed(
  () =>
    info.SystemName !== settings.value.SystemName ||
    info.ServerAddress !== settings.value.ServerAddress ||
    info.Logo !== settings.value.Logo ||
    info.Footer !== settings.value.Footer ||
    info.About !== settings.value.About ||
    info.HomePageContent !== settings.value.HomePageContent ||
    info['legal.user_agreement'] !== settings.value['legal.user_agreement'] ||
    info['legal.privacy_policy'] !== settings.value['legal.privacy_policy']
)

async function saveInfo() {
  infoSaving.value = true
  const patch: Record<string, string> = {}
  if (info.SystemName !== settings.value.SystemName)
    patch.SystemName = info.SystemName
  if (info.ServerAddress !== settings.value.ServerAddress)
    patch.ServerAddress = info.ServerAddress.replace(/\/+$/, '')
  if (info.Logo !== settings.value.Logo) patch.Logo = info.Logo
  if (info.Footer !== settings.value.Footer) patch.Footer = info.Footer
  if (info.About !== settings.value.About) patch.About = info.About
  if (info.HomePageContent !== settings.value.HomePageContent)
    patch.HomePageContent = info.HomePageContent
  if (info['legal.user_agreement'] !== settings.value['legal.user_agreement'])
    patch['legal.user_agreement'] = info['legal.user_agreement']
  if (info['legal.privacy_policy'] !== settings.value['legal.privacy_policy'])
    patch['legal.privacy_policy'] = info['legal.privacy_policy']

  const ok = await saveOptions(patch)
  infoSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Notice section ─────────────────────────────────────────────────────────
const notice = reactive({ Notice: '' })
const noticeSaving = reactive({ value: false })
const noticeDirty = computed(() => notice.Notice !== settings.value.Notice)

async function saveNotice() {
  noticeSaving.value = true
  const ok = await saveOptions({ Notice: notice.Notice })
  noticeSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

onMounted(async () => {
  await load()
  syncInfo()
  notice.Notice = settings.value.Notice
})
</script>

<template>
  <div class="space-y-6">
    <!-- System Information -->
    <SysSettingsFormCard
      :title="t('systemSettings.site.systemInfo')"
      :saving="infoSaving.value"
      :dirty="infoDirty"
      @save="saveInfo"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <SysInputRow
          v-model="info.SystemName"
          :label="t('systemSettings.site.systemName')"
          :description="t('systemSettings.site.systemNameDesc')"
          :placeholder="BRAND_NAME"
          class="sm:col-span-2"
        />
        <SysInputRow
          v-model="info.ServerAddress"
          :label="t('systemSettings.site.serverAddress')"
          :description="t('systemSettings.site.serverAddressDesc')"
          :placeholder="t('systemSettings.site.serverAddressPlaceholder')"
          type="url"
          class="sm:col-span-2"
        />
        <SysInputRow
          v-model="info.Logo"
          :label="t('systemSettings.site.logoUrl')"
          :description="t('systemSettings.site.logoUrlDesc')"
          :placeholder="t('systemSettings.site.logoUrlPlaceholder')"
          type="url"
          class="sm:col-span-2"
        />
        <SysInputRow
          v-model="info.Footer"
          :label="t('systemSettings.site.footer')"
          :description="t('systemSettings.site.footerDesc')"
          :placeholder="t('systemSettings.site.footerPlaceholder')"
          :rows="3"
          class="sm:col-span-2"
        />
        <SysInputRow
          v-model="info.About"
          :label="t('systemSettings.site.about')"
          :description="t('systemSettings.site.aboutDesc')"
          :rows="4"
          class="sm:col-span-2"
        />
        <SysInputRow
          v-model="info.HomePageContent"
          :label="t('systemSettings.site.homePageContent')"
          :description="t('systemSettings.site.homePageContentDesc')"
          :rows="5"
          class="sm:col-span-2"
        />
        <SysInputRow
          v-model="info['legal.user_agreement']"
          :label="t('systemSettings.site.userAgreement')"
          :description="t('systemSettings.site.userAgreementDesc')"
          :rows="4"
        />
        <SysInputRow
          v-model="info['legal.privacy_policy']"
          :label="t('systemSettings.site.privacyPolicy')"
          :description="t('systemSettings.site.privacyPolicyDesc')"
          :rows="4"
        />
      </div>
    </SysSettingsFormCard>

    <!-- System Notice -->
    <SysSettingsFormCard
      :title="t('systemSettings.site.notice')"
      :saving="noticeSaving.value"
      :dirty="noticeDirty"
      @save="saveNotice"
    >
      <SysInputRow
        v-model="notice.Notice"
        :label="t('systemSettings.site.notice')"
        :description="t('systemSettings.site.noticeDesc')"
        :rows="6"
      />
    </SysSettingsFormCard>
  </div>
</template>
