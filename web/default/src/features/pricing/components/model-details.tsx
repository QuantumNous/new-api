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
import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'
import { DEFAULT_TOKEN_UNIT, QUOTA_TYPE_VALUES } from '../constants'
import { usePricingData } from '../hooks/use-pricing-data'
import { parseTags } from '../lib/filters'
import {
  getAvailableGroups,
  replaceModelInPath,
  isTokenBasedModel,
} from '../lib/model-helpers'
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
              {t('Dynamic Pricing')}
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
  groupRatio: Record<string, number>
}) {
  const { t } = useTranslation()
  const {
    model,
    priceRate,
    usdExchangeRate,
    tokenUnit,
    showRechargePrice,
    groupRatio,
  } = props
  const isTokenBased = isTokenBasedModel(model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const defaultGroup = model.enable_groups?.[0] || ''
  const ratio = defaultGroup ? groupRatio[defaultGroup] || 1 : 1
  const groupKey = defaultGroup || '_default'
  const groupRatioMap = { [groupKey]: ratio }

  const priceTypes: { label: string; type: PriceType; available: boolean }[] = [
    { label: t('Input'), type: 'input', available: true },
    {
      label: t('Cached input'),
      type: 'cache',
      available: model.cache_ratio != null,
    },
    { label: t('Output'), type: 'output', available: true },
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

  if (!isTokenBased) {
    return (
      <section className='border-b py-4'>
        <SectionTitle>{t('Price')}</SectionTitle>
        <div className='flex items-baseline justify-between'>
          <span className='text-muted-foreground text-sm'>
            {t('Per request')}
          </span>
          <span className='text-foreground font-mono text-sm font-semibold tabular-nums'>
            {formatGroupPrice(
              model,
              groupKey,
              'input',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              groupRatioMap
            )}
          </span>
        </div>
      </section>
    )
  }

  const items = priceTypes.filter((p) => p.available)

  return (
    <section className='border-b py-4'>
      <SectionTitle>{t('Price')}</SectionTitle>
      <div className='space-y-1.5'>
        {items.map((item) => (
          <div key={item.type} className='flex items-baseline justify-between'>
            <span className='text-muted-foreground text-sm'>{item.label}</span>
            <span className='text-foreground font-mono text-sm tabular-nums'>
              {formatGroupPrice(
                model,
                groupKey,
                item.type,
                tokenUnit,
                showRechargePrice,
                priceRate,
                usdExchangeRate,
                groupRatioMap
              )}
              <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
                / {tokenUnitLabel}
              </span>
            </span>
          </div>
        ))}
      </div>
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
          <span className='bg-muted text-foreground rounded px-1.5 py-0.5 text-[11px] font-medium'>
            {g}
          </span>
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
                  <TableCell className='py-2.5 font-medium'>{group}</TableCell>
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

        <ModelHeader model={model} />

        <PriceSection
          model={model}
          priceRate={priceRate ?? 1}
          usdExchangeRate={usdExchangeRate ?? 1}
          tokenUnit={tokenUnit}
          showRechargePrice={search.rechargePrice ?? false}
          groupRatio={groupRatio || {}}
        />

        <EndpointsSection
          model={model}
          endpointMap={
            (endpointMap as Record<
              string,
              { path?: string; method?: string }
            >) || {}
          }
        />

        {model.billing_mode === 'tiered_expr' && model.billing_expr && (
          <div className='border-b'>
            <DynamicPricingBreakdown billingExpr={model.billing_expr} />
          </div>
        )}

        <GroupPricingSection
          model={model}
          groupRatio={groupRatio || {}}
          usableGroup={usableGroup || {}}
          autoGroups={autoGroups || []}
          priceRate={priceRate ?? 1}
          usdExchangeRate={usdExchangeRate ?? 1}
          tokenUnit={tokenUnit}
          showRechargePrice={search.rechargePrice ?? false}
        />
      </div>
    </PublicLayout>
  )
}
