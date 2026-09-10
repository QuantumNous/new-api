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
import { Copy, Plus, Trash2 } from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  formatPricingAmount,
  USD_PRICING_CURRENCY,
  type PricingCurrency,
} from '@/features/model-pricing/currency'
import { useBillingTime } from '@/features/pricing/hooks/use-billing-time'
import {
  BILLING_EXTRA_VARS,
  MATCH_CONTAINS,
  MATCH_EQ,
  MATCH_EXISTS,
  MATCH_GT,
  MATCH_GTE,
  MATCH_LT,
  MATCH_LTE,
  MATCH_RANGE,
  SOURCE_HEADER,
  SOURCE_PARAM,
  SOURCE_TIME,
  buildRequestRuleExpr,
  combineBillingExpr,
  createEmptyCondition,
  createEmptyRuleGroup,
  createEmptyTimeCondition,
  getRequestRuleMatchOptions,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  type ParamHeaderCondition,
  type RequestCondition,
  type RequestRuleGroup,
  type TimeCondition,
  type TimeFunc,
} from '@/features/pricing/lib/billing-expr'
import { compileBillingExpression } from '@/features/pricing/lib/billing-expression/parser'
import {
  parseVisualBillingDocument,
  serializeVisualBillingDocument,
  type VisualBillingDocument,
} from '@/features/pricing/lib/billing-expression/visual'
import {
  CACHE_MODE_TIMED,
  type ExtraTokenValues,
  type TierConditionInput,
  type VisualConfig,
  type VisualTier,
  createDefaultVisualConfig,
  evalExprLocally,
  buildEstimatorTokens,
  exprUsesExtraVars,
  generateExprFromVisualConfig,
  getTierCacheMode,
  normalizeVisualConfig,
  normalizeVisualTier,
  tryParseVisualConfig,
} from '@/features/pricing/lib/tier-expr'
import { cn } from '@/lib/utils'

import {
  BillingTimeProbeFields,
  BillingTimeRangeFields,
} from './billing-time-fields'
import { DraftNumberInput } from './draft-number-input'
import { RequestSimulation } from './request-simulation'
import { TierPriceFields } from './tier-price-fields'
import { VisualBillingDocumentEditor } from './visual-billing-document-editor'

const CONDITION_INPUT_OPTIONS: {
  value: TierConditionInput['var']
  labelKey: string
}[] = [
  { value: 'len', labelKey: 'Full input length' },
  { value: 'p', labelKey: 'Billable input tokens' },
  { value: 'c', labelKey: 'Billable output tokens' },
]
const OPS: TierConditionInput['op'][] = ['<', '<=', '>', '>=']

type Preset = {
  key: string
  label: string
  expr: string
  requestRules?: RequestRuleGroup[]
}

type PresetGroup = {
  group: string
  presets: Preset[]
}

