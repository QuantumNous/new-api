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
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarClock,
  Code2,
  FileText,
  HeartPulse,
  Info,
  Layers,
  Maximize2,
  Sparkles,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { StaticDataTable } from '@/components/data-table'
import { Button } from '@/components/design-system/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/design-system/tabs'
import { GroupBadge } from '@/components/group-badge'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getPerfMetrics } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

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
import { formatFixedPrice, formatGroupPrice } from '../lib/price'
import type {
  ModelCapability,
  PriceType,
  PricingModel,
  TokenUnit,
} from '../types'
import { DynamicPricingBreakdown } from './dynamic-pricing-breakdown'
import { ModelDetailsApi } from './model-details-api'
import { ModelDetailsPerformance } from './model-details-performance'

// ----------------------------------------------------------------------------
// Local UI helpers
// ----------------------------------------------------------------------------

function SectionTitle(props: {
  children: React.ReactNode
  description?: string
}) {
  return (
    <div className='mb-4'>
      <h2 className='text-base font-semibold'>{props.children}</h2>
      {props.description && (
        <p className='text-muted-foreground mt-1 text-sm'>
          {props.description}
        </p>
      )}
    </div>
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

const MODALITY_LABEL_KEYS: Record<string, string> = {
  text: 'Text',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  file: 'File',
}

const TOKEN_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

function formatCatalogTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return ''
  if (tokens >= 1_000_000) {
    return `${TOKEN_FORMAT.format(tokens / 1_000_000)}M`
  }
  if (tokens >= 1_000) {
    return `${TOKEN_FORMAT.format(tokens / 1_000)}K`
  }
  return TOKEN_FORMAT.format(tokens)
}

function formatCatalogYearMonth(value?: string): string {
  if (!value) return ''
  const [yearStr, monthStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return value
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short' })
}

function normalizeCatalogItems(items?: readonly string[]): string[] {
  if (!items) return []
  return items.filter((item) => item.trim().length > 0)
}

function OverviewMetric(props: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className='min-w-0 px-4 py-3'>
      <div className='text-muted-foreground text-xs font-medium'>
        {props.label}
      </div>
      <div
        className={cn(
          'text-foreground mt-1 truncate text-sm font-semibold tabular-nums',
          props.valueClassName
        )}
      >
        {props.value}
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
    <div className='divide-border grid divide-y overflow-hidden rounded-xl border sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
      <OverviewMetric label='TPS' value={formatThroughput(avgTps)} />
      <OverviewMetric
        label={t('Average latency')}
        value={formatLatency(avgLatency)}
      />
      <OverviewMetric
        label={t('Success rate')}
        value={formatUptimePct(successRate)}
        valueClassName={getSuccessRateTextClass(successRate)}
      />
    </div>
  )
}

function CatalogPillList(props: { items: string[] }) {
  return (
    <div className='flex min-w-0 flex-wrap gap-1.5'>
      {props.items.map((item) => (
        <StatusBadge key={item} variant='neutral' size='md'>
          {item}
        </StatusBadge>
      ))}
    </div>
  )
}

function CatalogTextValue(props: { children: React.ReactNode }) {
  return (
    <span className='text-foreground min-w-0 truncate text-sm font-medium'>
      {props.children}
    </span>
  )
}

function CatalogInfoCell(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex min-w-0 flex-col gap-1.5 px-4 py-3'>
      <span className='text-muted-foreground text-xs font-medium'>
        {props.label}
      </span>
      {props.children}
    </div>
  )
}

function ModalityLabels(props: { items: string[] }) {
  const { t } = useTranslation()
  if (props.items.length === 0) return null

  return (
    <span className='inline-flex items-center gap-1 align-middle'>
      {props.items.map((item) => (
        <span key={item} className='font-medium'>
          {t(MODALITY_LABEL_KEYS[item] ?? item)}
        </span>
      ))}
    </span>
  )
}

