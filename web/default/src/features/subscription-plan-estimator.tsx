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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CalendarClock, Check, InfinityIcon, PackageOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { featuredModelNames } from '@/features/home/model-pricing-config'
import { getPricing } from '@/features/pricing/api'
import { getModelUsableGroupRatios } from '@/features/pricing/lib/model-helpers'
import type { PricingModel } from '@/features/pricing/types'
import {
  getPublicPlans,
  getSelfSubscriptionFull,
} from '@/features/subscriptions/api'
import { SubscriptionPurchaseDialog } from '@/features/subscriptions/components/dialogs/subscription-purchase-dialog'
import { formatDuration, formatResetPeriod } from '@/features/subscriptions/lib'
import type { PlanRecord } from '@/features/subscriptions/types'
import { useTopupInfo } from '@/features/wallet/hooks'
import { getSelf } from '@/lib/api'
import { formatSubscriptionPlanPrice } from '@/lib/currency'
import { formatQuota, formatTokens } from '@/lib/format'
import { getLocalizedField } from '@/lib/localized-content'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

function formatTokenCapacity(value: number): string {
  if (!Number.isFinite(value)) return '∞'
  if (value <= 0) return '-'
  return `${formatTokens(Math.floor(value))} Token`
}

export function Plans() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const setUser = useAuthStore((state) => state.auth.setUser)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [purchasePlan, setPurchasePlan] = useState<PlanRecord | null>(null)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [purchaseDataEnabled, setPurchaseDataEnabled] = useState(false)
  const { topupInfo } = useTopupInfo(Boolean(user) && purchaseDataEnabled)

  const plansQuery = useQuery({
    queryKey: ['subscription-plans', 'public'],
    queryFn: getPublicPlans,
    staleTime: 5 * 60 * 1000,
  })
  const pricingQuery = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    staleTime: 5 * 60 * 1000,
  })
  const subscriptionsQuery = useQuery({
    queryKey: ['subscription-self'],
    queryFn: getSelfSubscriptionFull,
    enabled: Boolean(user) && purchaseDataEnabled,
  })

  const planRecords = useMemo(() => {
    return [...(plansQuery.data?.data || [])]
      .filter((record) => record.plan.enabled)
      .map((record) => ({
        ...record,
        plan: {
          ...record.plan,
          title: getLocalizedField(
            record.plan,
            'title',
            i18n.resolvedLanguage,
            t
          ),
          subtitle: getLocalizedField(
            record.plan,
            'subtitle',
            i18n.resolvedLanguage,
            t
          ),
        },
      }))
      .sort((left, right) => {
        if (left.plan.sort_order !== right.plan.sort_order) {
          return right.plan.sort_order - left.plan.sort_order
        }
        return right.plan.id - left.plan.id
      })
  }, [i18n.resolvedLanguage, plansQuery.data, t])

  const plans = useMemo(
    () => planRecords.map((record) => record.plan),
    [planRecords]
  )

  const planGroups = useMemo(
    () =>
      [
        {
          value: 'credit',
          labelKey: 'Credit Plans',
          plans: planRecords.filter(
            (record) => record.plan.quota_reset_period === 'never'
          ),
        },
        {
          value: 'reset',
          labelKey: 'Reset Plans',
          plans: planRecords.filter(
            (record) => record.plan.quota_reset_period !== 'never'
          ),
        },
      ].filter((group) => group.plans.length > 0),
    [planRecords]
  )

  useEffect(() => {
    if (plans.length === 0) {
      setSelectedPlanId(null)
      return
    }
    if (!plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(plans[0].id)
    }
  }, [plans, selectedPlanId])

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null

  const modelPricing = useMemo(() => {
    const pricingMap = new Map(
      (pricingQuery.data?.data || []).map((model) => [model.model_name, model])
    )
    return featuredModelNames.map((modelName) => ({
      modelName,
      pricing: pricingMap.get(modelName),
    }))
  }, [pricingQuery.data])

  const purchaseCountMap = useMemo(() => {
    const counts = new Map<number, number>()
    const subscriptions = subscriptionsQuery.data?.data?.all_subscriptions || []
    for (const record of subscriptions) {
      const planId = record.subscription.plan_id
      counts.set(planId, (counts.get(planId) || 0) + 1)
    }
    return counts
  }, [subscriptionsQuery.data])

  const epayMethods = useMemo(() => {
    return (topupInfo?.pay_methods || []).filter(
      (method) =>
        method.type && method.type !== 'stripe' && method.type !== 'creem'
    )
  }, [topupInfo?.pay_methods])

  const isUnlimited = Boolean(selectedPlan && selectedPlan.total_amount <= 0)
  const resetLabel = selectedPlan
    ? formatResetPeriod(selectedPlan, t)
    : t('No Reset')

  const getCapacity = (
    model: PricingModel | undefined,
    type: 'input' | 'output'
  ): { label: string; value: number | null } => {
    if (!selectedPlan || !model) {
      return { label: t('Pricing unavailable'), value: null }
    }
    if (model.quota_type !== 0 || model.billing_mode === 'tiered_expr') {
      return { label: t('Dynamic pricing'), value: null }
    }
    if (isUnlimited) {
      return {
        label: formatTokenCapacity(Number.POSITIVE_INFINITY),
        value: Number.POSITIVE_INFINITY,
      }
    }

    const modelGroupRatios = getModelUsableGroupRatios(
      model,
      pricingQuery.data?.group_ratio || {},
      pricingQuery.data?.usable_group || {}
    )
    const effectiveGroupRatio = selectedPlan.upgrade_group
      ? pricingQuery.data?.group_ratio?.[selectedPlan.upgrade_group]
      : Math.min(...modelGroupRatios)
    const completionRatio = type === 'output' ? model.completion_ratio : 1
    const costPerToken =
      model.model_ratio * completionRatio * (effectiveGroupRatio || 1)
    if (!Number.isFinite(costPerToken) || costPerToken <= 0) {
      return { label: t('Pricing unavailable'), value: null }
    }
    const value = selectedPlan.total_amount / costPerToken
    return { label: formatTokenCapacity(value), value }
  }

  const capacityRows = modelPricing.map((item) => ({
    ...item,
    input: getCapacity(item.pricing, 'input'),
    output: getCapacity(item.pricing, 'output'),
  }))
  const finiteCapacityValues = capacityRows.flatMap((row) =>
    [row.input.value, row.output.value].filter(
      (value): value is number => value !== null && Number.isFinite(value)
    )
  )
  const maxCapacity = Math.max(...finiteCapacityValues, 0)

  const getProgressValue = (value: number | null): number => {
    if (value === Number.POSITIVE_INFINITY) return 100
    if (value === null || maxCapacity <= 0) return 0
    return (value / maxCapacity) * 100
  }

  const isLoading = plansQuery.isLoading || pricingQuery.isLoading
  const hasError = plansQuery.isError || pricingQuery.isError

  const handleSubscribe = (record: PlanRecord) => {
    if (!user) {
      navigate({ to: '/sign-in', search: { redirect: '/plans' } })
      return
    }
    setSelectedPlanId(record.plan.id)
    setPurchasePlan(record)
    setPurchaseDataEnabled(true)
    setPurchaseOpen(true)
  }

  const handlePurchaseSuccess = async () => {
    const response = await getSelf()
    if (response.success && response.data) {
      setUser(response.data)
    }
    await queryClient.invalidateQueries({ queryKey: ['subscription-self'] })
  }

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='mx-auto w-full max-w-7xl px-4 pt-24 pb-12 sm:px-6 sm:pt-28 lg:px-8'>
        <header className='mx-auto mb-8 max-w-3xl text-center sm:mb-10'>
          <Badge variant='secondary' className='mb-4'>
            {t('Subscription Plans')}
          </Badge>
          <h1 className='text-3xl leading-tight font-bold sm:text-4xl'>
            {t('Choose a plan and estimate model usage')}
          </h1>
          <p className='text-muted-foreground mt-3 text-sm leading-6 sm:text-base'>
            {t(
              'Select a plan to see the maximum standalone input or output Token capacity for each model.'
            )}
          </p>
        </header>

        {isLoading && (
          <div className='space-y-8'>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {['first', 'second', 'third'].map((key) => (
                <Skeleton key={key} className='h-48 rounded-xl' />
              ))}
            </div>
            <Skeleton className='h-96 rounded-xl' />
          </div>
        )}
        {!isLoading && hasError && (
          <Card className='mx-auto max-w-xl text-center'>
            <CardHeader>
              <CardTitle>{t('Unable to load subscription plans')}</CardTitle>
              <CardDescription>
                {t('Please refresh the page and try again.')}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        {!isLoading && !hasError && plans.length === 0 && (
          <div className='text-muted-foreground flex min-h-72 flex-col items-center justify-center gap-3 text-center'>
            <PackageOpen className='size-10' aria-hidden='true' />
            <p className='font-medium'>{t('No plans available')}</p>
          </div>
        )}
        {!isLoading && !hasError && plans.length > 0 && (
          <div className='space-y-8'>
            <section aria-labelledby='plan-selection-heading'>
              <div className='mb-3 flex items-end justify-between gap-4'>
                <div>
                  <h2
                    id='plan-selection-heading'
                    className='text-xl font-semibold'
                  >
                    {t('Select a plan')}
                  </h2>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    {t('{{count}} plans available', { count: plans.length })}
                  </p>
                </div>
              </div>
              <Tabs defaultValue={planGroups[0].value}>
                <TabsList
                  className={cn(
                    'mx-auto mb-6 grid w-full max-w-sm',
                    planGroups.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                  )}
                >
                  {planGroups.map((group) => (
                    <TabsTrigger key={group.value} value={group.value}>
                      {t(group.labelKey)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {planGroups.map((group) => (
                  <TabsContent key={group.value} value={group.value}>
                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
                      {group.plans.map((record) => {
                        const plan = record.plan
                        const isSelected = plan.id === selectedPlanId
                        const resetPeriod = formatResetPeriod(plan, t)
                        const quotaLabel =
                          plan.quota_reset_period === 'never'
                            ? t('Total Quota')
                            : t('Period Quota')
                        const benefits = [
                          `${t('Validity Period')}: ${formatDuration(plan, t)}`,
                          resetPeriod !== t('No Reset')
                            ? `${t('Quota Reset')}: ${resetPeriod}`
                            : null,
                          plan.total_amount > 0
                            ? `${quotaLabel}: ${formatQuota(plan.total_amount)}`
                            : `${quotaLabel}: ${t('Unlimited')}`,
                          plan.upgrade_group
                            ? `${t('Upgrade Group')}: ${plan.upgrade_group}`
                            : null,
                        ].filter(Boolean) as string[]

                        return (
                          <Card
                            key={plan.id}
                            className={cn(
                              'bg-card/70 min-h-[240px] rounded-3xl text-left backdrop-blur-md transition-transform hover:-translate-y-0.5',
                              isSelected && 'ring-primary/30 ring-2'
                            )}
                          >
                            <button
                              type='button'
                              aria-pressed={isSelected}
                              onClick={() => setSelectedPlanId(plan.id)}
                              className='focus-visible:ring-ring flex flex-1 flex-col rounded-t-3xl text-left outline-none focus-visible:ring-2'
                            >
                              <CardHeader className='w-full'>
                                <CardTitle className='flex items-center justify-between gap-3 text-lg font-semibold'>
                                  <span className='truncate'>
                                    {plan.title || t('Subscription Plans')}
                                  </span>
                                  {isSelected && (
                                    <span className='bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full'>
                                      <Check
                                        className='size-3.5'
                                        aria-hidden='true'
                                      />
                                    </span>
                                  )}
                                </CardTitle>
                                {plan.subtitle && (
                                  <div className='text-muted-foreground line-clamp-2 text-sm'>
                                    {plan.subtitle}
                                  </div>
                                )}
                              </CardHeader>

                              <CardContent className='flex w-full flex-1 flex-col gap-5'>
                                <div className='bg-primary/8 rounded-2xl px-4 py-3'>
                                  <span className='text-primary text-3xl font-bold'>
                                    {formatSubscriptionPlanPrice(
                                      plan.price_amount
                                    )}
                                  </span>
                                </div>

                                <div className='flex flex-col gap-2'>
                                  {benefits.map((benefit) => (
                                    <div
                                      key={benefit}
                                      className='text-muted-foreground flex items-start gap-2 text-sm'
                                    >
                                      <Check className='text-primary mt-0.5 size-4 shrink-0' />
                                      <span>{benefit}</span>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </button>

                            <CardFooter>
                              <Button
                                variant='outline'
                                size='lg'
                                className='h-11 w-full rounded-full text-base font-semibold'
                                onClick={() => handleSubscribe(record)}
                              >
                                {t('Subscribe Now')}
                              </Button>
                            </CardFooter>
                          </Card>
                        )
                      })}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            {selectedPlan && (
              <section aria-labelledby='capacity-heading'>
                <Card className='gap-0 py-0'>
                  <CardHeader className='border-b px-5 py-5 sm:px-6'>
                    <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-start'>
                      <div>
                        <CardTitle id='capacity-heading' className='text-xl'>
                          {t('{{plan}} Token capacity', {
                            plan: selectedPlan.title,
                          })}
                        </CardTitle>
                        <CardDescription className='mt-1.5 leading-5'>
                          {selectedPlan.quota_reset_period === 'never'
                            ? t(
                                'Maximum standalone usage across the full plan validity period.'
                              )
                            : t(
                                'Maximum standalone usage within each {{period}} reset period.',
                                { period: resetLabel }
                              )}
                        </CardDescription>
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        <Badge variant='outline'>
                          <CalendarClock aria-hidden='true' />
                          {formatDuration(selectedPlan, t)}
                        </Badge>
                        <Badge variant='outline'>
                          {isUnlimited && <InfinityIcon aria-hidden='true' />}
                          {isUnlimited
                            ? t('Unlimited Quota')
                            : formatQuota(selectedPlan.total_amount)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className='divide-y p-0'>
                    {capacityRows.map((item) => (
                      <div
                        key={item.modelName}
                        className='space-y-4 px-5 py-5 sm:px-6'
                      >
                        <h3 className='font-mono text-sm font-semibold'>
                          {item.modelName}
                        </h3>
                        <div className='space-y-3'>
                          <div className='grid grid-cols-[4.5rem_minmax(0,1fr)_7rem] items-center gap-3'>
                            <span className='text-muted-foreground text-xs font-medium'>
                              {t('Maximum input Tokens')}
                            </span>
                            <Progress
                              value={getProgressValue(item.input.value)}
                              aria-label={`${item.modelName} ${t('Maximum input Tokens')}`}
                              className='[&_[data-slot=progress-track]]:h-2.5'
                            />
                            <span className='text-right text-sm font-semibold tabular-nums'>
                              {item.input.label}
                            </span>
                          </div>
                          <div className='grid grid-cols-[4.5rem_minmax(0,1fr)_7rem] items-center gap-3'>
                            <span className='text-muted-foreground text-xs font-medium'>
                              {t('Maximum output Tokens')}
                            </span>
                            <Progress
                              value={getProgressValue(item.output.value)}
                              aria-label={`${item.modelName} ${t('Maximum output Tokens')}`}
                              className='[&_[data-slot=progress-indicator]]:bg-chart-2 [&_[data-slot=progress-track]]:h-2.5'
                            />
                            <span className='text-right text-sm font-semibold tabular-nums'>
                              {item.output.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <p className='text-muted-foreground mt-3 text-xs leading-5'>
                  {t(
                    'Estimates assume the selected model is used exclusively. Actual usage may vary with cache, tools, media, or dynamic pricing.'
                  )}
                </p>
              </section>
            )}
          </div>
        )}
      </PageTransition>
      <SubscriptionPurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        plan={purchasePlan}
        enableStripe={Boolean(topupInfo?.enable_stripe_topup)}
        enableCreem={Boolean(topupInfo?.enable_creem_topup)}
        enableWaffoPancake={Boolean(topupInfo?.enable_waffo_pancake_topup)}
        enableOnlineTopUp={Boolean(topupInfo?.enable_online_topup)}
        epayMethods={epayMethods}
        userQuota={user?.quota}
        onPurchaseSuccess={handlePurchaseSuccess}
        purchaseLimit={purchasePlan?.plan.max_purchase_per_user}
        purchaseCount={
          purchasePlan ? purchaseCountMap.get(purchasePlan.plan.id) : undefined
        }
      />
    </PublicLayout>
  )
}
