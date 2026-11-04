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
import type { TFunction } from 'i18next'
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
  Timer,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { StaticDataTable } from '@/components/data-table'
import { sideDrawerContentClassName } from '@/components/drawer-layout'
import { GroupBadge } from '@/components/group-badge'
import { PublicLayout } from '@/components/layout'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Hint } from '@/features/hw/components/hint'
import { PremiumModelNotice } from '@/features/hw/components/premium-model-notice'
import { guideText, modelGuide } from '@/features/hw/data/model-guide'
import { getPerfMetrics } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { PluginIcon } from '@/features/task-plugins/components/plugin-icon'
import { formatDecimal } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import { usePricingCurrency } from '../hooks/use-pricing-currency'
import { usePricingData } from '../hooks/use-pricing-data'
import type { ParsedTaskTier } from '../lib/billing-expr'
import { formatBillingCondition } from '../lib/billing-expression/condition-display'
import { getBillingModeLabelKey } from '../lib/billing-mode'
import { visibleCustomerGroups } from '../lib/customer-groups'
import {
  formatTaskUsageUnitPrice,
  getDynamicPriceEntries,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  getDynamicPricingTiers,
  getTaskUsageQuantityUnitLabelKey,
  isDynamicPricingModel,
  isUnconfiguredTaskUsageModel,
  type DynamicPriceEntry,
} from '../lib/dynamic-price'
import { describeEndpoint } from '../lib/endpoint-labels'
import { parseTags } from '../lib/filters'
import { getAvailableGroups, isTokenBasedModel } from '../lib/model-helpers'
import { averageResponseTimeMs, wordsPerSecond } from '../lib/plain-metrics'
import { withPluginPricing } from '../lib/plugin-pricing'
import { formatFixedPrice, formatGroupPrice } from '../lib/price'
import {
  evaluateTaskUsageExamples,
  getTaskEnumFields,
  getTaskNumberFields,
} from '../lib/task-expr'
import { getTaskPricingDisplayTiers } from '../lib/task-matrix-display'
import {
  hasSimpleTaskPricing,
  taskPriceLabel,
  taskUsageUnitLabel,
  taskTierConditions,
  pricingDisplayFallbackKey,
} from '../lib/task-price-display'
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

/**
 * Billing mode badge for the drawer. A beginner does not know what
 * "token-based" means, so the drawer calls it "Pay as you go" while the card
 * keeps its own badge.
 */
function ModelBillingModeBadge(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const labelKey = getBillingModeLabelKey(props.model)
  const isTokenBilled = labelKey === 'Token-based'
  let variant: StatusVariant = 'purple'
  if (isDynamicPricingModel(props.model)) {
    variant = 'warning'
  } else if (isTokenBilled) {
    variant = 'info'
  }

  return (
    <StatusBadge
      label={isTokenBilled ? t('Pay as you go') : t(labelKey)}
      variant={variant}
      copyable={false}
      size='sm'
    />
  )
}

function SectionTitle(props: { children: React.ReactNode }) {
  return (
    <h2 className='text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase'>
      {props.children}
    </h2>
  )
}

function DynamicPriceEntryLabel(props: { entry: DynamicPriceEntry }) {
  const { t, i18n } = useTranslation()
  if (props.entry.labelKind === 'schema') {
    return (
      <span className='break-words whitespace-normal'>
        {taskPriceLabel(
          props.entry.description,
          props.entry.shortLabel,
          i18n.language
        )}
      </span>
    )
  }
  return t(props.entry.shortLabel)
}