function ModelBackendQuickStats(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const model = props.model
  const inputModalities = normalizeCatalogItems(model.input_modalities)
  const outputModalities = normalizeCatalogItems(model.output_modalities)
  const contextLength = model.context_length ?? 0
  const maxOutput = model.max_output_tokens ?? 0
  const knowledgeCutoff = formatCatalogYearMonth(model.knowledge_cutoff)
  const releaseDate = formatCatalogYearMonth(model.release_date)

  const stats: {
    key: string
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: React.ReactNode
    hint?: string
  }[] = []

  if (contextLength > 0) {
    stats.push({
      key: 'context',
      icon: Layers,
      label: t('Context'),
      value: formatCatalogTokenCount(contextLength),
      hint: t('Maximum input window'),
    })
  }

  if (maxOutput > 0) {
    stats.push({
      key: 'max-output',
      icon: Maximize2,
      label: t('Max output'),
      value: formatCatalogTokenCount(maxOutput),
      hint: t('Maximum tokens per response'),
    })
  }

  if (inputModalities.length > 0 || outputModalities.length > 0) {
    stats.push({
      key: 'modalities',
      icon: FileText,
      label: t('Modalities'),
      value: (
        <span className='inline-flex items-center gap-1'>
          <ModalityLabels items={inputModalities} />
          {inputModalities.length > 0 && outputModalities.length > 0 && (
            <span className='text-muted-foreground/40'>→</span>
          )}
          <ModalityLabels items={outputModalities} />
        </span>
      ),
    })
  }

  if (knowledgeCutoff) {
    stats.push({
      key: 'knowledge',
      icon: Sparkles,
      label: t('Knowledge cutoff'),
      value: knowledgeCutoff,
    })
  }

  if (releaseDate) {
    stats.push({
      key: 'release',
      icon: CalendarClock,
      label: t('Released'),
      value: releaseDate,
    })
  }

  if (stats.length === 0) return null

  return (
    <div className='divide-border grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border @md/details:grid-cols-3 @2xl/details:grid-cols-5'>
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div key={stat.key} className='flex min-w-0 flex-col gap-1 px-4 py-3'>
            <span className='text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs font-medium'>
              <Icon className='size-3.5 shrink-0' />
              <span className='truncate'>{stat.label}</span>
            </span>
            <span className='text-foreground truncate text-sm font-semibold tabular-nums'>
              {stat.value}
            </span>
            {stat.hint && (
              <span className='text-muted-foreground truncate text-xs'>
                {stat.hint}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ModelBackendSignalsSection(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const capabilities = normalizeCatalogItems(props.model.capabilities)
  const inputModalities = normalizeCatalogItems(props.model.input_modalities)
  const outputModalities = normalizeCatalogItems(props.model.output_modalities)

  if (
    capabilities.length === 0 &&
    inputModalities.length === 0 &&
    outputModalities.length === 0
  ) {
    return null
  }

  return (
    <section>
      <SectionTitle>{t('Capabilities')}</SectionTitle>
      <div className='space-y-4 rounded-xl border p-4'>
        {capabilities.length > 0 && (
          <CatalogPillList
            items={capabilities.map((capability) =>
              t(
                CAPABILITY_LABEL_KEYS[capability as ModelCapability] ??
                  capability
              )
            )}
          />
        )}
        {(inputModalities.length > 0 || outputModalities.length > 0) && (
          <div className='grid gap-2 sm:grid-cols-2'>
            {inputModalities.length > 0 && (
              <div className='bg-muted/20 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5'>
                <span className='text-muted-foreground text-xs font-medium'>
                  {t('Input')}
                </span>
                <CatalogTextValue>
                  <ModalityLabels items={inputModalities} />
                </CatalogTextValue>
              </div>
            )}
            {outputModalities.length > 0 && (
              <div className='bg-muted/20 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5'>
                <span className='text-muted-foreground text-xs font-medium'>
                  {t('Output')}
                </span>
                <CatalogTextValue>
                  <ModalityLabels items={outputModalities} />
                </CatalogTextValue>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function ModelBackendProviderSection(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const model = props.model
  const groups = normalizeCatalogItems(model.enable_groups)
  const endpoints = normalizeCatalogItems(model.supported_endpoint_types)
  const tags = parseTags(model.tags)
  const cells: React.ReactNode[] = []

  if (model.vendor_name) {
    cells.push(
      <CatalogInfoCell key='provider' label={t('Provider')}>
        <CatalogTextValue>{model.vendor_name}</CatalogTextValue>
      </CatalogInfoCell>
    )
  }

  cells.push(
    <CatalogInfoCell key='type' label={t('Type')}>
      <CatalogTextValue>
        {model.quota_type === QUOTA_TYPE_VALUES.TOKEN
          ? t('Token-based')
          : t('Per Request')}
      </CatalogTextValue>
    </CatalogInfoCell>
  )

  if (groups.length > 0) {
    cells.push(
      <CatalogInfoCell key='groups' label={t('Groups')}>
        <div className='flex min-w-0 flex-wrap gap-1.5'>
          {groups.map((group) => (
            <GroupBadge key={group} group={group} size='md' />
          ))}
        </div>
      </CatalogInfoCell>
    )
  }

  if (endpoints.length > 0) {
    cells.push(
      <CatalogInfoCell key='endpoints' label={t('Endpoints')}>
        <CatalogPillList items={endpoints} />
      </CatalogInfoCell>
    )
  }

  if (tags.length > 0) {
    cells.push(
      <CatalogInfoCell key='tags' label={t('Tags')}>
        <CatalogPillList items={tags} />
      </CatalogInfoCell>
    )
  }

  if (model.parameter_count) {
    cells.push(
      <CatalogInfoCell key='parameters' label={t('Parameters')}>
        <CatalogTextValue>{model.parameter_count}</CatalogTextValue>
      </CatalogInfoCell>
    )
  }

  if (cells.length === 0) return null

  return (
    <section>
      <SectionTitle>{t('Model')}</SectionTitle>
      <div className='divide-border grid grid-cols-1 overflow-hidden rounded-xl border sm:grid-cols-2 [&>*]:border-b [&>*:nth-child(odd)]:sm:border-r [&>*:nth-last-child(-n+2)]:sm:border-b-0'>
        {cells}
      </div>
    </section>
  )
}

function ModelBackendDetailsSection(props: { model: PricingModel }) {
  return (
    <>
      <ModelBackendSignalsSection model={props.model} />
      <ModelBackendProviderSection model={props.model} />
    </>
  )
}

// ----------------------------------------------------------------------------
// Model header (always visible above the detail sections)
// ----------------------------------------------------------------------------

function ModelHeader(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const model = props.model
  const modelIconKey = model.icon || model.vendor_icon
  const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 28) : null
  const description = model.description || model.vendor_description || null
  const tags = parseTags(model.tags)
  const endpoints = normalizeCatalogItems(model.supported_endpoint_types)
  const isSpecialExpression =
    model.billing_mode === 'tiered_expr' &&
    Boolean(model.billing_expr) &&
    getDynamicPricingTiers(model).length === 0

  return (
    <header className='space-y-5'>
      <div className='flex items-start gap-4'>
        <div className='bg-muted flex size-12 shrink-0 items-center justify-center rounded-xl'>
          {modelIcon || (
            <span className='text-muted-foreground text-base font-medium'>
              {model.model_name?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            <h1 className='truncate font-mono text-lg font-semibold tracking-tight'>
              {model.model_name}
            </h1>
            <CopyButton
              value={model.model_name || ''}
              size='icon-xs'
              iconClassName='size-3'
              tooltip={t('Copy model name')}
              successTooltip={t('Copied!')}
              aria-label={t('Copy model name')}
            />
            {model.billing_mode === 'tiered_expr' && model.billing_expr && (
              <StatusBadge variant='warning' size='md'>
                {isSpecialExpression
                  ? t('Special billing expression')
                  : t('Dynamic Pricing')}
              </StatusBadge>
            )}
          </div>
          <div className='text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm'>
            {model.vendor_name && <span>{model.vendor_name}</span>}
            {model.vendor_name && (
              <span className='text-muted-foreground/40'>·</span>
            )}
            <span>
              {model.quota_type === QUOTA_TYPE_VALUES.TOKEN
                ? t('Token-based')
                : t('Per Request')}
            </span>
          </div>
        </div>
      </div>

      {description && (
        <p className='text-muted-foreground max-w-3xl text-sm leading-relaxed'>
          {description}
        </p>
      )}

      {(tags.length > 0 || endpoints.length > 0) && (
        <div className='flex flex-wrap gap-1.5'>
          {tags.map((tag) => (
            <StatusBadge key={`tag-${tag}`} variant='neutral' size='md'>
              {tag}
            </StatusBadge>
          ))}
          {endpoints.map((endpoint) => (
            <StatusBadge
              key={`endpoint-${endpoint}`}
              variant='neutral'
              size='md'
            >
              {endpoint}
            </StatusBadge>
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
          <SectionTitle>{t('Pricing')}</SectionTitle>
          <div className='border-warning/30 bg-warning/10 rounded-xl border p-4'>
            <div className='text-warning text-sm font-medium'>
              {t('Special billing expression')}
            </div>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t('Unable to parse structured pricing')}
            </p>
            <div className='mt-3'>
              <div className='text-muted-foreground mb-1 text-xs font-medium'>
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

    const priceRows = [
      ...dynamicSummary.primaryEntries,
      ...dynamicSummary.secondaryEntries,
    ]

    return (
      <section>
        <SectionTitle>{t('Pricing')}</SectionTitle>
        <div className='overflow-hidden rounded-xl border'>
          <div className='flex items-baseline justify-between gap-3 border-b px-4 py-3'>
            <span className='text-sm font-medium'>{t('Text tokens')}</span>
            <span className='text-muted-foreground text-xs'>
              {t('Prices shown per')} {tokenUnitLabel} {t('tokens')}
            </span>
          </div>
          <div className='divide-y'>
            {priceRows.map((entry) => (
              <div
                key={entry.key}
                className='flex items-baseline justify-between gap-4 px-4 py-3'
              >
                <span className='text-muted-foreground text-sm'>
                  {t(entry.shortLabel)}
                </span>
                <span className='text-sm font-medium tabular-nums'>
                  {entry.formatted}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (!isTokenBased) {
    return (
      <section>
        <SectionTitle>{t('Pricing')}</SectionTitle>
        <div className='overflow-hidden rounded-xl border'>
          <div className='flex items-baseline justify-between gap-4 px-4 py-3'>
            <span className='text-muted-foreground text-sm'>
              {t('Per request')}
            </span>
            <span className='text-sm font-medium tabular-nums'>
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
        </div>
      </section>
    )
  }

  const secondaryItems = secondaryPriceTypes.filter((p) => p.available)
  const priceRows = [
    ...primaryPriceTypes,
    ...secondaryItems.map((item) => ({
      label: item.label,
      type: item.type,
    })),
  ]

  return (
    <section>
      <SectionTitle>{t('Pricing')}</SectionTitle>
      <div className='overflow-hidden rounded-xl border'>
        <div className='flex items-baseline justify-between gap-3 border-b px-4 py-3'>
          <span className='text-sm font-medium'>{t('Text tokens')}</span>
          <span className='text-muted-foreground text-xs'>
            {t('Prices shown per')} {tokenUnitLabel} {t('tokens')}
          </span>
        </div>
        <div className='divide-y'>
          {priceRows.map((item) => (
            <div
              key={item.type}
              className='flex items-baseline justify-between gap-4 px-4 py-3'
            >
              <span className='text-muted-foreground text-sm'>
                {item.label}
              </span>
              <span className='text-sm font-medium tabular-nums'>
                {formatGroupPrice(
                  props.model,
                  baseGroupKey,
                  item.type,
                  props.tokenUnit,
                  props.showRechargePrice,
                  props.priceRate,
                  props.usdExchangeRate,
                  baseGroupRatioMap
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
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

type DynamicPriceOptions = Parameters<typeof getDynamicPriceEntries>[1]
type DynamicPricingTier = ReturnType<typeof getDynamicPricingTiers>[number]
type DynamicFormattedPricesByTier = Map<DynamicPricingTier, Map<string, string>>

function getDynamicPriceFields(
  tiers: DynamicPricingTier[],
  options: DynamicPriceOptions
) {
  return [
    ...new Map(
      tiers
        .flatMap((tier) => getDynamicPriceEntries(tier, options))
        .map((entry) => [entry.field, entry])
    ).values(),
  ]
}

function getDynamicFormattedPricesByTier(
  tiers: DynamicPricingTier[],
  options: DynamicPriceOptions
): DynamicFormattedPricesByTier {
  return new Map(
    tiers.map((tier) => [
      tier,
      new Map(
        getDynamicPriceEntries(tier, options).map((entry) => [
          entry.field,
          entry.formatted,
        ])
      ),
    ])
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
    if (props.model.cache_ratio != null) {
      types.push({ label: t('Cache'), type: 'cache' })
    }
    if (props.model.create_cache_ratio != null) {
      types.push({ label: t('Cache Write'), type: 'create_cache' })
    }
    if (props.model.image_ratio != null) {
      types.push({ label: t('Image'), type: 'image' })
    }
    if (props.model.audio_ratio != null) {
      types.push({ label: t('Audio In'), type: 'audio_input' })
    }
    if (
      props.model.audio_ratio != null &&
      props.model.audio_completion_ratio != null
    ) {
      types.push({ label: t('Audio Out'), type: 'audio_output' })
    }
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

  const thClass = 'text-muted-foreground py-2 text-xs font-medium'

  if (isDynamicPricingModel(props.model)) {
    const dynamicTiers = getDynamicPricingTiers(props.model)

    if (dynamicTiers.length === 0) {
      return (
        <section>
          <SectionTitle>{t('Pricing by Group')}</SectionTitle>
          <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
          <div className='border-warning/30 bg-warning/10 rounded-lg border p-3'>
            <div className='text-warning text-sm font-medium'>
              {t('Special billing expression')}
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t(
                'Group prices cannot be expanded because this expression is not a standard tiered pricing expression.'
              )}
            </p>
            <div className='mt-3'>
              <div className='text-muted-foreground mb-1 text-xs font-medium'>
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

    const priceFields = getDynamicPriceFields(dynamicTiers, {
      tokenUnit: props.tokenUnit,
      showRechargePrice,
      priceRate: props.priceRate,
      usdExchangeRate: props.usdExchangeRate,
      groupRatioMultiplier: 1,
    })
    const formattedPricesByGroup = new Map(
      availableGroups.map((group) => {
        const ratio = props.groupRatio[group] || 1
        return [
          group,
          getDynamicFormattedPricesByTier(dynamicTiers, {
            tokenUnit: props.tokenUnit,
            showRechargePrice,
            priceRate: props.priceRate,
            usdExchangeRate: props.usdExchangeRate,
            groupRatioMultiplier: ratio,
          }),
        ] as const
      })
    )

    return (
      <section>
        <SectionTitle>{t('Pricing by Group')}</SectionTitle>
        <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
        <div className='space-y-3'>
          {availableGroups.map((group) => {
            const ratio = props.groupRatio[group] || 1
            const formattedPricesByTier =
              formattedPricesByGroup.get(group) ??
              new Map<DynamicPricingTier, Map<string, string>>()

            return (
              <div key={group} className='overflow-hidden rounded-lg border'>
                <div className='bg-muted/20 flex items-center justify-between gap-3 border-b px-3 py-2'>
                  <GroupBadge group={group} size='sm' />
                  <span className='text-muted-foreground font-mono text-xs'>
                    {ratio}x
                  </span>
                </div>
                <StaticDataTable
                  className='rounded-none border-0'
                  tableClassName='text-sm'
                  headerRowClassName='hover:bg-transparent'
                  data={dynamicTiers}
                  getRowKey={(tier, tierIndex) =>
                    `${group}-${tier.label || tierIndex}`
                  }
                  columns={[
                    {
                      id: 'tier',
                      header: t('Tier'),
                      className: thClass,
                      cellClassName: 'text-muted-foreground py-2.5',
                      cell: (tier) => tier.label || t('Default'),
                    },
                    ...priceFields.map((fieldEntry) => ({
                      id: fieldEntry.field,
                      header: t(fieldEntry.shortLabel),
                      className: `${thClass} text-right`,
                      cellClassName: 'py-2.5 text-right font-mono',
                      cell: (tier: (typeof dynamicTiers)[number]) =>
                        formattedPricesByTier
                          .get(tier)
                          ?.get(fieldEntry.field) ?? '-',
                    })),
                  ]}
                />
              </div>
            )
          })}
          <p className='text-muted-foreground/40 mt-1.5 text-xs'>
            {t('Prices shown per')} {tokenUnitLabel} tokens
          </p>
        </div>
      </section>
    )
  }

  const renderGroupPrice = (group: string, type: PriceType) =>
    formatGroupPrice(
      props.model,
      group,
      type,
      props.tokenUnit,
      showRechargePrice,
      props.priceRate,
      props.usdExchangeRate,
      props.groupRatio
    )
  const renderFixedGroupPrice = (group: string) =>
    formatFixedPrice(
      props.model,
      group,
      showRechargePrice,
      props.priceRate,
      props.usdExchangeRate,
      props.groupRatio
    )

  return (
    <section>
      <SectionTitle>{t('Pricing by Group')}</SectionTitle>
      <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
      <StaticDataTable
        className='-mx-4 rounded-none border-0 sm:mx-0'
        tableClassName='text-sm'
        headerRowClassName='hover:bg-transparent'
        data={availableGroups}
        getRowKey={(group) => group}
        columns={[
          {
            id: 'group',
            header: t('Group'),
            className: thClass,
            cellClassName: 'py-2.5',
            cell: (group) => <GroupBadge group={group} size='sm' />,
          },
          {
            id: 'ratio',
            header: t('Ratio'),
            className: thClass,
            cellClassName: 'text-muted-foreground py-2.5 font-mono',
            cell: (group) => `${props.groupRatio[group] || 1}x`,
          },
          ...(isTokenBased
            ? [
                {
                  id: 'input',
                  header: t('Input'),
                  className: `${thClass} text-right`,
                  cellClassName: 'py-2.5 text-right font-mono',
                  cell: (group: string) => renderGroupPrice(group, 'input'),
                },
                {
                  id: 'output',
                  header: t('Output'),
                  className: `${thClass} text-right`,
                  cellClassName: 'py-2.5 text-right font-mono',
                  cell: (group: string) => renderGroupPrice(group, 'output'),
                },
                ...extraPriceTypes.map((ep) => ({
                  id: ep.type,
                  header: ep.label,
                  className: `${thClass} text-right`,
                  cellClassName: 'py-2.5 text-right font-mono',
                  cell: (group: string) => renderGroupPrice(group, ep.type),
                })),
              ]
            : [
                {
                  id: 'price',
                  header: t('Price'),
                  className: `${thClass} text-right`,
                  cellClassName: 'py-2.5 text-right font-mono',
                  cell: renderFixedGroupPrice,
                },
              ]),
        ]}
      />
      <div className='-mx-4 sm:mx-0'>
        {isTokenBased && (
          <p className='text-muted-foreground/40 mt-1.5 px-4 text-xs sm:px-0'>
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

  const isDynamic =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)

  return (
    <div className='@container/details space-y-8'>
      <ModelHeader model={props.model} />
      <ModelBackendQuickStats model={props.model} />
      <OverviewSummaryGrid model={props.model} />

      <Tabs defaultValue='overview' className='gap-6'>
        <TabsList
          variant='line'
          className='w-full justify-start gap-6 overflow-x-auto overflow-y-hidden border-b p-0'
        >
          {TAB_VALUES.map((value) => {
            const Icon = TAB_META[value].icon
            return (
              <TabsTrigger
                key={value}
                value={value}
                className='flex-none gap-1.5 px-0.5 pb-3'
              >
                <Icon aria-hidden='true' className='size-3.5' />
                <span className='truncate'>{t(TAB_META[value].labelKey)}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value='overview' className='space-y-8 outline-none'>
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
          <ModelBackendDetailsSection model={props.model} />
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
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto max-w-6xl px-4 pt-20 pb-10 sm:px-6 lg:px-8'>
          <Skeleton className='mb-4 h-5 w-16' />
          <div className='space-y-2'>
            <Skeleton className='h-7 w-64' />
            <Skeleton className='h-4 w-40' />
            <Skeleton className='h-4 w-full max-w-md' />
          </div>
          <div className='mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {['stats-a', 'stats-b', 'stats-c', 'stats-d'].map((key) => (
              <Skeleton key={key} className='h-16 w-full' />
            ))}
          </div>
          <div className='mt-6 space-y-3'>
            {['block-a', 'block-b', 'block-c', 'block-d'].map((key) => (
              <Skeleton key={key} className='h-24 w-full' />
            ))}
          </div>
        </div>
      </PublicLayout>
    )
  }

  if (!model) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto max-w-2xl px-4 pt-24 pb-10 text-center sm:px-6'>
          <h2 className='mb-1 text-base font-semibold'>
            {t('Model not found')}
          </h2>
          <p className='text-muted-foreground mb-4 text-sm'>
            {t("The model you're looking for doesn't exist.")}
          </p>
          <Button onClick={handleBack} variant='outline'>
            {t('Back to Models')}
          </Button>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='mx-auto max-w-5xl px-4 pt-20 pb-16 sm:px-6 lg:px-8'>
        <Button
          variant='ghost'
          onClick={handleBack}
          className='text-muted-foreground hover:text-foreground mb-8 -ml-2'
        >
          <ArrowLeft aria-hidden='true' />
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
      </PageTransition>
    </PublicLayout>
  )
}
