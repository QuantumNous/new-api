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
import { Link } from '@tanstack/react-router'
import {
  BadgeCheck,
  Cable,
  Check,
  Copy,
  EyeOff,
  Gauge,
  Play,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { IconGithub } from '@/assets/brand-icons'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getPricing } from '@/features/pricing/api'
import { QUOTA_TYPE_VALUES } from '@/features/pricing/constants'
import type { PricingModel } from '@/features/pricing/types'
import { getPublicPlans } from '@/features/subscriptions/api'
import { formatDuration, formatResetPeriod } from '@/features/subscriptions/lib'
import { api } from '@/lib/api'
import { formatSubscriptionPlanPrice, getCurrencyDisplay } from '@/lib/currency'
import { formatQuota } from '@/lib/format'
import {
  getLocalizedField,
  type ContentTranslations,
} from '@/lib/localized-content'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { modelPricingConfig, pricingHeaderConfig } from './model-pricing-config'

interface ModelPricingRow {
  name: string
  inputPrice: string
  outputPrice: string
  officialInput: string
  officialOutput: string
  discount: string
}

interface HomePricingResponse {
  data?: PricingModel[]
  group_ratio?: Record<string, number>
  usable_group?: Record<string, { desc: string; ratio: number }>
}

interface HomeStatusResponse {
  data?: {
    faq?: HomeFAQItem[]
    faq_enabled?: boolean
    server_address?: string
    serverAddress?: string
  }
}

interface HomeFAQItem {
  id?: number
  question: string
  answer: string
  translations?: ContentTranslations
}

const TRUST_SIGNALS = [
  { label: 'Officially funded accounts', icon: BadgeCheck },
  { label: 'Direct official access', icon: Cable },
  { label: 'Stable high concurrency', icon: Gauge },
  { label: 'No model downgrades or substitutions', icon: ShieldCheck },
  { label: 'Zero retention', icon: EyeOff },
] as const

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function truncateDecimal(value: number, digits: number): number {
  const sign = value < 0 ? '-' : ''
  const normalized = Math.abs(value).toFixed(digits + 8)
  const [integerPart, fractionPart = ''] = normalized.split('.')
  const truncatedFraction = fractionPart.slice(0, digits).replace(/0+$/, '')
  return Number(
    `${sign}${integerPart}${truncatedFraction ? `.${truncatedFraction}` : ''}`
  )
}

function formatTruncatedCurrency(
  value: number,
  symbol: string,
  currencyCode?: string
): string {
  const truncatedValue = truncateDecimal(value, 4)
  if (currencyCode) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(truncatedValue)
  }

  const formattedNumber = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(truncatedValue)
  return `${symbol}${formattedNumber}`
}

function formatPrice(value: number | null | undefined): string {
  if (!hasNumber(value) || value <= 0) return '-'
  const { meta } = getCurrencyDisplay()
  if (meta.kind === 'custom') {
    return formatTruncatedCurrency(value * meta.exchangeRate, meta.symbol)
  }
  if (meta.kind === 'currency') {
    return formatTruncatedCurrency(
      value * meta.exchangeRate,
      meta.symbol,
      meta.currencyCode
    )
  }
  return formatTruncatedCurrency(value, '$', 'USD')
}

function getModelUsableGroupRatios(
  model: PricingModel,
  groupRatios: Record<string, number>,
  usableGroups: Record<string, { desc: string; ratio: number }>
): number[] {
  const groups = Array.isArray(model.enable_groups) ? model.enable_groups : []
  const usableRatios: number[] = []

  for (const group of groups) {
    if (!(group in usableGroups)) continue
    const ratio = groupRatios[group]
    if (hasNumber(ratio) && ratio > 0) {
      usableRatios.push(ratio)
    }
  }

  return usableRatios.length > 0 ? usableRatios : [1]
}

function getPriceRangeUSD(
  model: PricingModel,
  groupRatios: Record<string, number>,
  usableGroups: Record<string, { desc: string; ratio: number }>,
  getValue: (base: number, pricingModel: PricingModel) => number
): { min: number; max: number } | null {
  if (model.quota_type !== QUOTA_TYPE_VALUES.TOKEN) return null
  const ranges = getModelUsableGroupRatios(model, groupRatios, usableGroups)
    .map((ratio) => {
      const base = model.model_ratio * 2 * ratio
      return getValue(base, model)
    })
    .filter((value) => Number.isFinite(value) && value > 0)

  if (ranges.length === 0) return null

  return {
    min: Math.min(...ranges),
    max: Math.max(...ranges),
  }
}

