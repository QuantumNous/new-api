export const SOURCE_PARAM = 'param';
export const SOURCE_HEADER = 'header';
export const SOURCE_TIME = 'time';

export const MATCH_EQ = 'eq';
export const MATCH_CONTAINS = 'contains';
export const MATCH_GT = 'gt';
export const MATCH_GTE = 'gte';
export const MATCH_LT = 'lt';
export const MATCH_LTE = 'lte';
export const MATCH_EXISTS = 'exists';
export const MATCH_RANGE = 'range';

export const TIME_FUNCS = ['hour', 'minute', 'weekday', 'month', 'day'];

export const COMMON_TIMEZONES = [
  { value: 'Asia/Shanghai', label: 'UTC+8 北京 (Asia/Shanghai)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'UTC-5 纽约 (America/New_York)' },
  { value: 'America/Los_Angeles', label: 'UTC-8 洛杉矶 (America/Los_Angeles)' },
  { value: 'America/Chicago', label: 'UTC-6 芝加哥 (America/Chicago)' },
  { value: 'Europe/London', label: 'UTC+0 伦敦 (Europe/London)' },
  { value: 'Europe/Berlin', label: 'UTC+1 柏林 (Europe/Berlin)' },
  { value: 'Asia/Tokyo', label: 'UTC+9 东京 (Asia/Tokyo)' },
  { value: 'Asia/Singapore', label: 'UTC+8 新加坡 (Asia/Singapore)' },
  { value: 'Asia/Seoul', label: 'UTC+9 首尔 (Asia/Seoul)' },
  { value: 'Australia/Sydney', label: 'UTC+10 悉尼 (Australia/Sydney)' },
];

export const NUMERIC_LITERAL_REGEX =
  /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

// ---------------------------------------------------------------------------
// Condition creators (no multiplier — multiplier lives on the group)
// ---------------------------------------------------------------------------

export function createEmptyCondition() {
  return { source: SOURCE_PARAM, path: '', mode: MATCH_EQ, value: '' };
}

export function createEmptyTimeCondition() {
  return {
    source: SOURCE_TIME,
    timeFunc: 'hour',
    timezone: 'Asia/Shanghai',
    mode: MATCH_GTE,
    value: '',
    rangeStart: '',
    rangeEnd: '',
  };
}

// ---------------------------------------------------------------------------
// Group creators
// ---------------------------------------------------------------------------

export function createEmptyRuleGroup() {
  return { conditions: [createEmptyCondition()], multiplier: '' };
}

export function createEmptyTimeRuleGroup() {
  return { conditions: [createEmptyTimeCondition()], multiplier: '' };
}

// Kept for backward compat with old preset format
export function createEmptyRequestRule() {
  return { source: SOURCE_PARAM, path: '', mode: MATCH_EQ, value: '', multiplier: '' };
}

export function createEmptyTimeRule() {
  return {
    source: SOURCE_TIME, timeFunc: 'hour', timezone: 'Asia/Shanghai',
    mode: MATCH_GTE, value: '', rangeStart: '', rangeEnd: '', multiplier: '',
  };
}

// ---------------------------------------------------------------------------
// Match options
// ---------------------------------------------------------------------------

export function getRequestRuleMatchOptions(source, t) {
  if (source === SOURCE_TIME) {
    return [
      { value: MATCH_EQ, label: t('等于') },
      { value: MATCH_GTE, label: t('大于等于') },
      { value: MATCH_LT, label: t('小于') },
      { value: MATCH_RANGE, label: t('跨夜范围') },
    ];
  }
  const base = [
    { value: MATCH_EQ, label: t('等于') },
    { value: MATCH_CONTAINS, label: t('包含') },
    { value: MATCH_EXISTS, label: t('存在') },
  ];
  if (source === SOURCE_HEADER) {
    return base;
  }
  return [
    ...base,
    { value: MATCH_GT, label: t('大于') },
    { value: MATCH_GTE, label: t('大于等于') },
    { value: MATCH_LT, label: t('小于') },
    { value: MATCH_LTE, label: t('小于等于') },
  ];
}

// ---------------------------------------------------------------------------
// Normalize a single condition
// ---------------------------------------------------------------------------

export function normalizeCondition(cond) {
  const source = cond?.source === SOURCE_TIME
    ? SOURCE_TIME
    : cond?.source === SOURCE_HEADER
      ? SOURCE_HEADER
      : SOURCE_PARAM;

  if (source === SOURCE_TIME) {
    const timeFunc = TIME_FUNCS.includes(cond?.timeFunc) ? cond.timeFunc : 'hour';
    const options = getRequestRuleMatchOptions(SOURCE_TIME, (v) => v);
    const mode = options.some((item) => item.value === cond?.mode) ? cond.mode : MATCH_GTE;
    return {
      source: SOURCE_TIME,
      timeFunc,
      timezone: cond?.timezone || 'Asia/Shanghai',
      mode,
      value: cond?.value == null ? '' : String(cond.value),
      rangeStart: cond?.rangeStart == null ? '' : String(cond.rangeStart),
      rangeEnd: cond?.rangeEnd == null ? '' : String(cond.rangeEnd),
    };
  }

  const options = getRequestRuleMatchOptions(source, (v) => v);
  const mode = options.some((item) => item.value === cond?.mode) ? cond.mode : MATCH_EQ;
  return {
    source,
    path: cond?.path || '',
    mode,
    value: cond?.value == null ? '' : String(cond.value),
  };
}

// Legacy compat wrapper
export function normalizeRequestRule(rule) {
  const base = normalizeCondition(rule);
  return { ...base, multiplier: rule?.multiplier == null ? '' : String(rule.multiplier) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function splitTopLevelMultiply(expr) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < expr.length; index += 1) {
    const char = expr[index];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && expr.slice(index, index + 3) === ' * ') {
      parts.push(expr.slice(start, index).trim());
      start = index + 3;
      index += 2;
    }
  }
  parts.push(expr.slice(start).trim());
  return parts.filter(Boolean);
}

