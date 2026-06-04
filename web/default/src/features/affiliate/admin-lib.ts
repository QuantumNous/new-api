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
  AffiliateCommissionAdjustmentFormValues,
  AffiliateCommissionAdjustmentPayload,
  AffiliateCommissionFilters,
  AffiliateCommissionRecomputeFormValues,
  AffiliateCommissionRecomputePayload,
  AffiliateProfileFilters,
  AffiliateProfileFormValues,
  AffiliateProfilePayload,
  AffiliateProfilesParams,
  AffiliateRuleSet,
  AffiliateRuleSetDraftFormValues,
  AffiliateRuleSetDraftPayload,
  AffiliateRuleSetFilters,
  AffiliateRuleSetRollbackPayload,
  AffiliateRuleSetsParams,
  AffiliateSettlementFilters,
  AffiliateSettlementRunFormValues,
  AffiliateSettlementRunPayload,
} from './types'

type Translate = (key: string) => string

const BPS_BASE = 10000
const LEVEL_ONE_CAP_BPS = 3000

function normalizePositiveInteger(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.trunc(number)
}

function normalizeSignedInteger(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.trunc(number)
}

function normalizeSignedYuanToCents(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100)
}

function normalizeYuanToCents(value: unknown): number {
  const cents = normalizeSignedYuanToCents(value)
  return cents > 0 ? cents : 0
}

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === 'true'
}

function normalizeDefaultTrueBoolean(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  return normalizeBoolean(value)
}

function formatCentsAsYuan(value: unknown): string {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return '0.00'
  return (number / 100).toFixed(2)
}

function normalizePositiveNumber(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return number
}

function normalizeTimestamp(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0
  if (value instanceof Date) {
    const timestamp = Math.floor(value.getTime() / 1000)
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
  }
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.trunc(numeric > 100000000000 ? numeric / 1000 : numeric)
  }
  const parsed = Date.parse(String(value))
  if (!Number.isFinite(parsed)) return 0
  return Math.floor(parsed / 1000)
}

function stringifyPretty(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2)
}

function normalizeCommissionRulesForForm(
  value: unknown
): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      return { status: 'active', value: rule }
    }
    const record = rule as Record<string, unknown>
    return {
      ...record,
      status: String(record.status || '').trim() || 'active',
    }
  })
}

function normalizeCommissionTiersForForm(
  value: unknown
): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      return { requires_manual_approval: false, value: rule }
    }
    const record = rule as Record<string, unknown>
    return {
      ...record,
      requires_manual_approval: record.requires_manual_approval === true,
    }
  })
}

function normalizeHeadFeeRulesForForm(
  value: unknown
): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      return { status: 'active', value: rule }
    }
    const record = rule as Record<string, unknown>
    return {
      ...record,
      status: String(record.status || '').trim() || 'active',
    }
  })
}

function normalizeRiskRulesForForm(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      return {
        self_brush_strategy: 'exclude',
        bulk_abuse_strategy: 'manual_review',
        action: 'manual_review',
        value: rule,
      }
    }
    const record = rule as Record<string, unknown>
    return {
      ...record,
      self_brush_strategy:
        String(record.self_brush_strategy || '').trim() || 'exclude',
      bulk_abuse_strategy:
        String(record.bulk_abuse_strategy || '').trim() || 'manual_review',
      action: String(record.action || '').trim() || 'manual_review',
    }
  })
}