function getInputPriceRangeUSD(
  model: PricingModel,
  groupRatios: Record<string, number>,
  usableGroups: Record<string, { desc: string; ratio: number }>
): { min: number; max: number } | null {
  return getPriceRangeUSD(model, groupRatios, usableGroups, (base) => base)
}

function getOutputPriceRangeUSD(
  model: PricingModel,
  groupRatios: Record<string, number>,
  usableGroups: Record<string, { desc: string; ratio: number }>
): { min: number; max: number } | null {
  return getPriceRangeUSD(
    model,
    groupRatios,
    usableGroups,
    (base, pricingModel) => base * pricingModel.completion_ratio
  )
}

function getConfiguredInputPriceUSD(model: PricingModel): number | null {
  if (model.quota_type !== QUOTA_TYPE_VALUES.TOKEN) return null
  const value = model.model_ratio * 2
  return Number.isFinite(value) && value > 0 ? value : null
}

function getConfiguredOutputPriceUSD(model: PricingModel): number | null {
  const inputPrice = getConfiguredInputPriceUSD(model)
  if (!hasNumber(inputPrice)) return null
  const value = inputPrice * model.completion_ratio
  return Number.isFinite(value) && value > 0 ? value : null
}

function formatOfficialPrice(value: number | null): string {
  if (!hasNumber(value) || value <= 0) return '-'
  return formatTruncatedCurrency(value, '$', 'USD')
}

function getDiscountPercent(actual: number, official: number): number | null {
  if (!hasNumber(actual) || !hasNumber(official) || official <= 0) return null
  return (1 - actual / official) * 100
}

function formatDiscountPercent(value: number | null): string {
  if (!hasNumber(value)) return '-'
  const rounded = Math.round(value)
  if (rounded > 0) return `-${rounded}%`
  if (rounded < 0) return `+${Math.abs(rounded)}%`
  return '0%'
}