function splitTopLevelAnd(expr) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const c = expr[i];
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (depth === 0 && expr.slice(i, i + 4) === ' && ') {
      parts.push(expr.slice(start, i).trim());
      start = i + 4;
      i += 3;
    }
  }
  parts.push(expr.slice(start).trim());
  return parts.filter(Boolean);
}

function parseExprLiteral(raw) {
  const text = raw.trim();
  if (text === 'true' || text === 'false') return text;
  if (NUMERIC_LITERAL_REGEX.test(text)) return text;
  try { return JSON.parse(text); } catch { return null; }
}

function buildExprLiteral(mode, value) {
  const text = String(value || '').trim();
  if (mode === MATCH_CONTAINS) return JSON.stringify(text);
  if (text === 'true' || text === 'false') return text;
  if (NUMERIC_LITERAL_REGEX.test(text)) return text;
  return JSON.stringify(text);
}

// ---------------------------------------------------------------------------
// Build a single condition expression string (no ? mult : 1 wrapper)
// ---------------------------------------------------------------------------

function buildTimeConditionExpr(cond) {
  const normalized = normalizeCondition(cond);
  const { timeFunc, timezone, mode } = normalized;
  const tz = JSON.stringify(timezone);
  const fn = `${timeFunc}(${tz})`;

  if (mode === MATCH_RANGE) {
    const s = normalized.rangeStart.trim();
    const e = normalized.rangeEnd.trim();
    if (!NUMERIC_LITERAL_REGEX.test(s) || !NUMERIC_LITERAL_REGEX.test(e)) return '';
    return `${fn} >= ${s} || ${fn} < ${e}`;
  }
  const v = normalized.value.trim();
  if (!NUMERIC_LITERAL_REGEX.test(v)) return '';
  const opMap = { [MATCH_EQ]: '==', [MATCH_GTE]: '>=', [MATCH_LT]: '<' };
  return `${fn} ${opMap[mode] || '=='} ${v}`;
}

