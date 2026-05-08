import { useMemo } from 'react'
import { Tag as TagIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BILLING_PRICING_VARS,
  MATCH_CONTAINS,
  MATCH_EQ,
  MATCH_EXISTS,
  MATCH_GTE,
  MATCH_LT,
  MATCH_RANGE,
  SOURCE_TIME,
  normalizeTierLabel,
  parseTiersFromExpr,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  type ParsedTier,
  type RequestCondition,
  type RequestRuleGroup,
  type TierCondition,
} from '../lib/billing-expr'

type DynamicPricingBreakdownProps = {
  billingExpr: string | null | undefined
  /**
   * Label of the tier that fired for the current request. When provided,
   * the corresponding row is highlighted and tagged as "Matched". Used by
   * the usage-log details dialog to show which tier the engine selected.
   */
  matchedTierLabel?: string | null
  /**
   * Hide cache-pricing columns regardless of the per-tier values. The log
   * details dialog passes this when the actual request did not consume any
   * cache tokens, so users only see pricing rows that were relevant to the
   * call they are inspecting. Defaults to false (show all configured prices).
   */
  hideCacheColumns?: boolean
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
  return (group.conditions || [])
    .map((c) => describeCondition(c, t))
    .join(' && ')
}

export function DynamicPricingBreakdown({
  billingExpr,
  matchedTierLabel,
  hideCacheColumns = false,
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
    const parsedTiers = parseTiersFromExpr(split.billingExpr)
    const parsedRules = tryParseRequestRuleExpr(split.requestRuleExpr || '')
    return {
      tiers: parsedTiers,
      ruleGroups: parsedRules || [],
    }
  }, [expr])

  const hasTiers = tiers.length > 0
  const hasRules = ruleGroups.length > 0
  const normalizedMatchedTierLabel = normalizeTierLabel(
    matchedTierLabel ?? undefined
  )

  if (!expr) return null

  if (!hasTiers) {
    return (
      <section className='min-w-0 py-4'>
        <div className='mb-3 flex items-center gap-2'>
          <span className='inline-flex size-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-500/20 dark:text-amber-300'>
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
        <div className='text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase'>
          {t('Raw expression')}
        </div>
        <code className='text-muted-foreground block text-xs break-all'>
          {expr}
        </code>
      </section>
    )
  }

  const visiblePriceFields = BILLING_PRICING_VARS.filter((v) => {
    if (!hasTiers) return false
    if (hideCacheColumns && v.group === 'cache') return false
    return tiers.some(
      (tier) => Number(tier[v.field as string as keyof ParsedTier] || 0) > 0
    )
  })

  return (
    <section className='min-w-0 py-3 sm:py-4'>
      <div className='mb-3 flex items-start gap-2 sm:mb-4'>
        <span className='mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-500/20 dark:text-amber-300'>
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

      {hasTiers && (
        <div className='mb-3 sm:mb-4'>
          <div className='text-foreground mb-2 text-sm font-semibold'>
            {t('Tiered price table')}
          </div>
          <div className='space-y-1.5 sm:hidden'>
            {tiers.map((tier, i) => {
              const condSummary = formatConditionSummary(tier.conditions, t)
              const isMatched =
                matchedTierLabel != null &&
                matchedTierLabel !== '' &&
                tier.label === matchedTierLabel
              return (
                <div
                  key={`tier-mobile-${i}`}
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
                    {visiblePriceFields.map((v) => {
                      const value = Number(
                        tier[v.field as string as keyof ParsedTier] || 0
                      )
                      return (
                        <div key={v.field} className='min-w-0'>
                          <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
                            {t(v.shortLabel)}
                          </div>
                          <div className='truncate font-mono text-sm font-semibold'>
                            {value > 0
                              ? `${symbol}${(value * rate).toFixed(4)}`
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
          <div className='hidden overflow-x-auto sm:block'>
            <Table className='text-sm'>
              <TableHeader>
                <TableRow className='hover:bg-transparent'>
                  <TableHead className='text-muted-foreground py-2 text-[10px] font-medium tracking-wider uppercase'>
                    {t('Tier')}
                  </TableHead>
                  {visiblePriceFields.map((v) => (
                    <TableHead
                      key={v.field}
                      className='text-muted-foreground py-2 text-right text-[10px] font-medium tracking-wider uppercase'
                    >
                      {t(v.shortLabel)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier, i) => {
                  const condSummary = formatConditionSummary(tier.conditions, t)
                  const isMatched =
                    normalizedMatchedTierLabel !== '' &&
                    normalizeTierLabel(tier.label) ===
                      normalizedMatchedTierLabel
                  return (
                    <TableRow
                      key={`tier-${i}`}
                      className={cn(
                        isMatched &&
                          'bg-emerald-50/70 hover:bg-emerald-50/70 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/10'
                      )}
                    >
                      <TableCell className='py-2.5 align-top'>
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
                      </TableCell>
                      {visiblePriceFields.map((v) => {
                        const value = Number(
                          tier[v.field as string as keyof ParsedTier] || 0
                        )
                        return (
                          <TableCell
                            key={v.field}
                            className='py-2.5 text-right align-top font-mono'
                          >
                            {value > 0 ? (
                              <span className='font-semibold'>
                                {`${symbol}${(value * rate).toFixed(4)}`}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {hasRules && (
        <div>
          <div className='text-foreground mb-2 text-sm font-semibold'>
            {t('Conditional multipliers')}
          </div>
          <ul className='space-y-1.5'>
            {ruleGroups.map((group, gi) => (
              <li
                key={`group-${gi}`}
                className='bg-muted/50 flex items-center justify-between gap-3 rounded-md px-3 py-2'
              >
                <span className='text-foreground text-sm break-all'>
                  {describeGroup(group, t)}
                </span>
                <Badge
                  variant='secondary'
                  className='shrink-0 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                >
                  {group.multiplier}x
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
