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
import { Tag as TagIcon } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import {
  BILLING_PRICING_VARS,
  MATCH_CONTAINS,
  MATCH_EQ,
  MATCH_EXISTS,
  MATCH_GTE,
  MATCH_LT,
  MATCH_RANGE,
  SOURCE_TIME,
  parseTaskTiersFromExpr,
  parseTiersFromExpr,
  requestRuleGroupsFromTrace,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  type ParsedTaskTier,
  type ParsedTier,
  type RequestCondition,
  type RequestRuleGroup,
  type RequestRuleTrace,
  type TierCondition,
} from '../lib/billing-expr'
import { isBreakdownTierMatched } from '../lib/breakdown-tier-match'
import type { DynamicPriceLabelKind } from '../lib/dynamic-price'
import { getTaskMatrixDisplayTiers } from '../lib/task-matrix-display'
import type { BillingUsageSchema, BillingUsageUnit } from '../types'

type DynamicPricingBreakdownProps = {
  billingExpr: string | null | undefined
  /**
   * Label of the tier that fired for the current request. When provided,
   * the corresponding row is highlighted and tagged as "Matched". Used by
   * the usage-log details dialog to show which tier the engine selected.
   */
  matchedTierLabel?: string | null
  /** Request-rule traces emitted by the settlement run. */
  requestRules?: RequestRuleTrace[] | null
  /**
   * Hide cache-pricing columns regardless of the per-tier values. The log
   * details dialog passes this when the actual request did not consume any
   * cache tokens, so users only see pricing rows that were relevant to the
   * call they are inspecting. Defaults to false (show all configured prices).
   */
  hideCacheColumns?: boolean
  /**
   * Dense rendering for the usage-log details dialog: drops the colored
   * icon header and uses the dialog's small text sizes. Defaults to false.
   */
  compact?: boolean
  usageSchema?: BillingUsageSchema
  /**
   * Settlement usage facts from the consume log. Used to highlight the
   * expanded matrix display row when the engine label no longer matches
   * any synthesized combination label.
   */
  usageFacts?: Record<string, string | number>
}

type BreakdownTier = ParsedTier | ParsedTaskTier

type BreakdownPriceField = {
  id: string
  label: string
  labelKind: DynamicPriceLabelKind
  unit: BillingUsageUnit | 'request' | 'token'
  value: (tier: BreakdownTier) => number
}

function breakdownPriceFieldLabel(
  field: BreakdownPriceField,
  t: (key: string) => string
): ReactNode {
  if (field.labelKind === 'schema') {
    return <code className='font-mono'>{field.label}</code>
  }
  return t(field.label)
}

const VAR_LABELS: Record<string, string> = {
  p: 'Input',
  c: 'Output',
  len: 'Length',
}
const OP_LABELS: Record<string, string> = {
  '<': '<',
  '<=': '≤',
  '>': '>',
  '>=': '≥',
}
const TIME_FUNC_LABELS: Record<string, string> = {
  hour: 'Hour',
  minute: 'Minute',
  weekday: 'Weekday',
  month: 'Month',
  day: 'Day',
}

function formatTokenHint(value: string | number): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
  }
  return String(n)
}

function formatConditionSummary(
  conditions: TierCondition[],
  t: (key: string) => string
): string {
  return conditions
    .map((c) => {
      const varLabel = t(VAR_LABELS[c.var] || c.var)
      const hint = formatTokenHint(c.value)
      return `${varLabel} ${OP_LABELS[c.op] || c.op} ${hint || c.value}`
    })
    .filter(Boolean)
    .join(' && ')
}

function isTaskBreakdownTier(tier: BreakdownTier): tier is ParsedTaskTier {
  return 'unitPrices' in tier
}

function formatBreakdownConditionSummary(
  tier: BreakdownTier,
  t: (key: string) => string
): string {
  if (!isTaskBreakdownTier(tier)) {
    return formatConditionSummary(tier.conditions, t)
  }
  return tier.conditions
    .map((condition) => `${condition.field} = ${condition.value}`)
    .join(' && ')
}

