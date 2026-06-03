const normalizeInteger = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  const integer = Math.trunc(number);
  return integer > 0 ? integer : 0;
};

const normalizeSignedInteger = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.trunc(number);
};

const normalizeSignedYuanToCents = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.round(number * 100);
};

const normalizeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const normalizeTimestamp = (value) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  if (value instanceof Date) {
    const timestamp = Math.floor(value.getTime() / 1000);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.trunc(numeric > 100000000000 ? numeric / 1000 : numeric);
  }
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.floor(parsed / 1000);
};

const getPeriodStart = (values = {}) =>
  Array.isArray(values.period_range) && values.period_range.length > 0
    ? values.period_range[0]
    : values.period_start;

const getPeriodEnd = (values = {}) =>
  Array.isArray(values.period_range) && values.period_range.length > 1
    ? values.period_range[1]
    : values.period_end;

const translate = (t, value) => (typeof t === 'function' ? t(value) : value);

function appendPositiveInteger(params, key, value) {
  const normalized = normalizeInteger(value);
  if (normalized > 0) {
    params.set(key, String(normalized));
  }
}

function appendText(params, key, value) {
  const normalized = String(value || '').trim();
  if (normalized) {
    params.set(key, normalized);
  }
}

export function buildAffiliateCommissionsQuery({
  page = 1,
  pageSize = 10,
  filters = {},
} = {}) {
  const params = new URLSearchParams();
  params.set('p', String(normalizeInteger(page) || 1));
  params.set('page_size', String(normalizeInteger(pageSize) || 10));
  appendPositiveInteger(params, 'affiliate_user_id', filters.affiliate_user_id);
  appendPositiveInteger(params, 'rule_set_id', filters.rule_set_id);
  appendPositiveInteger(
    params,
    'downstream_user_id',
    filters.downstream_user_id,
  );
  appendPositiveInteger(params, 'settlement_id', filters.settlement_id);
  appendText(params, 'status', filters.status);
  appendText(params, 'kind', filters.kind);
  appendPositiveInteger(params, 'period_start', filters.period_start);
  appendPositiveInteger(params, 'period_end', filters.period_end);
  return `/api/affiliate/admin/commissions?${params.toString()}`;
}

export function buildAffiliateSettlementsQuery({
  page = 1,
  pageSize = 10,
  filters = {},
} = {}) {
  const params = new URLSearchParams();
  params.set('p', String(normalizeInteger(page) || 1));
  params.set('page_size', String(normalizeInteger(pageSize) || 10));
  appendPositiveInteger(params, 'affiliate_user_id', filters.affiliate_user_id);
  appendPositiveInteger(params, 'rule_set_id', filters.rule_set_id);
  appendText(params, 'status', filters.status);
  appendPositiveInteger(params, 'period_start', filters.period_start);
  appendPositiveInteger(params, 'period_end', filters.period_end);
  return `/api/affiliate/admin/settlements?${params.toString()}`;
}

export function buildAffiliateSettlementRunPayload(values = {}) {
  return {
    rule_set_id: normalizeInteger(values.rule_set_id),
    period_start: normalizeTimestamp(getPeriodStart(values)),
    period_end: normalizeTimestamp(getPeriodEnd(values)),
    freeze_days: normalizeInteger(values.freeze_days),
    now: normalizeTimestamp(values.now_datetime || values.now),
    quota_per_unit: normalizeNumber(values.quota_per_unit),
    usd_exchange_rate: normalizeNumber(values.usd_exchange_rate),
    reason: String(values.reason || '').trim(),
  };
}

export function buildAffiliateCommissionRecomputePayload(values = {}) {
  return {
    rule_set_id: normalizeInteger(values.rule_set_id),
    period_start: normalizeTimestamp(getPeriodStart(values)),
    period_end: normalizeTimestamp(getPeriodEnd(values)),
    quota_per_unit: normalizeNumber(values.quota_per_unit),
    usd_exchange_rate: normalizeNumber(values.usd_exchange_rate),
    reason: String(values.reason || '').trim(),
  };
}

export function buildAffiliateCommissionAdjustmentPayload(values = {}) {
  return {
    affiliate_user_id: normalizeInteger(values.affiliate_user_id),
    downstream_user_id: normalizeInteger(values.downstream_user_id),
    rule_set_id: normalizeInteger(values.rule_set_id),
    period_start: normalizeTimestamp(getPeriodStart(values)),
    period_end: normalizeTimestamp(getPeriodEnd(values)),
    commission_cents:
      values.commission_yuan !== undefined
        ? normalizeSignedYuanToCents(values.commission_yuan)
        : normalizeSignedInteger(values.commission_cents),
    reason: String(values.reason || '').trim(),
  };
}

function validatePeriod(t, payload) {
  if (
    payload.period_start > 0 &&
    payload.period_end > 0 &&
    payload.period_end < payload.period_start
  ) {
    return translate(t, '结算周期结束时间不能早于开始时间');
  }
  return '';
}

function validateReason(t, payload) {
  if (!String(payload.reason || '').trim()) {
    return translate(t, '请填写操作原因');
  }
  return '';
}

export function validateAffiliateSettlementRunPayload(t, payload) {
  return validatePeriod(t, payload) || validateReason(t, payload);
}

export function validateAffiliateCommissionRecomputePayload(t, payload) {
  return validatePeriod(t, payload) || validateReason(t, payload);
}

export function validateAffiliateCommissionAdjustmentPayload(t, payload) {
  if (!payload.affiliate_user_id) {
    return translate(t, '请输入分销商用户 ID');
  }
  if (!payload.commission_cents) {
    return translate(t, '佣金调整金额不能为 0');
  }
  return validatePeriod(t, payload) || validateReason(t, payload);
}

export function getAffiliateEventStatusMeta(t, status) {
  switch (status) {
    case 'pending':
      return { label: translate(t, '待处理'), type: 'warning' };
    case 'ready':
      return { label: translate(t, '待结算'), type: 'primary' };
    case 'settled':
      return { label: translate(t, '已结算'), type: 'success' };
    case 'void':
      return { label: translate(t, '已作废'), type: 'danger' };
    default:
      return { label: status || translate(t, '未知'), type: 'tertiary' };
  }
}

export function getAffiliateSettlementStatusMeta(t, status) {
  switch (status) {
    case 'draft':
      return { label: translate(t, '草稿'), type: 'warning' };
    case 'frozen':
      return { label: translate(t, '已冻结'), type: 'primary' };
    case 'paid':
      return { label: translate(t, '已支付'), type: 'success' };
    case 'void':
      return { label: translate(t, '已作废'), type: 'danger' };
    default:
      return { label: status || translate(t, '未知'), type: 'tertiary' };
  }
}

export function getAffiliateCommissionKindText(t, kind) {
  switch (kind) {
    case 'accrual':
      return translate(t, '计提');
    case 'clawback':
      return translate(t, '扣回');
    case 'manual_adjustment':
      return translate(t, '人工调整');
    default:
      return kind || translate(t, '未知');
  }
}

export function formatAffiliateCentsRMB(cents) {
  const value = Number(cents || 0);
  const sign = value < 0 ? '-' : '';
  return `${sign}¥${(Math.abs(value) / 100).toFixed(2)}`;
}
