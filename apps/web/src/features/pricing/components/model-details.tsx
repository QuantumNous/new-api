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
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Code2, HeartPulse, Info } from 'lucide-react'
import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { sideDrawerContentClassName } from '@/components/drawer-layout'
import { ErrorState } from '@/components/error-state'
import { Main, PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStatus } from '@/hooks/use-status'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { usePricingData } from '../hooks/use-pricing-data'
import type { PricingModel, TokenUnit } from '../types'
import { DynamicPricingBreakdown } from './dynamic-pricing-breakdown'
import { ModelDetailsApi } from './model-details-api'
import { PriceSection } from './model-details-base-price'
import {
  ModelBackendDetailsSection,
  OverviewSummaryGrid,
} from './model-details-catalog'
import { GroupPricingSection } from './model-details-group-pricing'
import { ModelHeader } from './model-details-header'
import { ModelDetailsPerformance } from './model-details-performance'
import { SectionTitle } from './model-details-section-title'

const MODEL_DETAILS_SKELETON_KEYS = ['first', 'second', 'third', 'fourth']

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
  const { status } = useStatus()
  const emptyMultiplier = status?.empty_response_multiplier
  const truncatedMultiplier = status?.truncated_response_multiplier
  const showRechargePrice = props.showRechargePrice ?? false

  const isDynamic =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)

  return (
    <div className='@container/details space-y-4'>
      <ModelHeader model={props.model} />

      <Tabs defaultValue='overview' className='gap-4'>
        <TabsList className='grid w-full grid-cols-3 group-data-horizontal/tabs:h-auto'>
          {TAB_VALUES.map((value) => {
            const Icon = TAB_META[value].icon
            return (
              <TabsTrigger
                key={value}
                value={value}
                className='h-10 min-w-0 gap-1.5 px-3 text-xs sm:text-sm'
              >
                <Icon className='size-3.5' />
                <span className='truncate'>{t(TAB_META[value].labelKey)}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value='overview' className='space-y-6 outline-none'>
          <OverviewSummaryGrid model={props.model} />

          <Card>
            <CardHeader>
              <SectionTitle>{t('Pricing')}</SectionTitle>
            </CardHeader>
            <CardContent className='space-y-5'>
              <PriceSection
                model={props.model}
                priceRate={props.priceRate}
                usdExchangeRate={props.usdExchangeRate}
                tokenUnit={props.tokenUnit}
                showRechargePrice={showRechargePrice}
              />
              {isDynamic && (
                <DynamicPricingBreakdown
                  billingExpr={props.model.billing_expr}
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
              {typeof emptyMultiplier === 'number' &&
                typeof truncatedMultiplier === 'number' && (
                  <div className='text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs'>
                    <Info
                      className='mt-0.5 size-3.5 shrink-0'
                      aria-hidden='true'
                    />
                    <p>
                      <Trans
                        i18nKey='pricing.model.emptyResponseNote'
                        values={{
                          empty: emptyMultiplier,
                          emptyRefund: Math.round((1 - emptyMultiplier) * 100),
                          truncated: truncatedMultiplier,
                          truncatedRefund: Math.round(
                            (1 - truncatedMultiplier) * 100
                          ),
                        }}
                        components={{
                          0: <span className='text-amber-500' />,
                        }}
                      />
                    </p>
                  </div>
                )}
            </CardContent>
          </Card>

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
        <div className='no-scrollbar flex-1 overflow-y-auto px-4 pt-11 pb-5 sm:px-6 sm:pt-12 sm:pb-6'>
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
    error,
    refetch,
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
        <Main className='mx-auto w-full max-w-5xl overflow-visible px-4 pt-20 pb-10 sm:px-6 sm:pt-24'>
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
        </Main>
      </PublicLayout>
    )
  }

  if (error) {
    return (
      <PublicLayout showMainContainer={false}>
        <Main className='mx-auto w-full max-w-5xl px-4 pt-24 sm:px-6'>
          <ErrorState
            title={t('Loading failed')}
            onRetry={() => void refetch()}
          />
        </Main>
      </PublicLayout>
    )
  }

  if (!model) {
    return (
      <PublicLayout showMainContainer={false}>
        <Main className='mx-auto w-full max-w-2xl px-4 pt-24 text-center sm:px-6'>
          <h2 className='mb-1 text-base font-semibold'>
            {t('Model not found')}
          </h2>
          <p className='text-muted-foreground mb-4 text-sm'>
            {t("The model you're looking for doesn't exist.")}
          </p>
          <Button onClick={handleBack} variant='outline' size='sm'>
            {t('Back to Models')}
          </Button>
        </Main>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <Main className='mx-auto w-full max-w-5xl overflow-visible px-4 pt-20 pb-10 sm:px-6 sm:pt-24'>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleBack}
          className='text-muted-foreground mb-4 w-fit gap-1.5'
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
      </Main>
    </PublicLayout>
  )
}
