const BPS_BASE = 10000;
const LEVEL_ONE_CAP_BPS = 3000;

const normalizeInteger = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  const integer = Math.trunc(number);
  return integer > 0 ? integer : 0;
};

const normalizeBoolean = (value) => value === true || value === 'true';

const normalizeDefaultTrueBoolean = (value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  return normalizeBoolean(value);
};

const translate = (t, value) => (typeof t === 'function' ? t(value) : value);

const centsToYuan = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Number((number / 100).toFixed(2));
};

const yuanToCents = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.round(number * 100));
};

const stringifyPretty = (value) => JSON.stringify(value || [], null, 2);

const normalizeCommissionRulesForForm = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      return { status: 'active', value: rule };
    }
    return {
      ...rule,
      status: String(rule.status || '').trim() || 'active',
    };
  });
};

const normalizeCommissionTiersForForm = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      return { requires_manual_approval: false, value: rule };
    }
    return {
      ...rule,
      requires_manual_approval: rule.requires_manual_approval === true,
    };
  });
};

const normalizeHeadFeeRulesForForm = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      return { status: 'active', value: rule };
    }
    return {
      ...rule,
      status: String(rule.status || '').trim() || 'active',
    };
  });
};

const normalizeRiskRulesForForm = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      return {
        self_brush_strategy: 'exclude',
        bulk_abuse_strategy: 'manual_review',
        action: 'manual_review',
        value: rule,
      };
    }
    return {
      ...rule,
      self_brush_strategy:
        String(rule.self_brush_strategy || '').trim() || 'exclude',
      bulk_abuse_strategy:
        String(rule.bulk_abuse_strategy || '').trim() || 'manual_review',
      action: String(rule.action || '').trim() || 'manual_review',
    };
  });
};