function formatBreakdownPrice(
  value: number,
  field: BreakdownPriceField,
  symbol: string,
  rate: number,
  t: (key: string) => string
): string {
  const amount = `${symbol}${(value * rate).toFixed(4)}`
  if (field.unit === 'second') return `${amount}/${t('s')}`
  if (field.unit === 'count') return `${amount}/${t('unit')}`
  if (field.unit === 'credit') return `${amount}/${t('credit')}`
  if (
    field.unit === 'token' &&
    !BILLING_PRICING_VARS.some((variable) => variable.field === field.id)
  ) {
    return `${amount}/${t('1M token')}`
  }
  if (field.unit === 'request') return `${amount}/${t('request')}`
  return amount
}

function describeCondition(
  cond: RequestCondition,
  t: (key: string) => string
): string {
  if (cond.source === SOURCE_TIME) {
    const fn = t(TIME_FUNC_LABELS[cond.timeFunc] || cond.timeFunc)
    const tz = cond.timezone || 'UTC'
    if (cond.mode === MATCH_RANGE) {
      return `${fn} ${cond.rangeStart}:00~${cond.rangeEnd}:00 (${tz})`
    }
    const opMap: Record<string, string> = {
      [MATCH_EQ]: '=',
      [MATCH_GTE]: '≥',
      [MATCH_LT]: '<',
    }
    return `${fn} ${opMap[cond.mode] || '='} ${cond.value} (${tz})`
  }
  const src = cond.source === 'header' ? t('Header') : t('Body param')
  const path = cond.path || ''
  if (cond.mode === MATCH_EXISTS) return `${src} ${path} ${t('Exists')}`
  if (cond.mode === MATCH_CONTAINS) {
    return `${src} ${path} ${t('Contains')} "${cond.value}"`
  }
  const opMap: Record<string, string> = {
    eq: '=',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
  }
  return `${src} ${path} ${opMap[cond.mode] || '='} ${cond.value}`
}

function describeGroup(
  group: RequestRuleGroup,
  t: (key: string) => string
): string {
  const description = (group.conditions || [])
    .map((condition) => describeCondition(condition, t))
    .join(' && ')
  return description || group.conditionText || ''
}

function nextOccurrenceKey(
  baseKey: string,
  occurrences: Map<string, number>
): string {
  const occurrence = occurrences.get(baseKey) || 0
  occurrences.set(baseKey, occurrence + 1)
  return `${baseKey}:${occurrence}`
}

