import { useMemo } from 'react'
import { useParams, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CopyButton } from '@/components/copy-button'
import { GroupBadge } from '@/components/group-badge'
import { PublicLayout } from '@/components/layout'
import { DEFAULT_TOKEN_UNIT, QUOTA_TYPE_VALUES } from '../constants'
import { usePricingData } from '../hooks/use-pricing-data'
import { parseTags } from '../lib/filters'
import {
  getAvailableGroups,
  replaceModelInPath,
  isTokenBasedModel,
} from '../lib/model-helpers'
import {
  getDynamicPriceEntries,
  getDynamicPricingSummary,
  getDynamicPricingTiers,
  isDynamicPricingModel,
} from '../lib/dynamic-price'
import { formatGroupPrice, formatFixedPrice } from '../lib/price'
import type { PricingModel, TokenUnit, PriceType } from '../types'
import { DynamicPricingBreakdown } from './dynamic-pricing-breakdown'

function SectionTitle(props: { children: React.ReactNode }) {
  return (
    <h2 className='text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase'>
      {props.children}
    </h2>
  )
}

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
    <header className='pb-5'>
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
      <div className='mt-1 flex items-center gap-1.5 text-xs'>
        {model.vendor_name && (
          <span className='text-muted-foreground'>{model.vendor_name}</span>
        )}
        <span className='text-muted-foreground/30'>·</span>
        <span className='text-muted-foreground/50'>
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