function stringifyStable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyStable(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stringifyStable(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
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

function appendPositiveInteger(
  query: URLSearchParams,
  key: string,
  value: unknown
) {
  const normalized = normalizePositiveInteger(value)
  if (normalized > 0) query.set(key, String(normalized))
}

function appendText(query: URLSearchParams, key: string, value: unknown) {
  const normalized = String(value || '').trim()
  if (normalized) query.set(key, normalized)
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
    return t('Second-level affiliate requires a parent user ID')
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

export function isAffiliateRuleSetReadOnly(
  ruleSet?: { status?: string } | null
): boolean {
  const status = String(ruleSet?.status || '').trim()
  return status === 'published' || status === 'archived'
}

export function buildAffiliateRuleSetStatusConfirmation(
  action: 'publish' | 'archive',
  ruleSet: { id?: number; version?: string; name?: string },
  t: Translate
): string {
  const identity = ruleSet.version
    ? String(ruleSet.version)
    : `#${normalizePositiveInteger(ruleSet.id)}`
  if (action === 'publish') {
    return t(
      'Publish rule set {{version}}? This will activate it and archive the current published rule set.'
    ).replace('{{version}}', identity)
  }
  return t(
    'Archive rule set {{version}}? This will stop this version from being selected automatically.'
  ).replace('{{version}}', identity)
}

export function buildAffiliateRuleSetSaveConfirmation(
  ruleSet: { id?: number; version?: string; name?: string },
  t: Translate
): string {
  const identity = ruleSet.version
    ? String(ruleSet.version)
    : `#${normalizePositiveInteger(ruleSet.id)}`
  return t(
    'Overwrite draft rule set {{version}}? This will replace the existing draft configuration.'
  ).replace('{{version}}', identity)
}

function getAffiliateRuleSetVersionIdentity(ruleSet: {
  id?: number
  version?: string
}): string {
  const version = String(ruleSet.version || '').trim()
  if (version) return version
  const id = normalizePositiveInteger(ruleSet.id)
  return id > 0 ? `rule-set-${id}` : 'rule-set'
}

function getAffiliateRuleSetDisplayIdentity(ruleSet: {
  id?: number
  version?: string
}): string {
  const version = String(ruleSet.version || '').trim()
  if (version) return version
  const id = normalizePositiveInteger(ruleSet.id)
  return id > 0 ? `#${id}` : 'rule set'
}

export function buildAffiliateRuleSetRollbackPayload(
  ruleSet: { id?: number; version?: string; name?: string },
  t: Translate
): AffiliateRuleSetRollbackPayload {
  const version = getAffiliateRuleSetVersionIdentity(ruleSet)
  const name = String(ruleSet.name || '').trim() || version
  return {
    version: `${version}-rollback`,
    name: `${name} ${t('Rollback')}`,
    reason: t(
      'Admin created affiliate rule set rollback draft from {{version}}'
    ).replace('{{version}}', getAffiliateRuleSetDisplayIdentity(ruleSet)),
  }
}

export function buildAffiliateRuleSetRollbackConfirmation(
  ruleSet: { id?: number; version?: string; name?: string },
  t: Translate
): string {
  return t(
    'Create rollback draft from rule set {{version}}? This will copy the historical configuration into a new editable draft.'
  ).replace('{{version}}', getAffiliateRuleSetDisplayIdentity(ruleSet))
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
      min_settlement_amount_cents:
        values.minSettlementAmountYuan !== undefined
          ? normalizeYuanToCents(values.minSettlementAmountYuan)
          : normalizePositiveInteger(values.minSettlementAmountCents),
      manual_review_enabled: values.manualReviewEnabled === true,
      auto_settlement_enabled: values.autoSettlementEnabled !== false,
      review_note: String(values.reviewNote || '').trim(),
    },
    commission_rules: parseJsonArray(
      'Commission rules',
      values.commissionRulesJson
    ),
    commission_tiers: parseJsonArray(
      'Commission tiers',
      values.commissionTiersJson
    ).map((rule) => ({
      ...rule,
      requires_manual_approval: rule.requires_manual_approval === true,
    })),
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
  const settlementConfig: Record<string, unknown> =
    snapshot.settlement_config && typeof snapshot.settlement_config === 'object'
      ? (snapshot.settlement_config as Record<string, unknown>)
      : snapshot.settlement_cycle
        ? { cycle: snapshot.settlement_cycle }
        : {}

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
    minSettlementAmountYuan: formatCentsAsYuan(
      settlementConfig.min_settlement_amount_cents
    ),
    manualReviewEnabled: settlementConfig.manual_review_enabled === true,
    autoSettlementEnabled: normalizeDefaultTrueBoolean(
      settlementConfig.auto_settlement_enabled
    ),
    reviewNote: String(settlementConfig.review_note || '').trim(),
    commissionRulesJson: stringifyPretty(
      normalizeCommissionRulesForForm(snapshot.commission_rules)
    ),
    commissionTiersJson: stringifyPretty(
      normalizeCommissionTiersForForm(snapshot.commission_tiers)
    ),
    kpiTiersJson: stringifyPretty(snapshot.kpi_tiers),
    headFeeRulesJson: stringifyPretty(
      normalizeHeadFeeRulesForForm(snapshot.head_fee_rules)
    ),
    riskRulesJson: stringifyPretty(
      normalizeRiskRulesForForm(snapshot.risk_rules)
    ),
  }
}

export function buildAffiliateRuleSetCopyDraftFormValues(
  ruleSet?: AffiliateRuleSet | null
): AffiliateRuleSetDraftFormValues {
  const values = buildAffiliateRuleSetDraftFormValues(ruleSet)
  return {
    ...values,
    id: '',
    version: values.version ? `${values.version}-copy` : '',
    reason: '',
  }
}

export function buildAffiliateRuleSetExportJson(
  values: AffiliateRuleSetDraftFormValues = {}
): string {
  const payload = buildAffiliateRuleSetDraftPayload(values)
  const { id: _id, reason: _reason, ...exportable } = payload
  return JSON.stringify(exportable, null, 2)
}

export function parseAffiliateRuleSetImportJson(
  value: string
): AffiliateRuleSetDraftFormValues {
  const parsed = JSON.parse(String(value || '').trim())
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Rule set import JSON must be an object')
  }
  const imported = parsed as Record<string, unknown>
  const settlementConfig =
    imported.settlement_config && typeof imported.settlement_config === 'object'
      ? (imported.settlement_config as Record<string, unknown>)
      : {}

  return {
    id: '',
    version: String(imported.version || '').trim(),
    name: String(imported.name || '').trim(),
    effectiveStart: String(normalizePositiveInteger(imported.effective_start)),
    effectiveEnd: String(normalizePositiveInteger(imported.effective_end)),
    reason: '',
    settlementCycle: String(settlementConfig.cycle || '').trim(),
    freezeDays: String(normalizePositiveInteger(settlementConfig.freeze_days)),
    minSettlementAmountCents: String(
      normalizePositiveInteger(settlementConfig.min_settlement_amount_cents)
    ),
    minSettlementAmountYuan: formatCentsAsYuan(
      settlementConfig.min_settlement_amount_cents
    ),
    manualReviewEnabled: settlementConfig.manual_review_enabled === true,
    autoSettlementEnabled: normalizeDefaultTrueBoolean(
      settlementConfig.auto_settlement_enabled
    ),
    reviewNote: String(settlementConfig.review_note || '').trim(),
    commissionRulesJson: stringifyPretty(
      normalizeCommissionRulesForForm(imported.commission_rules)
    ),
    commissionTiersJson: stringifyPretty(
      normalizeCommissionTiersForForm(imported.commission_tiers)
    ),
    kpiTiersJson: stringifyPretty(imported.kpi_tiers),
    headFeeRulesJson: stringifyPretty(
      normalizeHeadFeeRulesForForm(imported.head_fee_rules)
    ),
    riskRulesJson: stringifyPretty(
      normalizeRiskRulesForForm(imported.risk_rules)
    ),
  }
}