const PRESET_GROUPS: PresetGroup[] = [
  {
    group: 'Fixed price',
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
    group: 'Tiered',
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
    group: 'Multimodal',
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
    group: 'Request rule',
    presets: [
      {
        key: 'claude-opus-fast',
        label: 'Claude Opus 4.6 Fast',
        expr: 'tier("base", p * 5 + c * 25 + cr * 0.5 + cc * 6.25 + cc1h * 10)',
        requestRules: [
          {
            conditions: [
              {
                source: SOURCE_HEADER as 'header',
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
                source: SOURCE_PARAM as 'param',
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
                source: SOURCE_PARAM as 'param',
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
    group: 'Time-based',
    presets: [
      {
        key: 'night-discount',
        label: 'Night discount (50%)',
        expr: 'tier("base", p * 3 + c * 15)',
        requestRules: [
          {
            conditions: [
              {
                source: SOURCE_TIME as 'time',
                timeFunc: 'hour',
                timezone: 'Asia/Shanghai',
                mode: MATCH_RANGE,
                value: '',
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
        label: 'Weekend discount (80%)',
        expr: 'tier("base", p * 3 + c * 15)',
        requestRules: [
          {
            conditions: [
              {
                source: SOURCE_TIME as 'time',
                timeFunc: 'weekday',
                timezone: 'Asia/Shanghai',
                mode: MATCH_EQ,
                value: '0',
                rangeStart: '',
                rangeEnd: '',
              },
            ],
            multiplier: '0.8',
          },
          {
            conditions: [
              {
                source: SOURCE_TIME as 'time',
                timeFunc: 'weekday',
                timezone: 'Asia/Shanghai',
                mode: MATCH_EQ,
                value: '6',
                rangeStart: '',
                rangeEnd: '',
              },
            ],
            multiplier: '0.8',
          },
        ],
      },
    ],
  },
]

function formatTokenHint(n: number | string | null | undefined): string {
  if (n == null || n === '' || Number.isNaN(Number(n))) return ''
  const v = Number(n)
  if (v === 0) return '= 0'
  if (v >= 1_000_000) return `= ${(v / 1_000_000).toLocaleString()}M tokens`
  if (v >= 1_000) return `= ${(v / 1_000).toLocaleString()}K tokens`
  return `= ${v.toLocaleString()} tokens`
}

// ---------------------------------------------------------------------------
// Tier condition row
// ---------------------------------------------------------------------------

type ConditionRowProps = {
  condition: TierConditionInput
  onChange: (next: TierConditionInput) => void
  onRemove: () => void
}

function ConditionRow({ condition, onChange, onRemove }: ConditionRowProps) {
  const { t } = useTranslation()
  const currentInputOption = CONDITION_INPUT_OPTIONS.find(
    (option) => option.value === condition.var
  )

  return (
    <div className='flex items-center gap-2'>
      <Select
        items={CONDITION_INPUT_OPTIONS.map((option) => ({
          value: option.value,
          label: t(option.labelKey),
        }))}
        value={condition.var}
        onValueChange={(value) =>
          onChange({ ...condition, var: value as TierConditionInput['var'] })
        }
      >
        <SelectTrigger className='w-32' size='sm'>
          <SelectValue>
            {currentInputOption
              ? t(currentInputOption.labelKey)
              : condition.var}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {CONDITION_INPUT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        items={OPS.map((op) => ({ value: op, label: op }))}
        value={condition.op}
        onValueChange={(value) =>
          onChange({ ...condition, op: value as TierConditionInput['op'] })
        }
      >
        <SelectTrigger className='w-20' size='sm'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {OPS.map((op) => (
              <SelectItem key={op} value={op}>
                {op}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <DraftNumberInput
        min={0}
        value={condition.value}
        onValueChange={(value) => onChange({ ...condition, value })}
        placeholder='tokens'
        className='w-32'
      />
      <span className='text-muted-foreground text-xs'>
        {formatTokenHint(condition.value)}
      </span>
      <Button
        variant='ghost'
        size='icon'
        onClick={onRemove}
        aria-label='remove'
        className='ml-auto'
      >
        <Trash2 className='text-destructive h-4 w-4' />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single tier card (visual editor)
// ---------------------------------------------------------------------------

type VisualTierCardProps = {
  currency: PricingCurrency
  tier: VisualTier
  index: number
  total: number
  onChange: (next: VisualTier) => void
  onRemove: () => void
  onAddCondition: () => void
}

function VisualTierCard({
  currency,
  tier,
  index,
  total,
  onChange,
  onRemove,
  onAddCondition,
}: VisualTierCardProps) {
  const { t } = useTranslation()
  const cacheMode = getTierCacheMode(tier)

  const handleConditionChange = (
    conditionIndex: number,
    next: TierConditionInput
  ) => {
    const conditions = [...tier.conditions]
    conditions[conditionIndex] = next
    onChange({ ...tier, conditions })
  }

  const handleConditionRemove = (conditionIndex: number) => {
    onChange({
      ...tier,
      conditions: tier.conditions.filter((_, i) => i !== conditionIndex),
    })
  }

  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Badge variant='outline'>
            {t('Tier')} {index + 1} / {total}
          </Badge>
          {tier.conditions.length === 0 && (
            <Badge variant='secondary'>{t('Fallback tier')}</Badge>
          )}
          <Input
            value={tier.label}
            onChange={(event) =>
              onChange({ ...tier, label: event.target.value })
            }
            placeholder={t('Tier name')}
            className='h-7 w-36'
          />
        </div>
        <Button
          variant='ghost'
          size='icon'
          onClick={onRemove}
          disabled={total <= 1}
          aria-label={t('Remove tier')}
        >
          <Trash2 className='text-destructive h-4 w-4' />
        </Button>
      </div>

      {/* Conditions */}
      <div className='space-y-1.5'>
        <div className='flex h-7 items-center justify-between'>
          <Label className='text-xs font-medium'>{t('Tier conditions')}</Label>
          <Button
            variant='ghost'
            size='sm'
            onClick={onAddCondition}
            disabled={tier.conditions.length >= 2}
            className='h-7 px-2 text-xs'
          >
            <Plus className='mr-1 h-3 w-3' />
            {t('Add condition')}
          </Button>
        </div>
        {tier.conditions.length === 0 ? (
          <p className='text-muted-foreground text-xs'>
            {t('Always matches (default tier).')}
          </p>
        ) : (
          tier.conditions.map((condition, conditionIndex) => (
            <ConditionRow
              // eslint-disable-next-line react/no-array-index-key -- Parsed editor rows have no IDs; preserve input identity while their editable labels and values change.
              key={conditionIndex}
              condition={condition}
              onChange={(next) => handleConditionChange(conditionIndex, next)}
              onRemove={() => handleConditionRemove(conditionIndex)}
            />
          ))
        )}
      </div>

      <TierPriceFields
        currency={currency}
        billingUnit={tier.billing_unit}
        fixedPrice={tier.fixed_price}
        onBillingUnitChange={(billing_unit) =>
          onChange({ ...tier, billing_unit })
        }
        onFixedPriceChange={(fixed_price) => onChange({ ...tier, fixed_price })}
        prices={{
          p: tier.input_unit_cost,
          c: tier.output_unit_cost,
          ...Object.fromEntries(
            BILLING_EXTRA_VARS.map((variable) => [
              variable.key,
              tier[variable.tierField as keyof VisualTier] ?? 0,
            ])
          ),
        }}
        cacheMode={cacheMode}
        onCacheModeChange={(mode) =>
          onChange({
            ...tier,
            cache_mode: mode,
            cache_create_1h_unit_cost:
              mode === CACHE_MODE_TIMED
                ? (tier.cache_create_1h_unit_cost ?? 0)
                : 0,
          })
        }
        onChange={(variable, value) => {
          const field =
            variable === 'p' ? 'input_unit_cost' : 'output_unit_cost'
          const extra = BILLING_EXTRA_VARS.find((item) => item.key === variable)
          onChange({ ...tier, [extra?.tierField ?? field]: Number(value) })
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Visual editor (list of tiers)
// ---------------------------------------------------------------------------

type VisualEditorProps = {
  currency: PricingCurrency
  visualConfig: VisualConfig | null
  onChange: (next: VisualConfig) => void
}

function VisualEditor({ visualConfig, onChange, currency }: VisualEditorProps) {
  const { t } = useTranslation()
  const config = useMemo(
    () => normalizeVisualConfig(visualConfig),
    [visualConfig]
  )

  const handleTierChange = (index: number, next: VisualTier) => {
    const tiers = [...config.tiers]
    tiers[index] = normalizeVisualTier(next)
    onChange({ ...config, tiers })
  }

  const handleAddTier = () => {
    const tiers = [...config.tiers]
    const lastIndex = tiers.length - 1
    // When adding a new fallback, give the previous catch-all tier a default
    // upper-bound condition so the expression compiles into a sane two-tier
    // shape with an immediately useful fallback.
    if (lastIndex >= 0 && tiers[lastIndex].conditions.length === 0) {
      tiers[lastIndex] = normalizeVisualTier({
        ...tiers[lastIndex],
        conditions: [{ var: 'len', op: '<', value: 200000 }],
      })
    }
    tiers.push(
      normalizeVisualTier({
        label: `tier_${tiers.length + 1}`,
        conditions: [],
        input_unit_cost: 0,
        output_unit_cost: 0,
      })
    )
    onChange({ ...config, tiers })
  }

  const handleRemoveTier = (index: number) => {
    const tiers = config.tiers.filter((_, i) => i !== index)
    onChange({ ...config, tiers: tiers.length > 0 ? tiers : config.tiers })
  }

  const handleAddCondition = (index: number) => {
    const tier = config.tiers[index]
    if (tier.conditions.length >= 2) return
    // Prefer `len` (input length) over `p`/`c` for tier conditions because
    // `p` is subject to auto-exclusion when sub-categories like `cr` are
    // priced separately, which can misroute long-input requests into shorter
    // tiers when cache-hits reduce the effective `p`.
    const usedVars = new Set(tier.conditions.map((c) => c.var))
    const nextVar: TierConditionInput['var'] = usedVars.has('len') ? 'c' : 'len'
    onChange({
      ...config,
      tiers: config.tiers.map((current, i) =>
        i === index
          ? {
              ...current,
              conditions: [
                ...tier.conditions,
                { var: nextVar, op: '<', value: 200000 },
              ],
            }
          : current
      ),
    })
  }

  return (
    <div className='space-y-2'>
      <p className='text-muted-foreground text-xs'>
        {t(
          'Each tier supports up to 2 conditions. The last tier without conditions is the fallback.'
        )}
      </p>
      {config.tiers.map((tier, index) => (
        <VisualTierCard
          currency={currency}
          // eslint-disable-next-line react/no-array-index-key -- Parsed editor rows have no IDs; preserve input identity while their editable labels and values change.
          key={index}
          tier={tier}
          index={index}
          total={config.tiers.length}
          onChange={(next) => handleTierChange(index, next)}
          onRemove={() => handleRemoveTier(index)}
          onAddCondition={() => handleAddCondition(index)}
        />
      ))}
      <Button
        variant='outline'
        size='sm'
        className='h-9 w-36 justify-center'
        onClick={handleAddTier}
      >
        <Plus className='mr-2 h-4 w-4' />
        {t('Add tier')}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Raw expression editor
// ---------------------------------------------------------------------------

type RawExprEditorProps = {
  exprString: string
  onChange: (value: string) => void
}

function RawExprEditor({ exprString, onChange }: RawExprEditorProps) {
  const { t } = useTranslation()
  return (
    <div className='space-y-3'>
      <Alert>
        <AlertDescription className='space-y-1 text-xs'>
          <div>
            {t('Variables')}: <code>len</code>, <code>p</code>, <code>c</code>,{' '}
            <code>cr</code>, <code>cc</code>, <code>cc1h</code>,{' '}
            <code>img</code>, <code>img_o</code>, <code>ai</code>,{' '}
            <code>ao</code>
          </div>
          <div>
            {t('Functions')}: <code>tier(name, value)</code>,{' '}
            <code>fixed(amount)</code>, <code>max</code>, <code>min</code>,{' '}
            <code>ceil</code>, <code>floor</code>, <code>abs</code>,{' '}
            <code>header(name)</code>, <code>param(path)</code>,{' '}
            <code>has(source, text)</code>
          </div>
          <div>
            {t(
              'Use tier(name, fixed(amount)) for a USD price per request. Group and request multipliers still apply.'
            )}
          </div>
        </AlertDescription>
      </Alert>
      <Textarea
        aria-label={t('Billing expression')}
        value={exprString}
        onChange={(event) => onChange(event.target.value)}
        placeholder='tier("base", p * 3 + c * 15)'
        rows={6}
        className='font-mono text-xs'
        spellCheck={false}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Request rule condition row
// ---------------------------------------------------------------------------

type RuleConditionRowProps = {
  condition: RequestCondition
  onChange: (next: RequestCondition) => void
  onRemove: () => void
}

function RuleConditionRow({
  condition,
  onChange,
  onRemove,
}: RuleConditionRowProps) {
  const { t } = useTranslation()
  const matchOptions = getRequestRuleMatchOptions(condition.source)
  const getMatchLabel = (mode: string) => {
    switch (mode) {
      case MATCH_EQ:
        return t('Equals')
      case MATCH_CONTAINS:
        return t('Contains')
      case MATCH_EXISTS:
        return t('Exists')
      case MATCH_GT:
        return t('Greater than')
      case MATCH_GTE:
        return t('Greater than or equal')
      case MATCH_LT:
        return t('Less than')
      case MATCH_LTE:
        return t('Less than or equal')
      case MATCH_RANGE:
        return t('Time range')
      default:
        return mode
    }
  }
  let sourceLabel = t('Time')
  if (condition.source === SOURCE_PARAM) sourceLabel = t('Body param')
  else if (condition.source === SOURCE_HEADER) sourceLabel = t('Header')

  const handleSourceChange = (source: string) => {
    if (source === SOURCE_TIME) {
      onChange(createEmptyTimeCondition())
    } else if (source === SOURCE_HEADER || source === SOURCE_PARAM) {
      onChange({
        ...createEmptyCondition(),
        source: source as 'param' | 'header',
      })
    }
  }

  const handleModeChange = (mode: string) => {
    onChange({ ...condition, mode } as RequestCondition)
  }

  const renderTimeCondition = (timeCond: TimeCondition) => (
    <>
      <BillingTimeProbeFields
        probe={timeCond.timeFunc}
        timezone={timeCond.timezone}
        onChange={(timeFunc, timezone) =>
          onChange({ ...timeCond, timeFunc: timeFunc as TimeFunc, timezone })
        }
      />
      <Select
        items={matchOptions.map((option) => ({
          value: option.value,
          label: getMatchLabel(option.value),
        }))}
        value={timeCond.mode}
        onValueChange={(v) => v !== null && handleModeChange(v)}
      >
        <SelectTrigger className='w-32' size='sm'>
          <SelectValue>{getMatchLabel(timeCond.mode)}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {matchOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {getMatchLabel(option.value)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {timeCond.mode === MATCH_RANGE ? (
        <BillingTimeRangeFields
          normalizeNumberDrafts
          start={timeCond.rangeStart}
          end={timeCond.rangeEnd}
          onChange={(rangeStart, rangeEnd) =>
            onChange({ ...timeCond, rangeStart, rangeEnd })
          }
        />
      ) : (
        <DraftNumberInput
          value={timeCond.value}
          onValueChange={(value) =>
            onChange({ ...timeCond, value: String(value) })
          }
          placeholder={t('Value')}
          className='w-24'
        />
      )}
    </>
  )

  const renderParamHeaderCondition = (phCond: ParamHeaderCondition) => (
    <>
      <Input
        value={phCond.path}
        onChange={(event) => onChange({ ...phCond, path: event.target.value })}
        placeholder={
          phCond.source === SOURCE_HEADER ? 'X-Header-Name' : 'service_tier'
        }
        className='w-44'
      />
      <Select
        items={matchOptions.map((option) => ({
          value: option.value,
          label: getMatchLabel(option.value),
        }))}
        value={phCond.mode}
        onValueChange={(v) => v !== null && handleModeChange(v)}
      >
        <SelectTrigger className='w-32' size='sm'>
          <SelectValue>{getMatchLabel(phCond.mode)}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {matchOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {getMatchLabel(option.value)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {phCond.mode !== MATCH_EXISTS && (
        <Input
          value={phCond.value}
          onChange={(event) =>
            onChange({ ...phCond, value: event.target.value })
          }
          placeholder={t('Value')}
          className='w-44'
        />
      )}
    </>
  )

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Select
        items={[
          { value: SOURCE_PARAM, label: t('Body param') },
          { value: SOURCE_HEADER, label: t('Header') },
          { value: SOURCE_TIME, label: t('Time') },
        ]}
        value={condition.source}
        onValueChange={(v) => v !== null && handleSourceChange(v)}
      >
        <SelectTrigger className='w-28' size='sm'>
          <SelectValue>{sourceLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectItem value={SOURCE_PARAM}>{t('Body param')}</SelectItem>
            <SelectItem value={SOURCE_HEADER}>{t('Header')}</SelectItem>
            <SelectItem value={SOURCE_TIME}>{t('Time')}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {condition.source === SOURCE_TIME
        ? renderTimeCondition(condition as TimeCondition)
        : renderParamHeaderCondition(condition as ParamHeaderCondition)}
      <Button
        variant='ghost'
        size='icon'
        onClick={onRemove}
        aria-label={t('Remove condition')}
        className='ml-auto'
      >
        <Trash2 className='text-destructive h-4 w-4' />
      </Button>
      {condition.source === SOURCE_TIME && condition.mode === MATCH_RANGE && (
        <p className='text-muted-foreground w-full text-xs'>
          {t('Start ≤ end: within the day; start > end: across midnight')}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Request rule group card
// ---------------------------------------------------------------------------

type RuleGroupCardProps = {
  group: RequestRuleGroup
  index: number
  onChange: (next: RequestRuleGroup) => void
  onRemove: () => void
}

function RuleGroupCard({
  group,
  index,
  onChange,
  onRemove,
}: RuleGroupCardProps) {
  const { t } = useTranslation()

  const handleConditionChange = (
    conditionIndex: number,
    next: RequestCondition
  ) => {
    const conditions = [...group.conditions]
    conditions[conditionIndex] = next
    onChange({ ...group, conditions })
  }

  const handleAddCondition = (timeMode: boolean) => {
    onChange({
      ...group,
      conditions: [
        ...group.conditions,
        timeMode ? createEmptyTimeCondition() : createEmptyCondition(),
      ],
    })
  }

  return (
    <div className='bg-muted/30 space-y-3 rounded-md border p-3'>
      <div className='flex items-center justify-between gap-2'>
        <Badge variant='outline'>
          {t('Rule group')} #{index + 1}
        </Badge>
        <Button
          variant='ghost'
          size='icon'
          onClick={onRemove}
          aria-label={t('Remove rule group')}
        >
          <Trash2 className='text-destructive h-4 w-4' />
        </Button>
      </div>

      <div className='space-y-2'>
        {group.conditions.map((condition, conditionIndex) => (
          <RuleConditionRow
            // eslint-disable-next-line react/no-array-index-key -- Parsed editor rows have no IDs; preserve input identity while their editable labels and values change.
            key={conditionIndex}
            condition={condition}
            onChange={(next) => handleConditionChange(conditionIndex, next)}
            onRemove={() =>
              onChange({
                ...group,
                conditions: group.conditions.filter(
                  (_, i) => i !== conditionIndex
                ),
              })
            }
          />
        ))}
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => handleAddCondition(false)}
          >
            <Plus className='mr-1 h-3 w-3' />
            {t('Add param/header')}
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => handleAddCondition(true)}
          >
            <Plus className='mr-1 h-3 w-3' />
            {t('Add time condition')}
          </Button>
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <Label className='text-xs'>{t('Multiplier')}</Label>
        <DraftNumberInput
          min={0}
          step={0.000001}
          value={group.multiplier}
          onValueChange={(value) =>
            onChange({ ...group, multiplier: String(value) })
          }
          className='w-32'
          placeholder='1.0'
        />
        <span className='text-muted-foreground text-xs'>
          {t('Final cost = base × multiplier when conditions match')}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preset section
// ---------------------------------------------------------------------------

type PresetSectionProps = {
  applyPreset: (preset: Preset) => void
}

function PresetSection({ applyPreset }: PresetSectionProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? PRESET_GROUPS : PRESET_GROUPS.slice(0, 2)
  const hasMore = PRESET_GROUPS.length > 2

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2'>
        <span className='text-sm font-medium'>{t('Preset templates')}</span>
        {hasMore && (
          <Button
            variant='ghost'
            size='sm'
            className='h-6 px-2 text-xs'
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? t('Collapse') : t('More templates...')}
          </Button>
        )}
      </div>
      <div className='space-y-1'>
        {visible.map((presetGroup) => (
          <div
            key={presetGroup.group}
            className='flex flex-wrap items-center gap-2'
          >
            <Badge variant='secondary' className='min-w-[60px] justify-center'>
              {t(presetGroup.group)}
            </Badge>
            {presetGroup.presets.map((preset) => (
              <Button
                key={preset.key}
                variant='outline'
                size='sm'
                className='h-7 text-xs'
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cost estimator
// ---------------------------------------------------------------------------

type EstimatorProps = {
  currency: PricingCurrency
  effectiveExpr: string
  fullExpr: string
}

function CostEstimator({ effectiveExpr, fullExpr, currency }: EstimatorProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const outputId = useId()
  const lengthId = useId()
  const [lengthOverride, setLengthOverride] = useState('')
  const billingTime = useBillingTime(effectiveExpr)
  const [promptTokens, setPromptTokens] = useState(0)
  const [completionTokens, setCompletionTokens] = useState(0)
  const [extras, setExtras] = useState<ExtraTokenValues>({
    cacheReadTokens: 0,
    cacheCreateTokens: 0,
    cacheCreate1hTokens: 0,
    imageTokens: 0,
    imageOutputTokens: 0,
    audioInputTokens: 0,
    audioOutputTokens: 0,
  })

  const usesExtras = useMemo(
    () => exprUsesExtraVars(effectiveExpr),
    [effectiveExpr]
  )

  const tokens = useMemo(() => {
    const values = buildEstimatorTokens(promptTokens, completionTokens, extras)
    if (lengthOverride.trim()) values.len = Number(lengthOverride)
    return values
  }, [promptTokens, completionTokens, extras, lengthOverride])

  const result = useMemo(
    () =>
      evalExprLocally(effectiveExpr, promptTokens, completionTokens, extras, {
        tokens,
        now: billingTime === undefined ? undefined : new Date(billingTime),
      }),
    [effectiveExpr, promptTokens, completionTokens, extras, tokens, billingTime]
  )

  return (
    <div className='bg-muted/30 space-y-3 rounded-md border p-3'>
      <div className='space-y-1'>
        <h4 className='text-sm font-medium'>{t('Token estimator')}</h4>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Enter token counts to preview the estimated cost (excluding group multipliers).'
          )}
        </p>
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label htmlFor={inputId} className='text-xs'>
            {t('Input tokens')}
          </Label>
          <DraftNumberInput
            id={inputId}
            min={0}
            value={promptTokens}
            onValueChange={setPromptTokens}
          />
        </div>
        <div className='space-y-1'>
          <Label htmlFor={outputId} className='text-xs'>
            {t('Output tokens')}
          </Label>
          <DraftNumberInput
            id={outputId}
            min={0}
            value={completionTokens}
            onValueChange={setCompletionTokens}
          />
        </div>
      </div>
      <Field>
        <FieldLabel htmlFor={lengthId}>
          {t('Full input length override')}
        </FieldLabel>
        <Input
          id={lengthId}
          type='number'
          min={0}
          value={lengthOverride}
          onChange={(event) => setLengthOverride(event.target.value)}
          placeholder={t('Use the existing token total')}
        />
      </Field>
      {usesExtras && (
        <div className='grid grid-cols-2 gap-3'>
          {BILLING_EXTRA_VARS.map((variable) => {
            // BILLING_EXTRA_VARS only contains pricing variables; they are
            // guaranteed to have a non-null `field` (the `len` condition-only
            // variable is filtered out). Narrow the type here for safety.
            if (!variable.field) return null
            const stateKey = variable.field.replace(
              'Price',
              'Tokens'
            ) as keyof ExtraTokenValues
            return (
              <div key={variable.key} className='space-y-1'>
                <Label className='text-xs'>{t(variable.shortLabel)}</Label>
                <DraftNumberInput
                  min={0}
                  value={extras[stateKey]}
                  onValueChange={(value) =>
                    setExtras((prev) => ({
                      ...prev,
                      [stateKey]: value,
                    }))
                  }
                />
              </div>
            )
          })}
        </div>
      )}
      <div
        className={cn(
          'rounded-md border p-3 text-sm',
          result.error
            ? 'border-destructive/50 bg-destructive/10 text-destructive'
            : 'border-primary/50 bg-primary/10'
        )}
      >
        {result.error ? (
          <span>
            {t('Expression error')}: {result.error}
          </span>
        ) : (
          <div className='flex items-center gap-2'>
            <span className='font-medium'>
              {t('Estimated cost')}:{' '}
              {formatPricingAmount(result.cost / 1_000_000, currency)}
              {result.billingUnit === 'request' && `/${t('request')}`}
            </span>
            {result.matchedTier && (
              <Badge variant='outline' className='text-xs'>
                {t('Hit tier')}: {result.matchedTier}
              </Badge>
            )}
          </div>
        )}
      </div>
      <RequestSimulation
        expression={fullExpr}
        tokens={tokens}
        currency={currency}
        mode='token'
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// LLM prompt helper
// ---------------------------------------------------------------------------

const LLM_PROMPT_TEMPLATE = `You are an AI API billing expression design assistant. The user needs help designing a billing expression for an AI API gateway.

## Expression Language

Expressions are based on standard arithmetic with ternary operators.

### Token Variables

Input side:
- p — input token count (for pricing). Automatically excludes sub-categories priced separately (e.g., if cr is used, cache tokens are deducted from p)
- len — total input context length (for condition checks). Not affected by auto-exclusion; always reflects the full input length. Use in tier conditions
- cr — cache-hit (read) token count
- cc — cache-create token count (5-min TTL)
- cc1h — cache-create token count (1-hour TTL, Claude-specific)
- img — image input token count
- ai — audio input token count

Output side:
- c — output token count. Also auto-excludes sub-categories priced separately
- img_o — image output token count
- ao — audio output token count

### p/c Auto-exclusion

p and c are fallback variables representing all tokens not separately priced in the expression. If the expression uses a sub-category variable (e.g., cr), those tokens are deducted from p to avoid double-billing. Unused sub-category tokens remain in p/c at base price.

Important: len is NOT affected by auto-exclusion. Tier conditions should use len instead of p to prevent cache hits from lowering p and misidentifying the tier.

### Built-in Functions

- tier(name, value) — labels the billing tier; must wrap the cost expression
- fixed(amount) — a finite non-negative USD price per request, used only as tier("name", fixed(0.01)); replaces token charges in that leaf. Other leaves may still use token prices. Group/request multipliers and existing tool surcharges still apply. Unsupported for task usage expressions and Realtime.
- max(a, b), min(a, b) — maximum/minimum
- ceil(x), floor(x), abs(x) — ceiling, floor, absolute value
- header(name) — reads a request header
- param(path) — reads a request body JSON path (gjson syntax)
- has(source, substr) — substring check
- hour(tz), minute(tz), weekday(tz), month(tz), day(tz) — time functions, tz is a timezone like "Asia/Shanghai"

### Price Coefficients

Numbers in the expression are $/1M tokens prices. For example, p * 2.5 means input $2.50/1M tokens.

## Expression Examples

Simple pricing:
tier("base", p * 2.5 + c * 15)

With cache:
tier("base", p * 2.5 + c * 15 + cr * 0.25)

Multi-tier (use len for conditions):
len <= 200000
  ? tier("standard", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6)
  : tier("long_context", p * 6 + c * 22.5 + cr * 0.6 + cc * 7.5 + cc1h * 12)

Image model:
tier("base", p * 2 + c * 8 + img * 2.5)

Multimodal with audio:
tier("base", p * 0.43 + c * 3.06 + img * 0.78 + ai * 3.81 + ao * 15.11)

Three-tier example:
len <= 128000
  ? tier("standard", p * 1.1 + c * 4.4)
  : (len <= 1000000
    ? tier("medium", p * 2.2 + c * 8.8)
    : tier("long", p * 4.4 + c * 17.6))

## Rules

1. Every leaf branch must be wrapped in tier("name", cost_expr)
2. Use English tier names, e.g. "base", "standard", "long_context"
3. Use len for tier conditions (not p), supports <, <=, >, >=
4. Multi-tier uses nested ternary: cond1 ? tier(...) : (cond2 ? tier(...) : tier(...))
5. Price coefficients are the provider's official $/1M tokens prices
6. If cache/image/audio don't need separate pricing, omit those variables; their tokens are included in p/c automatically

Please generate a billing expression based on the model information and pricing requirements provided.`

type LlmPromptHelperProps = {
  modelName?: string
}

function LlmPromptHelper({ modelName }: LlmPromptHelperProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const prompt = useMemo(() => {
    if (modelName) {
      return `${LLM_PROMPT_TEMPLATE}\n\nCurrent model: ${modelName}`
    }
    return LLM_PROMPT_TEMPLATE
  }, [modelName])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Failed to copy'))
    }
  }, [prompt, t])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={
          <Button variant='ghost' size='sm' className='h-7 px-2 text-xs' />
        }
      >
        <Copy className='mr-1.5 h-3 w-3' />
        {t('LLM prompt helper')}
      </CollapsibleTrigger>
      <CollapsibleContent className='mt-2'>
        <div className='bg-muted/30 rounded-md border p-3'>
          <div className='mb-2 flex items-center justify-between'>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Copy this prompt and send it to an LLM (e.g. ChatGPT / Claude) to help design your billing expression.'
              )}
            </p>
            <Button
              variant='outline'
              size='sm'
              className='ml-3 shrink-0'
              onClick={handleCopy}
            >
              <Copy className='mr-1.5 h-3 w-3' />
              {t('Copy prompt')}
            </Button>
          </div>
          <Textarea
            value={prompt}
            readOnly
            rows={8}
            className='font-mono text-xs'
            spellCheck={false}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export type TieredPricingEditorProps = {
  currency?: PricingCurrency
  modelName?: string
  billingExpr: string
  requestRuleExpr: string
  onBillingExprChange: (next: string) => void
  onRequestRuleExprChange: (next: string) => void
}

type EditorMode = 'visual' | 'raw'

// The legacy form omits zero-valued extra variables when generating prices.
// Keep that API unchanged for synchronization callers; route explicit zero to the document form.
function parseTierEditorConfig(source: string): VisualConfig | null {
  const config = tryParseVisualConfig(source)
  if (!config) return null
  const document = parseVisualBillingDocument(source)
  if (!document) return null
  if (
    document.root.kind === 'tier' &&
    document.root.prices.some(
      (price) =>
        price.variable !== 'p' &&
        price.variable !== 'c' &&
        Number(price.value) === 0
    )
  ) {
    return null
  }
  return config
}

export const TieredPricingEditor = memo(function TieredPricingEditor({
  currency = USD_PRICING_CURRENCY,
  modelName,
  billingExpr: currentExpr,
  requestRuleExpr: currentRequestRuleExpr,
  onBillingExprChange,
  onRequestRuleExprChange,
}: TieredPricingEditorProps) {
  const { t } = useTranslation()
  const [editorMode, setEditorMode] = useState<EditorMode>(() =>
    currentExpr &&
    !parseTierEditorConfig(currentExpr) &&
    !parseVisualBillingDocument(currentExpr)
      ? 'raw'
      : 'visual'
  )
  const [visualConfig, setVisualConfig] = useState<VisualConfig | null>(
    () =>
      parseTierEditorConfig(currentExpr) ??
      (!currentExpr ? createDefaultVisualConfig() : null)
  )
  const [visualDocument, setVisualDocument] =
    useState<VisualBillingDocument | null>(() =>
      parseTierEditorConfig(currentExpr)
        ? null
        : parseVisualBillingDocument(currentExpr)
    )
  const [baseExpr, setBaseExpr] = useState(currentExpr)
  const [ruleExpr, setRuleExpr] = useState(currentRequestRuleExpr)
  const [rawExpr, setRawExpr] = useState(() =>
    combineBillingExpr(currentExpr, currentRequestRuleExpr)
  )
  const [requestRuleGroups, setRequestRuleGroups] = useState<
    RequestRuleGroup[]
  >(() => tryParseRequestRuleExpr(currentRequestRuleExpr) || [])
  const loadedModel = useRef(modelName)
  useEffect(() => {
    if (loadedModel.current === modelName) return
    loadedModel.current = modelName
    const config = parseTierEditorConfig(currentExpr)
    const document = config ? null : parseVisualBillingDocument(currentExpr)
    setVisualConfig(
      config ?? (!currentExpr ? createDefaultVisualConfig() : null)
    )
    setVisualDocument(document)
    setEditorMode(config || document || !currentExpr ? 'visual' : 'raw')
    setBaseExpr(currentExpr)
    setRuleExpr(currentRequestRuleExpr)
    setRawExpr(combineBillingExpr(currentExpr, currentRequestRuleExpr))
    setRequestRuleGroups(tryParseRequestRuleExpr(currentRequestRuleExpr) || [])
  }, [modelName, currentExpr, currentRequestRuleExpr])

  const serialized = useMemo(
    () =>
      visualDocument ? serializeVisualBillingDocument(visualDocument) : null,
    [visualDocument]
  )
  const invalidFlatDraft = useMemo(
    () =>
      visualConfig?.tiers.some((tier) => tier.billing_unit === 'request') &&
      compileBillingExpression(generateExprFromVisualConfig(visualConfig))
        .status !== 'ready',
    [visualConfig]
  )
  const invalidDraft =
    editorMode === 'visual' &&
    (serialized?.ok === false || Boolean(invalidFlatDraft))
  const canUseVisualRules =
    !ruleExpr || tryParseRequestRuleExpr(ruleExpr) !== null
  const effectiveExpr = baseExpr

  const handleVisualChange = useCallback(
    (next: VisualConfig) => {
      setVisualConfig(next)
      const expression = generateExprFromVisualConfig(next)
      if (
        next.tiers.some((tier) => tier.billing_unit === 'request') &&
        compileBillingExpression(expression).status !== 'ready'
      ) {
        return
      }
      setBaseExpr(expression)
      onBillingExprChange(expression)
    },
    [onBillingExprChange]
  )

  const handleDocumentChange = useCallback(
    (next: VisualBillingDocument) => {
      setVisualDocument(next)
      const result = serializeVisualBillingDocument(next)
      if (result.ok) {
        setBaseExpr(result.source)
        onBillingExprChange(result.source)
      }
    },
    [onBillingExprChange]
  )

  const handleRawChange = useCallback(
    (value: string) => {
      setRawExpr(value)
      const split = splitBillingExprAndRequestRules(value)
      setBaseExpr(split.billingExpr)
      setRuleExpr(split.requestRuleExpr)
      onBillingExprChange(split.billingExpr)
      onRequestRuleExprChange(split.requestRuleExpr)
    },
    [onBillingExprChange, onRequestRuleExprChange]
  )

  const handleModeChange = useCallback(
    (next: EditorMode) => {
      if (next === editorMode) return
      if (invalidDraft) return
      if (next === 'visual') {
        const parsed = parseTierEditorConfig(baseExpr)
        const document = parsed ? null : parseVisualBillingDocument(baseExpr)
        if (!parsed && !document) {
          toast.error(
            t(
              'This expression cannot be edited visually without losing information.'
            )
          )
          return
        }
        setVisualConfig(parsed)
        setVisualDocument(document)
        setRequestRuleGroups(tryParseRequestRuleExpr(ruleExpr) || [])
      } else {
        setRawExpr(combineBillingExpr(baseExpr, ruleExpr))
      }
      setEditorMode(next)
    },
    [editorMode, invalidDraft, baseExpr, ruleExpr, t]
  )

  const applyPreset = useCallback(
    (preset: Preset) => {
      const groups = preset.requestRules || []
      const rules = buildRequestRuleExpr(groups)
      const config = parseTierEditorConfig(preset.expr)
      const document = config ? null : parseVisualBillingDocument(preset.expr)
      setRawExpr(combineBillingExpr(preset.expr, rules))
      setBaseExpr(preset.expr)
      setRuleExpr(rules)
      setVisualConfig(config)
      setVisualDocument(document)
      setEditorMode(config || document ? 'visual' : 'raw')
      setRequestRuleGroups(groups)
      onBillingExprChange(preset.expr)
      onRequestRuleExprChange(rules)
    },
    [onBillingExprChange, onRequestRuleExprChange]
  )

  const handleRuleGroupsChange = useCallback(
    (next: RequestRuleGroup[]) => {
      setRequestRuleGroups(next)
      const rules = buildRequestRuleExpr(next)
      setRuleExpr(rules)
      onRequestRuleExprChange(rules)
    },
    [onRequestRuleExprChange]
  )

  return (
    <div className='space-y-5' data-billing-invalid={invalidDraft || undefined}>
      <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end'>
        <Field className='gap-2'>
          <FieldLabel>{t('Editor mode')}</FieldLabel>
          <Select
            items={[
              { value: 'visual', label: t('Visual editor') },
              { value: 'raw', label: t('Expression editor') },
            ]}
            value={editorMode}
            onValueChange={(value) => handleModeChange(value as EditorMode)}
          >
            <SelectTrigger
              aria-label={t('Editor mode')}
              className='w-full sm:w-56'
              size='sm'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='visual'>{t('Visual editor')}</SelectItem>
                <SelectItem value='raw' disabled={invalidDraft}>
                  {t('Expression editor')}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {editorMode === 'raw' && (
          <div className='sm:pb-0.5'>
            <LlmPromptHelper modelName={modelName} />
          </div>
        )}
      </div>

      <p className='text-muted-foreground text-xs'>
        {t(
          'Raw expressions and presets use USD. Currency selection only converts visual price inputs and monetary previews.'
        )}
      </p>
      <PresetSection applyPreset={applyPreset} />

      <div className='bg-muted/30 space-y-3 rounded-md border p-3'>
        {editorMode === 'visual' && visualDocument && (
          <VisualBillingDocumentEditor
            document={visualDocument}
            currency={currency}
            issues={serialized && !serialized.ok ? serialized.issues : []}
            onChange={handleDocumentChange}
          />
        )}
        {editorMode === 'visual' && !visualDocument && (
          <VisualEditor
            currency={currency}
            visualConfig={visualConfig}
            onChange={handleVisualChange}
          />
        )}
        {editorMode === 'raw' && (
          <RawExprEditor exprString={rawExpr} onChange={handleRawChange} />
        )}
        {invalidDraft && (
          <p role='alert' className='text-destructive text-sm'>
            {t(
              'Complete the invalid fields before saving or switching modes. The last valid expression is preserved.'
            )}
          </p>
        )}

        {editorMode === 'visual' && (
          <div className='space-y-3 border-t pt-3'>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>
                {t('Request rule pricing')}
              </h4>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'When conditions match, the final price is multiplied by X. Multiple matches multiply together; values < 1 act as discounts.'
                )}
              </p>
            </div>

            {ruleExpr && !canUseVisualRules ? (
              <Alert>
                <AlertDescription className='text-xs'>
                  {t(
                    'This expression is too complex for the visual editor. Please switch to expression mode to edit.'
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {requestRuleGroups.map((group, groupIndex) => (
                  <RuleGroupCard
                    // eslint-disable-next-line react/no-array-index-key -- Parsed editor rows have no IDs; preserve input identity while their editable labels and values change.
                    key={groupIndex}
                    group={group}
                    index={groupIndex}
                    onChange={(next) => {
                      const updated = [...requestRuleGroups]
                      updated[groupIndex] = next
                      handleRuleGroupsChange(updated)
                    }}
                    onRemove={() =>
                      handleRuleGroupsChange(
                        requestRuleGroups.filter((_, i) => i !== groupIndex)
                      )
                    }
                  />
                ))}
                <Button
                  variant='outline'
                  size='sm'
                  className='h-9 w-36 justify-center'
                  onClick={() =>
                    handleRuleGroupsChange([
                      ...requestRuleGroups,
                      createEmptyRuleGroup(),
                    ])
                  }
                >
                  <Plus className='mr-2 h-4 w-4' />
                  {t('Add rule group')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <CostEstimator
        effectiveExpr={effectiveExpr}
        fullExpr={
          editorMode === 'raw'
            ? rawExpr
            : combineBillingExpr(effectiveExpr, ruleExpr)
        }
        currency={currency}
      />
    </div>
  )
})