function PriceSection(props: {
  model: PricingModel
  priceRate: number
  usdExchangeRate: number
  tokenUnit: TokenUnit
  showRechargePrice: boolean
}) {
  const { t } = useTranslation()
  const {
    model,
    priceRate,
    usdExchangeRate,
    tokenUnit,
    showRechargePrice,
  } = props
  const isTokenBased = isTokenBasedModel(model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const baseGroupKey = '_base'
  const baseGroupRatioMap = { [baseGroupKey]: 1 }
  const dynamicSummary = getDynamicPricingSummary(model, {
    tokenUnit,
    showRechargePrice,
    priceRate,
    usdExchangeRate,
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
      available: model.cache_ratio != null,
    },
    {
      label: t('Cache write'),
      type: 'create_cache',
      available: model.create_cache_ratio != null,
    },
    {
      label: t('Image input'),
      type: 'image',
      available: model.image_ratio != null,
    },
    {
      label: t('Audio input'),
      type: 'audio_input',
      available: model.audio_ratio != null,
    },
    {
      label: t('Audio output'),
      type: 'audio_output',
      available:
        model.audio_ratio != null && model.audio_completion_ratio != null,
    },
  ]

  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      return (
        <section className='border-b py-4'>
          <SectionTitle>{t('Base Price')}</SectionTitle>
          <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10'>
            <div className='text-amber-800 text-sm font-medium dark:text-amber-200'>
              {t('Special billing expression')}
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('Unable to parse structured pricing')}
            </p>
            <div className='mt-3'>
              <div className='text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase'>
                {t('Raw expression')}
              </div>
              <code className='text-muted-foreground block max-h-28 overflow-auto rounded-md border bg-background/80 px-2 py-1.5 font-mono text-xs break-all'>
                {dynamicSummary.rawExpression}
              </code>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className='border-b py-4'>
        <SectionTitle>{t('Base Price')}</SectionTitle>
        {dynamicSummary.primaryEntries.length > 0 ? (
          <div className='grid grid-cols-2 gap-2'>
            {dynamicSummary.primaryEntries.map((entry) => (
              <div key={entry.key} className='rounded-lg border bg-muted/20 p-3'>
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
      <section className='border-b py-4'>
        <SectionTitle>{t('Base Price')}</SectionTitle>
        <div className='flex items-baseline justify-between'>
          <span className='text-muted-foreground text-sm'>
            {t('Per request')}
          </span>
          <span className='text-foreground font-mono text-sm font-semibold tabular-nums'>
            {formatFixedPrice(
              model,
              baseGroupKey,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
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
        model,
        baseGroupKey,
        type,
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        baseGroupRatioMap
      )}
      <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
        / {tokenUnitLabel}
      </span>
    </>
  )

  return (
    <section className='border-b py-4'>
      <SectionTitle>{t('Base Price')}</SectionTitle>
      <div className='grid grid-cols-2 gap-2'>
        {primaryPriceTypes.map((item) => (
          <div key={item.type} className='rounded-lg border bg-muted/20 p-3'>
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

function EndpointsSection(props: {
  model: PricingModel
  endpointMap: Record<string, { path?: string; method?: string }>
}) {
  const { t } = useTranslation()
  const { model, endpointMap } = props

  const endpoints = useMemo(() => {
    const types = model.supported_endpoint_types || []
    return types.map((type) => {
      const info = endpointMap[type] || {}
      let path = info.path || ''
      if (path.includes('{model}')) {
        path = replaceModelInPath(path, model.model_name || '')
      }
      return { type, path, method: info.method || 'POST' }
    })
  }, [model, endpointMap])

  if (endpoints.length === 0) return null

  return (
    <section className='border-b py-4'>
      <SectionTitle>{t('API Endpoints')}</SectionTitle>
      <div className='space-y-1'>
        {endpoints.map(({ type, path, method }) => (
          <div key={type} className='flex items-center justify-between py-1'>
            <div className='flex items-center gap-2'>
              <span className='text-sm font-medium'>{type}</span>
              {path && (
                <code className='text-muted-foreground/60 text-xs break-all'>
                  {path}
                </code>
              )}
            </div>
            {path && (
              <span className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase'>
                {method}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

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
  const {
    model,
    groupRatio,
    usableGroup,
    autoGroups,
    priceRate,
    usdExchangeRate,
    tokenUnit,
    showRechargePrice = false,
  } = props

  const availableGroups = useMemo(
    () => getAvailableGroups(model, usableGroup || {}),
    [model, usableGroup]
  )

  const isTokenBased = isTokenBasedModel(model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'

  const extraPriceTypes = useMemo(() => {
    const types: { label: string; type: PriceType }[] = []
    if (model.cache_ratio != null)
      types.push({ label: t('Cache'), type: 'cache' })
    if (model.create_cache_ratio != null)
      types.push({ label: t('Cache Write'), type: 'create_cache' })
    if (model.image_ratio != null)
      types.push({ label: t('Image'), type: 'image' })
    if (model.audio_ratio != null)
      types.push({ label: t('Audio In'), type: 'audio_input' })
    if (model.audio_ratio != null && model.audio_completion_ratio != null)
      types.push({ label: t('Audio Out'), type: 'audio_output' })
    return types
  }, [model, t])

  if (availableGroups.length === 0) {
    return (
      <section className='py-4'>
        <SectionTitle>{t('Pricing by Group')}</SectionTitle>
        <AutoGroupChain model={model} autoGroups={autoGroups} />
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

  if (isDynamicPricingModel(model)) {
    const dynamicTiers = getDynamicPricingTiers(model)

    if (dynamicTiers.length === 0) {
      return (
        <section className='py-4'>
          <SectionTitle>{t('Pricing by Group')}</SectionTitle>
          <AutoGroupChain model={model} autoGroups={autoGroups} />
          <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10'>
            <div className='text-amber-800 text-sm font-medium dark:text-amber-200'>
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
              <code className='text-muted-foreground block max-h-28 overflow-auto rounded-md border bg-background/80 px-2 py-1.5 font-mono text-xs break-all'>
                {model.billing_expr}
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
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              groupRatioMultiplier: 1,
            })
          )
          .map((entry) => [entry.field, entry])
      ).values()
    )

    return (
      <section className='py-4'>
        <SectionTitle>{t('Pricing by Group')}</SectionTitle>
        <AutoGroupChain model={model} autoGroups={autoGroups} />
        <div className='space-y-3'>
          {availableGroups.map((group) => {
            const ratio = groupRatio[group] || 1
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
                          tokenUnit,
                          showRechargePrice,
                          priceRate,
                          usdExchangeRate,
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
          <p className='text-muted-foreground/40 mt-1.5 px-4 text-[10px] sm:px-0'>
            {t('Prices shown per')} {tokenUnitLabel} tokens
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className='py-4'>
      <SectionTitle>{t('Pricing by Group')}</SectionTitle>
      <AutoGroupChain model={model} autoGroups={autoGroups} />
      <div className='-mx-4 sm:mx-0'>
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
              const ratio = groupRatio[group] || 1
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
                          model,
                          group,
                          'input',
                          tokenUnit,
                          showRechargePrice,
                          priceRate,
                          usdExchangeRate,
                          groupRatio
                        )}
                      </TableCell>
                      <TableCell className='py-2.5 text-right font-mono'>
                        {formatGroupPrice(
                          model,
                          group,
                          'output',
                          tokenUnit,
                          showRechargePrice,
                          priceRate,
                          usdExchangeRate,
                          groupRatio
                        )}
                      </TableCell>
                      {extraPriceTypes.map((ep) => (
                        <TableCell
                          key={ep.type}
                          className='py-2.5 text-right font-mono'
                        >
                          {formatGroupPrice(
                            model,
                            group,
                            ep.type,
                            tokenUnit,
                            showRechargePrice,
                            priceRate,
                            usdExchangeRate,
                            groupRatio
                          )}
                        </TableCell>
                      ))}
                    </>
                  ) : (
                    <TableCell className='py-2.5 text-right font-mono'>
                      {formatFixedPrice(
                        model,
                        group,
                        showRechargePrice,
                        priceRate,
                        usdExchangeRate,
                        groupRatio
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
  const {
    model,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    priceRate,
    usdExchangeRate,
    tokenUnit,
    showRechargePrice = false,
  } = props

  return (
    <>
      <ModelHeader model={model} />

      <PriceSection
        model={model}
        priceRate={priceRate}
        usdExchangeRate={usdExchangeRate}
        tokenUnit={tokenUnit}
        showRechargePrice={showRechargePrice}
      />

      <EndpointsSection model={model} endpointMap={endpointMap} />

      {model.billing_mode === 'tiered_expr' && model.billing_expr && (
        <div className='border-b'>
          <DynamicPricingBreakdown billingExpr={model.billing_expr} />
        </div>
      )}

      <GroupPricingSection
        model={model}
        groupRatio={groupRatio}
        usableGroup={usableGroup}
        autoGroups={autoGroups}
        priceRate={priceRate}
        usdExchangeRate={usdExchangeRate}
        tokenUnit={tokenUnit}
        showRechargePrice={showRechargePrice}
      />
    </>
  )
}

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
        className='flex h-dvh w-full overflow-hidden p-0 sm:max-w-2xl xl:max-w-3xl'
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
        <div className='mx-auto max-w-2xl px-4 sm:px-6'>
          <Skeleton className='mb-4 h-5 w-16' />
          <div className='space-y-2'>
            <Skeleton className='h-7 w-64' />
            <Skeleton className='h-4 w-40' />
            <Skeleton className='h-4 w-full max-w-md' />
          </div>
          <div className='mt-6 space-y-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className='flex justify-between'>
                <Skeleton className='h-5 w-24' />
                <Skeleton className='h-5 w-20' />
              </div>
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
      <div className='mx-auto max-w-2xl px-4 sm:px-6'>
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
