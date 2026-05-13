/*
Copyright (C) 2025 QuantumNous

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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Collapsible,
  Input,
  InputNumber,
  Radio,
  RadioGroup,
  Select,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconCopy, IconDelete, IconPlus } from '@douyinfe/semi-icons';
import { renderQuota } from '../../../../helpers/render';
import { copy, showSuccess } from '../../../../helpers';
import {
  BILLING_EXTRA_VARS,
  BILLING_CACHE_VAR_MAP,
  BILLING_CONDITION_VARS,
} from '../../../../constants';
import {
  createEmptyCondition,
  createEmptyTimeCondition,
  createEmptyRuleGroup,
  createEmptyTimeRuleGroup,
  getRequestRuleMatchOptions,
  normalizeCondition,
  tryParseRequestRuleExpr,
  buildRequestRuleExpr,
  combineBillingExpr,
  splitBillingExprAndRequestRules,
  MATCH_EQ,
  MATCH_EXISTS,
  MATCH_CONTAINS,
  MATCH_RANGE,
  MATCH_GTE,
  SOURCE_HEADER,
  SOURCE_PARAM,
  SOURCE_TIME,
  TIME_FUNCS,
  COMMON_TIMEZONES,
} from './requestRuleExpr';

const { Text } = Typography;

const PRICE_SUFFIX = '$/1M tokens';

function unitCostToPrice(uc) {
  return Number(uc) || 0;
}
function priceToUnitCost(price) {
  return Number(price) || 0;
}

const OPS = ['<', '<=', '>', '>='];
const VAR_OPTIONS = [
  { value: 'len', label: 'len (长度)' },
  { value: 'p', label: 'p (输入)' },
  { value: 'c', label: 'c (输出)' },
];

const CACHE_MODE_TIMED = 'timed';
const CACHE_MODE_GENERIC = 'generic';

function formatTokenHint(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '';
  const v = Number(n);
  if (v === 0) return '= 0';
  if (v >= 1000000) return `= ${(v / 1000000).toLocaleString()}M tokens`;
  if (v >= 1000) return `= ${(v / 1000).toLocaleString()}K tokens`;
  return `= ${v.toLocaleString()} tokens`;
}

// ---------------------------------------------------------------------------
// Expr generation from visual config (multi-condition)
// ---------------------------------------------------------------------------

function buildConditionStr(conditions) {
  if (!conditions || conditions.length === 0) return '';
  return conditions
    .filter((c) => c.var && c.op && c.value != null && c.value !== '')
    .map((c) => `${c.var} ${c.op} ${c.value}`)
    .join(' && ');
}

const CACHE_VAR_MAP = BILLING_CACHE_VAR_MAP;

function getTierCacheMode(tier) {
  if (tier?.cache_mode === CACHE_MODE_TIMED) {
    return CACHE_MODE_TIMED;
  }
  if (tier?.cache_mode === CACHE_MODE_GENERIC) {
    return CACHE_MODE_GENERIC;
  }
  return Number(tier?.cache_create_1h_unit_cost) > 0
    ? CACHE_MODE_TIMED
    : CACHE_MODE_GENERIC;
}

function normalizeVisualTier(tier = {}) {
  return {
    ...tier,
    conditions: Array.isArray(tier.conditions) ? tier.conditions : [],
    cache_mode: getTierCacheMode(tier),
  };
}

function createDefaultVisualConfig() {
  return {
    tiers: [
      normalizeVisualTier({
        conditions: [],
        input_unit_cost: 0,
        output_unit_cost: 0,
        label: 'base',
        cache_mode: CACHE_MODE_GENERIC,
      }),
    ],
  };
}

function normalizeVisualConfig(config) {
  if (!config || !Array.isArray(config.tiers) || config.tiers.length === 0) {
    return createDefaultVisualConfig();
  }
  return {
    ...config,
    tiers: config.tiers.map((tier) => normalizeVisualTier(tier)),
  };
}

function buildTierBodyExpr(tier) {
  const parts = [];
  const ic = Number(tier.input_unit_cost) || 0;
  const oc = Number(tier.output_unit_cost) || 0;
  parts.push(`p * ${ic}`);
  parts.push(`c * ${oc}`);
  for (const cv of CACHE_VAR_MAP) {
    const v = Number(tier[cv.field]) || 0;
    if (v !== 0) parts.push(`${cv.exprVar} * ${v}`);
  }
  return parts.join(' + ');
}

function generateExprFromVisualConfig(config) {
  if (!config || !config.tiers || config.tiers.length === 0)
    return 'p * 0 + c * 0';
  const tiers = config.tiers;

  if (tiers.length === 1) {
    const t = tiers[0];
    const label = t.label || 'default';
    const body = `tier("${label}", ${buildTierBodyExpr(t)})`;
    const cond = buildConditionStr(t.conditions);
    if (cond) {
      return `${cond} ? ${body} : p * 0 + c * 0`;
    }
    return body;
  }

  const parts = [];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const label = t.label || `第${i + 1}档`;
    const body = `tier("${label}", ${buildTierBodyExpr(t)})`;
    const cond = buildConditionStr(t.conditions);

    if (i < tiers.length - 1 && cond) {
      parts.push(`${cond} ? ${body}`);
    } else {
      parts.push(body);
    }
  }
  return parts.join(' : ');
}

// ---------------------------------------------------------------------------
// Reverse-parse an Expr string back into visual config
// ---------------------------------------------------------------------------

function tryParseVisualConfig(exprStr) {
  if (!exprStr) return null;
  try {
    const versionMatch = exprStr.match(/^v\d+:([\s\S]*)$/);
    if (versionMatch) exprStr = versionMatch[1];
    const cacheVarNames = CACHE_VAR_MAP.map((cv) => cv.exprVar);
    const optCacheStr = cacheVarNames
      .map((v) => `(?:\\s*\\+\\s*${v}\\s*\\*\\s*([\\d.eE+-]+))?`)
      .join('');

    // Body pattern: p * X + c * Y [+ cr * A] [+ cc * B] [+ cc1h * C]
    const bodyPat = `p\\s*\\*\\s*([\\d.eE+-]+)\\s*\\+\\s*c\\s*\\*\\s*([\\d.eE+-]+)${optCacheStr}`;

    // Single-tier: tier("label", body)
    const singleRe = new RegExp(`^tier\\("([^"]*)",\\s*${bodyPat}\\)$`);
    const simple = exprStr.match(singleRe);
    if (simple) {
      const tier = {
        conditions: [],
        input_unit_cost: Number(simple[2]),
        output_unit_cost: Number(simple[3]),
        label: simple[1],
      };
      CACHE_VAR_MAP.forEach((cv, i) => {
        const val = simple[4 + i];
        if (val != null) tier[cv.field] = Number(val);
      });
      return normalizeVisualConfig({ tiers: [normalizeVisualTier(tier)] });
    }

    // Multi-tier: cond1 ? tier(body) : cond2 ? tier(body) : tier(body)
    const condGroup = `((?:(?:p|c|len)\\s*(?:<|<=|>|>=)\\s*[\\d.eE+]+)(?:\\s*&&\\s*(?:p|c|len)\\s*(?:<|<=|>|>=)\\s*[\\d.eE+]+)*)`;
    const tierRe = new RegExp(
      `(?:${condGroup}\\s*\\?\\s*)?tier\\("([^"]*)",\\s*${bodyPat}\\)`,
      'g',
    );
    const tiers = [];
    let match;
    while ((match = tierRe.exec(exprStr)) !== null) {
      const condStr = match[1] || '';
      const conditions = [];
      if (condStr) {
        const condParts = condStr.split(/\s*&&\s*/);
        for (const cp of condParts) {
          const cm = cp.trim().match(/^(p|c|len)\s*(<|<=|>|>=)\s*([\d.eE+]+)$/);
          if (cm) {
            conditions.push({ var: cm[1], op: cm[2], value: Number(cm[3]) });
          }
        }
      }
      const tier = {
        conditions,
        input_unit_cost: Number(match[3]),
        output_unit_cost: Number(match[4]),
        label: match[2],
      };
      CACHE_VAR_MAP.forEach((cv, i) => {
        const val = match[5 + i];
        if (val != null) tier[cv.field] = Number(val);
      });
      tiers.push(normalizeVisualTier(tier));
    }
    if (tiers.length === 0) return null;

    const cfg = normalizeVisualConfig({ tiers });
    const regenerated = generateExprFromVisualConfig(cfg);
    if (regenerated.replace(/\s+/g, '') !== exprStr.replace(/\s+/g, ''))
      return null;
    return cfg;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Condition editor row
