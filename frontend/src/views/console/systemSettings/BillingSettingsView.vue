<script setup lang="ts">
import { reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useSystemSettings } from '@/composables/useSystemSettings'
import SysSettingsFormCard from '@/components/console/systemSettings/SysSettingsFormCard.vue'
import SysInputRow from '@/components/console/systemSettings/SysInputRow.vue'
import SysToggleRow from '@/components/console/systemSettings/SysToggleRow.vue'

const { t } = useI18n()
const toast = useToast()
const { settings, load, saveOptions } = useSystemSettings()

// ── Quota ───────────────────────────────────────────────────────────────────
const quota = reactive({
  QuotaForNewUser: 0,
  PreConsumedQuota: 500000,
  QuotaForInvitee: 0,
  TopUpLink: '',
  'general_setting.docs_link': '',
  'quota_setting.enable_free_model_pre_consume': false,
})
const quotaSaving = reactive({ value: false })
const quotaDirty = computed(() => {
  const s = settings.value
  return (
    quota.QuotaForNewUser !== s.QuotaForNewUser ||
    quota.PreConsumedQuota !== s.PreConsumedQuota ||
    quota.QuotaForInvitee !== s.QuotaForInvitee ||
    quota.TopUpLink !== s.TopUpLink ||
    quota['general_setting.docs_link'] !== s['general_setting.docs_link'] ||
    quota['quota_setting.enable_free_model_pre_consume'] !==
      s['quota_setting.enable_free_model_pre_consume']
  )
})
async function saveQuota() {
  quotaSaving.value = true
  const s = settings.value
  const patch: Record<string, string | boolean | number> = {}
  if (quota.QuotaForNewUser !== s.QuotaForNewUser)
    patch.QuotaForNewUser = quota.QuotaForNewUser
  if (quota.PreConsumedQuota !== s.PreConsumedQuota)
    patch.PreConsumedQuota = quota.PreConsumedQuota
  if (quota.QuotaForInvitee !== s.QuotaForInvitee)
    patch.QuotaForInvitee = quota.QuotaForInvitee
  if (quota.TopUpLink !== s.TopUpLink) patch.TopUpLink = quota.TopUpLink
  if (quota['general_setting.docs_link'] !== s['general_setting.docs_link'])
    patch['general_setting.docs_link'] = quota['general_setting.docs_link']
  if (
    quota['quota_setting.enable_free_model_pre_consume'] !==
    s['quota_setting.enable_free_model_pre_consume']
  )
    patch['quota_setting.enable_free_model_pre_consume'] =
      quota['quota_setting.enable_free_model_pre_consume']
  const ok = await saveOptions(patch)
  quotaSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

// ── Check-in ────────────────────────────────────────────────────────────────
const checkin = reactive({
  'checkin_setting.enabled': false,
  'checkin_setting.min_quota': 100,
  'checkin_setting.max_quota': 500,
})

const affiliate = reactive({
  AffiliateEnabled: false,
  AffiliateRegistrationRequired: false,
  AffiliateRebateRateBps: 1000,
  AffiliateFreezeHours: 168,
  AffiliateDurationDays: 0,
  AffiliatePerInviteeCap: 100,
  AffiliateActivatedAt: 0,
})
const affiliateSaving = reactive({ value: false })
const affiliateDirty = computed(() => {
  const s = settings.value
  return (
    affiliate.AffiliateEnabled !== s.AffiliateEnabled ||
    affiliate.AffiliateRegistrationRequired !==
      s.AffiliateRegistrationRequired ||
    affiliate.AffiliateRebateRateBps !== s.AffiliateRebateRateBps ||
    affiliate.AffiliateFreezeHours !== s.AffiliateFreezeHours ||
    affiliate.AffiliateDurationDays !== s.AffiliateDurationDays ||
    affiliate.AffiliatePerInviteeCap !== s.AffiliatePerInviteeCap
  )
})
async function saveAffiliate() {
  affiliateSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (affiliate.AffiliateEnabled !== s.AffiliateEnabled)
    patch.AffiliateEnabled = affiliate.AffiliateEnabled
  if (
    affiliate.AffiliateRegistrationRequired !== s.AffiliateRegistrationRequired
  )
    patch.AffiliateRegistrationRequired =
      affiliate.AffiliateRegistrationRequired
  if (affiliate.AffiliateRebateRateBps !== s.AffiliateRebateRateBps)
    patch.AffiliateRebateRateBps = affiliate.AffiliateRebateRateBps
  if (affiliate.AffiliateFreezeHours !== s.AffiliateFreezeHours)
    patch.AffiliateFreezeHours = affiliate.AffiliateFreezeHours
  if (affiliate.AffiliateDurationDays !== s.AffiliateDurationDays)
    patch.AffiliateDurationDays = affiliate.AffiliateDurationDays
  if (affiliate.AffiliatePerInviteeCap !== s.AffiliatePerInviteeCap)
    patch.AffiliatePerInviteeCap = affiliate.AffiliatePerInviteeCap
  const ok = await saveOptions(patch)
  if (ok) {
    await load(true)
    const next = settings.value
    Object.assign(affiliate, {
      AffiliateEnabled: next.AffiliateEnabled,
      AffiliateRegistrationRequired: next.AffiliateRegistrationRequired,
      AffiliateRebateRateBps: next.AffiliateRebateRateBps,
      AffiliateFreezeHours: next.AffiliateFreezeHours,
      AffiliateDurationDays: next.AffiliateDurationDays,
      AffiliatePerInviteeCap: next.AffiliatePerInviteeCap,
      AffiliateActivatedAt: next.AffiliateActivatedAt,
    })
    toast.success(t('systemSettings.saved'))
  }
  affiliateSaving.value = false
}
const checkinSaving = reactive({ value: false })
const checkinDirty = computed(() => {
  const s = settings.value
  return (
    checkin['checkin_setting.enabled'] !== s['checkin_setting.enabled'] ||
    checkin['checkin_setting.min_quota'] !== s['checkin_setting.min_quota'] ||
    checkin['checkin_setting.max_quota'] !== s['checkin_setting.max_quota']
  )
})
async function saveCheckin() {
  checkinSaving.value = true
  const s = settings.value
  const patch: Record<string, boolean | number> = {}
  if (checkin['checkin_setting.enabled'] !== s['checkin_setting.enabled'])
    patch['checkin_setting.enabled'] = checkin['checkin_setting.enabled']
  if (checkin['checkin_setting.min_quota'] !== s['checkin_setting.min_quota'])
    patch['checkin_setting.min_quota'] = checkin['checkin_setting.min_quota']
  if (checkin['checkin_setting.max_quota'] !== s['checkin_setting.max_quota'])
    patch['checkin_setting.max_quota'] = checkin['checkin_setting.max_quota']
  const ok = await saveOptions(patch)
  checkinSaving.value = false
  if (ok) toast.success(t('systemSettings.saved'))
}

onMounted(async () => {
  await load()
  const s = settings.value
  Object.assign(quota, {
    QuotaForNewUser: s.QuotaForNewUser,
    PreConsumedQuota: s.PreConsumedQuota,
    QuotaForInvitee: s.QuotaForInvitee,
    TopUpLink: s.TopUpLink,
    'general_setting.docs_link': s['general_setting.docs_link'],
    'quota_setting.enable_free_model_pre_consume':
      s['quota_setting.enable_free_model_pre_consume'],
  })
  Object.assign(checkin, {
    'checkin_setting.enabled': s['checkin_setting.enabled'],
    'checkin_setting.min_quota': s['checkin_setting.min_quota'],
    'checkin_setting.max_quota': s['checkin_setting.max_quota'],
  })
  Object.assign(affiliate, {
    AffiliateEnabled: s.AffiliateEnabled,
    AffiliateRegistrationRequired: s.AffiliateRegistrationRequired,
    AffiliateRebateRateBps: s.AffiliateRebateRateBps,
    AffiliateFreezeHours: s.AffiliateFreezeHours,
    AffiliateDurationDays: s.AffiliateDurationDays,
    AffiliatePerInviteeCap: s.AffiliatePerInviteeCap,
    AffiliateActivatedAt: s.AffiliateActivatedAt,
  })
})

// helper: bind number input with two-way numeric model
function asStr(n: number) {
  return String(n)
}
function fromStr(v: string, key: string) {
  const n = Number(v)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(quota as any)[key] = Number.isFinite(n) ? n : 0
}
</script>

<template>
  <div class="space-y-6">
    <!-- Quota Settings -->
    <SysSettingsFormCard
      :title="t('systemSettings.billing.quotaSettings')"
      :saving="quotaSaving.value"
      :dirty="quotaDirty"
      @save="saveQuota"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <SysInputRow
          :label="t('systemSettings.billing.newUserQuota')"
          :description="t('systemSettings.billing.newUserQuotaDesc')"
          :model-value="asStr(quota.QuotaForNewUser)"
          type="number"
          @update:model-value="fromStr($event, 'QuotaForNewUser')"
        />
        <SysInputRow
          :label="t('systemSettings.billing.preConsumedQuota')"
          :description="t('systemSettings.billing.preConsumedQuotaDesc')"
          :model-value="asStr(quota.PreConsumedQuota)"
          type="number"
          @update:model-value="fromStr($event, 'PreConsumedQuota')"
        />
        <SysInputRow
          :label="t('systemSettings.billing.inviteeReward')"
          :description="t('systemSettings.billing.inviteeRewardDesc')"
          :model-value="asStr(quota.QuotaForInvitee)"
          type="number"
          @update:model-value="fromStr($event, 'QuotaForInvitee')"
        />
        <SysInputRow
          v-model="quota.TopUpLink"
          :label="t('systemSettings.billing.topUpLink')"
          :description="t('systemSettings.billing.topUpLinkDesc')"
          :placeholder="t('systemSettings.billing.topUpLinkPlaceholder')"
          type="url"
          class="sm:col-span-2"
        />
        <SysInputRow
          v-model="quota['general_setting.docs_link']"
          :label="t('systemSettings.billing.docsLink')"
          :description="t('systemSettings.billing.docsLinkDesc')"
          placeholder="https://docs.example.com"
          type="url"
          class="sm:col-span-2"
        />
      </div>
      <div class="mt-4 border-t border-[var(--border-subtle)]">
        <SysToggleRow
          v-model="quota['quota_setting.enable_free_model_pre_consume']"
          :label="t('systemSettings.billing.freeModelPreConsume')"
          :description="t('systemSettings.billing.freeModelPreConsumeDesc')"
        />
      </div>
    </SysSettingsFormCard>

    <SysSettingsFormCard
      :title="t('systemSettings.billing.affiliateProgram')"
      :saving="affiliateSaving.value"
      :dirty="affiliateDirty"
      @save="saveAffiliate"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="affiliate.AffiliateEnabled"
          :disabled="affiliate.AffiliateActivatedAt > 0"
          :label="t('systemSettings.billing.affiliateEnabled')"
          :description="t('systemSettings.billing.affiliateEnabledDesc')"
        />
        <SysToggleRow
          v-model="affiliate.AffiliateRegistrationRequired"
          :label="t('systemSettings.billing.affiliateRegistrationRequired')"
          :description="
            t('systemSettings.billing.affiliateRegistrationRequiredDesc')
          "
        />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <SysInputRow
          :label="t('systemSettings.billing.affiliateRate')"
          :description="t('systemSettings.billing.affiliateRateDesc')"
          :model-value="String(affiliate.AffiliateRebateRateBps)"
          type="number"
          @update:model-value="
            affiliate.AffiliateRebateRateBps = Number($event) || 0
          "
        />
        <SysInputRow
          :label="t('systemSettings.billing.affiliateFreeze')"
          :model-value="String(affiliate.AffiliateFreezeHours)"
          type="number"
          @update:model-value="
            affiliate.AffiliateFreezeHours = Number($event) || 0
          "
        />
        <SysInputRow
          :label="t('systemSettings.billing.affiliateDuration')"
          :description="t('systemSettings.billing.affiliateDurationDesc')"
          :model-value="String(affiliate.AffiliateDurationDays)"
          type="number"
          @update:model-value="
            affiliate.AffiliateDurationDays = Number($event) || 0
          "
        />
        <SysInputRow
          :label="t('systemSettings.billing.affiliateCap')"
          :model-value="String(affiliate.AffiliatePerInviteeCap)"
          type="number"
          @update:model-value="
            affiliate.AffiliatePerInviteeCap = Number($event) || 0
          "
        />
        <SysInputRow
          class="sm:col-span-2"
          :label="t('systemSettings.billing.affiliateActivatedAt')"
          :model-value="
            affiliate.AffiliateActivatedAt
              ? new Date(affiliate.AffiliateActivatedAt * 1000).toLocaleString()
              : t('systemSettings.billing.notActivated')
          "
          readonly
        />
      </div>
    </SysSettingsFormCard>

    <!-- Check-in Rewards -->
    <SysSettingsFormCard
      :title="t('systemSettings.billing.checkin')"
      :saving="checkinSaving.value"
      :dirty="checkinDirty"
      @save="saveCheckin"
    >
      <div class="divide-y divide-[var(--border-subtle)]">
        <SysToggleRow
          v-model="checkin['checkin_setting.enabled']"
          :label="t('systemSettings.billing.checkinEnabled')"
          :description="t('systemSettings.billing.checkinEnabledDesc')"
        />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <SysInputRow
          :label="t('systemSettings.billing.checkinMinQuota')"
          :model-value="String(checkin['checkin_setting.min_quota'])"
          type="number"
          @update:model-value="
            checkin['checkin_setting.min_quota'] = Number($event) || 0
          "
        />
        <SysInputRow
          :label="t('systemSettings.billing.checkinMaxQuota')"
          :model-value="String(checkin['checkin_setting.max_quota'])"
          type="number"
          @update:model-value="
            checkin['checkin_setting.max_quota'] = Number($event) || 0
          "
        />
      </div>
    </SysSettingsFormCard>
  </div>
</template>
