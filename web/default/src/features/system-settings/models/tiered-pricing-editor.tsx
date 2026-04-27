import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  BILLING_EXTRA_VARS,
  COMMON_TIMEZONES,
  MATCH_CONTAINS,
  MATCH_EQ,
  MATCH_EXISTS,
  MATCH_RANGE,
  SOURCE_HEADER,
  SOURCE_PARAM,
  SOURCE_TIME,
  TIME_FUNCS,
  buildRequestRuleExpr,
  combineBillingExpr,
  createEmptyCondition,
  createEmptyRuleGroup,
  createEmptyTimeCondition,
  createEmptyTimeRuleGroup,
  getRequestRuleMatchOptions,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  type ParamHeaderCondition,
  type RequestCondition,
  type RequestRuleGroup,
  type TimeCondition,
  type TimeFunc,
} from '@/features/pricing/lib/billing-expr'
import {
  CACHE_MODE_GENERIC,
  CACHE_MODE_TIMED,
  type CacheMode,
  type ExtraTokenValues,
  type TierConditionInput,
  type VisualConfig,
  type VisualTier,
  createDefaultVisualConfig,
  evalExprLocally,
  exprUsesExtraVars,
  generateExprFromVisualConfig,
  getTierCacheMode,
  normalizeVisualConfig,
  normalizeVisualTier,
  tryParseVisualConfig,
} from '@/features/pricing/lib/tier-expr'

const PRICE_SUFFIX = '$/1M tokens'

const VAR_OPTIONS: { value: TierConditionInput['var']; label: string }[] = [
  { value: 'p', label: 'p (input)' },
  { value: 'c', label: 'c (output)' },
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
        expr: 'p <= 272000 ? tier("standard", p * 2.5 + c * 15 + cr * 0.25) : tier("long_context", p * 5 + c * 22.5 + cr * 0.5)',
      },
    ],
  },
  {
    group: 'Tiered',
    presets: [
      {
        key: 'claude-sonnet',
        label: 'Claude Sonnet 4.5',
        expr: 'p <= 200000 ? tier("standard", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6) : tier("long_context", p * 6 + c * 22.5 + cr * 0.6 + cc * 7.5 + cc1h * 12)',
      },
      {
        key: 'qwen3-max',
        label: 'Qwen3 Max',
        expr: 'p <= 32000 ? tier("short", p * 1.2 + c * 6 + cr * 0.24 + cc * 1.5) : p <= 128000 ? tier("mid", p * 2.4 + c * 12 + cr * 0.48 + cc * 3) : tier("long", p * 3 + c * 15 + cr * 0.6 + cc * 3.75)',
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
        expr: 'p <= 272000 ? tier("standard", p * 2.5 + c * 15 + cr * 0.25) : tier("long_context", p * 5 + c * 22.5 + cr * 0.5)',
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
    ],
  },
]

function unitCostToPrice(uc: number | string): number {
  return Number(uc) || 0
}