// ---------------------------------------------------------------------------

function ConditionRow({ cond, onChange, onRemove, t }) {
  const hint = formatTokenHint(cond.value);
  return (
    <div
      style={{
        marginBottom: 6,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr auto',
        gap: '4px 6px',
        alignItems: 'center',
      }}
    >
      <Select
        size='small'
        value={cond.var || 'len'}
        onChange={(val) => onChange({ ...cond, var: val })}
      >
        {VAR_OPTIONS.map((v) => (
          <Select.Option key={v.value} value={v.value}>
            {v.label}
          </Select.Option>
        ))}
      </Select>
      <Select
        size='small'
        value={cond.op || '<'}
        onChange={(val) => onChange({ ...cond, op: val })}
        style={{ width: 70 }}
      >
        {OPS.map((op) => (
          <Select.Option key={op} value={op}>
            {op}
          </Select.Option>
        ))}
      </Select>
      <InputNumber
        size='small'
        min={0}
        value={cond.value ?? ''}
        onChange={(val) => onChange({ ...cond, value: val })}
      />
      <Button
        icon={<IconDelete />}
        type='danger'
        theme='borderless'
        size='small'
        onClick={onRemove}
      />
      {hint ? (
        <Text
          size='small'
          style={{
            color: 'var(--semi-color-text-3)',
            gridColumn: '3 / 4',
          }}
        >
          = {hint}
        </Text>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price input that preserves intermediate text like "7." or "0.5"
// ---------------------------------------------------------------------------

function PriceInput({ unitCost, field, index, onUpdate, placeholder }) {
  const priceFromModel = unitCostToPrice(unitCost);
  const [text, setText] = useState(
    priceFromModel === 0 ? '' : String(priceFromModel),
  );

  useEffect(() => {
    const current = Number(text);
    if (text === '' && priceFromModel === 0) return;
    if (!Number.isNaN(current) && current === priceFromModel) return;
    setText(priceFromModel === 0 ? '' : String(priceFromModel));
  }, [priceFromModel]);

  const handleChange = (val) => {
    setText(val);
    if (val === '') {
      onUpdate(index, field, 0);
      return;
    }
    const num = Number(val);
    if (!Number.isNaN(num)) {
      onUpdate(index, field, priceToUnitCost(num));
    }
  };

  return (
    <Input
      value={text}
      placeholder={placeholder || '0'}
      suffix={PRICE_SUFFIX}
      onChange={handleChange}
      style={{ width: '100%', marginTop: 2 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Extended price block (cache fields) — collapsible per tier, with mode switch
// ---------------------------------------------------------------------------

const CACHE_FIELDS_TIMED = [
  { field: 'cache_read_unit_cost', labelKey: '缓存读取价格' },
  { field: 'cache_create_unit_cost', labelKey: '缓存创建价格（5分钟）' },
  { field: 'cache_create_1h_unit_cost', labelKey: '缓存创建价格（1小时）' },
];

const CACHE_FIELDS_GENERIC = [
  { field: 'cache_read_unit_cost', labelKey: '缓存读取价格' },
  { field: 'cache_create_unit_cost', labelKey: '缓存创建价格' },
];

function ExtendedPriceBlock({ tier, index, onUpdate, t }) {
  const mediaFields = BILLING_EXTRA_VARS.filter((v) => v.group === 'media');
  const hasAny = [
    ...CACHE_FIELDS_TIMED,
    ...mediaFields.map((v) => v.tierField),
  ].some((f) => Number(tier[typeof f === 'string' ? f : f.field]) > 0);
  const [expanded, setExpanded] = useState(hasAny);
  const cacheMode = getTierCacheMode(tier);

  const handleCacheModeChange = (e) => {
    const mode = e.target.value;
    const patch = { cache_mode: mode };
    if (mode === CACHE_MODE_GENERIC) {
      patch.cache_create_1h_unit_cost = 0;
    }
    onUpdate(index, patch);
  };

  const activeFields =
    cacheMode === CACHE_MODE_TIMED ? CACHE_FIELDS_TIMED : CACHE_FIELDS_GENERIC;

  return (
    <div style={{ marginTop: 8 }}>
      <Button
        theme='borderless'
        size='small'
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '2px 0',
          color: 'var(--semi-color-text-2)',
          fontSize: 12,
        }}
      >
        {expanded ? '▾' : '▸'} {t('扩展价格')}
      </Button>
      <Collapsible isOpen={expanded}>
        <div
          style={{
            marginTop: 4,
            padding: '8px 0',
          }}
        >
          <div className='text-xs text-gray-500 mb-2'>
            {t('这些价格都是可选项，不填也可以。')}
          </div>
          <div style={{ marginBottom: 8 }}>
            <RadioGroup
              type='button'
              size='small'
              value={cacheMode}
              onChange={handleCacheModeChange}
            >
              <Radio value={CACHE_MODE_GENERIC}>{t('通用缓存')}</Radio>
              <Radio value={CACHE_MODE_TIMED}>{t('分时缓存 (Claude)')}</Radio>
            </RadioGroup>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            {activeFields.map((cf) => (
              <div key={cf.field}>
                <Text
                  size='small'
                  style={{ color: 'var(--semi-color-text-2)' }}
                >
                  {t(cf.labelKey)}
                </Text>
                <PriceInput
                  unitCost={tier[cf.field]}
                  field={cf.field}
                  index={index}
                  onUpdate={onUpdate}
                />
              </div>
            ))}
          </div>
          <div className='text-xs text-gray-500 mb-2 mt-3'>
            {t('图片/音频价格（可选）')}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            {mediaFields
              .map((v) => ({ field: v.tierField, labelKey: v.label }))
              .map((cf) => (
                <div key={cf.field}>
                  <Text
                    size='small'
                    style={{ color: 'var(--semi-color-text-2)' }}
                  >
                    {t(cf.labelKey)}
                  </Text>
                  <PriceInput
                    unitCost={tier[cf.field]}
                    field={cf.field}
                    index={index}
                    onUpdate={onUpdate}
                  />
                </div>
              ))}
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual Tier Card (multi-condition)
// ---------------------------------------------------------------------------

function VisualTierCard({
  tier,
  index,
  isLast,
  isOnly,
  onUpdate,
  onRemove,
  t,
}) {
  const conditions = tier.conditions || [];

  const varLabel = { len: t('长度'), p: t('输入'), c: t('输出') };
  const condSummary = useMemo(() => {
    if (conditions.length === 0) return t('无条件（兜底档）');
    return conditions
      .filter((c) => c.var && c.op && c.value != null)
      .map(
        (c) =>
          `${varLabel[c.var] || c.var} ${c.op} ${formatTokenHint(c.value)}`,
      )
      .join(' && ');
  }, [conditions, t]);

  const updateCondition = (ci, newCond) => {
    const next = conditions.map((c, i) => (i === ci ? newCond : c));
    onUpdate(index, 'conditions', next);
  };

  const removeCondition = (ci) => {
    onUpdate(
      index,
      'conditions',
      conditions.filter((_, i) => i !== ci),
    );
  };

  const addCondition = () => {
    if (conditions.length >= 2) return;
    const usedVars = conditions.map((c) => c.var);
    const nextVar = usedVars.includes('len') ? 'c' : 'len';
    onUpdate(index, 'conditions', [
      ...conditions,
      { var: nextVar, op: '<', value: 200000 },
    ]);
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid var(--semi-color-border)',
        background: 'var(--semi-color-bg-2)',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color='blue' size='small'>
            {t('第 {{n}} 档', { n: index + 1 })}
          </Tag>
          {isLast && !isOnly ? (
            <Tag color='grey' size='small'>
              {t('兜底档')}
            </Tag>
          ) : null}
        </div>
        {!isOnly ? (
          <Button
            icon={<IconDelete />}
            type='danger'
            theme='borderless'
            size='small'
            onClick={() => onRemove(index)}
          />
        ) : null}
      </div>

      {/* Tier label */}
      <div style={{ marginBottom: 8 }}>
        <Text size='small' style={{ color: 'var(--semi-color-text-2)' }}>
          {t('档位名称')}
        </Text>
        <Input
          size='small'
          value={tier.label || ''}
          placeholder={t('第 {{n}} 档', { n: index + 1 })}
          onChange={(val) => onUpdate(index, 'label', val)}
          style={{ width: '100%', marginTop: 2 }}
        />
      </div>

      {/* Conditions */}
      {!isLast || isOnly ? (
        <div style={{ marginBottom: 10 }}>
          <Text
            size='small'
            style={{
              color: 'var(--semi-color-text-2)',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {t('条件')}
          </Text>
          {conditions.map((cond, ci) => (
            <ConditionRow
              key={ci}
              cond={cond}
              onChange={(nc) => updateCondition(ci, nc)}
              onRemove={() => removeCondition(ci)}
              t={t}
            />
          ))}
          {conditions.length < 2 && (
            <Button
              icon={<IconPlus />}
              size='small'
              theme='borderless'
              onClick={addCondition}
              style={{ marginTop: 2 }}
            >
              {t('添加条件')}
            </Button>
          )}
        </div>
      ) : (
        <div
          style={{
            marginBottom: 10,
            padding: '4px 8px',
            borderRadius: 4,
            background: 'var(--semi-color-fill-1)',
          }}
        >
          <Text size='small' style={{ color: 'var(--semi-color-text-3)' }}>
            {condSummary}
          </Text>
        </div>
      )}

      {/* Prices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <Text size='small' style={{ color: 'var(--semi-color-text-2)' }}>
            {t('输入价格')}
          </Text>
          <PriceInput
            unitCost={tier.input_unit_cost}
            field='input_unit_cost'
            index={index}
            onUpdate={onUpdate}
          />
        </div>
        <div>
          <Text size='small' style={{ color: 'var(--semi-color-text-2)' }}>
            {t('输出价格')}
          </Text>
          <PriceInput
            unitCost={tier.output_unit_cost}
            field='output_unit_cost'
            index={index}
            onUpdate={onUpdate}
          />
        </div>
      </div>

      {/* Extended prices (cache) — collapsible */}
      <ExtendedPriceBlock tier={tier} index={index} onUpdate={onUpdate} t={t} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual editor
// ---------------------------------------------------------------------------

function VisualEditor({ visualConfig, onChange, t }) {
  const config = normalizeVisualConfig(visualConfig);
  const tiers = config.tiers || [];

  const updateTier = (index, field, value) => {
    const patch = typeof field === 'string' ? { [field]: value } : { ...field };
    const next = tiers.map((tier, i) =>
      i === index ? normalizeVisualTier({ ...tier, ...patch }) : tier,
    );
    onChange({ ...config, tiers: next });
  };

  const addTier = () => {
    const newTiers = [...tiers];
    if (
      newTiers.length > 0 &&
      (!newTiers[newTiers.length - 1].conditions ||
        newTiers[newTiers.length - 1].conditions.length === 0)
    ) {
      newTiers[newTiers.length - 1] = {
        ...newTiers[newTiers.length - 1],
        conditions: [{ var: 'len', op: '<', value: 200000 }],
      };
    }
    newTiers.push({
      conditions: [],
      input_unit_cost: 0,
      output_unit_cost: 0,
      label: `第${newTiers.length + 1}档`,
      cache_mode: CACHE_MODE_GENERIC,
    });
    onChange({ ...config, tiers: newTiers });
  };

  const removeTier = (index) => {
    if (tiers.length <= 1) return;
    const next = tiers.filter((_, i) => i !== index);
    if (next.length > 0) {
      next[next.length - 1] = {
        ...next[next.length - 1],
        conditions: [],
      };
    }
    onChange({ ...config, tiers: next });
  };

  return (
    <div>
      <Banner
        type='info'
        description={t(
          '每个档位可设置 0~2 个条件（对 len、p 和 c），最后一档为兜底档无需条件。len 为输入上下文总长度（含缓存），推荐用于阶梯条件。',
        )}
        style={{ marginBottom: 12 }}
      />

      {tiers.map((tier, index) => (
        <VisualTierCard
          key={index}
          tier={tier}
          index={index}
          isLast={index === tiers.length - 1}
          isOnly={tiers.length === 1}
          onUpdate={updateTier}
          onRemove={removeTier}
          t={t}
        />
      ))}
      <Button
        icon={<IconPlus />}
        size='small'
        theme='light'
        onClick={addTier}
        style={{ marginTop: 4 }}
      >
        {t('添加更多档位')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Raw Expr editor with preset templates
// ---------------------------------------------------------------------------

const PRESET_GROUPS = [
  {
    group: '固定价格',
    presets: [
      { key: 'flat', label: 'Flat', expr: 'tier("base", p * 2 + c * 4)' },
      {
        key: 'claude-opus',
        label: 'Claude Opus 4.6',
        expr: 'tier("base", p * 5 + c * 25 + cr * 0.5 + cc * 6.25 + cc1h * 10)',
      },
      {
        key: 'gpt-5.4',
        label: 'GPT-5.4',
        expr: 'len <= 272000 ? tier("standard", p * 2.5 + c * 15 + cr * 0.25) : tier("long_context", p * 5 + c * 22.5 + cr * 0.5)',
      },
    ],
  },
  {
    group: '阶梯计费',
    presets: [
      {
        key: 'claude-sonnet',
        label: 'Claude Sonnet 4.5',
        expr: 'len <= 200000 ? tier("standard", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6) : tier("long_context", p * 6 + c * 22.5 + cr * 0.6 + cc * 7.5 + cc1h * 12)',
      },
      {
        key: 'qwen3-max',
        label: 'Qwen3 Max',
        expr: 'len <= 32000 ? tier("short", p * 1.2 + c * 6 + cr * 0.24 + cc * 1.5) : len <= 128000 ? tier("mid", p * 2.4 + c * 12 + cr * 0.48 + cc * 3) : tier("long", p * 3 + c * 15 + cr * 0.6 + cc * 3.75)',
      },
      {
        key: 'glm-4.5-air',
        label: 'GLM-4.5 Air',
        expr: 'len < 32000 && c < 200 ? tier("short_output", p * 0.8 + c * 2 + cr * 0.16) : len < 32000 && c >= 200 ? tier("long_output", p * 0.8 + c * 6 + cr * 0.16) : tier("mid_context", p * 1.2 + c * 8 + cr * 0.24)',
      },
      {
        key: 'doubao-seed-1.8',
        label: 'Doubao Seed 1.8',
        expr: 'len <= 32000 && c <= 200 ? tier("discount", p * 0.8 + c * 2 + cr * 0.16 + cc * 0.17) : len <= 32000 ? tier("short", p * 0.8 + c * 8 + cr * 0.16 + cc * 0.17) : len <= 128000 ? tier("mid", p * 1.2 + c * 16 + cr * 0.16 + cc * 0.17) : tier("long", p * 2.4 + c * 24 + cr * 0.16 + cc * 0.17)',
      },
    ],
  },
  {
    group: '多模态',
    presets: [
      {
        key: 'gpt-image-1-mini',
        label: 'GPT Image 1 Mini',
        expr: 'tier("base", p * 2 + c * 8 + img * 2.5)',
      },
      {
        key: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        expr: 'tier("base", p * 0.3 + c * 2.5 + cr * 0.03 + ai * 1.0)',
      },
      {
        key: 'gemini-3-pro-image',
        label: 'Gemini 3 Pro Image',
        expr: 'tier("base", p * 2 + c * 12 + img_o * 120)',
      },
      {
        key: 'qwen3-omni-flash',
        label: 'Qwen3 Omni Flash',
        expr: 'tier("base", p * 0.43 + c * 3.06 + img * 0.78 + ai * 3.81 + ao * 15.11)',
      },
    ],
  },
  {
    group: '请求条件',
    presets: [
      {
        key: 'claude-opus-fast',
        label: 'Claude Opus 4.6 Fast',
        expr: 'tier("base", p * 5 + c * 25 + cr * 0.5 + cc * 6.25 + cc1h * 10)',
        requestRules: [
          {
            conditions: [
              {
                source: SOURCE_HEADER,
                path: 'anthropic-beta',
                mode: MATCH_CONTAINS,
                value: 'fast-mode-2026-02-01',
              },
            ],
            multiplier: '6',
          },
        ],
      },
      {
        key: 'gpt-5.4-tiers',
        label: 'GPT-5.4 Priority/Flex',
        expr: 'len <= 272000 ? tier("standard", p * 2.5 + c * 15 + cr * 0.25) : tier("long_context", p * 5 + c * 22.5 + cr * 0.5)',
        requestRules: [
          {
            conditions: [
              {
                source: SOURCE_PARAM,
                path: 'service_tier',
                mode: MATCH_EQ,
                value: 'priority',
              },
            ],
            multiplier: '2',
          },
          {
            conditions: [
              {
                source: SOURCE_PARAM,
                path: 'service_tier',
                mode: MATCH_EQ,
                value: 'flex',
              },
            ],
            multiplier: '0.5',
          },
        ],
      },
    ],
  },
  {
    group: '时间促销',
    presets: [
      {
        key: 'night-discount',
        label: '夜间半价',
        expr: 'tier("base", p * 3 + c * 15)',
        requestRules: [
          {
            conditions: [
              {
                source: SOURCE_TIME,
                timeFunc: 'hour',
                timezone: 'Asia/Shanghai',
                mode: MATCH_RANGE,
                rangeStart: '21',
                rangeEnd: '6',
              },
            ],
            multiplier: '0.5',
          },
        ],
      },
      {
        key: 'weekend-discount',
        label: '周末8折',
        expr: 'tier("base", p * 3 + c * 15)',
        requestRules: [
          {
            conditions: [
              {
                source: SOURCE_TIME,
                timeFunc: 'weekday',
                timezone: 'Asia/Shanghai',
                mode: MATCH_EQ,
                value: '0',
              },
            ],
            multiplier: '0.8',
          },
          {
            conditions: [
              {
                source: SOURCE_TIME,
                timeFunc: 'weekday',
                timezone: 'Asia/Shanghai',
                mode: MATCH_EQ,
                value: '6',
              },
            ],
            multiplier: '0.8',
          },
        ],
      },
      {
        key: 'new-year-promo',
        label: '新年促销',
        expr: 'tier("base", p * 3 + c * 15)',
        requestRules: [
          {
            conditions: [
              {
                source: SOURCE_TIME,
                timeFunc: 'month',
                timezone: 'Asia/Shanghai',
                mode: MATCH_EQ,
                value: '1',
              },
              {
                source: SOURCE_TIME,
                timeFunc: 'day',
                timezone: 'Asia/Shanghai',
                mode: MATCH_EQ,
                value: '1',
              },
            ],
            multiplier: '0.5',
          },
        ],
      },
    ],
  },
];

const PRESET_DEFAULT_VISIBLE = 2;

function PresetSection({ applyPreset, t }) {
  const [expanded, setExpanded] = useState(false);
  const visibleGroups = expanded
    ? PRESET_GROUPS
    : PRESET_GROUPS.slice(0, PRESET_DEFAULT_VISIBLE);
  const hasMore = PRESET_GROUPS.length > PRESET_DEFAULT_VISIBLE;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <Text size='small' style={{ color: 'var(--semi-color-text-2)' }}>
          {t('预设模板')}
        </Text>
        {hasMore && (
          <Button
            theme='borderless'
            size='small'
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: '0 4px',
              fontSize: 12,
              color: 'var(--semi-color-primary)',
            }}
          >
            {expanded ? t('收起') : t('更多模板...')}
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visibleGroups.map((g) => (
          <div
            key={g.group}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <Tag
              size='small'
              color='grey'
              style={{ minWidth: 60, textAlign: 'center' }}
            >
              {t(g.group)}
            </Tag>
            {g.presets.map((p) => (
              <Button
                key={p.key}
                size='small'
                theme='light'
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RawExprEditor({ exprString, onChange, t }) {
  return (
    <div>
      <Banner
        type='info'
        description={
          <div>
            <div>
              {t('变量')}: <code>p</code> ({t('输入 Token')}), <code>c</code> (
              {t('输出 Token')}), <code>len</code> ({t('输入长度')}),{' '}
              <code>cr</code> ({t('缓存读取')}), <code>cc</code> (
              {t('缓存创建')}), <code>cc1h</code> ({t('缓存创建-1小时')})
            </div>
            <div>
              {t('函数')}: <code>tier(name, value)</code>,{' '}
              <code>max(a, b)</code>, <code>min(a, b)</code>,{' '}
              <code>ceil(x)</code>, <code>floor(x)</code>, <code>abs(x)</code>,{' '}
              <code>header(name)</code>, <code>param(path)</code>,{' '}
              <code>has(source, text)</code>
            </div>
          </div>
        }
        style={{ marginBottom: 12 }}
      />

      <TextArea
        value={exprString}
        onChange={onChange}
        autosize={{ minRows: 3, maxRows: 12 }}
        style={{ fontFamily: 'monospace', fontSize: 13 }}
        placeholder={t('输入计费表达式...')}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cache token inputs for estimator — auto-shown when expression uses cache vars
// ---------------------------------------------------------------------------

const EXTRA_ESTIMATOR_FIELDS = BILLING_EXTRA_VARS.map((v) => ({
  var: v.key,
  stateKey: v.field.replace('Price', 'Tokens'),
  labelKey: `${v.shortLabel} Token (${v.key})`,
}));

function CacheTokenEstimatorInputs({
  effectiveExpr,
  extraTokenValues,
  extraTokenSetters,
  t,
}) {
  const usesExtra = useMemo(() => {
    if (!effectiveExpr) return false;
    const varNames = EXTRA_ESTIMATOR_FIELDS.map((f) =>
      f.var.replace('_', '_'),
    ).join('|');
    return new RegExp(`\\b(${varNames})\\b`).test(effectiveExpr);
  }, [effectiveExpr]);

  if (!usesExtra) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 12,
      }}
    >
      {EXTRA_ESTIMATOR_FIELDS.map((cf) => (
        <div key={cf.var}>
          <Text size='small' className='mb-1' style={{ display: 'block' }}>
            {t(cf.labelKey)}
          </Text>
          <InputNumber
            value={extraTokenValues[cf.stateKey]}
            min={0}
            onChange={(val) => extraTokenSetters[cf.stateKey](val ?? 0)}
            style={{ width: '100%' }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost estimator (works with any Expr string)
// ---------------------------------------------------------------------------

function evalExprLocally(exprStr, p, c, extraTokenValues) {
  try {
    let matchedTier = '';
    const tierFn = (name, value) => {
      matchedTier = name;
      return value;
    };
    const cacheReadTokens = extraTokenValues.cacheReadTokens || 0;
    const cacheCreateTokens = extraTokenValues.cacheCreateTokens || 0;
    const cacheCreate1hTokens = extraTokenValues.cacheCreate1hTokens || 0;
    const len = p + cacheReadTokens + cacheCreateTokens + cacheCreate1hTokens;
    const env = {
      p,
      c,
      len,
      tier: tierFn,
      max: Math.max,
      min: Math.min,
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
    };
    for (const field of EXTRA_ESTIMATOR_FIELDS) {
      env[field.var] = extraTokenValues[field.stateKey] || 0;
    }
    const fn = new Function(
      ...Object.keys(env),
      `"use strict"; return (${exprStr});`,
    );
    return { cost: fn(...Object.values(env)), matchedTier, error: null };
  } catch (e) {
    return { cost: 0, matchedTier: '', error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Request condition rule row (moved from RequestMultiplierEditor)
// ---------------------------------------------------------------------------

const TIME_FUNC_LABELS = {
  hour: '小时',
  minute: '分钟',
  weekday: '星期',
  month: '月份',
  day: '日期',
};

const TIME_FUNC_HINTS = {
  hour: '0~23',
  minute: '0~59',
  weekday: '0=周日 1=周一 2=周二 3=周三 4=周四 5=周五 6=周六',
  month: '1=一月 ... 12=十二月',
  day: '1~31',
};

const TIME_FUNC_PLACEHOLDERS = {
  hour: '0-23',
  minute: '0-59',
  weekday: '0-6',
  month: '1-12',
  day: '1-31',
};

function RuleConditionRow({ cond, onChange, onRemove, t }) {
  const normalized = normalizeCondition(cond);
  const isTime = normalized.source === SOURCE_TIME;
  const matchOptions = getRequestRuleMatchOptions(normalized.source, t);

  const sourceSelect = (
    <Select
      size='small'
      value={normalized.source}
      onChange={(value) => {
        if (value === SOURCE_TIME) {
          onChange(
            normalizeCondition({
              source: SOURCE_TIME,
              timeFunc: 'hour',
              timezone: 'Asia/Shanghai',
              mode: MATCH_GTE,
            }),
          );
        } else {
          onChange(
            normalizeCondition({ source: value, path: '', mode: MATCH_EQ }),
          );
        }
      }}
      style={{ width: 110 }}
    >
      <Select.Option value={SOURCE_PARAM}>{t('请求参数')}</Select.Option>
      <Select.Option value={SOURCE_HEADER}>{t('请求头')}</Select.Option>
      <Select.Option value={SOURCE_TIME}>{t('时间条件')}</Select.Option>
    </Select>
  );

  const removeBtn = (
    <Button
      icon={<IconDelete />}
      type='danger'
      theme='borderless'
      size='small'
      onClick={onRemove}
    />
  );

  if (isTime) {
    const isRange = normalized.mode === MATCH_RANGE;
    const ph = TIME_FUNC_PLACEHOLDERS[normalized.timeFunc] || '';
    const hint = TIME_FUNC_HINTS[normalized.timeFunc] || '';
    return (
      <div
        style={{
          marginBottom: 8,
          padding: '8px 10px',
          borderRadius: 6,
          background: 'var(--semi-color-fill-0)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {sourceSelect}
          <Select
            size='small'
            value={normalized.timeFunc}
            onChange={(value) => onChange({ ...normalized, timeFunc: value })}
            style={{ flex: 1 }}
          >
            {TIME_FUNCS.map((fn) => (
              <Select.Option key={fn} value={fn}>
                {t(TIME_FUNC_LABELS[fn] || fn)}
              </Select.Option>
            ))}
          </Select>
          {removeBtn}
        </div>
        <Select
          size='small'
          value={normalized.timezone}
          onChange={(value) => onChange({ ...normalized, timezone: value })}
          filter
          allowCreate
          placeholder={t('时区')}
        >
          {COMMON_TIMEZONES.map((tz) => (
            <Select.Option key={tz.value} value={tz.value}>
              {tz.label}
            </Select.Option>
          ))}
        </Select>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Select
            size='small'
            value={normalized.mode}
            onChange={(value) =>
              onChange(normalizeCondition({ ...normalized, mode: value }))
            }
            style={{ flex: 1 }}
          >
            {matchOptions.map((item) => (
              <Select.Option key={item.value} value={item.value}>
                {item.label}
              </Select.Option>
            ))}
          </Select>
          {isRange ? (
            <div
              style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }}
            >
              <Input
                size='small'
                value={normalized.rangeStart}
                placeholder={ph}
                style={{ flex: 1 }}
                onChange={(value) =>
                  onChange({ ...normalized, rangeStart: value })
                }
              />
              <span>~</span>
              <Input
                size='small'
                value={normalized.rangeEnd}
                placeholder={ph}
                style={{ flex: 1 }}
                onChange={(value) =>
                  onChange({ ...normalized, rangeEnd: value })
                }
              />
            </div>
          ) : (
            <Input
              size='small'
              value={normalized.value}
              placeholder={ph}
              style={{ flex: 1 }}
              onChange={(value) => onChange({ ...normalized, value })}
            />
          )}
        </div>
        {hint && (
          <Text size='small' style={{ color: 'var(--semi-color-text-3)' }}>
            {t(hint)}
          </Text>
        )}
      </div>
    );
  }

  const showValue = normalized.mode !== MATCH_EXISTS;
  return (
    <div
      style={{
        marginBottom: 8,
        padding: '8px 10px',
        borderRadius: 6,
        background: 'var(--semi-color-fill-0)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr auto',
        gap: '6px 8px',
      }}
    >
      {sourceSelect}
      <Input
        size='small'
        value={normalized.path}
        placeholder={
          normalized.source === SOURCE_HEADER
            ? t('例如 anthropic-beta')
            : t('例如 service_tier')
        }
        onChange={(value) => onChange({ ...normalized, path: value })}
      />
      {removeBtn}
      <Select
        size='small'
        value={normalized.mode}
        onChange={(value) =>
          onChange(
            normalizeCondition({
              ...normalized,
              mode: value,
              value: value === MATCH_EXISTS ? '' : normalized.value,
            }),
          )
        }
      >
        {matchOptions.map((item) => (
          <Select.Option key={item.value} value={item.value}>
            {item.label}
          </Select.Option>
        ))}
      </Select>
      <Input
        size='small'
        value={normalized.value}
        placeholder={
          normalized.mode === MATCH_CONTAINS
            ? t('匹配内容')
            : normalized.mode === MATCH_EXISTS
              ? ''
              : t('匹配值')
        }
        disabled={!showValue}
        onChange={(value) => onChange({ ...normalized, value })}
      />
      <div />
    </div>
  );
}

function RuleGroupCard({ group, index, onChange, onRemove, t }) {
  const conditions = group.conditions || [];

  const updateCondition = (ci, newCond) => {
    const next = conditions.map((c, i) => (i === ci ? newCond : c));
    onChange({ ...group, conditions: next });
  };
  const removeCondition = (ci) => {
    const next = conditions.filter((_, i) => i !== ci);
    onChange({
      ...group,
      conditions: next.length > 0 ? next : [createEmptyCondition()],
    });
  };
  const addCondition = (cond) => {
    onChange({ ...group, conditions: [...conditions, cond] });
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid var(--semi-color-border)',
        background: 'var(--semi-color-bg-2)',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <Tag color='blue' size='small'>
          {t('第 {{n}} 组', { n: index + 1 })}
        </Tag>
        <Button
          icon={<IconDelete />}
          type='danger'
          theme='borderless'
          size='small'
          onClick={onRemove}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <Text
          size='small'
          style={{
            color: 'var(--semi-color-text-2)',
            display: 'block',
            marginBottom: 4,
          }}
        >
          {t('条件')}
          {conditions.length > 1 ? ` (${t('同时满足')})` : ''}
        </Text>
        {conditions.map((cond, ci) => (
          <RuleConditionRow
            key={ci}
            cond={cond}
            onChange={(nc) => updateCondition(ci, nc)}
            onRemove={() => removeCondition(ci)}
            t={t}
          />
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            icon={<IconPlus />}
            size='small'
            theme='borderless'
            onClick={() => addCondition(createEmptyCondition())}
          >
            {t('添加条件')}
          </Button>
          <Button
            icon={<IconPlus />}
            size='small'
            theme='borderless'
            onClick={() => addCondition(createEmptyTimeCondition())}
          >
            {t('添加时间条件')}
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text
          size='small'
          style={{ color: 'var(--semi-color-text-2)', whiteSpace: 'nowrap' }}
        >
          {t('倍率')}
        </Text>
        <Input
          size='small'
          value={group.multiplier || ''}
          placeholder={t('例如 0.5 或 2')}
          suffix='x'
          onChange={(value) => onChange({ ...group, multiplier: value })}
          style={{ width: 160 }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LLM prompt helper — copyable prompt for LLM-assisted expression design
// ---------------------------------------------------------------------------

const LLM_PROMPT_TEMPLATE = `你是一个 AI API 计费表达式设计助手。用户需要你帮忙设计一个计费表达式（billing expression），用于 AI API 网关的模型计费。

## 表达式语言

表达式基于 expr-lang/expr，支持标准算术运算和三元运算符。

### Token 变量

输入侧：
- p — 输入 token 数（计价用）。系统会自动排除表达式中单独计价的子类别（如用了 cr，缓存 token 就从 p 中扣除）
- len — 输入上下文总长度（条件判断用）。不受自动排除影响，始终反映完整输入长度。用于阶梯条件判断
- cr — 缓存命中（读取）token 数
- cc — 缓存创建 token 数（5分钟 TTL）
- cc1h — 缓存创建 token 数（1小时 TTL，Claude 专用）
- img — 图片输入 token 数
- ai — 音频输入 token 数

输出侧：
- c — 输出 token 数。同样会自动排除单独计价的子类别
- img_o — 图片输出 token 数
- ao — 音频输出 token 数

### p/c 自动排除机制

p 和 c 是兜底变量，代表所有没有被表达式单独定价的 token。如果表达式使用了某个子类别变量（如 cr），对应 token 就从 p 中扣除，避免重复计费。没用到的子类别 token 则留在 p/c 中按基础价格计费。

重要：len 不受自动排除影响。阶梯条件应使用 len 而非 p，以避免缓存命中导致 p 降低而误判档位。

### 内置函数

- tier(name, value) — 标记计费档位名称，必须包裹费用表达式
- max(a, b)、min(a, b) — 取大/小值
- ceil(x)、floor(x)、abs(x) — 向上取整、向下取整、绝对值
- header(name) — 读取请求头
- param(path) — 读取请求体 JSON 路径（gjson 语法）
- has(source, substr) — 子字符串检查
- hour(tz)、minute(tz)、weekday(tz)、month(tz)、day(tz) — 时间函数，tz 为时区如 "Asia/Shanghai"

### 价格系数

表达式中的数字系数是 $/1M tokens 的价格。例如 p * 2.5 表示输入 $2.50/1M tokens。

## 表达式示例

简单定价：
tier("base", p * 2.5 + c * 15)

带缓存的定价：
tier("base", p * 2.5 + c * 15 + cr * 0.25)

多档阶梯（用 len 做条件）：
len <= 200000
  ? tier("standard", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6)
  : tier("long_context", p * 6 + c * 22.5 + cr * 0.6 + cc * 7.5 + cc1h * 12)

图片模型：
tier("base", p * 2 + c * 8 + img * 2.5)

多模态含音频：
tier("base", p * 0.43 + c * 3.06 + img * 0.78 + ai * 3.81 + ao * 15.11)

三档阶梯示例：
len <= 128000
  ? tier("standard", p * 1.1 + c * 4.4)
  : (len <= 1000000
    ? tier("medium", p * 2.2 + c * 8.8)
    : tier("long", p * 4.4 + c * 17.6))

## 规则

1. 每个叶子分支必须用 tier("名称", 费用表达式) 包裹
2. tier 名称用英文，如 "base"、"standard"、"long_context"
3. 阶梯条件用 len（不要用 p），支持 <、<=、>、>=
4. 多档用嵌套三元运算符：条件1 ? tier(...) : (条件2 ? tier(...) : tier(...))
5. 价格系数直接写供应商官方 $/1M tokens 价格
6. 不需要缓存/图片/音频单独定价时可以不写对应变量，它们的 token 会自动包含在 p/c 中

请根据用户提供的模型信息和定价需求，生成计费表达式。`;

function LlmPromptHelper({ t, model }) {
  const [open, setOpen] = useState(false);

  const modelName = model?.name || '';
  const prompt = useMemo(() => {
    if (modelName) {
      return LLM_PROMPT_TEMPLATE + `\n\n当前模型：${modelName}`;
    }
    return LLM_PROMPT_TEMPLATE;
  }, [modelName]);

  const handleCopy = useCallback(async () => {
    const ok = await copy(prompt);
    if (ok) showSuccess(t('已复制到剪贴板'));
  }, [prompt, t]);

  return (
    <div style={{ marginBottom: 12 }}>
      <Button
        theme='borderless'
        size='small'
        icon={<IconCopy />}
        onClick={() => setOpen(!open)}
        style={{ color: 'var(--semi-color-tertiary)' }}
      >
        {t('LLM 辅助设计提示词')}
      </Button>
      <Collapsible isOpen={open}>
        <Card
          bodyStyle={{ padding: 12 }}
          style={{ marginTop: 8, background: 'var(--semi-color-fill-0)' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text size='small' type='secondary'>
              {t(
                '复制以下提示词发送给 LLM（如 ChatGPT / Claude），让它帮你设计计费表达式',
              )}
            </Text>
            <Button
              icon={<IconCopy />}
              size='small'
              theme='light'
              onClick={handleCopy}
            >
              {t('复制提示词')}
            </Button>
          </div>
          <TextArea
            value={prompt}
            readonly
            autosize={{ minRows: 6, maxRows: 20 }}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </Card>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TieredPricingEditor({
  model,
  onExprChange,
  requestRuleExpr,
  onRequestRuleExprChange,
  t,
}) {
  const currentExpr = model?.billingExpr || '';

  const [editorMode, setEditorMode] = useState('visual');
  const [visualConfig, setVisualConfig] = useState(null);
  const [rawExpr, setRawExpr] = useState('');
  const [promptTokens, setPromptTokens] = useState(200000);
  const [completionTokens, setCompletionTokens] = useState(10000);
  const [cacheReadTokens, setCacheReadTokens] = useState(0);
  const [cacheCreateTokens, setCacheCreateTokens] = useState(0);
  const [cacheCreate1hTokens, setCacheCreate1hTokens] = useState(0);
  const [imageTokens, setImageTokens] = useState(0);
  const [imageOutputTokens, setImageOutputTokens] = useState(0);
  const [audioInputTokens, setAudioInputTokens] = useState(0);
  const [audioOutputTokens, setAudioOutputTokens] = useState(0);

  const currentRequestRuleExpr = requestRuleExpr || '';
  const parsedRequestRuleGroups = useMemo(
    () => tryParseRequestRuleExpr(currentRequestRuleExpr),
    [currentRequestRuleExpr],
  );
  const canUseVisualRules = parsedRequestRuleGroups !== null;
  const [requestRuleGroups, setRequestRuleGroups] = useState(
    parsedRequestRuleGroups || [],
  );

  useEffect(() => {
    if (parsedRequestRuleGroups) {
      setRequestRuleGroups(parsedRequestRuleGroups);
    } else {
      setRequestRuleGroups([]);
    }
  }, [currentRequestRuleExpr, parsedRequestRuleGroups]);

  const handleRequestRuleGroupsChange = useCallback(
    (nextGroups) => {
      setRequestRuleGroups(nextGroups);
      onRequestRuleExprChange(buildRequestRuleExpr(nextGroups));
    },
    [onRequestRuleExprChange],
  );

  useEffect(() => {
    const parsed = tryParseVisualConfig(currentExpr);
    if (parsed) {
      setEditorMode('visual');
      setVisualConfig(parsed);
      setRawExpr(currentExpr);
    } else if (currentExpr) {
      setEditorMode('raw');
      setRawExpr(currentExpr);
      setVisualConfig(null);
    } else {
      setEditorMode('visual');
      setVisualConfig(createDefaultVisualConfig());
      setRawExpr('');
    }
  }, [model?.name]);

  const effectiveExpr = useMemo(() => {
    if (editorMode === 'visual') {
      return generateExprFromVisualConfig(visualConfig);
    }
    const { billingExpr } = splitBillingExprAndRequestRules(rawExpr);
    return billingExpr;
  }, [editorMode, visualConfig, rawExpr]);

  useEffect(() => {
    if (effectiveExpr !== currentExpr) {
      onExprChange(effectiveExpr);
    }
  }, [effectiveExpr]);

  const handleVisualChange = useCallback((newConfig) => {
    setVisualConfig(newConfig);
  }, []);

  const handleRawChange = useCallback(
    (val) => {
      setRawExpr(val);
      const { requestRuleExpr: ruleStr } = splitBillingExprAndRequestRules(val);
      onRequestRuleExprChange(ruleStr);
    },
    [onRequestRuleExprChange],
  );

  const handleModeSwitch = useCallback(
    (e) => {
      const newMode = e.target.value;
      if (newMode === 'visual') {
        const { billingExpr, requestRuleExpr: ruleStr } =
          splitBillingExprAndRequestRules(rawExpr);
        const parsed = tryParseVisualConfig(billingExpr);
        if (parsed) {
          setVisualConfig(parsed);
        } else {
          setVisualConfig(createDefaultVisualConfig());
        }
        const parsedGroups = tryParseRequestRuleExpr(ruleStr);
        setRequestRuleGroups(parsedGroups || []);
        onRequestRuleExprChange(ruleStr);
      } else {
        const expr = generateExprFromVisualConfig(visualConfig);
        const ruleExpr = buildRequestRuleExpr(requestRuleGroups);
        setRawExpr(combineBillingExpr(expr, ruleExpr) || expr);
      }
      setEditorMode(newMode);
    },
    [rawExpr, visualConfig, requestRuleGroups, onRequestRuleExprChange],
  );

  const applyPreset = useCallback(
    (preset) => {
      const presetGroups = preset.requestRules || [];
      const ruleExpr = buildRequestRuleExpr(presetGroups);
      const combined = combineBillingExpr(preset.expr, ruleExpr) || preset.expr;
      setRawExpr(combined);
      const parsed = tryParseVisualConfig(preset.expr);
      if (parsed) {
        setVisualConfig(parsed);
      } else {
        setEditorMode('raw');
        setVisualConfig(null);
      }
      setRequestRuleGroups(presetGroups);
      onRequestRuleExprChange(ruleExpr);
    },
    [onRequestRuleExprChange],
  );

  const extraTokenValues = {
    cacheReadTokens,
    cacheCreateTokens,
    cacheCreate1hTokens,
    imageTokens,
    imageOutputTokens,
    audioInputTokens,
    audioOutputTokens,
  };
  const extraTokenSetters = {
    cacheReadTokens: setCacheReadTokens,
    cacheCreateTokens: setCacheCreateTokens,
    cacheCreate1hTokens: setCacheCreate1hTokens,
    imageTokens: setImageTokens,
    imageOutputTokens: setImageOutputTokens,
    audioInputTokens: setAudioInputTokens,
    audioOutputTokens: setAudioOutputTokens,
  };

  const evalResult = useMemo(() => {
    const result = evalExprLocally(
      effectiveExpr,
      promptTokens,
      completionTokens,
      extraTokenValues,
    );
    if (!result.error) {
      result.cost =
        (result.cost / 1000000) *
        (parseFloat(localStorage.getItem('quota_per_unit')) || 500000);
    }
    return result;
  }, [
    effectiveExpr,
    promptTokens,
    completionTokens,
    cacheReadTokens,
    cacheCreateTokens,
    cacheCreate1hTokens,
    imageTokens,
    imageOutputTokens,
    audioInputTokens,
    audioOutputTokens,
  ]);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <RadioGroup
          type='button'
          size='small'
          value={editorMode}
          onChange={handleModeSwitch}
        >
          <Radio value='visual'>{t('可视化编辑')}</Radio>
          <Radio value='raw'>{t('表达式编辑')}</Radio>
        </RadioGroup>
      </div>

      <PresetSection applyPreset={applyPreset} t={t} />

      <Card
        bodyStyle={{ padding: 16 }}
        style={{ marginBottom: 12, background: 'var(--semi-color-fill-0)' }}
      >
        {editorMode === 'visual' ? (
          <VisualEditor
            visualConfig={visualConfig}
            onChange={handleVisualChange}
            t={t}
          />
        ) : (
          <RawExprEditor
            exprString={rawExpr}
            onChange={handleRawChange}
            t={t}
          />
        )}

        {editorMode === 'visual' && (
          <>
            <div
              style={{
                borderTop: '1px solid var(--semi-color-border)',
                margin: '16px 0',
              }}
            />

            <div className='font-medium mb-2'>{t('请求条件调价')}</div>
            <div style={{ marginBottom: 12 }}>
              <Text type='secondary' size='small'>
                {t(
                  '满足条件时，整单价格乘以 X；如果有多条同时命中，会继续相乘。',
                )}
              </Text>
              <div style={{ marginTop: 2 }}>
                <Text type='secondary' size='small'>
                  {t(
                    'X 也可以小于 1，当折扣用。想做"只给输出加价"或"额外加固定费用"，请直接写完整计费公式。',
                  )}
                </Text>
              </div>
            </div>

            {currentRequestRuleExpr && !canUseVisualRules ? (
              <Banner
                type='warning'
                bordered
                fullMode={false}
                closeIcon={null}
                style={{ marginBottom: 12 }}
                title={t(
                  '这个公式比较复杂，下面的简化表单没法完整还原，请在表达式编辑模式下修改。',
                )}
              />
            ) : (
              <>
                {requestRuleGroups.map((group, gi) => (
                  <RuleGroupCard
                    key={`rule-group-${gi}`}
                    group={group}
                    index={gi}
                    t={t}
                    onChange={(nextGroup) => {
                      const next = [...requestRuleGroups];
                      next[gi] = nextGroup;
                      handleRequestRuleGroupsChange(next);
                    }}
                    onRemove={() => {
                      handleRequestRuleGroupsChange(
                        requestRuleGroups.filter((_, i) => i !== gi),
                      );
                    }}
                  />
                ))}
                <Button
                  icon={<IconPlus />}
                  size='small'
                  theme='light'
                  onClick={() =>
                    handleRequestRuleGroupsChange([
                      ...requestRuleGroups,
                      createEmptyRuleGroup(),
                    ])
                  }
                  style={{ marginTop: 4 }}
                >
                  {t('添加条件组')}
                </Button>
              </>
            )}
          </>
        )}
      </Card>

      <Card
        bodyStyle={{ padding: 16 }}
        style={{ marginBottom: 12, background: 'var(--semi-color-fill-0)' }}
      >
        <div className='font-medium mb-2'>{t('Token 估算器')}</div>
        <div className='text-xs text-gray-500 mb-3'>
          {t('输入 Token 数量，查看按当前配置的预计费用（不含分组倍率）。')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <Text size='small' className='mb-1' style={{ display: 'block' }}>
              {t('输入 Token 数')} (p)
            </Text>
            <InputNumber
              value={promptTokens}
              min={0}
              onChange={(val) => setPromptTokens(val ?? 0)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <Text size='small' className='mb-1' style={{ display: 'block' }}>
              {t('输出 Token 数')} (c)
            </Text>
            <InputNumber
              value={completionTokens}
              min={0}
              onChange={(val) => setCompletionTokens(val ?? 0)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        {/* Cache token inputs — shown when expression uses cache variables */}
        <CacheTokenEstimatorInputs
          effectiveExpr={effectiveExpr}
          extraTokenValues={extraTokenValues}
          extraTokenSetters={extraTokenSetters}
          t={t}
        />
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: evalResult.error
              ? 'var(--semi-color-danger-light-default)'
              : 'var(--semi-color-primary-light-default)',
            border: `1px solid ${evalResult.error ? 'var(--semi-color-danger)' : 'var(--semi-color-primary)'}`,
          }}
        >
          {evalResult.error ? (
            <Text type='danger'>
              {t('表达式错误')}: {evalResult.error}
            </Text>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong style={{ fontSize: 15 }}>
                  {t('预计费用')}：{renderQuota(evalResult.cost, 4)}
                </Text>
                {evalResult.matchedTier && (
                  <Tag size='small' color='blue' type='light'>
                    {t('命中档位')}：{evalResult.matchedTier}
                  </Tag>
                )}
              </div>
              <Text
                size='small'
                style={{
                  display: 'block',
                  marginTop: 2,
                  color: 'var(--semi-color-text-3)',
                }}
              >
                {t('原始额度')}：{evalResult.cost.toLocaleString()}
              </Text>
            </div>
          )}
        </div>
      </Card>

      <LlmPromptHelper t={t} model={model} />
    </div>
  );
}
