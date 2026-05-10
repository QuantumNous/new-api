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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Code2, HeartPulse, Info, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CopyButton } from '@/components/copy-button'
import { GroupBadge } from '@/components/group-badge'
import { PublicLayout } from '@/components/layout'
import { getPerfMetrics } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import { DEFAULT_TOKEN_UNIT, QUOTA_TYPE_VALUES } from '../constants'
import { usePricingData } from '../hooks/use-pricing-data'
import {
  getDynamicPriceEntries,
  getDynamicPricingSummary,
  getDynamicPricingTiers,
  isDynamicPricingModel,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { getAvailableGroups, isTokenBasedModel } from '../lib/model-helpers'
import { inferModelMetadata } from '../lib/model-metadata'
import { formatFixedPrice, formatGroupPrice } from '../lib/price'
import type {
  Modality,
  ModelCapability,
  PriceType,
  PricingModel,
  TokenUnit,
} from '../types'
import { DynamicPricingBreakdown } from './dynamic-pricing-breakdown'
import { ModelDetailsApi, ModelDetailsProviderInfo } from './model-details-api'
import { ModalityIcons } from './model-details-modalities'
import { ModelDetailsPerformance } from './model-details-performance'
import { ModelDetailsQuickStats } from './model-details-quick-stats'

// ----------------------------------------------------------------------------
// Local UI helpers
// ----------------------------------------------------------------------------

function SectionTitle(props: { children: React.ReactNode }) {
  return (
    <h2 className='text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase'>
      {props.children}
    </h2>
  )
}

const CAPABILITY_LABEL_KEYS: Record<ModelCapability, string> = {
  function_calling: 'Function calling',
  streaming: 'Streaming',
  vision: 'Vision',
  json_mode: 'JSON mode',
  structured_output: 'Structured output',
  reasoning: 'Reasoning',
  tools: 'Tools',
  system_prompt: 'System prompt',
  web_search: 'Web search',
  code_interpreter: 'Code interpreter',
  caching: 'Prompt caching',
  embeddings: 'Embeddings',
}

function CompactCapabilityList(props: { capabilities: ModelCapability[] }) {
  const { t } = useTranslation()

  if (props.capabilities.length === 0) {
    return (
      <span className='text-muted-foreground text-xs'>
        {t('No capabilities reported for this model.')}
      </span>
    )
  }

  return (
    <div className='flex flex-wrap gap-1.5'>
      {props.capabilities.map((capability) => (
        <span
          key={capability}
          className='bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-medium'
        >
          {t(CAPABILITY_LABEL_KEYS[capability] ?? capability)}
        </span>
      ))}
    </div>
  )
}

function CompactModalities(props: { input: Modality[]; output: Modality[] }) {
  const { t } = useTranslation()

  return (
    <div className='grid gap-2 sm:grid-cols-2'>
      <div className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2'>
        <span className='text-muted-foreground text-xs font-medium'>
          {t('Input')}
        </span>
        <ModalityIcons modalities={props.input} />
      </div>
      <div className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2'>
        <span className='text-muted-foreground text-xs font-medium'>
          {t('Output')}
        </span>
        <ModalityIcons modalities={props.output} />
      </div>
    </div>
  )
}

function ModelSignalsSection(props: {
  capabilities: ModelCapability[]
  input: Modality[]
  output: Modality[]
}) {
  const { t } = useTranslation()

  return (
    <section>
      <SectionTitle>
        {t('Capabilities')} / {t('Supported modalities')}
      </SectionTitle>
      <div className='grid gap-3 rounded-xl border p-3 @2xl/details:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]'>
        <CompactCapabilityList capabilities={props.capabilities} />
        <CompactModalities input={props.input} output={props.output} />
      </div>
    </section>
  )
}

function OverviewMetric(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  intent?: 'default' | 'warning' | 'success'
}) {
  const Icon = props.icon
  const intent = props.intent ?? 'default'

  return (
    <div className='flex min-w-0 items-center gap-2 px-3 py-2'>
      <Icon className='text-muted-foreground/70 size-3.5 shrink-0' />
      <div className='min-w-0 flex-1'>
        <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
          {props.label}
        </div>
        <div
          className={cn(
            'text-foreground truncate font-mono text-sm font-semibold tabular-nums',
            intent === 'warning' && 'text-amber-600 dark:text-amber-400',
            intent === 'success' && 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {props.value}
        </div>
      </div>
    </div>
  )
}

function OverviewSummaryGrid(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics', props.model.model_name],
    queryFn: () => getPerfMetrics(props.model.model_name, 24),
    staleTime: 60 * 1000,
  })

  const groups = metricsQuery.data?.data.groups ?? []
  const successRates = groups
    .map((group) => group.success_rate)
    .filter((rate) => Number.isFinite(rate))
  const successRate =
    successRates.length > 0
      ? successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length
      : Number.NaN
  let successIntent: 'default' | 'warning' | 'success' = 'warning'
  if (successRate >= 99.9) {
    successIntent = 'success'
  } else if (successRate >= 99) {
    successIntent = 'default'
  }
  const tpsValues = groups
    .map((group) => group.avg_tps)
    .filter((value) => value > 0)
  const avgTps =
    tpsValues.length > 0
      ? tpsValues.reduce((sum, value) => sum + value, 0) / tpsValues.length
      : 0
  const latencyValues = groups
    .map((group) => group.avg_latency_ms)
    .filter((value) => value > 0)
  const avgLatency =
    latencyValues.length > 0
      ? Math.round(
          latencyValues.reduce((sum, value) => sum + value, 0) /
            latencyValues.length
        )
      : 0

  return (
    <div className='bg-muted/20 grid overflow-hidden rounded-lg border sm:grid-cols-3 sm:divide-x'>
      <OverviewMetric
        icon={Timer}
        label='TPS'
        value={formatThroughput(avgTps)}
      />
      <OverviewMetric
        icon={Timer}
        label={t('Average latency')}
        value={formatLatency(avgLatency)}
      />
      <OverviewMetric
        icon={HeartPulse}
        label={t('Success rate')}
        value={formatUptimePct(successRate)}
        intent={successIntent}
      />
    </div>
  )
}