function UnconfiguredTaskPricingNotice(props: { model: PricingModel }) {
  const { t, i18n } = useTranslation()
  const numberFields = getTaskNumberFields(props.model.billing_usage_schema)
  const enumFields = getTaskEnumFields(props.model.billing_usage_schema)

  return (
    <div className='bg-muted/20 flex flex-col gap-3 rounded-lg border p-3'>
      <p className='text-muted-foreground text-sm'>
        {t(
          'This model is billed by usage, but the administrator has not configured its pricing yet.'
        )}
      </p>
      {numberFields.length + enumFields.length > 0 ? (
        <dl className='grid gap-2 sm:grid-cols-2'>
          {numberFields.map(([field, definition]) => (
            <div
              key={field}
              className='flex items-baseline justify-between gap-3'
            >
              <dt className='text-sm'>
                {taskPriceLabel(definition.description, field, i18n.language)}
              </dt>
              <dd className='text-muted-foreground text-xs'>
                {taskUsageUnitLabel(
                  definition,
                  i18n.language,
                  t(getTaskUsageQuantityUnitLabelKey(definition.unit))
                )}
              </dd>
            </div>
          ))}
          {enumFields.map(([field, definition]) => (
            <div
              key={field}
              className='flex items-baseline justify-between gap-3'
            >
              <dt className='text-sm'>
                <code>{field}</code>
              </dt>
              <dd className='text-muted-foreground text-right text-xs'>
                {(definition.enum ?? []).join(', ')}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
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

const MODEL_DETAILS_SKELETON_KEYS = ['first', 'second', 'third', 'fourth']

function formatCatalogTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return ''
  if (tokens >= 1_000_000) {
    return `${formatDecimal(tokens / 1_000_000, 1)}M`
  }
  if (tokens >= 1_000) {
    return `${formatDecimal(tokens / 1_000, 1)}K`
  }
  return formatDecimal(tokens, 1)
}

function formatCatalogYearMonth(value?: string): string {
  if (!value) return ''
  const [yearStr, monthStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return value
  return `${String(month).padStart(2, '0')}.${year}`
}

function normalizeCatalogItems(items?: readonly string[]): string[] {
  if (!items) return []
  return items.filter((item) => item.trim().length > 0)
}

function OverviewMetric(props: {
  icon: React.ComponentType<{ className?: string }>
  label: React.ReactNode
  value: React.ReactNode
  valueClassName?: string
}) {
  const Icon = props.icon

  return (
    <div className='flex min-w-0 items-center gap-2 px-3 py-2'>
      <Icon className='text-muted-foreground size-3.5 shrink-0' />
      <div className='min-w-0 flex-1'>
        <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
          {props.label}
        </div>
        <div
          className={cn(
            'text-foreground truncate font-mono text-sm font-semibold tabular-nums',
            props.valueClassName
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
    queryFn: async () =>
      requireServerSuccess(await getPerfMetrics(props.model.model_name, 24)),
    staleTime: 60 * 1000,
  })

  const summary = metricsQuery.data?.data.summary
  const successRate = summary?.success_rate ?? Number.NaN
  const avgTps = summary?.avg_tps ?? 0
  const avgResponseTime = averageResponseTimeMs(
    metricsQuery.data?.data.groups ?? []
  )
  const words = wordsPerSecond(avgTps)

  return (
    <div className='bg-muted/20 grid overflow-hidden rounded-lg border sm:grid-cols-3 sm:divide-x'>
      <OverviewMetric
        icon={Timer}
        label={
          <Hint
            hint={t(
              'How fast the model writes its answer. A word is about 1.3 tokens.'
            )}
          >
            {t('Writing speed')}
          </Hint>
        }
        value={
          words === null
            ? formatThroughput(avgTps)
            : t('~{{words}} words per second', { words })
        }
      />
      <OverviewMetric
        icon={Timer}
        label={
          <Hint
            hint={t(
              'How long you wait until the first words of the answer appear.'
            )}
          >
            {t('Response time')}
          </Hint>
        }
        value={formatLatency(avgResponseTime)}
      />
      <OverviewMetric
        icon={HeartPulse}
        label={
          <Hint
            hint={t(
              'The share of requests that worked in the last 24 hours. Higher is better.'
            )}
          >
            {t('Uptime (last 24 hours)')}
          </Hint>
        }
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
        <span
          key={item}
          className='bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-medium'
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function CatalogTextValue(props: { children: React.ReactNode }) {
  return (
    <span className='text-foreground min-w-0 truncate text-sm font-semibold'>
      {props.children}
    </span>
  )
}

function CatalogInfoCell(props: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className='bg-card flex min-w-0 flex-col gap-1 px-3 py-2.5'>
      <span className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
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
    hint: string
  }[] = []

  if (contextLength > 0) {
    stats.push({
      key: 'context',
      icon: Layers,
      label: t('Context'),
      value: formatCatalogTokenCount(contextLength),
      hint: t(
        'How much text the model can read at once, in tokens. 1,000 tokens is about 750 words.'
      ),
    })
  }

  if (maxOutput > 0) {
    stats.push({
      key: 'max-output',
      icon: Maximize2,
      label: t('Max output'),
      value: formatCatalogTokenCount(maxOutput),
      hint: t(
        'The longest answer the model can write in one go, in tokens. 1,000 tokens is about 750 words.'
      ),
    })
  }

  if (inputModalities.length > 0 || outputModalities.length > 0) {
    stats.push({
      key: 'modalities',
      icon: FileText,
      label: t('Modalities'),
      hint: t('What kinds of content the model can take in and give back.'),
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
      hint: t(
        'The model knows nothing that happened after this date, unless you give it that information.'
      ),
      value: knowledgeCutoff,
    })
  }

  if (releaseDate) {
    stats.push({
      key: 'release',
      icon: CalendarClock,
      label: t('Released'),
      hint: t('When the model first became available.'),
      value: releaseDate,
    })
  }

  if (stats.length === 0) return null

  return (
    <div className='bg-muted/20 grid grid-cols-2 gap-px overflow-hidden rounded-lg border @md/details:grid-cols-3 @2xl/details:grid-cols-5'>
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.key}
            className='bg-background flex min-w-0 flex-col gap-0.5 px-3 py-2.5'
          >
            <span className='text-muted-foreground inline-flex min-w-0 items-center gap-1 text-[10px] font-medium tracking-wider uppercase'>
              <Icon className='size-3 shrink-0' />
              <Hint hint={stat.hint} className='truncate'>
                {stat.label}
              </Hint>
            </span>
            <span className='text-foreground truncate text-sm font-semibold tabular-nums'>
              {stat.value}
            </span>
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
      <SectionTitle>
        <Hint
          hint={t(
            'What the model can do besides plain chat, and which kinds of content it understands.'
          )}
        >
          {t('Capabilities')} / {t('Supported modalities')}
        </Hint>
      </SectionTitle>
      <div className='grid gap-3 rounded-xl border p-3 @2xl/details:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]'>
        {capabilities.length > 0 ? (
          <CatalogPillList
            items={capabilities.map((capability) =>
              t(
                CAPABILITY_LABEL_KEYS[capability as ModelCapability] ??
                  capability
              )
            )}
          />
        ) : (
          <div />
        )}
        {(inputModalities.length > 0 || outputModalities.length > 0) && (
          <div className='grid gap-2 sm:grid-cols-2'>
            {inputModalities.length > 0 && (
              <div className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2'>
                <span className='text-muted-foreground text-xs font-medium'>
                  {t('Content it takes in')}
                </span>
                <CatalogTextValue>
                  <ModalityLabels items={inputModalities} />
                </CatalogTextValue>
              </div>
            )}
            {outputModalities.length > 0 && (
              <div className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2'>
                <span className='text-muted-foreground text-xs font-medium'>
                  {t('Content it gives back')}
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
  const endpoints = normalizeCatalogItems(model.supported_endpoint_types).map(
    (endpoint) => describeEndpoint(endpoint, t).label
  )
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
    <CatalogInfoCell
      key='type'
      label={
        <Hint
          hint={t(
            'Pay as you go means you only pay for the text you send and receive, nothing else.'
          )}
        >
          {t('Billing')}
        </Hint>
      }
    >
      <ModelBillingModeBadge model={model} />
    </CatalogInfoCell>
  )

  if (endpoints.length > 0) {
    cells.push(
      <CatalogInfoCell
        key='endpoints'
        label={
          <Hint
            hint={t(
              'The way your tool talks to this model. Pick the one your tool supports.'
            )}
          >
            {t('Connection type')}
          </Hint>
        }
      >
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
      <CatalogInfoCell
        key='parameters'
        label={
          <Hint
            hint={t(
              'How big the model is. Bigger models are usually smarter but slower and more expensive.'
            )}
          >
            {t('Parameters')}
          </Hint>
        }
      >
        <CatalogTextValue>{model.parameter_count}</CatalogTextValue>
      </CatalogInfoCell>
    )
  }

  if (cells.length === 0) return null

  return (
    <section>
      <SectionTitle>{t('Model')}</SectionTitle>
      <div className='border-border/60 bg-border/60 grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2'>
        {cells}
      </div>
    </section>
  )
}

function ModelBackendDetailsSection(props: { model: PricingModel }) {
  return (
    <>
      <ModelBackendQuickStats model={props.model} />
      <ModelBackendSignalsSection model={props.model} />
      <ModelBackendProviderSection model={props.model} />
    </>
  )
}

// ----------------------------------------------------------------------------
// Model header (always visible above the detail sections)
// ----------------------------------------------------------------------------

function ModelHeader(props: { model: PricingModel }) {
  const { t, i18n } = useTranslation()
  const model = props.model
  const modelIconKey = model.icon || model.vendor_icon
  const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 20) : null
  const guide = modelGuide(model.model_name)
  const description =
    model.description ||
    (guide ? guideText(guide.description, i18n.language) : '') ||
    model.vendor_description ||
    null

  return (
    <header className='pb-4'>
      <div className='flex items-center gap-2.5'>
        {modelIcon}
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
        <ModelBillingModeBadge model={model} />
      </div>
      {description && (
        <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
          {description}
        </p>
      )}
      <PremiumModelNotice
        className='mt-3'
        language={i18n.language}
        model={model.model_name}
      />
    </header>
  )
}

// ----------------------------------------------------------------------------
// Base price card (used in the Overview tab)
// ----------------------------------------------------------------------------

/** Plain-language label and one-sentence explanation for a price column. */
function plainPriceLabel(
  t: TFunction,
  type: PriceType
): { label: string; hint: string } {
  switch (type) {
    case 'input':
      return {
        label: t('Text you send'),
        hint: t(
          'The text, files and code you send to the model. 1 million tokens is about 750,000 words.'
        ),
      }
    case 'output':
      return {
        label: t('Text the model writes'),
        hint: t(
          'The answer or code the model writes back. It costs more per token than what you send.'
        ),
      }
    case 'cache':
      return {
        label: t('Reused text (cache)'),
        hint: t(
          'Parts of your prompt that you send again and again are charged at a lower price.'
        ),
      }
    case 'create_cache':
      return {
        label: t('Saving text for reuse'),
        hint: t(
          'The price for saving part of your prompt so it can be reused at the lower price later.'
        ),
      }
    case 'image':
      return {
        label: t('Images you send'),
        hint: t('The price for pictures you send to the model.'),
      }
    case 'audio_input':
      return {
        label: t('Audio you send'),
        hint: t('The price for sound recordings you send to the model.'),
      }
    default:
      return {
        label: t('Audio the model speaks'),
        hint: t('The price for sound the model creates for you.'),
      }
  }
}

function PriceSection(props: {
  model: PricingModel
  priceRate: number
  usdExchangeRate: number
  tokenUnit: TokenUnit
  showRechargePrice: boolean
}) {
  const { t, i18n } = useTranslation()
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = props.tokenUnit === 'K' ? '1K' : '1M'
  const baseGroupKey = '_base'
  const baseGroupRatioMap = { [baseGroupKey]: 1 }
  const currency = usePricingCurrency()
  const billingTime = useBillingTime(props.model.billing_expr)
  const dynamicSummary = useMemo(
    () =>
      getDynamicPricingSummary(props.model, {
        now: billingTime === undefined ? undefined : new Date(billingTime),
        tokenUnit: props.tokenUnit,
        showRechargePrice: props.showRechargePrice,
        priceRate: props.priceRate,
        usdExchangeRate: props.usdExchangeRate,
        groupRatioMultiplier: 1,
      }),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.model,
      props.tokenUnit,
      props.showRechargePrice,
      props.priceRate,
      props.usdExchangeRate,
      billingTime,
      currency,
    ]
  )

  const primaryPriceTypes = (['input', 'output'] as const).map((type) => ({
    type,
    ...plainPriceLabel(t, type),
  }))
  const secondaryPriceTypes: {
    label: string
    hint: string
    type: PriceType
    available: boolean
  }[] = [
    {
      ...plainPriceLabel(t, 'cache'),
      type: 'cache',
      available: props.model.cache_ratio != null,
    },
    {
      ...plainPriceLabel(t, 'create_cache'),
      type: 'create_cache',
      available: props.model.create_cache_ratio != null,
    },
    {
      ...plainPriceLabel(t, 'image'),
      type: 'image',
      available: props.model.image_ratio != null,
    },
    {
      ...plainPriceLabel(t, 'audio_input'),
      type: 'audio_input',
      available: props.model.audio_ratio != null,
    },
    {
      ...plainPriceLabel(t, 'audio_output'),
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
              {t(
                pricingDisplayFallbackKey(
                  dynamicSummary.rawExpression,
                  props.model.billing_usage_schema
                )
              )}
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
        {dynamicSummary.providerCount && (
          <p className='text-muted-foreground mb-2 text-xs'>
            {t('{{count}} providers', { count: dynamicSummary.providerCount })}
            {dynamicSummary.hasUnconfiguredProviders &&
              ` · ${t('Not configured for some providers')}`}
          </p>
        )}
        {dynamicSummary.isMixedBilling && (
          <p className='text-muted-foreground mb-2 text-xs'>
            {t('Token or per-call pricing')}
          </p>
        )}
        {dynamicSummary.primaryEntries.length > 0 ? (
          <div
            className={cn(
              'grid gap-2',
              dynamicSummary.primaryEntries.length > 1 && 'grid-cols-2'
            )}
          >
            {dynamicSummary.primaryEntries.map((entry) => {
              const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
              const unitLabel = taskUsageUnitLabel(
                entry,
                i18n.language,
                unitLabelKey ? t(unitLabelKey) : tokenUnitLabel
              )
              return (
                <div
                  key={entry.key}
                  className='bg-muted/20 rounded-lg border p-3'
                >
                  <div className='text-muted-foreground text-xs'>
                    <DynamicPriceEntryLabel entry={entry} />
                  </div>
                  <div className='text-foreground mt-1 font-mono text-base font-semibold tabular-nums'>
                    {entry.formattedRange ?? entry.formatted}
                    <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
                      / {unitLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {dynamicSummary.hasUnconfiguredProviders
              ? t('Not configured')
              : t('Dynamic Pricing')}
          </p>
        )}
        {dynamicSummary.secondaryEntries.length > 0 && (
          <div className='bg-muted/20 mt-3 rounded-lg border px-3 py-2.5'>
            <div className='space-y-1.5'>
              {dynamicSummary.secondaryEntries.map((entry) => {
                const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
                const unitLabel = taskUsageUnitLabel(
                  entry,
                  i18n.language,
                  unitLabelKey ? t(unitLabelKey) : tokenUnitLabel
                )
                return (
                  <div
                    key={entry.key}
                    className='flex items-baseline justify-between gap-4'
                  >
                    <span className='text-muted-foreground text-sm'>
                      <DynamicPriceEntryLabel entry={entry} />
                    </span>
                    <span className='text-muted-foreground font-mono text-sm tabular-nums'>
                      {entry.formattedRange ?? entry.formatted}
                      <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
                        / {unitLabel}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    )
  }

  if (isUnconfiguredTaskUsageModel(props.model)) {
    return (
      <section>
        <SectionTitle>{t('Base Price')}</SectionTitle>
        <UnconfiguredTaskPricingNotice model={props.model} />
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
            <div className='text-muted-foreground text-xs'>
              <Hint hint={item.hint}>{item.label}</Hint>
            </div>
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
                <span className='text-muted-foreground text-sm'>
                  <Hint hint={item.hint}>{item.label}</Hint>
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

type GroupPricingSectionProps = {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
  autoGroups: string[]
  priceRate: number
  usdExchangeRate: number
  tokenUnit: TokenUnit
  showRechargePrice?: boolean
}

function GroupPricingSection(props: GroupPricingSectionProps) {
  const { t } = useTranslation()
  const variants = props.model.billing_plugin_variants
  if (!variants?.length) {
    return <ProviderGroupPricingSection {...props} />
  }
  return (
    <section>
      <Tabs key={props.model.model_name} defaultValue={variants[0].plugin_key}>
        <TabsList
          aria-label={t('Provider')}
          className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'
        >
          {variants.map((variant) => (
            <TabsTrigger
              key={variant.plugin_key}
              value={variant.plugin_key}
              className='max-w-full min-w-0'
            >
              <PluginIcon
                plugin={{
                  key: variant.plugin_key,
                  name: variant.plugin_name,
                  icon: variant.icon,
                }}
                size={16}
              />
              <span className='truncate' title={variant.plugin_name}>
                {variant.plugin_name}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {variants.map((variant) => (
          <TabsContent key={variant.plugin_key} value={variant.plugin_key}>
            {variant.billing_expr || variant.billing_mode === 'ratio' ? (
              <ProviderGroupPricingSection
                {...props}
                model={withPluginPricing(props.model, variant)}
                hideTitle
              />
            ) : (
              <UnconfiguredTaskPricingNotice
                model={withPluginPricing(props.model, variant)}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}

function ProviderGroupPricingSection(
  props: GroupPricingSectionProps & { hideTitle?: boolean }
) {
  const { t, i18n } = useTranslation()
  const showRechargePrice = props.showRechargePrice ?? false

  const availableGroups = useMemo(
    () => getAvailableGroups(props.model, props.usableGroup || {}),
    [props.model, props.usableGroup]
  )

  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = props.tokenUnit === 'K' ? '1K' : '1M'

  const extraPriceTypes = useMemo(() => {
    const types: { label: string; hint: string; type: PriceType }[] = []
    if (props.model.cache_ratio != null) {
      types.push({ ...plainPriceLabel(t, 'cache'), type: 'cache' })
    }
    if (props.model.create_cache_ratio != null) {
      types.push({
        ...plainPriceLabel(t, 'create_cache'),
        type: 'create_cache',
      })
    }
    if (props.model.image_ratio != null) {
      types.push({ ...plainPriceLabel(t, 'image'), type: 'image' })
    }
    if (props.model.audio_ratio != null) {
      types.push({ ...plainPriceLabel(t, 'audio_input'), type: 'audio_input' })
    }
    if (
      props.model.audio_ratio != null &&
      props.model.audio_completion_ratio != null
    ) {
      types.push({
        ...plainPriceLabel(t, 'audio_output'),
        type: 'audio_output',
      })
    }
    return types
  }, [props.model, t])

  if (availableGroups.length === 0) {
    return (
      <section>
        {!props.hideTitle && (
          <SectionTitle>{t('Pricing by Group')}</SectionTitle>
        )}
        <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
        <p className='text-muted-foreground text-sm'>
          {t(
            'This model is not available in any group, or no group pricing information is configured.'
          )}
        </p>
      </section>
    )
  }

  // Customers cannot pick a group, so a table of groups only helps when the
  // price really differs per group. Otherwise one sentence says it all.
  const visibleGroups = visibleCustomerGroups(availableGroups)
  const pricedGroups =
    visibleGroups.length > 0 ? visibleGroups : availableGroups
  const samePriceForEveryone = pricedGroups.every(
    (group) => (props.groupRatio[group] || 1) === 1
  )
  const renderedGroups = samePriceForEveryone
    ? pricedGroups.slice(0, 1)
    : pricedGroups
  const showGroupTitle = !props.hideTitle && !samePriceForEveryone
  const samePriceNote = samePriceForEveryone ? (
    <p className='text-muted-foreground mb-2 text-sm'>
      {t('Same price for everyone')}
    </p>
  ) : null

  const thClass = cn(
    'text-muted-foreground py-2 text-xs font-medium whitespace-normal break-words',
    !props.model.billing_usage_schema && 'tracking-wider uppercase'
  )

  if (isDynamicPricingModel(props.model)) {
    const dynamicTiers = props.model.billing_usage_schema
      ? getTaskPricingDisplayTiers(
          props.model.billing_expr,
          props.model.billing_usage_schema
        )
      : getDynamicPricingTiers(props.model)
    const hasRequestPrice = dynamicTiers.some(
      (tier) => !('unitPrices' in tier) && tier.billingUnit === 'request'
    )

    if (dynamicTiers.length === 0) {
      return (
        <section>
          {showGroupTitle && (
            <SectionTitle>{t('Pricing by Group')}</SectionTitle>
          )}
          {!samePriceForEveryone && (
            <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
          )}
          <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10'>
            <div className='text-sm font-medium text-amber-800 dark:text-amber-200'>
              {t('Special billing expression')}
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t(
                pricingDisplayFallbackKey(
                  props.model.billing_expr || '',
                  props.model.billing_usage_schema
                )
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

    const usageExampleRows = evaluateTaskUsageExamples(
      props.model.billing_expr,
      props.model.billing_usage_schema,
      props.model.billing_usage_examples
    )
    const priceFields = getDynamicPriceFields(dynamicTiers, {
      tokenUnit: props.tokenUnit,
      showRechargePrice,
      priceRate: props.priceRate,
      usdExchangeRate: props.usdExchangeRate,
      groupRatioMultiplier: 1,
      usageSchema: props.model.billing_usage_schema,
    })
    const formattedPricesByGroup = new Map(
      renderedGroups.map((group) => {
        const ratio = props.groupRatio[group] || 1
        return [
          group,
          getDynamicFormattedPricesByTier(dynamicTiers, {
            tokenUnit: props.tokenUnit,
            showRechargePrice,
            priceRate: props.priceRate,
            usdExchangeRate: props.usdExchangeRate,
            groupRatioMultiplier: ratio,
            usageSchema: props.model.billing_usage_schema,
          }),
        ] as const
      })
    )

    return (
      <section>
        {showGroupTitle && <SectionTitle>{t('Pricing by Group')}</SectionTitle>}
        {!samePriceForEveryone && (
          <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
        )}
        {samePriceNote}
        <div className='space-y-3'>
          {renderedGroups.map((group) => {
            const ratio = props.groupRatio[group] || 1
            const formattedPricesByTier =
              formattedPricesByGroup.get(group) ??
              new Map<DynamicPricingTier, Map<string, string>>()

            return (
              <div key={group} className='overflow-hidden rounded-lg border'>
                {!samePriceForEveryone && (
                  <div className='bg-muted/20 flex items-center justify-between gap-3 border-b px-3 py-2'>
                    <GroupBadge group={group} size='sm' />
                    <span className='text-muted-foreground font-mono text-xs'>
                      {ratio}x
                    </span>
                  </div>
                )}
                <StaticDataTable
                  className='rounded-none border-0'
                  tableClassName='text-sm'
                  headerRowClassName='hover:bg-transparent'
                  data={dynamicTiers}
                  getRowKey={(tier, tierIndex) =>
                    `${group}-${tier.label}-${tierIndex}`
                  }
                  columns={[
                    ...(hasSimpleTaskPricing(props.model)
                      ? []
                      : [
                          {
                            id: 'tier',
                            header: props.model.billing_usage_schema
                              ? t('Applicable conditions')
                              : t('Tier'),
                            className: thClass,
                            cellClassName:
                              'text-muted-foreground py-2.5 whitespace-normal break-words',
                            cell: (tier: DynamicPricingTier) => {
                              if ('unitPrices' in tier) {
                                return (
                                  taskTierConditions(
                                    tier as ParsedTaskTier,
                                    props.model.billing_usage_schema,
                                    i18n.language,
                                    t
                                  ) ||
                                  t(
                                    dynamicTiers.length > 1
                                      ? 'Other cases'
                                      : 'All requests'
                                  )
                                )
                              }
                              if (tier.conditionText) {
                                return `${tier.label}: ${formatBillingCondition(tier.conditionText, t, i18n.language) ?? tier.conditionText}`
                              }
                              return tier.label || t('Default')
                            },
                          },
                        ]),
                    ...priceFields.map((fieldEntry) => {
                      const unitLabelKey =
                        getDynamicPriceUnitLabelKey(fieldEntry)
                      let unitLabel = taskUsageUnitLabel(
                        fieldEntry,
                        i18n.language,
                        unitLabelKey ? t(unitLabelKey) : ''
                      )
                      if (!unitLabel && hasRequestPrice) {
                        unitLabel = t('{{unit}} tokens', {
                          unit: tokenUnitLabel,
                        })
                      }
                      const fieldLabel =
                        fieldEntry.labelKind === 'schema' ? (
                          <DynamicPriceEntryLabel entry={fieldEntry} />
                        ) : (
                          t(fieldEntry.shortLabel)
                        )
                      return {
                        id: fieldEntry.field,
                        header: unitLabel ? (
                          <>
                            {fieldLabel}
                            {` / ${unitLabel}`}
                          </>
                        ) : (
                          fieldLabel
                        ),
                        className: `${thClass} text-right`,
                        cellClassName: 'py-2.5 text-right font-mono',
                        cell: (tier: (typeof dynamicTiers)[number]) =>
                          formattedPricesByTier
                            .get(tier)
                            ?.get(fieldEntry.field) ?? '-',
                      }
                    }),
                  ]}
                />
                {usageExampleRows.length > 0 ? (
                  <div className='border-t'>
                    <div className='text-muted-foreground px-3 pt-2 text-[10px] font-medium tracking-wider uppercase'>
                      {t('Price examples')}
                    </div>
                    <StaticDataTable
                      className='rounded-none border-0'
                      tableClassName='text-sm'
                      headerRowClassName='hover:bg-transparent'
                      data={usageExampleRows}
                      getRowKey={(row) => `${group}-${row.label}`}
                      columns={[
                        {
                          id: 'spec',
                          header: t('Spec'),
                          className: thClass,
                          cellClassName: 'text-muted-foreground py-2.5',
                          cell: (row) => row.label,
                        },
                        {
                          id: 'price',
                          header: t('Example price'),
                          className: `${thClass} text-right`,
                          cellClassName: 'py-2.5 text-right font-mono',
                          cell: (row) =>
                            `≈ ${formatTaskUsageUnitPrice(row.total, {
                              tokenUnit: props.tokenUnit,
                              showRechargePrice,
                              priceRate: props.priceRate,
                              usdExchangeRate: props.usdExchangeRate,
                              groupRatioMultiplier: ratio,
                            })}`,
                        },
                      ]}
                    />
                    <p className='text-muted-foreground/40 px-3 pb-2 text-[10px]'>
                      {t('Approximate prices for common specs.')}
                    </p>
                  </div>
                ) : null}
              </div>
            )
          })}
          <p className='text-muted-foreground/40 mt-1.5 text-[10px]'>
            {dynamicTiers.some(
              (tier) => 'unitPrices' in tier || tier.billingUnit === 'request'
            )
              ? t('Prices shown per usage unit')
              : t('Prices shown per {{unit}} tokens', { unit: tokenUnitLabel })}
          </p>
        </div>
      </section>
    )
  }

  if (isUnconfiguredTaskUsageModel(props.model)) {
    return (
      <section>
        {showGroupTitle && <SectionTitle>{t('Pricing by Group')}</SectionTitle>}
        {!samePriceForEveryone && (
          <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
        )}
        <UnconfiguredTaskPricingNotice model={props.model} />
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

  if (samePriceForEveryone) {
    return (
      <section>
        <p className='text-muted-foreground text-sm'>
          {t('Same price for everyone')}
        </p>
      </section>
    )
  }

  return (
    <section>
      {showGroupTitle && <SectionTitle>{t('Pricing by Group')}</SectionTitle>}
      <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
      <StaticDataTable
        className='-mx-4 rounded-none border-0 sm:mx-0'
        tableClassName='text-sm'
        headerRowClassName='hover:bg-transparent'
        data={pricedGroups}
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
                  header: plainPriceLabel(t, 'input').label,
                  className: `${thClass} text-right`,
                  cellClassName: 'py-2.5 text-right font-mono',
                  cell: (group: string) => renderGroupPrice(group, 'input'),
                },
                {
                  id: 'output',
                  header: plainPriceLabel(t, 'output').label,
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
          <p className='text-muted-foreground/40 mt-1.5 px-4 text-[10px] sm:px-0'>
            {t('Prices shown per {{unit}} tokens', { unit: tokenUnitLabel })}
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

  const simpleTaskPricing = hasSimpleTaskPricing(props.model)
  const taskTiers = getTaskPricingDisplayTiers(
    props.model.billing_expr,
    props.model.billing_usage_schema
  )
  const showBasePrices =
    !props.model.billing_usage_schema ||
    simpleTaskPricing ||
    taskTiers.length === 0

  return (
    <div className='@container/details space-y-4'>
      <ModelHeader model={props.model} />

      <Tabs defaultValue='overview' className='gap-4'>
        <TabsList className='bg-muted/60 grid w-full grid-cols-3 gap-1 rounded-lg p-1 group-data-horizontal/tabs:h-auto'>
          {TAB_VALUES.map((value) => {
            const Icon = TAB_META[value].icon
            return (
              <TabsTrigger
                key={value}
                value={value}
                className='h-auto min-h-8 min-w-0 gap-1.5 rounded-md px-2 py-1 text-xs whitespace-normal sm:px-3 sm:text-sm'
              >
                <Icon className='size-3.5 max-sm:hidden' />
                <span className='text-center leading-tight break-words'>
                  {t(TAB_META[value].labelKey)}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value='overview' className='space-y-6 outline-none'>
          <OverviewSummaryGrid model={props.model} />

          <section className='bg-card/60 space-y-5 rounded-xl border p-4 shadow-sm'>
            <SectionTitle>{t('Pricing')}</SectionTitle>
            {showBasePrices && (
              <PriceSection
                model={props.model}
                priceRate={props.priceRate}
                usdExchangeRate={props.usdExchangeRate}
                tokenUnit={props.tokenUnit}
                showRechargePrice={showRechargePrice}
              />
            )}
            {isDynamic && !simpleTaskPricing && (
              <DynamicPricingBreakdown
                billingExpr={props.model.billing_expr}
                usageSchema={props.model.billing_usage_schema}
                taskPriceOptions={{
                  showRechargePrice,
                  priceRate: props.priceRate,
                  usdExchangeRate: props.usdExchangeRate,
                }}
              />
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
        className={sideDrawerContentClassName(
          'sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl'
        )}
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
            {MODEL_DETAILS_SKELETON_KEYS.map((key) => (
              <Skeleton key={`metric-${key}`} className='h-16 w-full' />
            ))}
          </div>
          <div className='mt-6 space-y-3'>
            {MODEL_DETAILS_SKELETON_KEYS.map((key) => (
              <Skeleton key={`section-${key}`} className='h-24 w-full' />
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
