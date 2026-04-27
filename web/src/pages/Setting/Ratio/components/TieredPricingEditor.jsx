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
import { Button, Input, TextArea } from '@heroui/react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';
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

// `BILLING_CONDITION_VARS` is re-exported from constants but the visual
// editor only reads it indirectly via the `len`/`p`/`c` allow-list below.
// Reference it once so eslint doesn't flag the import as unused.
void BILLING_CONDITION_VARS;
void createEmptyTimeRuleGroup;

const PRICE_SUFFIX = '$/1M tokens';

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';
const inputClassSm =
  'h-8 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';

// Mirror the InfoBanner pattern in ModelPricingEditor so the two ratio-tab
// editors share the same v3-aligned palette without re-pulling the v2
// Semi `<Banner>` shim.
function InfoBanner({ tone = 'primary', children, className = '' }) {
  const tonePalette =
    tone === 'warning'
      ? { bg: 'border-warning/30 bg-warning/5', icon: 'text-warning' }
      : { bg: 'border-primary/20 bg-primary/5', icon: 'text-primary' };
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <div
      className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm text-foreground ${tonePalette.bg} ${className}`}
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${tonePalette.icon}`} />
      <div className='flex-1'>{children}</div>
    </div>
  );
}

const TONE_CLASSES = {
  blue: 'bg-primary/15 text-primary',
  grey: 'bg-surface-secondary text-muted',
  orange: 'bg-warning/15 text-warning',
};