export function buildAffiliateRuleSetDiffPreview(
  beforeValues: AffiliateRuleSetDraftFormValues = {},
  afterValues: AffiliateRuleSetDraftFormValues = {}
): Array<{ section: string; before: string; after: string }> {
  const before = buildAffiliateRuleSetDraftPayload(beforeValues)
  const after = buildAffiliateRuleSetDraftPayload(afterValues)
  const items: Array<{ section: string; before: string; after: string }> = []

  const appendScalar = (
    section: string,
    beforeValue: unknown,
    afterValue: unknown
  ) => {
    const beforeText = String(beforeValue ?? '')
    const afterText = String(afterValue ?? '')
    if (beforeText === afterText) return
    items.push({ section, before: beforeText, after: afterText })
  }
  const appendJson = (
    section: string,
    beforeValue: unknown,
    afterValue: unknown
  ) => {
    if (stringifyStable(beforeValue) === stringifyStable(afterValue)) return
    items.push({ section, before: 'changed', after: 'changed' })
  }

  appendScalar('Version', before.version, after.version)
  appendScalar('Name', before.name, after.name)
  appendScalar(
    'Effective Start Timestamp',
    before.effective_start,
    after.effective_start
  )
  appendScalar(
    'Effective End Timestamp',
    before.effective_end,
    after.effective_end
  )
  appendScalar(
    'Settlement Cycle',
    before.settlement_config?.cycle,
    after.settlement_config?.cycle
  )
  appendScalar(
    'Freeze Days',
    before.settlement_config?.freeze_days,
    after.settlement_config?.freeze_days
  )
  appendScalar(
    'Minimum Settlement Amount (cents)',
    before.settlement_config?.min_settlement_amount_cents,
    after.settlement_config?.min_settlement_amount_cents
  )
  appendScalar(
    'Manual Review',
    before.settlement_config?.manual_review_enabled,
    after.settlement_config?.manual_review_enabled
  )
  appendScalar(
    'Automatic Settlement',
    before.settlement_config?.auto_settlement_enabled,
    after.settlement_config?.auto_settlement_enabled
  )
  appendScalar(
    'Review Note',
    before.settlement_config?.review_note,
    after.settlement_config?.review_note
  )
  appendJson(
    'Commission Base Rules',
    before.commission_rules,
    after.commission_rules
  )
  appendJson(
    'Commission Tiers',
    before.commission_tiers,
    after.commission_tiers
  )
  appendJson('KPI Tiers', before.kpi_tiers, after.kpi_tiers)
  appendJson('Head Fee Rules', before.head_fee_rules, after.head_fee_rules)
  appendJson('Quality Thresholds', before.risk_rules, after.risk_rules)

  return items
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
    minSettlementAmountYuan: '100.00',
    manualReviewEnabled: true,
    autoSettlementEnabled: true,
    reviewNote: '',
    commissionRulesJson: stringifyPretty([
      {
        affiliate_level: 1,
        name: 'Level 1',
        status: 'active',
        default_rate_bps: 2000,
        default_cap_rate_bps: 3000,
        min_settlement_amount_cents: 10000,
        allow_manual_approval_rate: true,
      },
      {
        affiliate_level: 2,
        name: 'Level 2',
        status: 'active',
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
        requires_manual_approval: false,
        sort_order: 1,
      },
      {
        affiliate_level: 1,
        min_net_paid_amount_cents: 20000,
        max_net_paid_amount_cents: 80000,
        base_rate_bps: 1333,
        cap_rate_bps: 2000,
        requires_manual_approval: false,
        sort_order: 2,
      },
      {
        affiliate_level: 1,
        min_net_paid_amount_cents: 80000,
        max_net_paid_amount_cents: 150000,
        base_rate_bps: 1000,
        cap_rate_bps: 1500,
        requires_manual_approval: false,
        sort_order: 3,
      },
      {
        affiliate_level: 1,
        min_net_paid_amount_cents: 150000,
        max_net_paid_amount_cents: 500000,
        base_rate_bps: 533,
        cap_rate_bps: 800,
        requires_manual_approval: false,
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
        requires_manual_approval: false,
        sort_order: 1,
      },
      {
        affiliate_level: 2,
        min_net_paid_amount_cents: 20000,
        max_net_paid_amount_cents: 80000,
        base_rate_bps: 600,
        cap_rate_bps: 1200,
        requires_manual_approval: false,
        sort_order: 2,
      },
      {
        affiliate_level: 2,
        min_net_paid_amount_cents: 80000,
        max_net_paid_amount_cents: 150000,
        base_rate_bps: 450,
        cap_rate_bps: 900,
        requires_manual_approval: false,
        sort_order: 3,
      },
      {
        affiliate_level: 2,
        min_net_paid_amount_cents: 150000,
        max_net_paid_amount_cents: 500000,
        base_rate_bps: 250,
        cap_rate_bps: 500,
        requires_manual_approval: false,
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
    headFeeRulesJson: stringifyPretty(
      normalizeHeadFeeRulesForForm([
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
      ])
    ),
    riskRulesJson: stringifyPretty([
      {
        affiliate_level: 1,
        code: 'default',
        max_gift_only_ratio_bps: 2000,
        max_abnormal_ratio_bps: 1000,
        max_refund_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        self_brush_strategy: 'exclude',
        bulk_abuse_strategy: 'manual_review',
        action: 'manual_review',
      },
      {
        affiliate_level: 2,
        code: 'default',
        max_gift_only_ratio_bps: 3000,
        max_abnormal_ratio_bps: 1000,
        max_refund_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        self_brush_strategy: 'exclude',
        bulk_abuse_strategy: 'manual_review',
        action: 'manual_review',
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

export function buildAffiliateCommissionsQuery({
  page = 1,
  pageSize = 10,
  filters = {},
}: {
  page?: number
  pageSize?: number
  filters?: AffiliateCommissionFilters
} = {}): string {
  const query = new URLSearchParams()
  query.set('p', String(normalizePositiveInteger(page) || 1))
  query.set('page_size', String(normalizePositiveInteger(pageSize) || 10))
  appendPositiveInteger(query, 'affiliate_user_id', filters.affiliateUserId)
  appendPositiveInteger(query, 'rule_set_id', filters.ruleSetId)
  appendPositiveInteger(query, 'downstream_user_id', filters.downstreamUserId)
  appendPositiveInteger(query, 'settlement_id', filters.settlementId)
  appendText(query, 'status', filters.status)
  appendText(query, 'kind', filters.kind)
  appendPositiveInteger(query, 'period_start', filters.periodStart)
  appendPositiveInteger(query, 'period_end', filters.periodEnd)

  return `/api/affiliate/admin/commissions?${query.toString()}`
}

export function buildAffiliateSettlementsQuery({
  page = 1,
  pageSize = 10,
  filters = {},
}: {
  page?: number
  pageSize?: number
  filters?: AffiliateSettlementFilters
} = {}): string {
  const query = new URLSearchParams()
  query.set('p', String(normalizePositiveInteger(page) || 1))
  query.set('page_size', String(normalizePositiveInteger(pageSize) || 10))
  appendPositiveInteger(query, 'affiliate_user_id', filters.affiliateUserId)
  appendPositiveInteger(query, 'rule_set_id', filters.ruleSetId)
  appendText(query, 'status', filters.status)
  appendPositiveInteger(query, 'period_start', filters.periodStart)
  appendPositiveInteger(query, 'period_end', filters.periodEnd)

  return `/api/affiliate/admin/settlements?${query.toString()}`
}

export function buildAffiliateSettlementRunPayload(
  values: AffiliateSettlementRunFormValues = {}
): AffiliateSettlementRunPayload {
  return {
    rule_set_id: normalizePositiveInteger(values.ruleSetId),
    period_start: normalizeTimestamp(values.periodStart),
    period_end: normalizeTimestamp(values.periodEnd),
    freeze_days: normalizePositiveInteger(values.freezeDays),
    now: normalizeTimestamp(values.now),
    quota_per_unit: normalizePositiveNumber(values.quotaPerUnit),
    usd_exchange_rate: normalizePositiveNumber(values.usdExchangeRate),
    reason: String(values.reason || '').trim(),
  }
}

export function buildAffiliateCommissionRecomputePayload(
  values: AffiliateCommissionRecomputeFormValues = {}
): AffiliateCommissionRecomputePayload {
  return {
    rule_set_id: normalizePositiveInteger(values.ruleSetId),
    period_start: normalizeTimestamp(values.periodStart),
    period_end: normalizeTimestamp(values.periodEnd),
    quota_per_unit: normalizePositiveNumber(values.quotaPerUnit),
    usd_exchange_rate: normalizePositiveNumber(values.usdExchangeRate),
    reason: String(values.reason || '').trim(),
  }
}

export function buildAffiliateCommissionAdjustmentPayload(
  values: AffiliateCommissionAdjustmentFormValues = {}
): AffiliateCommissionAdjustmentPayload {
  return {
    affiliate_user_id: normalizePositiveInteger(values.affiliateUserId),
    downstream_user_id: normalizePositiveInteger(values.downstreamUserId),
    rule_set_id: normalizePositiveInteger(values.ruleSetId),
    period_start: normalizeTimestamp(values.periodStart),
    period_end: normalizeTimestamp(values.periodEnd),
    commission_cents:
      values.commissionYuan !== undefined
        ? normalizeSignedYuanToCents(values.commissionYuan)
        : normalizeSignedInteger(values.commissionCents),
    reason: String(values.reason || '').trim(),
  }
}

function validateFinancePeriod(
  payload: { period_start?: number; period_end?: number },
  t: Translate
): string {
  if (
    Number(payload.period_start || 0) > 0 &&
    Number(payload.period_end || 0) > 0 &&
    Number(payload.period_end) < Number(payload.period_start)
  ) {
    return t('Settlement period end cannot be earlier than start')
  }
  return ''
}

function validateFinanceReason(
  payload: { reason?: string },
  t: Translate
): string {
  if (!String(payload.reason || '').trim()) {
    return t('Operation reason is required')
  }
  return ''
}

export function validateAffiliateSettlementRunPayload(
  payload: Partial<AffiliateSettlementRunPayload>,
  t: Translate
): string {
  return validateFinancePeriod(payload, t) || validateFinanceReason(payload, t)
}

export function validateAffiliateCommissionRecomputePayload(
  payload: Partial<AffiliateCommissionRecomputePayload>,
  t: Translate
): string {
  return validateFinancePeriod(payload, t) || validateFinanceReason(payload, t)
}

export function validateAffiliateCommissionAdjustmentPayload(
  payload: Partial<AffiliateCommissionAdjustmentPayload>,
  t: Translate
): string {
  if (!payload.affiliate_user_id) {
    return t('Affiliate user ID is required')
  }
  if (!payload.commission_cents) {
    return t('Commission adjustment amount cannot be zero')
  }
  return validateFinancePeriod(payload, t) || validateFinanceReason(payload, t)
}

export function getAffiliateCommissionStatusMeta(
  status: string,
  t: Translate
): { label: string; variant: StatusBadgeProps['variant'] } {
  switch (status) {
    case 'pending':
      return { label: t('Pending'), variant: 'warning' }
    case 'ready':
      return { label: t('Ready'), variant: 'info' }
    case 'settled':
      return { label: t('Settled'), variant: 'success' }
    case 'void':
      return { label: t('Voided'), variant: 'danger' }
    default:
      return { label: status || t('Unknown'), variant: 'neutral' }
  }
}

export function getAffiliateSettlementStatusMeta(
  status: string,
  t: Translate
): { label: string; variant: StatusBadgeProps['variant'] } {
  switch (status) {
    case 'draft':
      return { label: t('Draft'), variant: 'warning' }
    case 'frozen':
      return { label: t('Frozen'), variant: 'info' }
    case 'paid':
      return { label: t('Paid'), variant: 'success' }
    case 'void':
      return { label: t('Voided'), variant: 'danger' }
    default:
      return { label: status || t('Unknown'), variant: 'neutral' }
  }
}

export function getAffiliateCommissionKindText(
  kind: string,
  t: Translate
): string {
  switch (kind) {
    case 'accrual':
      return t('Accrual')
    case 'clawback':
      return t('Clawback')
    case 'manual_adjustment':
      return t('Manual adjustment')
    default:
      return kind || t('Unknown')
  }
}

export function formatAffiliateCentsRMB(cents: unknown): string {
  const value = Number(cents || 0)
  const sign = value < 0 ? '-' : ''
  return `${sign}¥${(Math.abs(value) / 100).toFixed(2)}`
}