function priceToUnitCost(price: number | string): number {
  return Number(price) || 0
}

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
  return (
    <div className='flex items-center gap-2'>
      <Select
        value={condition.var}
        onValueChange={(value) =>
          onChange({ ...condition, var: value as TierConditionInput['var'] })
        }
      >
        <SelectTrigger className='w-32' size='sm'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VAR_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={condition.op}
        onValueChange={(value) =>
          onChange({ ...condition, op: value as TierConditionInput['op'] })
        }
      >
        <SelectTrigger className='w-20' size='sm'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPS.map((op) => (
            <SelectItem key={op} value={op}>
              {op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type='number'
        min={0}
        value={condition.value === '' ? '' : Number(condition.value)}
        onChange={(event) =>
          onChange({ ...condition, value: event.target.value })
        }
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
// Price input field
// ---------------------------------------------------------------------------

type PriceFieldProps = {
  label: string
  hint?: string
  value: number
  onChange: (next: number) => void
  showSuffix?: boolean
}

function PriceField({
  label,
  hint,
  value,
  onChange,
  showSuffix = true,
}: PriceFieldProps) {
  return (
    <div className='space-y-1'>
      <Label className='text-xs'>{label}</Label>
      <div className='flex items-center gap-2'>
        <Input
          type='number'
          min={0}
          step={0.01}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className='w-32'
        />
        {showSuffix && (
          <span className='text-muted-foreground text-xs'>{PRICE_SUFFIX}</span>
        )}
      </div>
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single tier card (visual editor)
// ---------------------------------------------------------------------------

type VisualTierCardProps = {
  tier: VisualTier
  index: number
  total: number
  onChange: (next: VisualTier) => void
  onRemove: () => void
  onAddCondition: () => void
}

function VisualTierCard({
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

  const handlePriceChange = (field: keyof VisualTier, value: number) => {
    onChange({ ...tier, [field]: value })
  }

  const handleCacheModeChange = (mode: CacheMode) => {
    onChange({
      ...tier,
      cache_mode: mode,
      cache_create_1h_unit_cost:
        mode === CACHE_MODE_TIMED ? (tier.cache_create_1h_unit_cost ?? 0) : 0,
    })
  }

  const inputUnitPrice = unitCostToPrice(tier.input_unit_cost)
  const outputUnitPrice = unitCostToPrice(tier.output_unit_cost)

  return (
    <div className='bg-muted/30 space-y-3 rounded-md border p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Badge variant='outline'>
            {t('Tier')} {index + 1} / {total}
          </Badge>
          <Input
            value={tier.label}
            onChange={(event) =>
              onChange({ ...tier, label: event.target.value })
            }
            placeholder={t('Tier name')}
            className='h-8 w-40'
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

      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label className='text-xs'>{t('Conditions (AND)')}</Label>
          <Button
            variant='ghost'
            size='sm'
            onClick={onAddCondition}
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
              key={conditionIndex}
              condition={condition}
              onChange={(next) => handleConditionChange(conditionIndex, next)}
              onRemove={() => handleConditionRemove(conditionIndex)}
            />
          ))
        )}
      </div>

      <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
        <PriceField
          label={t('Input price')}
          hint={`${inputUnitPrice} × p`}
          value={inputUnitPrice}
          onChange={(value) =>
            handlePriceChange('input_unit_cost', priceToUnitCost(value))
          }
        />
        <PriceField
          label={t('Output price')}
          hint={`${outputUnitPrice} × c`}
          value={outputUnitPrice}
          onChange={(value) =>
            handlePriceChange('output_unit_cost', priceToUnitCost(value))
          }
        />
      </div>

      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label className='text-xs'>{t('Cache mode')}</Label>
          <Select
            value={cacheMode}
            onValueChange={(value) => handleCacheModeChange(value as CacheMode)}
          >
            <SelectTrigger className='w-44' size='sm'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CACHE_MODE_GENERIC}>
                {t('Generic cache')}
              </SelectItem>
              <SelectItem value={CACHE_MODE_TIMED}>
                {t('Timed cache (1h)')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          {BILLING_EXTRA_VARS.map((variable) => {
            if (variable.key === 'cc1h' && cacheMode !== CACHE_MODE_TIMED) {
              return null
            }
            const fieldKey = variable.tierField as keyof VisualTier
            const value = unitCostToPrice(
              (tier[fieldKey] as number | undefined) ?? 0
            )
            return (
              <PriceField
                key={variable.key}
                label={variable.label}
                hint={`${value} × ${variable.key}`}
                value={value}
                onChange={(next) =>
                  handlePriceChange(fieldKey, priceToUnitCost(next))
                }
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Visual editor (list of tiers)
// ---------------------------------------------------------------------------

type VisualEditorProps = {
  visualConfig: VisualConfig | null
  onChange: (next: VisualConfig) => void
}

function VisualEditor({ visualConfig, onChange }: VisualEditorProps) {
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
    onChange({
      ...config,
      tiers: [
        ...config.tiers,
        normalizeVisualTier({
          label: `tier_${config.tiers.length + 1}`,
          conditions: [],
          input_unit_cost: 0,
          output_unit_cost: 0,
        }),
      ],
    })
  }

  const handleRemoveTier = (index: number) => {
    const tiers = config.tiers.filter((_, i) => i !== index)
    onChange({ ...config, tiers: tiers.length > 0 ? tiers : config.tiers })
  }

  const handleAddCondition = (index: number) => {
    const tier = config.tiers[index]
    onChange({
      ...config,
      tiers: config.tiers.map((current, i) =>
        i === index
          ? {
              ...current,
              conditions: [
                ...tier.conditions,
                { var: 'p', op: '<=', value: '' },
              ],
            }
          : current
      ),
    })
  }

  return (
    <div className='space-y-3'>
      {config.tiers.map((tier, index) => (
        <VisualTierCard
          key={index}
          tier={tier}
          index={index}
          total={config.tiers.length}
          onChange={(next) => handleTierChange(index, next)}
          onRemove={() => handleRemoveTier(index)}
          onAddCondition={() => handleAddCondition(index)}
        />
      ))}
      <Button variant='outline' size='sm' onClick={handleAddTier}>
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
            {t('Variables')}: <code>p</code>, <code>c</code>, <code>cr</code>,{' '}
            <code>cc</code>, <code>cc1h</code>, <code>img</code>,{' '}
            <code>img_o</code>, <code>ai</code>, <code>ao</code>
          </div>
          <div>
            {t('Functions')}: <code>tier(name, value)</code>, <code>max</code>,{' '}
            <code>min</code>, <code>ceil</code>, <code>floor</code>,{' '}
            <code>abs</code>, <code>header(name)</code>,{' '}
            <code>param(path)</code>, <code>has(source, text)</code>
          </div>
        </AlertDescription>
      </Alert>
      <Textarea
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
      <Select
        value={timeCond.timeFunc}
        onValueChange={(value) =>
          onChange({ ...timeCond, timeFunc: value as TimeFunc })
        }
      >
        <SelectTrigger className='w-32' size='sm'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIME_FUNCS.map((fn) => (
            <SelectItem key={fn} value={fn}>
              {fn}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={timeCond.timezone}
        onValueChange={(value) => onChange({ ...timeCond, timezone: value })}
      >
        <SelectTrigger className='w-56' size='sm'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMMON_TIMEZONES.map((tz) => (
            <SelectItem key={tz.value} value={tz.value}>
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={timeCond.mode} onValueChange={handleModeChange}>
        <SelectTrigger className='w-32' size='sm'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {matchOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {timeCond.mode === MATCH_RANGE ? (
        <>
          <Input
            type='number'
            value={timeCond.rangeStart}
            onChange={(event) =>
              onChange({ ...timeCond, rangeStart: event.target.value })
            }
            placeholder='start'
            className='w-20'
          />
          <span className='text-muted-foreground text-xs'>~</span>
          <Input
            type='number'
            value={timeCond.rangeEnd}
            onChange={(event) =>
              onChange({ ...timeCond, rangeEnd: event.target.value })
            }
            placeholder='end'
            className='w-20'
          />
        </>
      ) : (
        <Input
          type='number'
          value={timeCond.value}
          onChange={(event) =>
            onChange({ ...timeCond, value: event.target.value })
          }
          placeholder='value'
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
      <Select value={phCond.mode} onValueChange={handleModeChange}>
        <SelectTrigger className='w-32' size='sm'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {matchOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
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
      <Select value={condition.source} onValueChange={handleSourceChange}>
        <SelectTrigger className='w-28' size='sm'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SOURCE_PARAM}>{t('Body param')}</SelectItem>
          <SelectItem value={SOURCE_HEADER}>{t('Header')}</SelectItem>
          <SelectItem value={SOURCE_TIME}>{t('Time')}</SelectItem>
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
        <Input
          type='number'
          min={0}
          step={0.01}
          value={group.multiplier}
          onChange={(event) =>
            onChange({ ...group, multiplier: event.target.value })
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
        <span className='text-muted-foreground text-xs'>
          {t('Preset templates')}
        </span>
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
  effectiveExpr: string
}

function CostEstimator({ effectiveExpr }: EstimatorProps) {
  const { t } = useTranslation()
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

  const result = useMemo(
    () =>
      evalExprLocally(effectiveExpr, promptTokens, completionTokens, extras),
    [effectiveExpr, promptTokens, completionTokens, extras]
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
          <Label className='text-xs'>{t('Input tokens')} (p)</Label>
          <Input
            type='number'
            min={0}
            value={promptTokens}
            onChange={(event) =>
              setPromptTokens(Number(event.target.value) || 0)
            }
          />
        </div>
        <div className='space-y-1'>
          <Label className='text-xs'>{t('Output tokens')} (c)</Label>
          <Input
            type='number'
            min={0}
            value={completionTokens}
            onChange={(event) =>
              setCompletionTokens(Number(event.target.value) || 0)
            }
          />
        </div>
      </div>
      {usesExtras && (
        <div className='grid grid-cols-2 gap-3'>
          {BILLING_EXTRA_VARS.map((variable) => {
            const stateKey = variable.field.replace(
              'Price',
              'Tokens'
            ) as keyof ExtraTokenValues
            return (
              <div key={variable.key} className='space-y-1'>
                <Label className='text-xs'>
                  {variable.shortLabel} ({variable.key})
                </Label>
                <Input
                  type='number'
                  min={0}
                  value={extras[stateKey]}
                  onChange={(event) =>
                    setExtras((prev) => ({
                      ...prev,
                      [stateKey]: Number(event.target.value) || 0,
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
              {t('Estimated quota cost')}: {result.cost.toLocaleString()}
            </span>
            {result.matchedTier && (
              <Badge variant='outline' className='text-xs'>
                {t('Hit tier')}: {result.matchedTier}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export type TieredPricingEditorProps = {
  modelName?: string
  billingExpr: string
  requestRuleExpr: string
  onBillingExprChange: (next: string) => void
  onRequestRuleExprChange: (next: string) => void
}

type EditorMode = 'visual' | 'raw'

export const TieredPricingEditor = memo(function TieredPricingEditor({
  modelName,
  billingExpr: currentExpr,
  requestRuleExpr: currentRequestRuleExpr,
  onBillingExprChange,
  onRequestRuleExprChange,
}: TieredPricingEditorProps) {
  const { t } = useTranslation()
  const [editorMode, setEditorMode] = useState<EditorMode>('visual')
  const [visualConfig, setVisualConfig] = useState<VisualConfig | null>(() =>
    tryParseVisualConfig(currentExpr)
  )
  const [rawExpr, setRawExpr] = useState(() =>
    combineBillingExpr(currentExpr || '', currentRequestRuleExpr || '')
  )
  const [requestRuleGroups, setRequestRuleGroups] = useState<
    RequestRuleGroup[]
  >(() => tryParseRequestRuleExpr(currentRequestRuleExpr) || [])
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const parsedConfig = tryParseVisualConfig(currentExpr)
    if (parsedConfig) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisualConfig(parsedConfig)
      setEditorMode('visual')
    } else if (currentExpr) {
      setVisualConfig(null)
      setEditorMode('raw')
    } else {
      setVisualConfig(createDefaultVisualConfig())
    }
    setRawExpr(
      combineBillingExpr(currentExpr || '', currentRequestRuleExpr || '')
    )
    setRequestRuleGroups(tryParseRequestRuleExpr(currentRequestRuleExpr) || [])
  }, [currentExpr, currentRequestRuleExpr])

  useEffect(() => {
    initRef.current = false
  }, [modelName])

  const canUseVisualRules = useMemo(() => {
    if (!currentRequestRuleExpr) return true
    return tryParseRequestRuleExpr(currentRequestRuleExpr) !== null
  }, [currentRequestRuleExpr])

  const effectiveExpr = useMemo(() => {
    if (editorMode === 'visual') {
      return generateExprFromVisualConfig(visualConfig)
    }
    const { billingExpr } = splitBillingExprAndRequestRules(rawExpr)
    return billingExpr
  }, [editorMode, visualConfig, rawExpr])

  useEffect(() => {
    if (effectiveExpr !== currentExpr) {
      onBillingExprChange(effectiveExpr)
    }
  }, [effectiveExpr, currentExpr, onBillingExprChange])

  useEffect(() => {
    if (editorMode !== 'visual') return
    const ruleExpr = buildRequestRuleExpr(requestRuleGroups)
    if (ruleExpr !== currentRequestRuleExpr) {
      onRequestRuleExprChange(ruleExpr)
    }
  }, [
    editorMode,
    requestRuleGroups,
    currentRequestRuleExpr,
    onRequestRuleExprChange,
  ])

  const handleVisualChange = useCallback((next: VisualConfig) => {
    setVisualConfig(next)
  }, [])

  const handleRawChange = useCallback(
    (value: string) => {
      setRawExpr(value)
      const { requestRuleExpr: ruleStr } =
        splitBillingExprAndRequestRules(value)
      onRequestRuleExprChange(ruleStr)
    },
    [onRequestRuleExprChange]
  )

  const handleModeChange = useCallback(
    (next: EditorMode) => {
      if (next === 'visual') {
        const { billingExpr, requestRuleExpr: ruleStr } =
          splitBillingExprAndRequestRules(rawExpr)
        const parsed = tryParseVisualConfig(billingExpr)
        if (parsed) {
          setVisualConfig(parsed)
        } else {
          setVisualConfig(createDefaultVisualConfig())
        }
        const parsedGroups = tryParseRequestRuleExpr(ruleStr)
        setRequestRuleGroups(parsedGroups || [])
        onRequestRuleExprChange(ruleStr)
      } else {
        const expr = generateExprFromVisualConfig(visualConfig)
        const ruleExpr = buildRequestRuleExpr(requestRuleGroups)
        setRawExpr(combineBillingExpr(expr, ruleExpr) || expr)
      }
      setEditorMode(next)
    },
    [rawExpr, visualConfig, requestRuleGroups, onRequestRuleExprChange]
  )

  const applyPreset = useCallback(
    (preset: Preset) => {
      const presetGroups = preset.requestRules || []
      const ruleExpr = buildRequestRuleExpr(presetGroups)
      const combined = combineBillingExpr(preset.expr, ruleExpr) || preset.expr
      setRawExpr(combined)
      const parsed = tryParseVisualConfig(preset.expr)
      if (parsed) {
        setVisualConfig(parsed)
        setEditorMode('visual')
      } else {
        setEditorMode('raw')
        setVisualConfig(null)
      }
      setRequestRuleGroups(presetGroups)
      onRequestRuleExprChange(ruleExpr)
    },
    [onRequestRuleExprChange]
  )

  const handleRuleGroupsChange = useCallback((next: RequestRuleGroup[]) => {
    setRequestRuleGroups(next)
  }, [])

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-2'>
        <Label className='text-xs'>{t('Editor mode')}</Label>
        <Select
          value={editorMode}
          onValueChange={(value) => handleModeChange(value as EditorMode)}
        >
          <SelectTrigger className='w-44' size='sm'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='visual'>{t('Visual editor')}</SelectItem>
            <SelectItem value='raw'>{t('Expression editor')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PresetSection applyPreset={applyPreset} />

      <div className='bg-muted/30 space-y-3 rounded-md border p-3'>
        {editorMode === 'visual' ? (
          <VisualEditor
            visualConfig={visualConfig}
            onChange={handleVisualChange}
          />
        ) : (
          <RawExprEditor exprString={rawExpr} onChange={handleRawChange} />
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

            {currentRequestRuleExpr && !canUseVisualRules ? (
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
                <div className='flex flex-wrap gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
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
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() =>
                      handleRuleGroupsChange([
                        ...requestRuleGroups,
                        createEmptyTimeRuleGroup(),
                      ])
                    }
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    {t('Add time rule group')}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <CostEstimator effectiveExpr={effectiveExpr} />
    </div>
  )
})