function ToneChip({ tone = 'grey', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        TONE_CLASSES[tone] || TONE_CLASSES.grey
      } ${className}`}
    >
      {children}
    </span>
  );
}

// Pill segmented toggle that replaces v2 `<RadioGroup type='button'>`.
// v3 RadioGroup has no equivalent compound; the v2 prop was a silent
// no-op (would render plain radio buttons), so we render a row of
// outline / primary buttons instead.
function SegmentedToggle({ value, onChange, options, size = 'sm' }) {
  return (
    <div className='inline-flex overflow-hidden rounded-xl border border-border'>
      {options.map((opt, i) => (
        <Button
          key={opt.value}
          size={size}
          variant={value === opt.value ? 'primary' : 'outline'}
          className={`rounded-none border-0 ${
            i > 0 ? 'border-l border-border' : ''
          }`}
          onPress={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Logic helpers (unchanged from the previous Semi-style implementation)
// ---------------------------------------------------------------------------

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
// Atomic UI primitives — replace the v2 Semi {Input, InputNumber, Select}
// with native HTML controls styled to match the rest of /console.
// ---------------------------------------------------------------------------

const NumberInput = ({
  value,
  min,
  max,
  step,
  onChange,
  className = '',
  placeholder,
  disabled,
}) => (
  <input
    type='number'
    value={value === '' || value == null ? '' : value}
    min={min}
    max={max}
    step={step}
    placeholder={placeholder}
    disabled={disabled}
    onChange={(event) => {
      const v = event.target.value;
      onChange(v === '' ? '' : Number(v));
    }}
    className={`${inputClassSm} ${className}`}
  />
);

const NativeSelect = ({
  value,
  onChange,
  options,
  className = '',
  placeholder,
  ...rest
}) => (
  <select
    value={value ?? ''}
    onChange={(event) => onChange(event.target.value)}
    className={`${inputClassSm} ${className}`}
    {...rest}
  >
    {placeholder ? (
      <option value='' disabled>
        {placeholder}
      </option>
    ) : null}
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

// ---------------------------------------------------------------------------
// Condition row (visual tier conditions on len / p / c)
// ---------------------------------------------------------------------------

function ConditionRow({ cond, onChange, onRemove }) {
  const hint = formatTokenHint(cond.value);
  return (
    <div className='mb-1.5 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-x-1.5 gap-y-1'>
      <NativeSelect
        value={cond.var || 'len'}
        onChange={(val) => onChange({ ...cond, var: val })}
        options={VAR_OPTIONS}
      />
      <NativeSelect
        value={cond.op || '<'}
        onChange={(val) => onChange({ ...cond, op: val })}
        options={OPS.map((op) => ({ value: op, label: op }))}
        className='w-[70px]'
      />
      <NumberInput
        min={0}
        value={cond.value ?? ''}
        onChange={(val) => onChange({ ...cond, value: val })}
      />
      <Button
        isIconOnly
        size='sm'
        variant='ghost'
        className='text-danger hover:bg-danger/10'
        aria-label='delete'
        onPress={onRemove}
      >
        <Trash2 size={14} />
      </Button>
      {hint ? (
        <span className='col-start-3 text-xs text-muted'>= {hint}</span>
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

  // Re-sync only when the upstream model value diverges from the input — we
  // intentionally let the user keep typing intermediate states like "7." or
  // ".5" without snapping back. eslint is happy if we silence the missing
  // `text` dep here because reading it would re-introduce the snap-back bug.
  useEffect(() => {
    const current = Number(text);
    if (text === '' && priceFromModel === 0) return;
    if (!Number.isNaN(current) && current === priceFromModel) return;
    setText(priceFromModel === 0 ? '' : String(priceFromModel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className='relative mt-0.5'>
      <input
        type='text'
        value={text}
        placeholder={placeholder || '0'}
        onChange={(event) => handleChange(event.target.value)}
        className={`${inputClass} pr-24`}
      />
      <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted'>
        {PRICE_SUFFIX}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Extended price block (cache fields) — collapsible per tier, with mode switch
// ---------------------------------------------------------------------------

const CACHE_FIELDS_TIMED = [
  { field: 'cache_read_unit_cost', labelKey: '缓存读取价格' },
  { field: 'cache_create_unit_cost', labelKey: '缓存创建价格(5分钟)' },
  { field: 'cache_create_1h_unit_cost', labelKey: '缓存创建价格(1小时)' },
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

  const handleCacheModeChange = (mode) => {
    const patch = { cache_mode: mode };
    if (mode === CACHE_MODE_GENERIC) {
      patch.cache_create_1h_unit_cost = 0;
    }
    onUpdate(index, patch);
  };

  const activeFields =
    cacheMode === CACHE_MODE_TIMED ? CACHE_FIELDS_TIMED : CACHE_FIELDS_GENERIC;

  return (
    <div className='mt-2'>
      <Button
        size='sm'
        variant='ghost'
        className='-ml-1 h-auto px-1 py-0.5 text-xs text-muted'
        onPress={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={12} />
        ) : (
          <ChevronRight size={12} />
        )}
        {t('扩展价格')}
      </Button>
      {expanded ? (
        <div className='mt-1 py-2'>
          <div className='mb-2 text-xs text-muted'>
            {t('这些价格都是可选项，不填也可以。')}
          </div>
          <div className='mb-2'>
            <SegmentedToggle
              value={cacheMode}
              onChange={handleCacheModeChange}
              options={[
                { value: CACHE_MODE_GENERIC, label: t('通用缓存') },
                { value: CACHE_MODE_TIMED, label: t('分时缓存 (Claude)') },
              ]}
            />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            {activeFields.map((cf) => (
              <div key={cf.field}>
                <div className='text-xs text-muted'>{t(cf.labelKey)}</div>
                <PriceInput
                  unitCost={tier[cf.field]}
                  field={cf.field}
                  index={index}
                  onUpdate={onUpdate}
                />
              </div>
            ))}
          </div>
          <div className='mt-3 mb-2 text-xs text-muted'>
            {t('图片/音频价格（可选）')}
          </div>
          <div className='grid grid-cols-2 gap-2'>
            {mediaFields
              .map((v) => ({ field: v.tierField, labelKey: v.label }))
              .map((cf) => (
                <div key={cf.field}>
                  <div className='text-xs text-muted'>{t(cf.labelKey)}</div>
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
      ) : null}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className='mb-2 rounded-lg border border-border bg-surface-secondary/40 p-4'>
      <div className='mb-2.5 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <ToneChip tone='blue'>
            {t('第 {{n}} 档', { n: index + 1 })}
          </ToneChip>
          {isLast && !isOnly ? <ToneChip tone='grey'>{t('兜底档')}</ToneChip> : null}
        </div>
        {!isOnly ? (
          <Button
            isIconOnly
            size='sm'
            variant='ghost'
            className='text-danger hover:bg-danger/10'
            aria-label={t('删除')}
            onPress={() => onRemove(index)}
          >
            <Trash2 size={14} />
          </Button>
        ) : null}
      </div>

      {/* Tier label */}
      <div className='mb-2'>
        <div className='text-xs text-muted'>{t('档位名称')}</div>
        <input
          type='text'
          value={tier.label || ''}
          placeholder={t('第 {{n}} 档', { n: index + 1 })}
          onChange={(event) => onUpdate(index, 'label', event.target.value)}
          className={`${inputClassSm} mt-0.5`}
        />
      </div>

      {/* Conditions */}
      {!isLast || isOnly ? (
        <div className='mb-2.5'>
          <div className='mb-1 block text-xs text-muted'>{t('条件')}</div>
          {conditions.map((cond, ci) => (
            <ConditionRow
              key={ci}
              cond={cond}
              onChange={(nc) => updateCondition(ci, nc)}
              onRemove={() => removeCondition(ci)}
            />
          ))}
          {conditions.length < 2 && (
            <Button
              size='sm'
              variant='ghost'
              className='mt-0.5 px-1'
              onPress={addCondition}
            >
              <Plus size={12} />
              {t('添加条件')}
            </Button>
          )}
        </div>
      ) : (
        <div className='mb-2.5 rounded bg-surface-secondary px-2 py-1'>
          <span className='text-xs text-muted'>{condSummary}</span>
        </div>
      )}

      {/* Prices */}
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <div className='text-xs text-muted'>{t('输入价格')}</div>
          <PriceInput
            unitCost={tier.input_unit_cost}
            field='input_unit_cost'
            index={index}
            onUpdate={onUpdate}
          />
        </div>
        <div>
          <div className='text-xs text-muted'>{t('输出价格')}</div>
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
    const patch =
      typeof field === 'string' ? { [field]: value } : { ...field };
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
      <InfoBanner>
        {t(
          '每个档位可设置 0~2 个条件（对 len、p 和 c），最后一档为兜底档无需条件。len 为输入上下文总长度（含缓存），推荐用于阶梯条件。',
        )}
      </InfoBanner>

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
        size='sm'
        variant='secondary'
        className='mt-1'
        onPress={addTier}
      >
        <Plus size={14} />
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
        expr:
          'len <= 272000 ? tier("standard", p * 2.5 + c * 15 + cr * 0.25) : tier("long_context", p * 5 + c * 22.5 + cr * 0.5)',
      },
    ],
  },
  {
    group: '阶梯计费',
    presets: [
      {
        key: 'claude-sonnet',
        label: 'Claude Sonnet 4.5',
        expr:
          'len <= 200000 ? tier("standard", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6) : tier("long_context", p * 6 + c * 22.5 + cr * 0.6 + cc * 7.5 + cc1h * 12)',
      },
      {
        key: 'qwen3-max',
        label: 'Qwen3 Max',
        expr:
          'len <= 32000 ? tier("short", p * 1.2 + c * 6 + cr * 0.24 + cc * 1.5) : len <= 128000 ? tier("mid", p * 2.4 + c * 12 + cr * 0.48 + cc * 3) : tier("long", p * 3 + c * 15 + cr * 0.6 + cc * 3.75)',
      },
      {
        key: 'glm-4.5-air',
        label: 'GLM-4.5 Air',
        expr:
          'len < 32000 && c < 200 ? tier("short_output", p * 0.8 + c * 2 + cr * 0.16) : len < 32000 && c >= 200 ? tier("long_output", p * 0.8 + c * 6 + cr * 0.16) : tier("mid_context", p * 1.2 + c * 8 + cr * 0.24)',
      },
      {
        key: 'doubao-seed-1.8',
        label: 'Doubao Seed 1.8',
        expr:
          'len <= 32000 && c <= 200 ? tier("discount", p * 0.8 + c * 2 + cr * 0.16 + cc * 0.17) : len <= 32000 ? tier("short", p * 0.8 + c * 8 + cr * 0.16 + cc * 0.17) : len <= 128000 ? tier("mid", p * 1.2 + c * 16 + cr * 0.16 + cc * 0.17) : tier("long", p * 2.4 + c * 24 + cr * 0.16 + cc * 0.17)',
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
        expr:
          'tier("base", p * 0.43 + c * 3.06 + img * 0.78 + ai * 3.81 + ao * 15.11)',
      },
    ],
  },
  {
    group: '请求条件',
    presets: [
      {
        key: 'claude-opus-fast',
        label: 'Claude Opus 4.6 Fast',
        expr:
          'tier("base", p * 5 + c * 25 + cr * 0.5 + cc * 6.25 + cc1h * 10)',
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
        expr:
          'len <= 272000 ? tier("standard", p * 2.5 + c * 15 + cr * 0.25) : tier("long_context", p * 5 + c * 22.5 + cr * 0.5)',
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
    <div className='mb-3'>
      <div className='mb-1.5 flex items-center gap-2'>
        <span className='text-xs text-muted'>{t('预设模板')}</span>
        {hasMore && (
          <Button
            size='sm'
            variant='ghost'
            className='h-auto px-1 py-0 text-xs text-primary'
            onPress={() => setExpanded(!expanded)}
          >
            {expanded ? t('收起') : t('更多模板...')}
          </Button>
        )}
      </div>
      <div className='flex flex-col gap-1'>
        {visibleGroups.map((g) => (
          <div
            key={g.group}
            className='flex flex-wrap items-center gap-1.5'
          >
            <ToneChip tone='grey' className='min-w-[60px] justify-center'>
              {t(g.group)}
            </ToneChip>
            {g.presets.map((p) => (
              <Button
                key={p.key}
                size='sm'
                variant='secondary'
                onPress={() => applyPreset(p)}
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
      <InfoBanner>
        <div>
          {t('变量')}: <code>p</code> ({t('输入 Token')}), <code>c</code> (
          {t('输出 Token')}), <code>len</code> ({t('输入长度')}),{' '}
          <code>cr</code> ({t('缓存读取')}), <code>cc</code> ({t('缓存创建')}),{' '}
          <code>cc1h</code> ({t('缓存创建-1小时')})
        </div>
        <div>
          {t('函数')}: <code>tier(name, value)</code>, <code>max(a, b)</code>,{' '}
          <code>min(a, b)</code>, <code>ceil(x)</code>, <code>floor(x)</code>,{' '}
          <code>abs(x)</code>, <code>header(name)</code>,{' '}
          <code>param(path)</code>, <code>has(source, text)</code>
        </div>
      </InfoBanner>
      <TextArea
        value={exprString}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        className='font-mono text-xs'
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
    const varNames = EXTRA_ESTIMATOR_FIELDS.map((f) => f.var).join('|');
    return new RegExp(`\\b(${varNames})\\b`).test(effectiveExpr);
  }, [effectiveExpr]);

  if (!usesExtra) return null;

  return (
    <div className='mb-3 grid grid-cols-2 gap-3'>
      {EXTRA_ESTIMATOR_FIELDS.map((cf) => (
        <div key={cf.var}>
          <div className='mb-1 block text-xs text-muted'>{t(cf.labelKey)}</div>
          <NumberInput
            value={extraTokenValues[cf.stateKey]}
            min={0}
            onChange={(val) =>
              extraTokenSetters[cf.stateKey](Number(val) || 0)
            }
            className={inputClass}
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
    const len =
      p + cacheReadTokens + cacheCreateTokens + cacheCreate1hTokens;
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
    // eslint-disable-next-line no-new-func
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

const TIMEZONE_DATALIST_ID = 'tiered-pricing-tz-list';

function RuleConditionRow({ cond, onChange, onRemove, t }) {
  const normalized = normalizeCondition(cond);
  const isTime = normalized.source === SOURCE_TIME;
  const matchOptions = getRequestRuleMatchOptions(normalized.source, t);

  const sourceSelect = (
    <NativeSelect
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
          onChange(normalizeCondition({ source: value, path: '', mode: MATCH_EQ }));
        }
      }}
      options={[
        { value: SOURCE_PARAM, label: t('请求参数') },
        { value: SOURCE_HEADER, label: t('请求头') },
        { value: SOURCE_TIME, label: t('时间条件') },
      ]}
      className='w-[110px]'
    />
  );

  const removeBtn = (
    <Button
      isIconOnly
      size='sm'
      variant='ghost'
      className='text-danger hover:bg-danger/10'
      aria-label='delete'
      onPress={onRemove}
    >
      <Trash2 size={14} />
    </Button>
  );

  if (isTime) {
    const isRange = normalized.mode === MATCH_RANGE;
    const ph = TIME_FUNC_PLACEHOLDERS[normalized.timeFunc] || '';
    const hint = TIME_FUNC_HINTS[normalized.timeFunc] || '';
    return (
      <div className='mb-2 flex flex-col gap-1.5 rounded-md bg-surface-secondary px-2.5 py-2'>
        <div className='flex items-center gap-1.5'>
          {sourceSelect}
          <NativeSelect
            value={normalized.timeFunc}
            onChange={(value) => onChange({ ...normalized, timeFunc: value })}
            options={TIME_FUNCS.map((fn) => ({
              value: fn,
              label: t(TIME_FUNC_LABELS[fn] || fn),
            }))}
            className='flex-1'
          />
          {removeBtn}
        </div>
        {/*
          v2 used Semi <Select filter allowCreate /> for the timezone — v3
          has no equivalent compound, so we use an HTML5 <input list> +
          <datalist> for the same suggest-but-allow-free-input UX.
        */}
        <input
          type='text'
          list={TIMEZONE_DATALIST_ID}
          value={normalized.timezone || ''}
          onChange={(event) =>
            onChange({ ...normalized, timezone: event.target.value })
          }
          placeholder={t('时区')}
          className={inputClassSm}
        />
        <div className='flex items-center gap-1.5'>
          <NativeSelect
            value={normalized.mode}
            onChange={(value) =>
              onChange(normalizeCondition({ ...normalized, mode: value }))
            }
            options={matchOptions.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            className='flex-1'
          />
          {isRange ? (
            <div className='flex flex-1 items-center gap-1'>
              <input
                type='text'
                value={normalized.rangeStart || ''}
                placeholder={ph}
                onChange={(event) =>
                  onChange({ ...normalized, rangeStart: event.target.value })
                }
                className={`${inputClassSm} flex-1`}
              />
              <span>~</span>
              <input
                type='text'
                value={normalized.rangeEnd || ''}
                placeholder={ph}
                onChange={(event) =>
                  onChange({ ...normalized, rangeEnd: event.target.value })
                }
                className={`${inputClassSm} flex-1`}
              />
            </div>
          ) : (
            <input
              type='text'
              value={normalized.value || ''}
              placeholder={ph}
              onChange={(event) =>
                onChange({ ...normalized, value: event.target.value })
              }
              className={`${inputClassSm} flex-1`}
            />
          )}
        </div>
        {hint && <span className='text-xs text-muted'>{t(hint)}</span>}
      </div>
    );
  }

  const showValue = normalized.mode !== MATCH_EXISTS;
  return (
    <div className='mb-2 grid grid-cols-[1fr_1fr_auto] gap-x-2 gap-y-1.5 rounded-md bg-surface-secondary px-2.5 py-2'>
      {sourceSelect}
      <input
        type='text'
        value={normalized.path || ''}
        placeholder={
          normalized.source === SOURCE_HEADER
            ? t('例如 anthropic-beta')
            : t('例如 service_tier')
        }
        onChange={(event) =>
          onChange({ ...normalized, path: event.target.value })
        }
        className={inputClassSm}
      />
      {removeBtn}
      <NativeSelect
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
        options={matchOptions.map((item) => ({
          value: item.value,
          label: item.label,
        }))}
      />
      <input
        type='text'
        value={normalized.value || ''}
        placeholder={
          normalized.mode === MATCH_CONTAINS
            ? t('匹配内容')
            : normalized.mode === MATCH_EXISTS
              ? ''
              : t('匹配值')
        }
        disabled={!showValue}
        onChange={(event) =>
          onChange({ ...normalized, value: event.target.value })
        }
        className={inputClassSm}
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
    <div className='mb-2 rounded-lg border border-border bg-surface-secondary/40 p-4'>
      <div className='mb-2.5 flex items-center justify-between'>
        <ToneChip tone='blue'>{t('第 {{n}} 组', { n: index + 1 })}</ToneChip>
        <Button
          isIconOnly
          size='sm'
          variant='ghost'
          className='text-danger hover:bg-danger/10'
          aria-label={t('删除')}
          onPress={onRemove}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      <div className='mb-2'>
        <div className='mb-1 block text-xs text-muted'>
          {t('条件')}
          {conditions.length > 1 ? ` (${t('同时满足')})` : ''}
        </div>
        {conditions.map((cond, ci) => (
          <RuleConditionRow
            key={ci}
            cond={cond}
            onChange={(nc) => updateCondition(ci, nc)}
            onRemove={() => removeCondition(ci)}
            t={t}
          />
        ))}
        <div className='flex gap-1.5'>
          <Button
            size='sm'
            variant='ghost'
            onPress={() => addCondition(createEmptyCondition())}
          >
            <Plus size={12} />
            {t('添加条件')}
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onPress={() => addCondition(createEmptyTimeCondition())}
          >
            <Plus size={12} />
            {t('添加时间条件')}
          </Button>
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <span className='whitespace-nowrap text-xs text-muted'>
          {t('倍率')}
        </span>
        <div className='relative w-40'>
          <input
            type='text'
            value={group.multiplier || ''}
            placeholder={t('例如 0.5 或 2')}
            onChange={(event) =>
              onChange({ ...group, multiplier: event.target.value })
            }
            className={`${inputClassSm} pr-6`}
          />
          <span className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted'>
            x
          </span>
        </div>
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
    <div className='mb-3'>
      <Button
        size='sm'
        variant='ghost'
        className='text-muted'
        onPress={() => setOpen(!open)}
      >
        <Copy size={12} />
        {t('LLM 辅助设计提示词')}
      </Button>
      {open ? (
        <div className='mt-2 rounded-xl bg-surface-secondary/50 p-3'>
          <div className='mb-2 flex items-center justify-between'>
            <span className='text-xs text-muted'>
              {t(
                '复制以下提示词发送给 LLM（如 ChatGPT / Claude），让它帮你设计计费表达式',
              )}
            </span>
            <Button size='sm' variant='secondary' onPress={handleCopy}>
              <Copy size={14} />
              {t('复制提示词')}
            </Button>
          </div>
          <TextArea
            value={prompt}
            readOnly
            rows={10}
            className='font-mono text-xs'
          />
        </div>
      ) : null}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    (newMode) => {
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
      const combined =
        combineBillingExpr(preset.expr, ruleExpr) || preset.expr;
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

  const evalResult = useMemo(
    () => {
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
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
    ],
  );

  return (
    <div>
      {/* Shared timezone autocomplete options for any RuleConditionRow on
          this editor instance. Avoids re-emitting the <option> list for
          every row. */}
      <datalist id={TIMEZONE_DATALIST_ID}>
        {COMMON_TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </datalist>

      <div className='mb-3'>
        <SegmentedToggle
          value={editorMode}
          onChange={handleModeSwitch}
          options={[
            { value: 'visual', label: t('可视化编辑') },
            { value: 'raw', label: t('表达式编辑') },
          ]}
        />
      </div>

      <PresetSection applyPreset={applyPreset} t={t} />

      <div className='mb-3 rounded-xl bg-surface-secondary/50 p-4'>
        {editorMode === 'visual' ? (
          <VisualEditor
            visualConfig={visualConfig}
            onChange={handleVisualChange}
            t={t}
          />
        ) : (
          <RawExprEditor exprString={rawExpr} onChange={handleRawChange} t={t} />
        )}

        {editorMode === 'visual' && (
          <>
            <div className='my-4 border-t border-border' />

            <div className='mb-2 font-medium'>{t('请求条件调价')}</div>
            <div className='mb-3'>
              <span className='text-xs text-muted'>
                {t(
                  '满足条件时，整单价格乘以 X；如果有多条同时命中，会继续相乘。',
                )}
              </span>
              <div className='mt-0.5'>
                <span className='text-xs text-muted'>
                  {t(
                    'X 也可以小于 1，当折扣用。想做"只给输出加价"或"额外加固定费用"，请直接写完整计费公式。',
                  )}
                </span>
              </div>
            </div>

            {currentRequestRuleExpr && !canUseVisualRules ? (
              <InfoBanner tone='warning'>
                <div className='font-medium'>
                  {t(
                    '这个公式比较复杂，下面的简化表单没法完整还原，请在表达式编辑模式下修改。',
                  )}
                </div>
              </InfoBanner>
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
                  size='sm'
                  variant='secondary'
                  className='mt-1'
                  onPress={() =>
                    handleRequestRuleGroupsChange([
                      ...requestRuleGroups,
                      createEmptyRuleGroup(),
                    ])
                  }
                >
                  <Plus size={14} />
                  {t('添加条件组')}
                </Button>
              </>
            )}
          </>
        )}
      </div>

      <div className='mb-3 rounded-xl bg-surface-secondary/50 p-4'>
        <div className='mb-2 font-medium'>{t('Token 估算器')}</div>
        <div className='mb-3 text-xs text-muted'>
          {t('输入 Token 数量，查看按当前配置的预计费用（不含分组倍率）。')}
        </div>
        <div className='mb-3 grid grid-cols-2 gap-3'>
          <div>
            <div className='mb-1 block text-xs text-muted'>
              {t('输入 Token 数')} (p)
            </div>
            <NumberInput
              value={promptTokens}
              min={0}
              onChange={(val) => setPromptTokens(Number(val) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <div className='mb-1 block text-xs text-muted'>
              {t('输出 Token 数')} (c)
            </div>
            <NumberInput
              value={completionTokens}
              min={0}
              onChange={(val) => setCompletionTokens(Number(val) || 0)}
              className={inputClass}
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
          className={`rounded-lg border px-3.5 py-2.5 ${
            evalResult.error
              ? 'border-danger bg-danger/10'
              : 'border-primary bg-primary/10'
          }`}
        >
          {evalResult.error ? (
            <div className='text-danger'>
              {t('表达式错误')}: {evalResult.error}
            </div>
          ) : (
            <div>
              <div className='flex items-center gap-2'>
                <span className='text-[15px] font-semibold text-foreground'>
                  {t('预计费用')}：{renderQuota(evalResult.cost, 4)}
                </span>
                {evalResult.matchedTier && (
                  <ToneChip tone='blue'>
                    {t('命中档位')}：{evalResult.matchedTier}
                  </ToneChip>
                )}
              </div>
              <div className='mt-0.5 block text-xs text-muted'>
                {t('原始额度')}：{evalResult.cost.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>

      <LlmPromptHelper t={t} model={model} />
    </div>
  );
}