// ----------------------------------------------------------------------------
// Model header (always visible above the detail sections)
// ----------------------------------------------------------------------------

function ModelHeader(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const model = props.model
  const vendorIcon = model.vendor_icon
    ? getLobeIcon(model.vendor_icon, 20)
    : null
  const description = model.description || model.vendor_description || null
  const tags = parseTags(model.tags)
  const isSpecialExpression =
    model.billing_mode === 'tiered_expr' &&
    Boolean(model.billing_expr) &&
    getDynamicPricingTiers(model).length === 0

  return (
    <header className='pb-4'>
      <div className='flex items-center gap-2.5'>
        {vendorIcon}
        <h1 className='font-mono text-xl font-bold tracking-tight sm:text-2xl'>
          {model.model_name}
        </h1>
        <CopyButton
          value={model.model_name || ''}
          className='size-6'
          iconClassName='size-3'
          tooltip={t('Copy model name')}
          successTooltip={t('Copied!')}
          aria-label={t('Copy model name')}
        />
      </div>
      <div className='mt-1 flex flex-wrap items-center gap-1.5 text-xs'>
        {model.vendor_name && (
          <span className='text-muted-foreground'>{model.vendor_name}</span>
        )}
        <span className='text-muted-foreground/30'>·</span>
        <span className='text-muted-foreground/70'>
          {model.quota_type === QUOTA_TYPE_VALUES.TOKEN
            ? t('Token-based')
            : t('Per Request')}
        </span>
        {model.billing_mode === 'tiered_expr' && model.billing_expr && (
          <>
            <span className='text-muted-foreground/30'>·</span>
            <span className='rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'>
              {isSpecialExpression
                ? t('Special billing expression')
                : t('Dynamic Pricing')}
            </span>
          </>
        )}
      </div>
      {description && (
        <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
          {description}
        </p>
      )}
      {tags.length > 0 && (
        <div className='mt-2.5 flex flex-wrap gap-1'>
          {tags.map((tag) => (
            <span
              key={tag}
              className='bg-muted text-muted-foreground rounded px-2 py-0.5 text-[11px] font-medium'
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </header>
  )
}

// ----------------------------------------------------------------------------
// Base price card (used in the Overview tab)
// ----------------------------------------------------------------------------

function PriceSection(props: {
  model: PricingModel
  priceRate: number
  usdExchangeRate: number
  tokenUnit: TokenUnit
  showRechargePrice: boolean
}) {
  const { t } = useTranslation()
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = props.tokenUnit === 'K' ? '1K' : '1M'
  const baseGroupKey = '_base'
  const baseGroupRatioMap = { [baseGroupKey]: 1 }
  const dynamicSummary = getDynamicPricingSummary(props.model, {
    tokenUnit: props.tokenUnit,
    showRechargePrice: props.showRechargePrice,
    priceRate: props.priceRate,
    usdExchangeRate: props.usdExchangeRate,
    groupRatioMultiplier: 1,
  })

  const primaryPriceTypes: { label: string; type: PriceType }[] = [
    { label: t('Input'), type: 'input' },
    { label: t('Output'), type: 'output' },
  ]
  const secondaryPriceTypes: {
    label: string
    type: PriceType
    available: boolean
  }[] = [
    {
      label: t('Cached input'),
      type: 'cache',
      available: props.model.cache_ratio != null,
    },
    {
      label: t('Cache write'),
      type: 'create_cache',
      available: props.model.create_cache_ratio != null,
    },
    {
      label: t('Image input'),
      type: 'image',
      available: props.model.image_ratio != null,
    },
    {
      label: t('Audio input'),
      type: 'audio_input',
      available: props.model.audio_ratio != null,
    },
    {
      label: t('Audio output'),
      type: 'audio_output',
      available:
        props.model.audio_ratio != null &&
        props.model.audio_completion_ratio != null,
    },
  ]

  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      return (
        <section>
          <SectionTitle>{t('Base Price')}</SectionTitle>
          <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10'>
            <div className='text-sm font-medium text-amber-800 dark:text-amber-200'>
              {t('Special billing expression')}
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('Unable to parse structured pricing')}
            </p>
            <div className='mt-3'>
              <div className='text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase'>
                {t('Raw expression')}
              </div>
              <code className='text-muted-foreground bg-background/80 block max-h-28 overflow-auto rounded-md border px-2 py-1.5 font-mono text-xs break-all'>
                {dynamicSummary.rawExpression}
              </code>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section>
        <SectionTitle>{t('Base Price')}</SectionTitle>
        {dynamicSummary.primaryEntries.length > 0 ? (
          <div className='grid grid-cols-2 gap-2'>
            {dynamicSummary.primaryEntries.map((entry) => (
              <div
                key={entry.key}
                className='bg-muted/20 rounded-lg border p-3'
              >
                <div className='text-muted-foreground text-xs'>
                  {t(entry.shortLabel)}
                </div>
                <div className='text-foreground mt-1 font-mono text-base font-semibold tabular-nums'>
                  {entry.formatted}
                  <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
                    / {tokenUnitLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t('Dynamic Pricing')}
          </p>
        )}
        {dynamicSummary.secondaryEntries.length > 0 && (
          <div className='bg-muted/20 mt-3 rounded-lg border px-3 py-2.5'>
            <div className='space-y-1.5'>
              {dynamicSummary.secondaryEntries.map((entry) => (
                <div
                  key={entry.key}
                  className='flex items-baseline justify-between gap-4'
                >
                  <span className='text-muted-foreground/70 text-sm'>
                    {t(entry.shortLabel)}
                  </span>
                  <span className='text-muted-foreground font-mono text-sm tabular-nums'>
                    {entry.formatted}
                    <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
                      / {tokenUnitLabel}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    )
  }

  if (!isTokenBased) {
    return (
      <section>
        <SectionTitle>{t('Base Price')}</SectionTitle>
        <div className='flex items-baseline justify-between'>
          <span className='text-muted-foreground text-sm'>
            {t('Per request')}
          </span>
          <span className='text-foreground font-mono text-sm font-semibold tabular-nums'>
            {formatFixedPrice(
              props.model,
              baseGroupKey,
              props.showRechargePrice,
              props.priceRate,
              props.usdExchangeRate,
              baseGroupRatioMap
            )}
          </span>
        </div>
      </section>
    )
  }

  const secondaryItems = secondaryPriceTypes.filter((p) => p.available)
  const renderPrice = (type: PriceType) => (
    <>
      {formatGroupPrice(
        props.model,
        baseGroupKey,
        type,
        props.tokenUnit,
        props.showRechargePrice,
        props.priceRate,
        props.usdExchangeRate,
        baseGroupRatioMap
      )}
      <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
        / {tokenUnitLabel}
      </span>
    </>
  )

  return (
    <section>
      <SectionTitle>{t('Base Price')}</SectionTitle>
      <div className='grid grid-cols-2 gap-2'>
        {primaryPriceTypes.map((item) => (
          <div key={item.type} className='bg-muted/20 rounded-lg border p-3'>
            <div className='text-muted-foreground text-xs'>{item.label}</div>
            <div className='text-foreground mt-1 font-mono text-base font-semibold tabular-nums'>
              {renderPrice(item.type)}
            </div>
          </div>
        ))}
      </div>
      {secondaryItems.length > 0 && (
        <div className='bg-muted/20 mt-3 rounded-lg border px-3 py-2.5'>
          <div className='space-y-1.5'>
            {secondaryItems.map((item) => (
              <div
                key={item.type}
                className='flex items-baseline justify-between gap-4'
              >
                <span className='text-muted-foreground/70 text-sm'>
                  {item.label}
                </span>
                <span className='text-muted-foreground font-mono text-sm tabular-nums'>
                  {renderPrice(item.type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ----------------------------------------------------------------------------
// Auto group chain (used inside group pricing section)
// ----------------------------------------------------------------------------

function AutoGroupChain(props: { model: PricingModel; autoGroups: string[] }) {
  const { t } = useTranslation()
  const modelEnableGroups = Array.isArray(props.model.enable_groups)
    ? props.model.enable_groups
    : []
  const autoChain = props.autoGroups.filter((g) =>
    modelEnableGroups.includes(g)
  )

  if (autoChain.length === 0) return null

  return (
    <div className='text-muted-foreground mb-3 flex flex-wrap items-center gap-1 text-xs'>
      <span className='font-medium'>{t('Auto Group Chain')}</span>
      <span className='text-muted-foreground/40'>→</span>
      {autoChain.map((g, idx) => (
        <span key={g} className='flex items-center gap-1'>
          <GroupBadge group={g} size='sm' />
          {idx < autoChain.length - 1 && (
            <span className='text-muted-foreground/40'>→</span>
          )}
        </span>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Group pricing table
// ----------------------------------------------------------------------------

function GroupPricingSection(props: {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
  autoGroups: string[]
  priceRate: number
  usdExchangeRate: number
  tokenUnit: TokenUnit
  showRechargePrice?: boolean
}) {
  const { t } = useTranslation()
  const showRechargePrice = props.showRechargePrice ?? false

  const availableGroups = useMemo(
    () => getAvailableGroups(props.model, props.usableGroup || {}),
    [props.model, props.usableGroup]
  )

  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = props.tokenUnit === 'K' ? '1K' : '1M'

  const extraPriceTypes = useMemo(() => {
    const types: { label: string; type: PriceType }[] = []
    if (props.model.cache_ratio != null)
      types.push({ label: t('Cache'), type: 'cache' })
    if (props.model.create_cache_ratio != null)
      types.push({ label: t('Cache Write'), type: 'create_cache' })
    if (props.model.image_ratio != null)
      types.push({ label: t('Image'), type: 'image' })
    if (props.model.audio_ratio != null)
      types.push({ label: t('Audio In'), type: 'audio_input' })
    if (
      props.model.audio_ratio != null &&
      props.model.audio_completion_ratio != null
    )
      types.push({ label: t('Audio Out'), type: 'audio_output' })
    return types
  }, [props.model, t])

  if (availableGroups.length === 0) {
    return (
      <section>
        <SectionTitle>{t('Pricing by Group')}</SectionTitle>
        <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
        <p className='text-muted-foreground text-sm'>
          {t(
            'This model is not available in any group, or no group pricing information is configured.'
          )}
        </p>
      </section>
    )
  }

  const thClass =
    'text-muted-foreground py-2 text-[10px] font-medium tracking-wider uppercase'

  if (isDynamicPricingModel(props.model)) {
    const dynamicTiers = getDynamicPricingTiers(props.model)

    if (dynamicTiers.length === 0) {
      return (
        <section>
          <SectionTitle>{t('Pricing by Group')}</SectionTitle>
          <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
          <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10'>
            <div className='text-sm font-medium text-amber-800 dark:text-amber-200'>
              {t('Special billing expression')}
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t(
                'Group prices cannot be expanded because this expression is not a standard tiered pricing expression.'
              )}
            </p>
            <div className='mt-3'>
              <div className='text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase'>
                {t('Raw expression')}
              </div>
              <code className='text-muted-foreground bg-background/80 block max-h-28 overflow-auto rounded-md border px-2 py-1.5 font-mono text-xs break-all'>
                {props.model.billing_expr}
              </code>
            </div>
          </div>
        </section>
      )
    }

    const priceFields = Array.from(
      new Map(
        dynamicTiers
          .flatMap((tier) =>
            getDynamicPriceEntries(tier, {
              tokenUnit: props.tokenUnit,
              showRechargePrice,
              priceRate: props.priceRate,
              usdExchangeRate: props.usdExchangeRate,
              groupRatioMultiplier: 1,
            })
          )
          .map((entry) => [entry.field, entry])
      ).values()
    )

    return (
      <section>
        <SectionTitle>{t('Pricing by Group')}</SectionTitle>
        <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
        <div className='space-y-3'>
          {availableGroups.map((group) => {
            const ratio = props.groupRatio[group] || 1
            return (
              <div key={group} className='overflow-hidden rounded-lg border'>
                <div className='bg-muted/20 flex items-center justify-between gap-3 border-b px-3 py-2'>
                  <GroupBadge group={group} size='sm' />
                  <span className='text-muted-foreground font-mono text-xs'>
                    {ratio}x
                  </span>
                </div>
                <div className='overflow-x-auto'>
                  <Table className='text-sm'>
                    <TableHeader>
                      <TableRow className='hover:bg-transparent'>
                        <TableHead className={thClass}>{t('Tier')}</TableHead>
                        {priceFields.map((entry) => (
                          <TableHead
                            key={entry.field}
                            className={`${thClass} text-right`}
                          >
                            {t(entry.shortLabel)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dynamicTiers.map((tier, tierIndex) => {
                        const entries = getDynamicPriceEntries(tier, {
                          tokenUnit: props.tokenUnit,
                          showRechargePrice,
                          priceRate: props.priceRate,
                          usdExchangeRate: props.usdExchangeRate,
                          groupRatioMultiplier: ratio,
                        })
                        const entryMap = new Map(
                          entries.map((entry) => [entry.field, entry])
                        )

                        return (
                          <TableRow key={`${group}-${tier.label || tierIndex}`}>
                            <TableCell className='text-muted-foreground py-2.5 text-xs'>
                              {tier.label || t('Default')}
                            </TableCell>
                            {priceFields.map((fieldEntry) => {
                              const entry = entryMap.get(fieldEntry.field)
                              return (
                                <TableCell
                                  key={fieldEntry.field}
                                  className='py-2.5 text-right font-mono'
                                >
                                  {entry?.formatted ?? '-'}
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
            )
          })}
          <p className='text-muted-foreground/40 mt-1.5 text-[10px]'>
            {t('Prices shown per')} {tokenUnitLabel} tokens
          </p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <SectionTitle>{t('Pricing by Group')}</SectionTitle>
      <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
      <div className='-mx-4 overflow-x-auto sm:mx-0'>
        <Table className='text-sm'>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className={thClass}>{t('Group')}</TableHead>
              <TableHead className={thClass}>{t('Ratio')}</TableHead>
              {isTokenBased ? (
                <>
                  <TableHead className={`${thClass} text-right`}>
                    {t('Input')}
                  </TableHead>
                  <TableHead className={`${thClass} text-right`}>
                    {t('Output')}
                  </TableHead>
                  {extraPriceTypes.map((ep) => (
                    <TableHead
                      key={ep.type}
                      className={`${thClass} text-right`}
                    >
                      {ep.label}
                    </TableHead>
                  ))}
                </>
              ) : (
                <TableHead className={`${thClass} text-right`}>
                  {t('Price')}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {availableGroups.map((group) => {
              const ratio = props.groupRatio[group] || 1
              return (
                <TableRow key={group}>
                  <TableCell className='py-2.5'>
                    <GroupBadge group={group} size='sm' />
                  </TableCell>
                  <TableCell className='text-muted-foreground py-2.5 font-mono text-xs'>
                    {ratio}x
                  </TableCell>
                  {isTokenBased ? (
                    <>
                      <TableCell className='py-2.5 text-right font-mono'>
                        {formatGroupPrice(
                          props.model,
                          group,
                          'input',
                          props.tokenUnit,
                          showRechargePrice,
                          props.priceRate,
                          props.usdExchangeRate,
                          props.groupRatio
                        )}
                      </TableCell>
                      <TableCell className='py-2.5 text-right font-mono'>
                        {formatGroupPrice(
                          props.model,
                          group,
                          'output',
                          props.tokenUnit,
                          showRechargePrice,
                          props.priceRate,
                          props.usdExchangeRate,
                          props.groupRatio
                        )}
                      </TableCell>
                      {extraPriceTypes.map((ep) => (
                        <TableCell
                          key={ep.type}
                          className='py-2.5 text-right font-mono'
                        >
                          {formatGroupPrice(
                            props.model,
                            group,
                            ep.type,
                            props.tokenUnit,
                            showRechargePrice,
                            props.priceRate,
                            props.usdExchangeRate,
                            props.groupRatio
                          )}
                        </TableCell>
                      ))}
                    </>
                  ) : (
                    <TableCell className='py-2.5 text-right font-mono'>
                      {formatFixedPrice(
                        props.model,
                        group,
                        showRechargePrice,
                        props.priceRate,
                        props.usdExchangeRate,
                        props.groupRatio
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {isTokenBased && (
          <p className='text-muted-foreground/40 mt-1.5 px-4 text-[10px] sm:px-0'>
            {t('Prices shown per')} {tokenUnitLabel} tokens
          </p>
        )}
      </div>
    </section>
  )
}

const TAB_VALUES = ['overview', 'performance', 'api'] as const
type TabValue = (typeof TAB_VALUES)[number]

const TAB_META: Record<
  TabValue,
  { icon: React.ComponentType<{ className?: string }>; labelKey: string }
> = {
  overview: { icon: Info, labelKey: 'Overview' },
  performance: { icon: HeartPulse, labelKey: 'Performance' },
  api: { icon: Code2, labelKey: 'API' },
}

export interface ModelDetailsContentProps {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
  endpointMap: Record<string, { path?: string; method?: string }>
  autoGroups: string[]
  priceRate: number
  usdExchangeRate: number
  tokenUnit: TokenUnit
  showRechargePrice?: boolean
}

export function ModelDetailsContent(props: ModelDetailsContentProps) {
  const { t } = useTranslation()
  const showRechargePrice = props.showRechargePrice ?? false
  const metadata = useMemo(() => inferModelMetadata(props.model), [props.model])

  const isDynamic =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)

  return (
    <div className='@container/details space-y-4'>
      <ModelHeader model={props.model} />

      <Tabs defaultValue='overview' className='gap-4'>
        <TabsList className='bg-muted/60 h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg p-1'>
          {TAB_VALUES.map((value) => {
            const Icon = TAB_META[value].icon
            return (
              <TabsTrigger
                key={value}
                value={value}
                className='h-8 gap-1.5 rounded-md px-3 text-xs sm:text-sm'
              >
                <Icon className='size-3.5' />
                <span>{t(TAB_META[value].labelKey)}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value='overview' className='space-y-6 outline-none'>
          <OverviewSummaryGrid model={props.model} />

          <section className='bg-card/60 space-y-5 rounded-xl border p-4 shadow-sm'>
            <SectionTitle>{t('Pricing')}</SectionTitle>
            <PriceSection
              model={props.model}
              priceRate={props.priceRate}
              usdExchangeRate={props.usdExchangeRate}
              tokenUnit={props.tokenUnit}
              showRechargePrice={showRechargePrice}
            />
            {isDynamic && (
              <DynamicPricingBreakdown billingExpr={props.model.billing_expr} />
            )}
            <GroupPricingSection
              model={props.model}
              groupRatio={props.groupRatio}
              usableGroup={props.usableGroup}
              autoGroups={props.autoGroups}
              priceRate={props.priceRate}
              usdExchangeRate={props.usdExchangeRate}
              tokenUnit={props.tokenUnit}
              showRechargePrice={showRechargePrice}
            />
          </section>

          <ModelDetailsQuickStats metadata={metadata} />

          <ModelSignalsSection
            capabilities={metadata.capabilities}
            input={metadata.input_modalities}
            output={metadata.output_modalities}
          />

          <ModelDetailsProviderInfo model={props.model} />
        </TabsContent>

        <TabsContent value='performance' className='outline-none'>
          <ModelDetailsPerformance model={props.model} />
        </TabsContent>

        <TabsContent value='api' className='outline-none'>
          <ModelDetailsApi
            model={props.model}
            endpointMap={props.endpointMap}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Drawer & page wrappers
// ----------------------------------------------------------------------------

export interface ModelDetailsDrawerProps extends ModelDetailsContentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModelDetailsDrawer(props: ModelDetailsDrawerProps) {
  const { t } = useTranslation()
  const { open, onOpenChange, ...contentProps } = props

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='flex h-dvh w-full overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl'
      >
        <SheetHeader className='sr-only'>
          <SheetTitle>{props.model.model_name}</SheetTitle>
          <SheetDescription>{t('Model details')}</SheetDescription>
        </SheetHeader>
        <div className='flex-1 overflow-y-auto px-4 pt-11 pb-5 sm:px-6 sm:pt-12 sm:pb-6'>
          <ModelDetailsContent {...contentProps} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function ModelDetails() {
  const { t } = useTranslation()
  const { modelId } = useParams({ from: '/pricing/$modelId/' })
  const search = useSearch({ from: '/pricing/$modelId/' })
  const navigate = useNavigate()

  const {
    models,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const tokenUnit: TokenUnit =
    search.tokenUnit === 'K' ? 'K' : DEFAULT_TOKEN_UNIT

  const model = useMemo(() => {
    if (!models || !modelId) return null
    return models.find((m) => m.model_name === modelId) || null
  }, [models, modelId])

  const handleBack = () => {
    navigate({ to: '/pricing', search })
  }

  if (isLoading) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-5xl px-4 sm:px-6'>
          <Skeleton className='mb-4 h-5 w-16' />
          <div className='space-y-2'>
            <Skeleton className='h-7 w-64' />
            <Skeleton className='h-4 w-40' />
            <Skeleton className='h-4 w-full max-w-md' />
          </div>
          <div className='mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-16 w-full' />
            ))}
          </div>
          <div className='mt-6 space-y-3'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-24 w-full' />
            ))}
          </div>
        </div>
      </PublicLayout>
    )
  }

  if (!model) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-2xl px-4 text-center sm:px-6'>
          <h2 className='mb-1 text-base font-semibold'>
            {t('Model not found')}
          </h2>
          <p className='text-muted-foreground mb-4 text-sm'>
            {t("The model you're looking for doesn't exist.")}
          </p>
          <Button onClick={handleBack} variant='outline' size='sm'>
            {t('Back to Models')}
          </Button>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto max-w-5xl px-4 sm:px-6'>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleBack}
          className='text-muted-foreground hover:text-foreground mb-4 h-auto gap-1 px-0 py-1 text-xs'
        >
          <ArrowLeft className='size-3.5' />
          {t('Back')}
        </Button>

        <ModelDetailsContent
          model={model}
          groupRatio={groupRatio || {}}
          usableGroup={usableGroup || {}}
          autoGroups={autoGroups || []}
          priceRate={priceRate ?? 1}
          usdExchangeRate={usdExchangeRate ?? 1}
          tokenUnit={tokenUnit}
          showRechargePrice={search.rechargePrice ?? false}
          endpointMap={
            (endpointMap as Record<
              string,
              { path?: string; method?: string }
            >) || {}
          }
        />
      </div>
    </PublicLayout>
  )
}