function buildRequestConditionExpr(cond) {
  if (cond?.source === SOURCE_TIME) return buildTimeConditionExpr(cond);
  const normalized = normalizeCondition(cond);
  const path = normalized.path.trim();
  if (!path) return '';

  const sourceExpr = normalized.source === SOURCE_HEADER
    ? `header(${JSON.stringify(path)})`
    : `param(${JSON.stringify(path)})`;

  switch (normalized.mode) {
    case MATCH_EXISTS:
      return normalized.source === SOURCE_HEADER
        ? `${sourceExpr} != ""`
        : `${sourceExpr} != nil`;
    case MATCH_CONTAINS:
      return normalized.source === SOURCE_HEADER
        ? `has(${sourceExpr}, ${buildExprLiteral(normalized.mode, normalized.value)})`
        : `${sourceExpr} != nil && has(${sourceExpr}, ${buildExprLiteral(normalized.mode, normalized.value)})`;
    case MATCH_GT: case MATCH_GTE: case MATCH_LT: case MATCH_LTE: {
      const opMap = { [MATCH_GT]: '>', [MATCH_GTE]: '>=', [MATCH_LT]: '<', [MATCH_LTE]: '<=' };
      if (!NUMERIC_LITERAL_REGEX.test(String(normalized.value).trim())) return '';
      return `${sourceExpr} != nil && ${sourceExpr} ${opMap[normalized.mode]} ${String(normalized.value).trim()}`;
    }
    case MATCH_EQ:
    default:
      return `${sourceExpr} == ${buildExprLiteral(normalized.mode, normalized.value)}`;
  }
}

// ---------------------------------------------------------------------------
// Build a group factor: (cond1 && cond2 ? mult : 1)
// ---------------------------------------------------------------------------

function buildRuleGroupFactor(group) {
  const multiplier = (group.multiplier || '').trim();
  if (!NUMERIC_LITERAL_REGEX.test(multiplier)) return '';
  const condExprs = (group.conditions || [])
    .map(buildRequestConditionExpr)
    .filter(Boolean);
  if (condExprs.length === 0) return '';

  const combined = condExprs.length === 1
    ? condExprs[0]
    : condExprs.map((e) => (e.includes(' || ') ? `(${e})` : e)).join(' && ');
  return `(${combined} ? ${multiplier} : 1)`;
}

export function buildRequestRuleExpr(groups) {
  return (groups || []).map(buildRuleGroupFactor).filter(Boolean).join(' * ');
}

// ---------------------------------------------------------------------------
// Parse a single condition from an expression fragment
// ---------------------------------------------------------------------------

function tryParseTimeCondition(expr) {
  // Range: hour("tz") >= s || hour("tz") < e
  let m = expr.match(
    /^(hour|minute|weekday|month|day)\("([^"]+)"\) >= ([\d.eE+-]+) \|\| \1\("\2"\) < ([\d.eE+-]+)$/,
  );
  if (m) {
    return {
      source: SOURCE_TIME, timeFunc: m[1], timezone: m[2],
      mode: MATCH_RANGE, value: '', rangeStart: m[3], rangeEnd: m[4],
    };
  }
  // Wrapped range: (hour("tz") >= s || hour("tz") < e)
  m = expr.match(
    /^\((hour|minute|weekday|month|day)\("([^"]+)"\) >= ([\d.eE+-]+) \|\| \1\("\2"\) < ([\d.eE+-]+)\)$/,
  );
  if (m) {
    return {
      source: SOURCE_TIME, timeFunc: m[1], timezone: m[2],
      mode: MATCH_RANGE, value: '', rangeStart: m[3], rangeEnd: m[4],
    };
  }
  // Simple: hour("tz") op value
  m = expr.match(
    /^(hour|minute|weekday|month|day)\("([^"]+)"\) (==|>=|<) ([\d.eE+-]+)$/,
  );
  if (m) {
    const opMap = { '==': MATCH_EQ, '>=': MATCH_GTE, '<': MATCH_LT };
    return {
      source: SOURCE_TIME, timeFunc: m[1], timezone: m[2],
      mode: opMap[m[3]] || MATCH_EQ, value: m[4], rangeStart: '', rangeEnd: '',
    };
  }
  return null;
}