export function DynamicPricingBreakdown({
  billingExpr,
  matchedTierLabel,
  requestRules,
  hideCacheColumns = false,
  compact = false,
  usageSchema,
  usageFacts,
}: DynamicPricingBreakdownProps) {
  const { t } = useTranslation()
  const expr = billingExpr || ''
  const currency = useSystemConfigStore((s) => s.config.currency)

  const { symbol, rate } = useMemo(() => {
    if (currency.quotaDisplayType === 'CNY') {
      return { symbol: '¥', rate: currency.usdExchangeRate || 7 }
    }
    if (currency.quotaDisplayType === 'CUSTOM') {
      return {
        symbol: currency.customCurrencySymbol || '¤',
        rate: currency.customCurrencyExchangeRate || 1,
      }
    }
    return { symbol: '$', rate: 1 }
  }, [currency])

  const { tiers, ruleGroups } = useMemo(() => {
    const split = splitBillingExprAndRequestRules(expr)
    const matrixTiers = getTaskMatrixDisplayTiers(
      split.billingExpr,
      usageSchema
    )
    let parsedTiers
    if (matrixTiers) {
      parsedTiers = matrixTiers
    } else if (usageSchema) {
      parsedTiers = parseTaskTiersFromExpr(split.billingExpr, usageSchema)
    } else {
      parsedTiers = parseTiersFromExpr(split.billingExpr)
    }
    const parsedRules =
      requestRules != null
        ? requestRuleGroupsFromTrace(requestRules)
        : tryParseRequestRuleExpr(split.requestRuleExpr || '')
    return {
      tiers: parsedTiers,
      ruleGroups: parsedRules || [],
    }
  }, [expr, usageSchema, requestRules])

  const hasTiers = tiers.length > 0
  const hasRules = ruleGroups.length > 0

  if (!expr) return null

  if (!hasTiers) {
    return (
      <section className={cn('min-w-0', !compact && 'py-4')}>
        {!compact && (
          <div className='mb-3 flex items-center gap-2'>
            <span className='inline-flex size-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-500/20 dark:text-amber-300'>
              <TagIcon className='size-3.5' />
            </span>
            <div>
              <div className='text-foreground text-base font-medium'>
                {t('Special billing expression')}
              </div>
              <div className='text-muted-foreground text-xs'>
                {t('Unable to parse structured pricing')}
              </div>
            </div>
          </div>
        )}
        <div className='text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase'>
          {t('Raw expression')}
        </div>
        <code className='text-muted-foreground block text-xs break-all'>
          {expr}
        </code>
      </section>
    )
  }

  const visiblePriceFields: BreakdownPriceField[] = (() => {
    if (!hasTiers) return []
    if (usageSchema) {
      const fields: BreakdownPriceField[] = Object.entries(usageSchema)
        .filter(
          ([field, definition]) =>
            definition.type === 'number' &&
            Boolean(definition.unit) &&
            tiers.some(
              (tier) =>
                isTaskBreakdownTier(tier) &&
                Number(tier.unitPrices[field] || 0) > 0
            )
        )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([field, definition]) => ({
          id: field,
          label: field,
          labelKind: 'schema' as const,
          unit: definition.unit as BillingUsageUnit,
          value: (tier: BreakdownTier) =>
            isTaskBreakdownTier(tier) ? Number(tier.unitPrices[field] || 0) : 0,
        }))
      if (
        tiers.some((tier) => isTaskBreakdownTier(tier) && tier.constant > 0)
      ) {
        fields.push({
          id: 'constant',
          label: 'Base charge',
          labelKind: 'i18n',
          unit: 'request',
          value: (tier: BreakdownTier) =>
            isTaskBreakdownTier(tier) ? tier.constant : 0,
        })
      }
      return fields
    }
    return BILLING_PRICING_VARS.filter((variable) => {
      if (hideCacheColumns && variable.group === 'cache') return false
      return tiers.some(
        (tier) =>
          !isTaskBreakdownTier(tier) &&
          Number(tier[variable.field as string as keyof ParsedTier] || 0) > 0
      )
    }).map((variable, index) => ({
      id: variable.field ?? `price-${index}`,
      label: variable.shortLabel,
      labelKind: 'i18n' as const,
      unit: 'token',
      value: (tier: BreakdownTier) =>
        isTaskBreakdownTier(tier)
          ? 0
          : Number(tier[variable.field as string as keyof ParsedTier] || 0),
    }))
  })()
  const mobileTierKeyOccurrences = new Map<string, number>()
  const requestRuleKeyOccurrences = new Map<string, number>()

  return (
    <section className={cn('min-w-0', !compact && 'py-3 sm:py-4')}>
      {!compact && (
        <div className='mb-3 flex items-start gap-2 sm:mb-4'>
          <span className='mt-0.5 inline-flex size-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-500/20 dark:text-amber-300'>
            <TagIcon className='size-3.5' />
          </span>
          <div>
            <div className='text-foreground text-base font-medium'>
              {t('Dynamic Pricing')}
            </div>
            <div className='text-muted-foreground text-xs'>
              {t('Prices vary by usage tier and request conditions')}
            </div>
          </div>
        </div>
      )}

      {hasTiers && (
        <div className={cn(compact ? cn(hasRules && 'mb-2') : 'mb-3 sm:mb-4')}>
          <div
            className={
              compact
                ? 'text-muted-foreground mb-1.5 text-xs font-medium'
                : 'text-foreground mb-2 text-sm font-semibold'
            }
          >
            {t('Tiered price table')}
          </div>
          <div className='space-y-1.5 sm:hidden'>
            {tiers.map((tier) => {
              const condSummary = formatBreakdownConditionSummary(tier, t)
              const isMatched = isBreakdownTierMatched(
                tier,
                tiers,
                matchedTierLabel,
                usageFacts
              )
              const rowKey = nextOccurrenceKey(
                JSON.stringify(tier),
                mobileTierKeyOccurrences
              )
              return (
                <div
                  key={`tier-mobile-${rowKey}`}
                  className={cn(
                    'rounded-md border p-2',
                    isMatched && 'border-emerald-500/40 bg-emerald-500/10'
                  )}
                >
                  <div className='mb-1.5 flex flex-wrap items-center gap-1.5'>
                    <Badge
                      variant='secondary'
                      className='bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                    >
                      {tier.label || t('Default')}
                    </Badge>
                    {isMatched && (
                      <Badge
                        variant='secondary'
                        className='bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                      >
                        {t('Matched')}
                      </Badge>
                    )}
                  </div>
                  {condSummary && (
                    <div className='text-muted-foreground mb-1.5 text-xs'>
                      {condSummary}
                    </div>
                  )}
                  <div className='grid grid-cols-2 gap-x-3 gap-y-1.5'>
                    {visiblePriceFields.map((field) => {
                      const value = field.value(tier)
                      return (
                        <div key={field.id} className='min-w-0'>
                          <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
                            {breakdownPriceFieldLabel(field, t)}
                          </div>
                          <div
                            className={cn(
                              'truncate font-mono',
                              compact ? 'text-xs' : 'text-sm font-semibold'
                            )}
                          >
                            {value > 0
                              ? formatBreakdownPrice(
                                  value,
                                  field,
                                  symbol,
                                  rate,
                                  t
                                )
                              : '-'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <StaticDataTable
            className='hidden rounded-none border-0 sm:block'
            tableClassName={
              compact
                ? '[&_td]:text-xs [&_td_*]:text-xs [&_th]:text-xs [&_th_*]:text-xs'
                : 'text-sm'
            }
            headerRowClassName='hover:bg-transparent'
            data={tiers}
            getRowKey={(_tier, index) => `tier-${index}`}
            getRowClassName={(tier) => {
              const isMatched = isBreakdownTierMatched(
                tier,
                tiers,
                matchedTierLabel,
                usageFacts
              )
              return cn(
                isMatched &&
                  'bg-emerald-50/70 hover:bg-emerald-50/70 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/10'
              )
            }}
            columns={[
              {
                id: 'tier',
                header: t('Tier'),
                className: cn(
                  'text-muted-foreground py-2 font-medium',
                  compact && 'h-8'
                ),
                cellClassName: cn('align-top', compact ? 'py-2' : 'py-2.5'),
                cell: (tier) => {
                  const condSummary = formatBreakdownConditionSummary(tier, t)
                  const isMatched = isBreakdownTierMatched(
                    tier,
                    tiers,
                    matchedTierLabel,
                    usageFacts
                  )
                  return (
                    <>
                      <div className='flex flex-wrap items-center gap-1.5'>
                        <Badge
                          variant='secondary'
                          className='bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                        >
                          {tier.label || t('Default')}
                        </Badge>
                        {isMatched && (
                          <Badge
                            variant='secondary'
                            className='bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                          >
                            {t('Matched')}
                          </Badge>
                        )}
                      </div>
                      {condSummary && (
                        <div className='text-muted-foreground mt-1 text-xs'>
                          {condSummary}
                        </div>
                      )}
                    </>
                  )
                },
              },
              ...visiblePriceFields.map((field) => ({
                id: field.id,
                header: breakdownPriceFieldLabel(field, t),
                className: cn(
                  'text-muted-foreground py-2 text-right font-medium',
                  compact && 'h-8'
                ),
                cellClassName: cn(
                  'text-right align-top font-mono',
                  compact ? 'py-2' : 'py-2.5'
                ),
                cell: (tier: BreakdownTier) => {
                  const value = field.value(tier)
                  return value > 0 ? (
                    <span className={cn(!compact && 'font-semibold')}>
                      {formatBreakdownPrice(value, field, symbol, rate, t)}
                    </span>
                  ) : (
                    '-'
                  )
                },
              })),
            ]}
          />
        </div>
      )}

      {hasRules && (
        <div>
          <div
            className={
              compact
                ? 'text-muted-foreground mb-1.5 text-xs font-medium'
                : 'text-foreground mb-2 text-sm font-semibold'
            }
          >
            {t('Conditional multipliers')}
          </div>
          <ul className='space-y-1.5'>
            {ruleGroups.map((group) => {
              const isMatched = group.matched === true
              const rowKey = nextOccurrenceKey(
                `${group.conditionText || JSON.stringify(group.conditions)}:${group.multiplier}`,
                requestRuleKeyOccurrences
              )
              return (
                <li
                  key={`group-${rowKey}`}
                  className={cn(
                    'bg-muted/50 flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2',
                    isMatched && 'border-emerald-500/40 bg-emerald-500/10'
                  )}
                >
                  <span
                    className={cn(
                      'text-foreground break-all',
                      compact ? 'text-xs' : 'text-sm'
                    )}
                  >
                    {describeGroup(group, t)}
                  </span>
                  <Badge
                    variant='secondary'
                    className={cn(
                      'shrink-0 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
                      isMatched &&
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    )}
                  >
                    {group.multiplier}x{isMatched && ` · ${t('Matched')}`}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
