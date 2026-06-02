/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { StatusBadgeProps } from '@/components/status-badge'
import type {
  AffiliateProfileFilters,
  AffiliateProfileFormValues,
  AffiliateProfilePayload,
  AffiliateProfilesParams,
  AffiliateRuleSet,
  AffiliateRuleSetDraftFormValues,
  AffiliateRuleSetDraftPayload,
  AffiliateRuleSetFilters,
  AffiliateRuleSetsParams,
} from './types'

type Translate = (key: string) => string

const BPS_BASE = 10000
const LEVEL_ONE_CAP_BPS = 3000

function normalizePositiveInteger(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.trunc(number)
}

function stringifyPretty(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2)
}

function parseJsonArray(
  label: string,
  value: unknown
): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[]
  const text = String(value || '').trim()
  if (!text) return []
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array`)
  }
  return parsed as Record<string, unknown>[]
}

function normalizeSnapshot(
  ruleSet?: AffiliateRuleSet | null
): Record<string, unknown> {
  const snapshot = String(ruleSet?.config_snapshot || '').trim()
  if (!snapshot) return {}
  try {
    const parsed = JSON.parse(snapshot)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function buildAffiliateProfilesParams(
  filters: AffiliateProfileFilters,
  page: number,
  pageSize: number
): AffiliateProfilesParams {
  const userId = normalizePositiveInteger(filters.userId)
  const level = normalizePositiveInteger(filters.level)
  const status = String(filters.status || '').trim()

  return {
    p: page || 1,
    page_size: pageSize || 10,
    user_id: userId || undefined,
    level: level === 1 || level === 2 ? level : undefined,
    status: status || undefined,
  }
}

export function buildAffiliateProfilesQuery({
  page = 1,
  pageSize = 10,
  filters = {},
}: {
  page?: number
  pageSize?: number
  filters?: AffiliateProfileFilters
} = {}): string {
  const params = buildAffiliateProfilesParams(filters, page, pageSize)
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })

  return `/api/affiliate/admin/profiles?${query.toString()}`
}

export function buildAffiliateProfilePayload(
  values: AffiliateProfileFormValues = {}
): AffiliateProfilePayload {
  const level = normalizePositiveInteger(values.level)
  return {
    user_id: normalizePositiveInteger(values.userId),
    level,
    parent_user_id:
      level === 2 ? normalizePositiveInteger(values.parentUserId) : 0,
    invite_code: String(values.inviteCode || '').trim(),
    reason: String(values.reason || '').trim(),
  }
}

export function validateAffiliateProfilePayload(
  payload: AffiliateProfilePayload,
  t: Translate
): string {
  if (!payload.user_id) {
    return t('User ID is required')
  }
  if (payload.level !== 1 && payload.level !== 2) {
    return t('Please select an affiliate level')
  }
  if (payload.level === 2 && !payload.parent_user_id) {
    return t('Second-level affiliate requires a level-one parent user ID')
  }
  if (payload.level === 2 && payload.parent_user_id === payload.user_id) {
    return t('Second-level affiliate parent cannot be itself')
  }
  return ''
}

export function getAffiliateProfileStatusMeta(
  status: string,
  t: Translate
): { label: string; variant: StatusBadgeProps['variant'] } {
  switch (status) {
    case 'active':
      return { label: t('Active'), variant: 'success' }
    case 'disabled':
      return { label: t('Disabled'), variant: 'danger' }
    default:
      return { label: status || t('Unknown'), variant: 'neutral' }
  }
}

export function getAffiliateProfileLevelLabel(
  level: number,
  t: Translate
): string {
  if (Number(level) === 1) return t('Level-one affiliate')
  if (Number(level) === 2) return t('Level-two affiliate')
  return t('Not set')
}

export function buildAffiliateRuleSetsParams(
  filters: AffiliateRuleSetFilters = {},
  page: number,
  pageSize: number
): AffiliateRuleSetsParams {
  const status = String(filters.status || '').trim()
  return {
    p: page || 1,
    page_size: pageSize || 10,
    status: ['draft', 'published', 'archived'].includes(status)
      ? status
      : undefined,
  }
}

export function buildAffiliateRuleSetsQuery({
  page = 1,
  pageSize = 10,
  filters = {},
}: {
  page?: number
  pageSize?: number
  filters?: AffiliateRuleSetFilters
} = {}): string {
  const params = buildAffiliateRuleSetsParams(filters, page, pageSize)
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })

  return `/api/affiliate/admin/rule-sets?${query.toString()}`
}

export function buildAffiliateRuleSetStatusPayload(reason: string): {
  reason: string
} {
  return { reason: String(reason || '').trim() }
}

export function buildAffiliateRuleSetDraftPayload(
  values: AffiliateRuleSetDraftFormValues = {}
): AffiliateRuleSetDraftPayload {
  return {
    id: normalizePositiveInteger(values.id),
    version: String(values.version || '').trim(),
    name: String(values.name || '').trim(),
    effective_start: normalizePositiveInteger(values.effectiveStart),
    effective_end: normalizePositiveInteger(values.effectiveEnd),
    reason: String(values.reason || '').trim(),
    settlement_config: {
      cycle: String(values.settlementCycle || '').trim(),
      freeze_days: normalizePositiveInteger(values.freezeDays),
      min_settlement_amount_cents: normalizePositiveInteger(
        values.minSettlementAmountCents
      ),
      manual_review_enabled: values.manualReviewEnabled === true,
    },
    commission_rules: parseJsonArray(
      'Commission rules',
      values.commissionRulesJson
    ),
    commission_tiers: parseJsonArray(
      'Commission tiers',
      values.commissionTiersJson
    ),
    kpi_tiers: parseJsonArray('KPI tiers', values.kpiTiersJson),
    head_fee_rules: parseJsonArray('Head fee rules', values.headFeeRulesJson),
    risk_rules: parseJsonArray('Risk rules', values.riskRulesJson),
  }
}

export function buildAffiliateRuleSetDraftFormValues(
  ruleSet?: AffiliateRuleSet | null
): AffiliateRuleSetDraftFormValues {
  if (!ruleSet) {
    return buildAffiliateRuleSetDefaultSeedFormValues()
  }
  const snapshot = normalizeSnapshot(ruleSet)
  const settlementConfig =
    snapshot.settlement_config ||
    (snapshot.settlement_cycle ? { cycle: snapshot.settlement_cycle } : {})

  return {
    id: String(normalizePositiveInteger(ruleSet.id)),
    version: String(ruleSet.version || snapshot.version || '').trim(),
    name: String(ruleSet.name || snapshot.name || '').trim(),
    effectiveStart: String(
      normalizePositiveInteger(
        ruleSet.effective_start || snapshot.effective_start
      )
    ),
    effectiveEnd: String(
      normalizePositiveInteger(ruleSet.effective_end || snapshot.effective_end)
    ),
    reason: '',
    settlementCycle: String(settlementConfig.cycle || '').trim(),
    freezeDays: String(normalizePositiveInteger(settlementConfig.freeze_days)),
    minSettlementAmountCents: String(
      normalizePositiveInteger(settlementConfig.min_settlement_amount_cents)
    ),
    manualReviewEnabled: settlementConfig.manual_review_enabled === true,
    commissionRulesJson: stringifyPretty(snapshot.commission_rules),
    commissionTiersJson: stringifyPretty(snapshot.commission_tiers),
    kpiTiersJson: stringifyPretty(snapshot.kpi_tiers),
    headFeeRulesJson: stringifyPretty(snapshot.head_fee_rules),
    riskRulesJson: stringifyPretty(snapshot.risk_rules),
  }
}

function buildAffiliateRuleSetDefaultSeedFormValues(): AffiliateRuleSetDraftFormValues {
  return {
    id: '',
    version: '',
    name: 'Native Affiliate Rules',
    effectiveStart: '0',
    effectiveEnd: '0',
    reason: '',
    settlementCycle: 'monthly',
    freezeDays: '7',
    minSettlementAmountCents: '10000',
    manualReviewEnabled: true,
    commissionRulesJson: stringifyPretty([
      {
        affiliate_level: 1,
        name: 'Level 1',
        default_rate_bps: 2000,
        default_cap_rate_bps: 3000,
        min_settlement_amount_cents: 10000,
        allow_manual_approval_rate: true,
      },
      {
        affiliate_level: 2,
        name: 'Level 2',
        default_rate_bps: 1000,
        default_cap_rate_bps: 2000,
        min_settlement_amount_cents: 10000,
        allow_manual_approval_rate: true,
      },
    ]),
    commissionTiersJson: stringifyPretty([
      {
        affiliate_level: 1,
        min_net_paid_amount_cents: 0,
        max_net_paid_amount_cents: 20000,
        base_rate_bps: 2000,
        cap_rate_bps: 3000,
        sort_order: 1,
      },
      {
        affiliate_level: 1,
        min_net_paid_amount_cents: 20000,
        max_net_paid_amount_cents: 80000,
        base_rate_bps: 1333,
        cap_rate_bps: 2000,
        sort_order: 2,
      },
      {
        affiliate_level: 1,
        min_net_paid_amount_cents: 80000,
        max_net_paid_amount_cents: 150000,
        base_rate_bps: 1000,
        cap_rate_bps: 1500,
        sort_order: 3,
      },
      {
        affiliate_level: 1,
        min_net_paid_amount_cents: 150000,
        max_net_paid_amount_cents: 500000,
        base_rate_bps: 533,
        cap_rate_bps: 800,
        sort_order: 4,
      },
      {
        affiliate_level: 1,
        min_net_paid_amount_cents: 500000,
        max_net_paid_amount_cents: 0,
        base_rate_bps: 200,
        cap_rate_bps: 500,
        requires_manual_approval: true,
        sort_order: 5,
      },
      {
        affiliate_level: 2,
        min_net_paid_amount_cents: 0,
        max_net_paid_amount_cents: 20000,
        base_rate_bps: 1000,
        cap_rate_bps: 2000,
        sort_order: 1,
      },
      {
        affiliate_level: 2,
        min_net_paid_amount_cents: 20000,
        max_net_paid_amount_cents: 80000,
        base_rate_bps: 600,
        cap_rate_bps: 1200,
        sort_order: 2,
      },
      {
        affiliate_level: 2,
        min_net_paid_amount_cents: 80000,
        max_net_paid_amount_cents: 150000,
        base_rate_bps: 450,
        cap_rate_bps: 900,
        sort_order: 3,
      },
      {
        affiliate_level: 2,
        min_net_paid_amount_cents: 150000,
        max_net_paid_amount_cents: 500000,
        base_rate_bps: 250,
        cap_rate_bps: 500,
        sort_order: 4,
      },
      {
        affiliate_level: 2,
        min_net_paid_amount_cents: 500000,
        max_net_paid_amount_cents: 0,
        base_rate_bps: 100,
        cap_rate_bps: 200,
        requires_manual_approval: true,
        sort_order: 5,
      },
    ]),
    kpiTiersJson: stringifyPretty([
      {
        affiliate_level: 1,
        code: 'observe',
        name: 'Observe',
        min_effective_new_users: 0,
        min_net_paid_amount_cents: 0,
        coefficient_bps: 10000,
        max_gift_only_ratio_bps: 2000,
        max_abnormal_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        sort_order: 1,
      },
      {
        affiliate_level: 1,
        code: 'qualified',
        name: 'Qualified',
        min_effective_new_users: 30,
        min_net_paid_amount_cents: 150000,
        coefficient_bps: 12000,
        max_gift_only_ratio_bps: 2000,
        max_abnormal_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        sort_order: 2,
      },
      {
        affiliate_level: 1,
        code: 'growth',
        name: 'Growth',
        min_effective_new_users: 45,
        min_net_paid_amount_cents: 225000,
        coefficient_bps: 13500,
        max_gift_only_ratio_bps: 2000,
        max_abnormal_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        sort_order: 3,
      },
      {
        affiliate_level: 1,
        code: 'excellent',
        name: 'Excellent',
        min_effective_new_users: 60,
        min_net_paid_amount_cents: 300000,
        coefficient_bps: 15000,
        max_gift_only_ratio_bps: 2000,
        max_abnormal_ratio_bps: 1000,
        min_second_payment_ratio_bps: 2000,
        sort_order: 4,
      },
      {
        affiliate_level: 2,
        code: 'observe',
        name: 'Observe',
        min_effective_new_users: 0,
        min_net_paid_amount_cents: 0,
        coefficient_bps: 10000,
        max_gift_only_ratio_bps: 3000,
        max_abnormal_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        sort_order: 1,
      },
      {
        affiliate_level: 2,
        code: 'base',
        name: 'Base',
        min_effective_new_users: 10,
        min_net_paid_amount_cents: 20000,
        coefficient_bps: 14000,
        max_gift_only_ratio_bps: 3000,
        max_abnormal_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        sort_order: 2,
      },
      {
        affiliate_level: 2,
        code: 'growth',
        name: 'Growth',
        min_effective_new_users: 20,
        min_net_paid_amount_cents: 50000,
        coefficient_bps: 17000,
        max_gift_only_ratio_bps: 3000,
        max_abnormal_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        sort_order: 3,
      },
      {
        affiliate_level: 2,
        code: 'excellent',
        name: 'Excellent',
        min_effective_new_users: 50,
        min_net_paid_amount_cents: 150000,
        coefficient_bps: 20000,
        max_gift_only_ratio_bps: 3000,
        max_abnormal_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        sort_order: 4,
      },
    ]),
    headFeeRulesJson: stringifyPretty([
      {
        affiliate_level: 1,
        kpi_tier_code: 'observe',
        amount_cents: 0,
        first_recharge_min_cents: 1000,
        period_net_paid_min_cents: 1000,
        qualification_days: 14,
        unlock_delay_days: 7,
      },
      {
        affiliate_level: 1,
        kpi_tier_code: 'qualified',
        amount_cents: 160,
        first_recharge_min_cents: 1000,
        period_net_paid_min_cents: 1000,
        qualification_days: 14,
        unlock_delay_days: 7,
      },
      {
        affiliate_level: 1,
        kpi_tier_code: 'growth',
        amount_cents: 180,
        first_recharge_min_cents: 1000,
        period_net_paid_min_cents: 1000,
        qualification_days: 14,
        unlock_delay_days: 7,
      },
      {
        affiliate_level: 1,
        kpi_tier_code: 'excellent',
        amount_cents: 200,
        first_recharge_min_cents: 1000,
        period_net_paid_min_cents: 1000,
        qualification_days: 14,
        unlock_delay_days: 7,
      },
      {
        affiliate_level: 2,
        kpi_tier_code: 'observe',
        amount_cents: 0,
        first_recharge_min_cents: 1000,
        period_net_paid_min_cents: 1000,
        qualification_days: 14,
        unlock_delay_days: 7,
      },
      {
        affiliate_level: 2,
        kpi_tier_code: 'base',
        amount_cents: 70,
        first_recharge_min_cents: 1000,
        period_net_paid_min_cents: 1000,
        qualification_days: 14,
        unlock_delay_days: 7,
      },
      {
        affiliate_level: 2,
        kpi_tier_code: 'growth',
        amount_cents: 85,
        first_recharge_min_cents: 1000,
        period_net_paid_min_cents: 1000,
        qualification_days: 14,
        unlock_delay_days: 7,
      },
      {
        affiliate_level: 2,
        kpi_tier_code: 'excellent',
        amount_cents: 100,
        first_recharge_min_cents: 1000,
        period_net_paid_min_cents: 1000,
        qualification_days: 14,
        unlock_delay_days: 7,
      },
    ]),
    riskRulesJson: stringifyPretty([
      {
        affiliate_level: 1,
        code: 'default',
        max_gift_only_ratio_bps: 2000,
        max_abnormal_ratio_bps: 1000,
        max_refund_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
      },
      {
        affiliate_level: 2,
        code: 'default',
        max_gift_only_ratio_bps: 3000,
        max_abnormal_ratio_bps: 1000,
        max_refund_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
      },
    ]),
  }
}

export function validateAffiliateRuleSetDraftPayload(
  payload: AffiliateRuleSetDraftPayload,
  t: Translate
): string {
  if (!String(payload.version || '').trim()) {
    return t('Rule set version is required')
  }
  if (!String(payload.name || '').trim()) {
    return t('Rule set name is required')
  }
  if (
    Number(payload.effective_start || 0) > 0 &&
    Number(payload.effective_end || 0) > 0 &&
    Number(payload.effective_end) < Number(payload.effective_start)
  ) {
    return t('Effective end cannot be earlier than effective start')
  }
  if (!String(payload.settlement_config?.cycle || '').trim()) {
    return t('Settlement cycle is required')
  }

  const commissionRules = Array.isArray(payload.commission_rules)
    ? payload.commission_rules
    : []
  const commissionTiers = Array.isArray(payload.commission_tiers)
    ? payload.commission_tiers
    : []
  const caps = [...commissionRules, ...commissionTiers]
  const levelOneMaxCap = Math.max(
    0,
    ...caps
      .filter((rule) => Number(rule.affiliate_level) === 1)
      .map((rule) =>
        Number(rule.default_cap_rate_bps ?? rule.cap_rate_bps ?? 0)
      )
  )

  if (levelOneMaxCap > LEVEL_ONE_CAP_BPS) {
    return t('Level-one affiliate cap cannot exceed 30%')
  }
  if (
    levelOneMaxCap > 0 &&
    caps.some(
      (rule) =>
        Number(rule.affiliate_level) === 2 &&
        Number(rule.default_cap_rate_bps ?? rule.cap_rate_bps ?? 0) >
          levelOneMaxCap
    )
  ) {
    return t('Level-two affiliate cap cannot exceed level one')
  }

  const kpiTiers = Array.isArray(payload.kpi_tiers) ? payload.kpi_tiers : []
  if (kpiTiers.some((tier) => Number(tier.coefficient_bps || 0) < BPS_BASE)) {
    return t('KPI coefficient cannot be below 1.00')
  }
  return ''
}

export function getAffiliateRuleSetStatusMeta(
  status: string,
  t: Translate
): { label: string; variant: StatusBadgeProps['variant'] } {
  switch (status) {
    case 'draft':
      return { label: t('Draft'), variant: 'warning' }
    case 'published':
      return { label: t('Published'), variant: 'success' }
    case 'archived':
      return { label: t('Archived'), variant: 'neutral' }
    default:
      return { label: status || t('Unknown'), variant: 'neutral' }
  }
}