function tryParseRequestCondition(expr) {
  const tc = tryParseTimeCondition(expr);
  if (tc) return tc;

  let m = expr.match(/^header\("([^"]+)"\) != ""$/);
  if (m) return { source: SOURCE_HEADER, path: m[1], mode: MATCH_EXISTS, value: '' };

  m = expr.match(/^param\("([^"]+)"\) != nil$/);
  if (m) return { source: SOURCE_PARAM, path: m[1], mode: MATCH_EXISTS, value: '' };

  m = expr.match(/^has\(header\("([^"]+)"\), ((?:"(?:[^"\\]|\\.)*"))\)$/);
  if (m) return { source: SOURCE_HEADER, path: m[1], mode: MATCH_CONTAINS, value: JSON.parse(m[2]) };

  m = expr.match(/^param\("([^"]+)"\) != nil && has\(param\("([^"]+)"\), ((?:"(?:[^"\\]|\\.)*"))\)$/);
  if (m && m[1] === m[2]) return { source: SOURCE_PARAM, path: m[1], mode: MATCH_CONTAINS, value: JSON.parse(m[3]) };

  m = expr.match(/^param\("([^"]+)"\) != nil && param\("([^"]+)"\) (>|>=|<|<=) ([\d.eE+-]+)$/);
  if (m && m[1] === m[2]) {
    const opMap = { '>': MATCH_GT, '>=': MATCH_GTE, '<': MATCH_LT, '<=': MATCH_LTE };
    return { source: SOURCE_PARAM, path: m[1], mode: opMap[m[3]], value: m[4] };
  }

  m = expr.match(/^(param|header)\("([^"]+)"\) == (.+)$/);
  if (m) {
    const parsedValue = parseExprLiteral(m[3]);
    if (parsedValue === null) return null;
    return { source: m[1], path: m[2], mode: MATCH_EQ, value: String(parsedValue) };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parse a group factor: (cond1 && cond2 ? mult : 1)
// ---------------------------------------------------------------------------

function tryParseRuleGroupFactor(part) {
  // Must be wrapped in ( ... ? mult : 1)
  const m = part.match(/^\((.+) \? ([\d.eE+-]+) : 1\)$/s);
  if (!m) return null;

  const conditionStr = m[1];
  const multiplier = m[2];

  const andParts = splitTopLevelAnd(conditionStr);
  const conditions = [];
  for (const ap of andParts) {
    const cond = tryParseRequestCondition(ap.trim());
    if (!cond) return null;
    conditions.push(normalizeCondition(cond));
  }
  if (conditions.length === 0) return null;
  return { conditions, multiplier };
}

export function tryParseRequestRuleExpr(expr) {
  const trimmed = (expr || '').trim();
  if (!trimmed) return [];

  const parts = splitTopLevelMultiply(trimmed);
  const groups = [];
  for (const part of parts) {
    const group = tryParseRuleGroupFactor(part);
    if (!group) return null;
    groups.push(group);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Combine / split billing expr and request rules
// ---------------------------------------------------------------------------

function hasFullOuterParens(expr) {
  if (!expr.startsWith('(') || !expr.endsWith(')')) return false;
  let depth = 0;
  for (let i = 0; i < expr.length; i += 1) {
    if (expr[i] === '(') depth += 1;
    if (expr[i] === ')') depth -= 1;
    if (depth === 0 && i < expr.length - 1) return false;
  }
  return depth === 0;
}

export function unwrapOuterParens(expr) {
  let current = (expr || '').trim();
  while (hasFullOuterParens(current)) {
    current = current.slice(1, -1).trim();
  }
  return current;
}

export function combineBillingExpr(baseExpr, requestRuleExpr) {
  const base = (baseExpr || '').trim();
  const rules = (requestRuleExpr || '').trim();
  if (!base) return '';
  if (!rules) return base;
  return `(${base}) * ${rules}`;
}

export function splitBillingExprAndRequestRules(expr) {
  const trimmed = (expr || '').trim();
  if (!trimmed) return { billingExpr: '', requestRuleExpr: '' };

  const parts = splitTopLevelMultiply(trimmed);
  if (parts.length <= 1) return { billingExpr: trimmed, requestRuleExpr: '' };

  const ruleParts = [];
  const baseParts = [];

  parts.forEach((part) => {
    if (tryParseRequestRuleExpr(part) !== null && tryParseRequestRuleExpr(part).length > 0) {
      ruleParts.push(part);
    } else {
      baseParts.push(part);
    }
  });

  if (ruleParts.length === 0 || baseParts.length !== 1) {
    return { billingExpr: trimmed, requestRuleExpr: '' };
  }

  return {
    billingExpr: unwrapOuterParens(baseParts[0]),
    requestRuleExpr: ruleParts.join(' * '),
  };
}