const stringifyStable = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyStable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stringifyStable(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

function parseJsonArray(label, value) {
  if (Array.isArray(value)) {
    return value;
  }
  const text = String(value || '').trim();
  if (!text) {
    return [];
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 数组`);
  }
  return parsed;
}

function normalizeSnapshot(ruleSet = {}) {
  const snapshot = String(ruleSet.config_snapshot || '').trim();
  if (!snapshot) {
    return {};
  }
  try {
    const parsed = JSON.parse(snapshot);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function appendStatus(params, status) {
  const normalized = String(status || '').trim();
  if (['draft', 'published', 'archived'].includes(normalized)) {
    params.set('status', normalized);
  }
}

export function buildAffiliateRuleSetsQuery({
  page = 1,
  pageSize = 10,
  filters = {},
} = {}) {
  const params = new URLSearchParams();
  params.set('p', String(normalizeInteger(page) || 1));
  params.set('page_size', String(normalizeInteger(pageSize) || 10));
  appendStatus(params, filters.status);
  return `/api/affiliate/admin/rule-sets?${params.toString()}`;
}

export function buildAffiliateRuleSetStatusPayload(values = {}) {
  return { reason: String(values.reason || '').trim() };
}

export function isAffiliateRuleSetReadOnly(ruleSet = null) {
  const status = String(ruleSet?.status || '').trim();
  return status === 'published' || status === 'archived';
}

export function buildAffiliateRuleSetStatusConfirmation(
  t,
  action,
  ruleSet = {},
) {
  const identity = ruleSet.version
    ? String(ruleSet.version)
    : `#${normalizeInteger(ruleSet.id)}`;
  if (action === 'publish') {
    return translate(
      t,
      '确认发布规则集 {{version}}？发布后会启用该版本并归档当前已发布规则。',
    ).replace('{{version}}', identity);
  }
  return translate(
    t,
    '确认归档规则集 {{version}}？归档后该版本不会再被自动选择。',
  ).replace('{{version}}', identity);
}

export function buildAffiliateRuleSetSaveConfirmation(t, ruleSet = {}) {
  const identity = ruleSet.version
    ? String(ruleSet.version)
    : `#${normalizeInteger(ruleSet.id)}`;
  return translate(
    t,
    '确认覆盖保存规则集 {{version}}？保存后会替换现有草稿配置。',
  ).replace('{{version}}', identity);
}

function getAffiliateRuleSetVersionIdentity(ruleSet = {}) {
  const version = String(ruleSet.version || '').trim();
  if (version) return version;
  const id = normalizeInteger(ruleSet.id);
  return id > 0 ? `rule-set-${id}` : 'rule-set';
}

function getAffiliateRuleSetDisplayIdentity(ruleSet = {}) {
  const version = String(ruleSet.version || '').trim();
  if (version) return version;
  const id = normalizeInteger(ruleSet.id);
  return id > 0 ? `#${id}` : '规则集';
}

export function buildAffiliateRuleSetRollbackPayload(t, ruleSet = {}) {
  const version = getAffiliateRuleSetVersionIdentity(ruleSet);
  const name = String(ruleSet.name || '').trim() || version;
  return {
    version: `${version}-rollback`,
    name: `${name} ${translate(t, '回滚草稿')}`,
    reason: translate(t, '管理员从规则集 {{version}} 创建回滚草稿').replace(
      '{{version}}',
      getAffiliateRuleSetDisplayIdentity(ruleSet),
    ),
  };
}

export function buildAffiliateRuleSetRollbackConfirmation(t, ruleSet = {}) {
  return translate(
    t,
    '确认从规则集 {{version}} 创建回滚草稿？该操作会把历史配置复制为新的可编辑草稿。',
  ).replace('{{version}}', getAffiliateRuleSetDisplayIdentity(ruleSet));
}

export function buildAffiliateRuleSetDraftPayload(values = {}) {
  return {
    id: normalizeInteger(values.id),
    version: String(values.version || '').trim(),
    name: String(values.name || '').trim(),
    effective_start: normalizeInteger(values.effective_start),
    effective_end: normalizeInteger(values.effective_end),
    reason: String(values.reason || '').trim(),
    commission_rules: parseJsonArray(
      '分佣规则',
      values.commission_rules_json || values.commission_rules,
    ),
    commission_tiers: parseJsonArray(
      '分佣区间',
      values.commission_tiers_json || values.commission_tiers,
    ).map((rule) => ({
      ...rule,
      requires_manual_approval: rule.requires_manual_approval === true,
    })),
    kpi_tiers: parseJsonArray(
      'KPI 档位',
      values.kpi_tiers_json || values.kpi_tiers,
    ),
    head_fee_rules: parseJsonArray(
      '人头费规则',
      values.head_fee_rules_json || values.head_fee_rules,
    ),
    risk_rules: parseJsonArray(
      '质量门槛',
      values.risk_rules_json || values.risk_rules,
    ),
    settlement_config: {
      cycle: String(values.settlement_cycle || '').trim(),
      freeze_days: normalizeInteger(values.freeze_days),
      min_settlement_amount_cents:
        values.min_settlement_amount_yuan !== undefined
          ? yuanToCents(values.min_settlement_amount_yuan)
          : normalizeInteger(values.min_settlement_amount_cents),
      manual_review_enabled: normalizeBoolean(values.manual_review_enabled),
      auto_settlement_enabled: values.auto_settlement_enabled !== false,
      review_note: String(values.review_note || '').trim(),
    },
  };
}

export function buildAffiliateRuleSetDraftFormValues(ruleSet = null) {
  if (!ruleSet) {
    return buildAffiliateRuleSetDefaultSeedFormValues();
  }

  const snapshot = normalizeSnapshot(ruleSet);
  const settlementConfig =
    snapshot.settlement_config ||
    (snapshot.settlement_cycle ? { cycle: snapshot.settlement_cycle } : {});

  return {
    id: normalizeInteger(ruleSet.id),
    version: String(ruleSet.version || snapshot.version || '').trim(),
    name: String(ruleSet.name || snapshot.name || '').trim(),
    effective_start: normalizeInteger(
      ruleSet.effective_start || snapshot.effective_start,
    ),
    effective_end: normalizeInteger(
      ruleSet.effective_end || snapshot.effective_end,
    ),
    reason: '',
    settlement_cycle: String(settlementConfig.cycle || '').trim(),
    freeze_days: normalizeInteger(settlementConfig.freeze_days),
    min_settlement_amount_cents: normalizeInteger(
      settlementConfig.min_settlement_amount_cents,
    ),
    min_settlement_amount_yuan: centsToYuan(
      settlementConfig.min_settlement_amount_cents,
    ),
    manual_review_enabled: normalizeBoolean(
      settlementConfig.manual_review_enabled,
    ),
    auto_settlement_enabled: normalizeDefaultTrueBoolean(
      settlementConfig.auto_settlement_enabled,
    ),
    review_note: String(settlementConfig.review_note || '').trim(),
    commission_rules_json: stringifyPretty(
      normalizeCommissionRulesForForm(snapshot.commission_rules),
    ),
    commission_tiers_json: stringifyPretty(
      normalizeCommissionTiersForForm(snapshot.commission_tiers),
    ),
    kpi_tiers_json: stringifyPretty(snapshot.kpi_tiers),
    head_fee_rules_json: stringifyPretty(
      normalizeHeadFeeRulesForForm(snapshot.head_fee_rules),
    ),
    risk_rules_json: stringifyPretty(
      normalizeRiskRulesForForm(snapshot.risk_rules),
    ),
  };
}

export function buildAffiliateRuleSetCopyDraftFormValues(ruleSet = null) {
  const values = buildAffiliateRuleSetDraftFormValues(ruleSet);
  return {
    ...values,
    id: 0,
    version: values.version ? `${values.version}-copy` : '',
    reason: '',
  };
}

export function buildAffiliateRuleSetExportJson(values = {}) {
  const {
    id: _id,
    reason: _reason,
    ...exportable
  } = buildAffiliateRuleSetDraftPayload(values);
  return JSON.stringify(exportable, null, 2);
}

export function parseAffiliateRuleSetImportJson(value = '') {
  const parsed = JSON.parse(String(value || '').trim());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('规则集导入 JSON 必须是对象');
  }
  const settlementConfig =
    parsed.settlement_config && typeof parsed.settlement_config === 'object'
      ? parsed.settlement_config
      : {};

  return {
    id: 0,
    version: String(parsed.version || '').trim(),
    name: String(parsed.name || '').trim(),
    effective_start: normalizeInteger(parsed.effective_start),
    effective_end: normalizeInteger(parsed.effective_end),
    reason: '',
    settlement_cycle: String(settlementConfig.cycle || '').trim(),
    freeze_days: normalizeInteger(settlementConfig.freeze_days),
    min_settlement_amount_cents: normalizeInteger(
      settlementConfig.min_settlement_amount_cents,
    ),
    min_settlement_amount_yuan: centsToYuan(
      settlementConfig.min_settlement_amount_cents,
    ),
    manual_review_enabled: normalizeBoolean(
      settlementConfig.manual_review_enabled,
    ),
    auto_settlement_enabled: normalizeDefaultTrueBoolean(
      settlementConfig.auto_settlement_enabled,
    ),
    review_note: String(settlementConfig.review_note || '').trim(),
    commission_rules_json: stringifyPretty(
      normalizeCommissionRulesForForm(parsed.commission_rules),
    ),
    commission_tiers_json: stringifyPretty(
      normalizeCommissionTiersForForm(parsed.commission_tiers),
    ),
    kpi_tiers_json: stringifyPretty(parsed.kpi_tiers),
    head_fee_rules_json: stringifyPretty(
      normalizeHeadFeeRulesForForm(parsed.head_fee_rules),
    ),
    risk_rules_json: stringifyPretty(
      normalizeRiskRulesForForm(parsed.risk_rules),
    ),
  };
}

export function buildAffiliateRuleSetDiffPreview(
  beforeValues = {},
  afterValues = {},
) {
  const before = buildAffiliateRuleSetDraftPayload(beforeValues);
  const after = buildAffiliateRuleSetDraftPayload(afterValues);
  const items = [];

  const appendScalar = (section, beforeValue, afterValue) => {
    const beforeText = String(beforeValue ?? '');
    const afterText = String(afterValue ?? '');
    if (beforeText === afterText) return;
    items.push({ section, before: beforeText, after: afterText });
  };
  const appendJson = (section, beforeValue, afterValue) => {
    if (stringifyStable(beforeValue) === stringifyStable(afterValue)) return;
    items.push({ section, before: 'changed', after: 'changed' });
  };

  appendScalar('Version', before.version, after.version);
  appendScalar('Name', before.name, after.name);
  appendScalar(
    'Effective Start Timestamp',
    before.effective_start,
    after.effective_start,
  );
  appendScalar(
    'Effective End Timestamp',
    before.effective_end,
    after.effective_end,
  );
  appendScalar(
    'Settlement Cycle',
    before.settlement_config?.cycle,
    after.settlement_config?.cycle,
  );
  appendScalar(
    'Freeze Days',
    before.settlement_config?.freeze_days,
    after.settlement_config?.freeze_days,
  );
  appendScalar(
    'Minimum Settlement Amount (cents)',
    before.settlement_config?.min_settlement_amount_cents,
    after.settlement_config?.min_settlement_amount_cents,
  );
  appendScalar(
    'Manual Review',
    before.settlement_config?.manual_review_enabled,
    after.settlement_config?.manual_review_enabled,
  );
  appendScalar(
    'Automatic Settlement',
    before.settlement_config?.auto_settlement_enabled,
    after.settlement_config?.auto_settlement_enabled,
  );
  appendScalar(
    'Review Note',
    before.settlement_config?.review_note,
    after.settlement_config?.review_note,
  );
  appendJson(
    'Commission Base Rules',
    before.commission_rules,
    after.commission_rules,
  );
  appendJson(
    'Commission Tiers',
    before.commission_tiers,
    after.commission_tiers,
  );
  appendJson('KPI Tiers', before.kpi_tiers, after.kpi_tiers);
  appendJson('Head Fee Rules', before.head_fee_rules, after.head_fee_rules);
  appendJson('Quality Thresholds', before.risk_rules, after.risk_rules);

  return items;
}

function buildAffiliateRuleSetDefaultSeedFormValues() {
  return {
    id: 0,
    version: '',
    name: 'Native Affiliate Rules',
    effective_start: 0,
    effective_end: 0,
    reason: '',
    settlement_cycle: 'monthly',
    freeze_days: 7,
    min_settlement_amount_cents: 10000,
    min_settlement_amount_yuan: 100,
    manual_review_enabled: true,
    auto_settlement_enabled: true,
    review_note: '',
    commission_rules_json: stringifyPretty([
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
    commission_tiers_json: stringifyPretty([
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
    kpi_tiers_json: stringifyPretty([
      {
        affiliate_level: 1,
        code: 'observe',
        name: '观察档',
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
        name: '合格档',
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
        name: '增长档',
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
        name: '卓越档',
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
        name: '观察档',
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
        name: '基础档',
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
        name: '增长档',
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
        name: '卓越档',
        min_effective_new_users: 50,
        min_net_paid_amount_cents: 150000,
        coefficient_bps: 20000,
        max_gift_only_ratio_bps: 3000,
        max_abnormal_ratio_bps: 1000,
        min_second_payment_ratio_bps: 0,
        sort_order: 4,
      },
    ]),
    head_fee_rules_json: stringifyPretty(
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
      ]),
    ),
    risk_rules_json: stringifyPretty([
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
  };
}

export function validateAffiliateRuleSetDraftPayload(t, payload) {
  if (!String(payload.version || '').trim()) {
    return translate(t, '请填写规则集版本');
  }
  if (!String(payload.name || '').trim()) {
    return translate(t, '请填写规则集名称');
  }
  if (
    payload.effective_start > 0 &&
    payload.effective_end > 0 &&
    payload.effective_end < payload.effective_start
  ) {
    return translate(t, '生效结束时间不能早于开始时间');
  }
  if (!String(payload.settlement_config?.cycle || '').trim()) {
    return translate(t, '请填写结算周期');
  }

  const commissionRules = Array.isArray(payload.commission_rules)
    ? payload.commission_rules
    : [];
  const commissionTiers = Array.isArray(payload.commission_tiers)
    ? payload.commission_tiers
    : [];
  const allCommissionCaps = [...commissionRules, ...commissionTiers];
  const levelOneMaxCap = Math.max(
    0,
    ...allCommissionCaps
      .filter((rule) => Number(rule.affiliate_level) === 1)
      .map((rule) =>
        Number(rule.default_cap_rate_bps ?? rule.cap_rate_bps ?? 0),
      ),
  );

  if (levelOneMaxCap > LEVEL_ONE_CAP_BPS) {
    return translate(t, '一级分销 cap 不能超过 30%');
  }
  if (
    levelOneMaxCap > 0 &&
    allCommissionCaps.some(
      (rule) =>
        Number(rule.affiliate_level) === 2 &&
        Number(rule.default_cap_rate_bps ?? rule.cap_rate_bps ?? 0) >
          levelOneMaxCap,
    )
  ) {
    return translate(t, '二级分销 cap 不能高于一级');
  }

  const kpiTiers = Array.isArray(payload.kpi_tiers) ? payload.kpi_tiers : [];
  if (kpiTiers.some((tier) => Number(tier.coefficient_bps || 0) < BPS_BASE)) {
    return translate(t, 'KPI 系数不能低于 1.00');
  }
  return '';
}

export function getAffiliateRuleSetStatusMeta(t, status) {
  switch (status) {
    case 'draft':
      return { label: translate(t, '草稿'), type: 'warning' };
    case 'published':
      return { label: translate(t, '已发布'), type: 'success' };
    case 'archived':
      return { label: translate(t, '已归档'), type: 'tertiary' };
    default:
      return { label: status || translate(t, '未知'), type: 'tertiary' };
  }
}

export function formatAffiliateBpsPercent(bps) {
  const value = Number(bps || 0);
  return `${(value / 100).toFixed(2)}%`;
}