export function Home() {
  const { t, i18n } = useTranslation()
  const { config } = useSystemConfigStore()
  const [homePageContent, setHomePageContent] = useState('')
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false)
  const [showAllPricingModels, setShowAllPricingModels] = useState(false)
  const isChinese = i18n.language.startsWith('zh')
  const isDemoSiteMode = config.demoSiteEnabled || false
  const { data: statusData } = useQuery<HomeStatusResponse>({
    queryKey: ['home-status'],
    queryFn: async () => {
      const response = await api.get('/api/status')
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
  const serverAddress =
    statusData?.data?.server_address ||
    statusData?.data?.serverAddress ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const faqItems = useMemo(() => {
    const items =
      statusData?.data?.faq_enabled === false ? [] : statusData?.data?.faq || []
    return items.map((item) => ({
      ...item,
      question: getLocalizedField(item, 'question', i18n.resolvedLanguage, t),
      answer: getLocalizedField(item, 'answer', i18n.resolvedLanguage, t),
    }))
  }, [i18n.resolvedLanguage, statusData, t])
  const { data: pricingData } = useQuery<HomePricingResponse>({
    queryKey: ['home-pricing'],
    queryFn: getPricing,
    staleTime: 5 * 60 * 1000,
  })
  const { data: subscriptionPlansData } = useQuery({
    queryKey: ['home-subscription-plans'],
    queryFn: getPublicPlans,
    staleTime: 5 * 60 * 1000,
  })

  const subscriptionPlans = useMemo(() => {
    return (subscriptionPlansData?.data || [])
      .filter((item) => item.plan?.enabled)
      .map((item) => ({
        ...item,
        plan: {
          ...item.plan,
          title: getLocalizedField(
            item.plan,
            'title',
            i18n.resolvedLanguage,
            t
          ),
          subtitle: getLocalizedField(
            item.plan,
            'subtitle',
            i18n.resolvedLanguage,
            t
          ),
        },
      }))
      .sort(
        (a, b) =>
          Number(b.plan?.sort_order || 0) - Number(a.plan?.sort_order || 0)
      )
  }, [i18n.resolvedLanguage, subscriptionPlansData, t])

  const subscriptionPlanGroups = useMemo(
    () =>
      [
        {
          value: 'credit',
          labelKey: 'Credit Plans',
          plans: subscriptionPlans.filter(
            (item) => item.plan.quota_reset_period === 'never'
          ),
        },
        {
          value: 'reset',
          labelKey: 'Reset Plans',
          plans: subscriptionPlans.filter(
            (item) => item.plan.quota_reset_period !== 'never'
          ),
        },
      ].filter((group) => group.plans.length > 0),
    [subscriptionPlans]
  )

  const modelPricingRows = useMemo<ModelPricingRow[]>(() => {
    const pricingModels = pricingData?.data || []
    const groupRatios = pricingData?.group_ratio || {}
    const usableGroups = pricingData?.usable_group || {}
    const modelMap = new Map(
      pricingModels.map((model) => [model.model_name, model])
    )

    return modelPricingConfig
      .map((configItem) => {
        const model = modelMap.get(configItem.name)
        if (!model) {
          if (
            !hasNumber(configItem.officialInputPrice) ||
            !hasNumber(configItem.officialOutputPrice)
          ) {
            return null
          }

          return {
            name: configItem.name,
            inputPrice: '-',
            outputPrice: '-',
            officialInput: formatOfficialPrice(configItem.officialInputPrice),
            officialOutput: formatOfficialPrice(configItem.officialOutputPrice),
            discount: '-',
          }
        }

        if (model.quota_type !== QUOTA_TYPE_VALUES.TOKEN) {
          return null
        }

        const inputPriceRange = getInputPriceRangeUSD(
          model,
          groupRatios,
          usableGroups
        )
        const outputPriceRange = getOutputPriceRangeUSD(
          model,
          groupRatios,
          usableGroups
        )
        const configuredInputPrice = getConfiguredInputPriceUSD(model)
        const configuredOutputPrice = getConfiguredOutputPriceUSD(model)
        const officialInputPrice =
          configItem.officialInputPrice ?? configuredInputPrice
        const officialOutputPrice =
          configItem.officialOutputPrice ?? configuredOutputPrice
        const minimumDiscount =
          inputPriceRange && hasNumber(officialInputPrice)
            ? getDiscountPercent(inputPriceRange.min, officialInputPrice)
            : null

        return {
          name: configItem.name,
          inputPrice: formatPrice(inputPriceRange?.min),
          outputPrice: formatPrice(outputPriceRange?.min),
          officialInput: formatOfficialPrice(officialInputPrice),
          officialOutput: formatOfficialPrice(officialOutputPrice),
          discount: formatDiscountPercent(minimumDiscount),
        }
      })
      .filter((item): item is ModelPricingRow => item !== null)
  }, [pricingData])

  const displayHomePageContent = async () => {
    const cached = localStorage.getItem('home_page_content') || ''
    setHomePageContent(cached)
    try {
      const res = await api.get('/api/home_page_content')
      const { success, data } = res.data
      if (success) {
        setHomePageContent(data)
        localStorage.setItem('home_page_content', data)
      }
    } catch (error) {
      console.error('加载首页内容失败:', error)
    }
    setHomePageContentLoaded(true)
  }

  const handleCopyBaseURL = async () => {
    try {
      await navigator.clipboard.writeText(serverAddress)
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  useEffect(() => {
    displayHomePageContent()
  }, [])

  if (!homePageContentLoaded) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='flex min-h-screen items-center justify-center'>
          <div className='text-muted-foreground'>{t('Loading...')}</div>
        </main>
      </PublicLayout>
    )
  }

  if (homePageContent) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='w-full overflow-x-hidden'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='h-screen w-full border-none'
              title={t('Custom Home Page')}
              sandbox='allow-forms allow-popups allow-scripts'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </main>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='w-full overflow-x-hidden'>
        <div className='home-claude w-full overflow-x-hidden'>
          <div className='relative min-h-[500px] w-full overflow-x-hidden border-b md:min-h-[600px] lg:min-h-[700px]'>
            <div className='blur-ball blur-ball-indigo' />
            <div className='blur-ball blur-ball-teal' />
            <div className='mt-10 flex h-full items-center justify-center px-4 py-20 md:py-24 lg:py-32'>
              <div className='mx-auto flex w-full max-w-6xl flex-col items-center justify-center text-center'>
                <div className='mb-6 flex flex-col items-center justify-center md:mb-8'>
                  <h1
                    className={cn(
                      'text-foreground text-4xl leading-tight font-bold md:text-5xl lg:text-6xl xl:text-7xl',
                      isChinese && 'tracking-wide md:tracking-wider'
                    )}
                  >
                    {t('Direct access to official providers')}
                    <br />
                    <span className='shine-text from-primary to-primary/70 bg-gradient-to-r bg-clip-text text-transparent'>
                      {t('Enterprise-grade API gateway')}
                    </span>
                  </h1>
                  <div className='mt-4 flex w-full max-w-lg flex-col items-center justify-center gap-4 md:mt-6 md:flex-row'>
                    <div className='relative w-full flex-1'>
                      <Input
                        readOnly
                        value={serverAddress}
                        className='rounded-full pr-24'
                      />
                      <div className='absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1'>
                        <Button
                          variant='ghost'
                          size='icon-sm'
                          className='rounded-full'
                          onClick={handleCopyBaseURL}
                        >
                          <Copy />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4'>
                  <Link to='/keys' className='w-full sm:w-auto'>
                    <Button size='lg' className='w-full rounded-full px-8'>
                      <Play data-icon='inline-start' />
                      {t('Start for Free')}
                    </Button>
                  </Link>
                  {isDemoSiteMode && (
                    <Button
                      variant='outline'
                      size='lg'
                      className='w-full rounded-full px-6 sm:w-auto'
                      onClick={() =>
                        window.open(
                          'https://github.com/QuantumNous/new-api',
                          '_blank'
                        )
                      }
                    >
                      <IconGithub data-icon='inline-start' />
                      GitHub
                    </Button>
                  )}
                </div>

                <ul className='mt-10 grid w-full max-w-5xl grid-cols-2 gap-x-5 gap-y-4 py-5 sm:grid-cols-3 lg:grid-cols-5'>
                  {TRUST_SIGNALS.map((signal) => {
                    const Icon = signal.icon

                    return (
                      <li
                        key={signal.label}
                        className='text-foreground flex min-w-0 items-center gap-2.5 text-left text-sm font-medium'
                      >
                        <span className='bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg'>
                          <Icon aria-hidden='true' className='size-4' />
                        </span>
                        <span className='leading-snug'>{t(signal.label)}</span>
                      </li>
                    )
                  })}
                </ul>

                <Card className='bg-card/70 mt-8 w-full max-w-5xl rounded-3xl text-left backdrop-blur-md'>
                  <CardHeader className='items-center text-center'>
                    <CardTitle
                      role='heading'
                      aria-level={2}
                      className='text-xl font-semibold md:text-2xl'
                    >
                      {t('Model Price Comparison')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='px-0'>
                    <div className='text-muted-foreground hidden grid-cols-5 px-5 py-3 text-xs font-semibold tracking-wider uppercase md:grid'>
                      <span className='min-w-[140px] text-left md:min-w-[180px]'>
                        {t(pricingHeaderConfig.model)}
                      </span>
                      <span className='hidden text-center md:block'>
                        {t(pricingHeaderConfig.input)}
                      </span>
                      <span className='hidden text-center md:block'>
                        {t(pricingHeaderConfig.output)}
                      </span>
                      <span className='text-center'>
                        {t(pricingHeaderConfig.official)}
                      </span>
                      <span className='text-center'>
                        {t(pricingHeaderConfig.discount)}
                      </span>
                    </div>

                    <Separator className='mx-5 w-auto' />

                    {modelPricingRows.length === 0 ? (
                      <div className='text-muted-foreground px-5 py-6 text-sm'>
                        {t('No pricing data available')}
                      </div>
                    ) : (
                      (showAllPricingModels
                        ? modelPricingRows
                        : modelPricingRows.slice(0, 6)
                      ).map((item) => (
                        <div
                          key={item.name}
                          className='hover:bg-muted/45 grid grid-cols-2 items-center gap-3 px-5 py-4 text-sm transition-colors md:grid-cols-5 md:gap-0 md:py-3.5'
                        >
                          <span
                            className='text-foreground col-span-2 truncate text-left font-medium md:col-span-1 md:min-w-[180px] md:pr-2'
                            title={item.name}
                          >
                            {item.name}
                          </span>
                          <span className='bg-muted/35 flex flex-col gap-1 rounded-xl p-2 text-left md:hidden'>
                            <span className='text-muted-foreground text-xs'>
                              {t(pricingHeaderConfig.input)}
                            </span>
                            <span className='text-foreground font-mono font-medium'>
                              {item.inputPrice}
                            </span>
                          </span>
                          <span className='bg-muted/35 flex flex-col gap-1 rounded-xl p-2 text-left md:hidden'>
                            <span className='text-muted-foreground text-xs'>
                              {t(pricingHeaderConfig.output)}
                            </span>
                            <span className='text-foreground font-mono font-medium'>
                              {item.outputPrice}
                            </span>
                          </span>
                          <span className='text-muted-foreground hidden text-center font-mono md:block'>
                            {item.inputPrice}
                          </span>
                          <span className='text-muted-foreground hidden text-center font-mono md:block'>
                            {item.outputPrice}
                          </span>
                          <span className='text-muted-foreground flex flex-col gap-1 text-left font-mono md:block md:text-center'>
                            <span className='text-muted-foreground text-xs md:hidden'>
                              {t(pricingHeaderConfig.official)}
                            </span>
                            <span>
                              {item.officialInput} / {item.officialOutput}
                            </span>
                          </span>
                          <span className='flex flex-col gap-1 text-left md:block md:text-center'>
                            <span className='text-muted-foreground text-xs md:hidden'>
                              {t(pricingHeaderConfig.discount)}
                            </span>
                            <Badge variant='outline' className='font-mono'>
                              {item.discount}
                            </Badge>
                          </span>
                        </div>
                      ))
                    )}

                    {modelPricingRows.length > 6 && (
                      <div className='flex justify-center px-5 py-4'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() =>
                            setShowAllPricingModels((visible) => !visible)
                          }
                        >
                          {t(showAllPricingModels ? 'Show Less' : 'Show More')}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {subscriptionPlans.length > 0 && (
                  <div className='mt-6 w-full max-w-5xl'>
                    <h2 className='mb-6 text-center text-xl font-semibold md:text-2xl'>
                      {t('Subscription Plans')}
                    </h2>
                    <Tabs defaultValue={subscriptionPlanGroups[0].value}>
                      <TabsList
                        className={cn(
                          'mx-auto mb-6 grid w-full max-w-sm',
                          subscriptionPlanGroups.length === 1
                            ? 'grid-cols-1'
                            : 'grid-cols-2'
                        )}
                      >
                        {subscriptionPlanGroups.map((group) => (
                          <TabsTrigger key={group.value} value={group.value}>
                            {t(group.labelKey)}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {subscriptionPlanGroups.map((group) => (
                        <TabsContent key={group.value} value={group.value}>
                          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
                            {group.plans.map((item) => {
                              const plan = item.plan
                              const totalAmount = Number(plan.total_amount || 0)
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
                                totalAmount > 0
                                  ? `${quotaLabel}: ${formatQuota(totalAmount)}`
                                  : `${quotaLabel}: ${t('Unlimited')}`,
                                plan.upgrade_group
                                  ? `${t('Upgrade Group')}: ${plan.upgrade_group}`
                                  : null,
                              ].filter(Boolean) as string[]

                              return (
                                <Card
                                  key={plan.id}
                                  className='bg-card/70 min-h-[240px] rounded-3xl text-left backdrop-blur-md transition-transform hover:-translate-y-0.5'
                                >
                                  <CardHeader>
                                    <CardTitle
                                      role='heading'
                                      aria-level={3}
                                      className='truncate text-lg font-semibold'
                                    >
                                      {plan.title || t('Subscription Plans')}
                                    </CardTitle>
                                    {plan.subtitle && (
                                      <div className='text-muted-foreground line-clamp-2 text-sm'>
                                        {plan.subtitle}
                                      </div>
                                    )}
                                  </CardHeader>

                                  <CardContent className='flex flex-1 flex-col gap-5'>
                                    <div className='bg-primary/8 rounded-2xl px-4 py-3'>
                                      <span className='text-primary text-3xl font-bold'>
                                        {formatSubscriptionPlanPrice(
                                          Number(plan.price_amount || 0)
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

                                  <CardFooter>
                                    <Link to='/plans' className='w-full'>
                                      <Button
                                        variant='outline'
                                        size='lg'
                                        className='h-11 w-full rounded-full text-base font-semibold'
                                      >
                                        {t('Subscribe Now')}
                                      </Button>
                                    </Link>
                                  </CardFooter>
                                </Card>
                              )
                            })}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>
                )}

                {faqItems.length > 0 && (
                  <section
                    aria-labelledby='home-faq-title'
                    className='mt-16 w-full max-w-4xl text-left md:mt-20'
                  >
                    <div className='mb-8 text-center'>
                      <h2
                        id='home-faq-title'
                        className='text-2xl font-semibold md:text-3xl'
                      >
                        {t('FAQ')}
                      </h2>
                      <p className='text-muted-foreground mt-2 text-base'>
                        {t('Answers for common access and billing questions')}
                      </p>
                    </div>

                    <Card className='bg-card/70 rounded-3xl px-5 backdrop-blur-md sm:px-7'>
                      <Accordion className='w-full'>
                        {faqItems.map((item, index) => {
                          const itemKey = item.id ?? `faq-${index}`

                          return (
                            <AccordionItem
                              key={itemKey}
                              value={`faq-${itemKey}`}
                              className='border-border/60'
                            >
                              <AccordionTrigger className='py-5 text-base font-semibold hover:no-underline'>
                                <Markdown className='pr-4 text-base leading-relaxed font-semibold'>
                                  {item.question}
                                </Markdown>
                              </AccordionTrigger>
                              <AccordionContent className='pb-5'>
                                <Markdown className='text-muted-foreground text-base leading-relaxed'>
                                  {item.answer}
                                </Markdown>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    </Card>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </PublicLayout>
  )
}
