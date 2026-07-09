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
import { useEffect, useMemo, useState } from 'react'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, Copy, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { api } from '@/lib/api'
import { getCurrencyDisplay } from '@/lib/currency'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Separator } from '@/components/ui/separator'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { getPricing } from '@/features/pricing/api'
import { QUOTA_TYPE_VALUES } from '@/features/pricing/constants'
import type { PricingModel } from '@/features/pricing/types'
import { getPublicPlans } from '@/features/subscriptions/api'
import { formatDuration, formatResetPeriod } from '@/features/subscriptions/lib'
import {
  imageModelPricingConfig,
  imagePricingHeaderConfig,
  modelPricingConfig,
  pricingHeaderConfig,
  pricingNoticeConfig,
} from './model-pricing-config'

interface ModelPricingRow {
  name: string
  inputPrice: string
  outputPrice: string
  officialInput: string
  officialOutput: string
  discount: string
  cacheHit: string
}

interface ImageModelPricingRow {
  name: string
  types: string
  price: string
}

interface HomePricingResponse {
  data?: PricingModel[]
  group_ratio?: Record<string, number>
  usable_group?: Record<string, { desc: string; ratio: number }>
}

interface HomeStatusResponse {
  data?: {
    server_address?: string
    serverAddress?: string
  }
}

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

function formatSubscriptionPrice(amount: number | string): string {
  const numeric =
    typeof amount === 'number' ? amount : Number.parseFloat(String(amount))
  if (!Number.isFinite(numeric)) return '-'
  return `¥${numeric.toFixed(2)}`
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

function getImagePriceRangeUSD(
  model: PricingModel,
  groupRatios: Record<string, number>,
  usableGroups: Record<string, { desc: string; ratio: number }>,
  multiplier: number
): { min: number; max: number } | null {
  const groups = getModelUsableGroupRatios(model, groupRatios, usableGroups)
  const ranges = groups
    .map((ratio) => {
      if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
        return (model.model_price || 0) * ratio * multiplier
      }

      const imageRatio = hasNumber(model.image_ratio)
        ? Number(model.image_ratio)
        : 1
      return model.model_ratio * 2 * ratio * imageRatio * multiplier
    })
    .filter((value) => Number.isFinite(value) && value > 0)

  if (ranges.length === 0) return null

  return {
    min: Math.min(...ranges),
    max: Math.max(...ranges),
  }
}

function formatPriceRange(range: { min: number; max: number } | null): string {
  if (!range) return '-'
  if (Math.abs(range.min - range.max) < 0.000001) {
    return formatPrice(range.min)
  }
  return `${formatPrice(range.min)}~${formatPrice(range.max)}`
}

function formatPerRequestPriceRange(
  range: { min: number; max: number } | null
): string {
  const price = formatPriceRange(range)
  return price === '-' ? price : `${price}/次`
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

function formatUnsignedDiscountPercent(value: number | null): string {
  if (!hasNumber(value)) return '-'
  return `${Math.abs(Math.round(value))}%`
}

function formatDiscountRange(
  inputRange: { min: number; max: number } | null,
  officialInput: number | null | undefined
): string {
  const values = [
    inputRange && hasNumber(officialInput)
      ? getDiscountPercent(inputRange.min, officialInput)
      : null,
    inputRange && hasNumber(officialInput)
      ? getDiscountPercent(inputRange.max, officialInput)
      : null,
  ].filter(hasNumber)

  if (values.length === 0) return '-'

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  if (Math.abs(minValue - maxValue) < 0.001) {
    return formatDiscountPercent(maxValue)
  }

  const first = formatDiscountPercent(maxValue)
  const second = formatUnsignedDiscountPercent(minValue)
  return `${first}~${second}`
}

function findPricingModel(
  modelMap: Map<string, PricingModel>,
  names: string[]
): PricingModel | null {
  for (const name of names) {
    const model = modelMap.get(name)
    if (model) return model
  }
  return null
}

export function Home() {
  const { t, i18n } = useTranslation()
  const { config } = useSystemConfigStore()
  const [homePageContent, setHomePageContent] = useState('')
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false)
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
      .sort(
        (a, b) =>
          Number(b.plan?.sort_order || 0) - Number(a.plan?.sort_order || 0)
      )
  }, [subscriptionPlansData])

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
        if (!model || model.quota_type !== QUOTA_TYPE_VALUES.TOKEN) {
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

        return {
          name: configItem.name,
          inputPrice: formatPriceRange(inputPriceRange),
          outputPrice: formatPriceRange(outputPriceRange),
          officialInput: formatPrice(configItem.officialInput),
          officialOutput: formatPrice(configItem.officialOutput),
          discount: formatDiscountRange(
            inputPriceRange,
            configItem.officialInput
          ),
          cacheHit: configItem.cacheHit || '-',
        }
      })
      .filter((item): item is ModelPricingRow => item !== null)
  }, [pricingData])

  const imageModelPricingRows = useMemo<ImageModelPricingRow[]>(() => {
    const pricingModels = pricingData?.data || []
    const groupRatios = pricingData?.group_ratio || {}
    const usableGroups = pricingData?.usable_group || {}
    const modelMap = new Map(
      pricingModels.map((model) => [model.model_name, model])
    )

    return imageModelPricingConfig.map((configItem) => {
      const typeLabels = configItem.types.map((typeItem) => typeItem.type)
      const model = findPricingModel(modelMap, [configItem.name])
      const priceRange = model
        ? getImagePriceRangeUSD(model, groupRatios, usableGroups, 1)
        : null

      return {
        name: configItem.name,
        types: typeLabels.join('、'),
        price: formatPerRequestPriceRange(priceRange),
      }
    })
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
      toast.success(t('已复制到剪切板'))
    } catch {
      toast.error(t('复制失败'))
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
                    {t('直连官方的')}
                    <br />
                    <span className='shine-text from-primary to-primary/70 bg-gradient-to-r bg-clip-text text-transparent'>
                      {t('企业级接口网关')}
                    </span>
                  </h1>
                  <p className='text-muted-foreground mt-4 max-w-xl text-base md:mt-6 md:text-lg lg:text-xl'>
                    {t('还有更多低价渠道，稳定流畅，只需要将BaseUrl替换为：')}
                  </p>
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
                      {t('获取密钥')}
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
                      <GitHubLogoIcon data-icon='inline-start' />
                      GitHub
                    </Button>
                  )}
                </div>

                <Card className='bg-card/70 mt-12 w-full max-w-5xl rounded-3xl text-left backdrop-blur-md'>
                  <CardHeader className='items-center text-center'>
                    <CardTitle
                      role='heading'
                      aria-level={2}
                      className='text-xl font-semibold md:text-2xl'
                    >
                      {t('模型价格对比')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='px-0'>
                    <div className='text-muted-foreground hidden grid-cols-6 px-5 py-3 text-xs font-semibold tracking-wider uppercase md:grid'>
                      <span className='min-w-[140px] text-left md:min-w-[180px]'>
                        {pricingHeaderConfig.model}
                      </span>
                      <span className='hidden text-center md:block'>
                        {pricingHeaderConfig.input}
                      </span>
                      <span className='hidden text-center md:block'>
                        {pricingHeaderConfig.output}
                      </span>
                      <span className='text-center'>
                        {pricingHeaderConfig.official}
                      </span>
                      <span className='text-center'>
                        {pricingHeaderConfig.discount}
                      </span>
                      <span className='text-center'>
                        {pricingHeaderConfig.cacheHit}
                      </span>
                    </div>

                    <Separator className='mx-5 w-auto' />

                    {modelPricingRows.length === 0 ? (
                      <div className='text-muted-foreground px-5 py-6 text-sm'>
                        {t('暂无价格数据')}
                      </div>
                    ) : (
                      modelPricingRows.map((item) => (
                        <div
                          key={item.name}
                          className='hover:bg-muted/45 grid grid-cols-2 items-center gap-3 px-5 py-4 text-sm transition-colors md:grid-cols-6 md:gap-0 md:py-3.5'
                        >
                          <span
                            className='text-foreground col-span-2 truncate text-left font-medium md:col-span-1 md:min-w-[180px] md:pr-2'
                            title={item.name}
                          >
                            {item.name}
                          </span>
                          <span className='bg-muted/35 flex flex-col gap-1 rounded-xl p-2 text-left md:hidden'>
                            <span className='text-muted-foreground text-xs'>
                              {pricingHeaderConfig.input}
                            </span>
                            <span className='text-foreground font-mono font-medium'>
                              {item.inputPrice}
                            </span>
                          </span>
                          <span className='bg-muted/35 flex flex-col gap-1 rounded-xl p-2 text-left md:hidden'>
                            <span className='text-muted-foreground text-xs'>
                              {pricingHeaderConfig.output}
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
                              {pricingHeaderConfig.official}
                            </span>
                            <span>
                              {item.officialInput} / {item.officialOutput}
                            </span>
                          </span>
                          <span className='flex flex-col gap-1 text-left md:block md:text-center'>
                            <span className='text-muted-foreground text-xs md:hidden'>
                              {pricingHeaderConfig.discount}
                            </span>
                            <Badge variant='outline' className='font-mono'>
                              {item.discount}
                            </Badge>
                          </span>
                          <span className='flex flex-col gap-1 text-left md:block md:text-center'>
                            <span className='text-muted-foreground text-xs md:hidden'>
                              {pricingHeaderConfig.cacheHit}
                            </span>
                            <Badge variant='secondary' className='font-mono'>
                              {item.cacheHit}
                            </Badge>
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className='bg-card/70 mt-6 w-full max-w-5xl rounded-3xl text-left backdrop-blur-md'>
                  <CardHeader className='items-center text-center'>
                    <CardTitle
                      role='heading'
                      aria-level={2}
                      className='text-xl font-semibold md:text-2xl'
                    >
                      {t('图像模型')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='px-0'>
                    <div className='text-muted-foreground hidden grid-cols-3 px-5 py-3 text-xs font-semibold tracking-wider uppercase sm:grid'>
                      <span className='text-left'>
                        {imagePricingHeaderConfig.model}
                      </span>
                      <span className='text-center'>
                        {imagePricingHeaderConfig.type}
                      </span>
                      <span className='text-center'>
                        {imagePricingHeaderConfig.price}
                      </span>
                    </div>

                    <Separator className='mx-5 w-auto' />

                    {imageModelPricingRows.length === 0 ? (
                      <div className='text-muted-foreground px-5 py-6 text-sm'>
                        {t('暂无价格数据')}
                      </div>
                    ) : (
                      imageModelPricingRows.map((item) => (
                        <div
                          key={item.name}
                          className='hover:bg-muted/45 grid grid-cols-2 items-center gap-3 px-5 py-4 text-sm transition-colors sm:grid-cols-3 sm:gap-0 sm:py-3.5'
                        >
                          <span
                            className='text-foreground col-span-2 truncate text-left font-medium sm:col-span-1 sm:pr-2'
                            title={item.name}
                          >
                            {item.name}
                          </span>
                          <span className='flex flex-col gap-1 text-left sm:block sm:text-center'>
                            <span className='text-muted-foreground text-xs sm:hidden'>
                              {imagePricingHeaderConfig.type}
                            </span>
                            <span className='text-muted-foreground font-mono'>
                              {item.types}
                            </span>
                          </span>
                          <span className='flex flex-col gap-1 text-left sm:block sm:text-center'>
                            <span className='text-muted-foreground text-xs sm:hidden'>
                              {imagePricingHeaderConfig.price}
                            </span>
                            <span className='text-foreground font-mono font-semibold'>
                              {item.price}
                            </span>
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {pricingNoticeConfig.enabled &&
                  subscriptionPlans.length === 0 && (
                    <Alert className='mt-4 w-full max-w-5xl text-center backdrop-blur-sm'>
                      <AlertDescription>
                        {pricingNoticeConfig.text}
                        {pricingNoticeConfig.linkText &&
                        pricingNoticeConfig.linkUrl ? (
                          <>
                            {' '}
                            <a
                              href={pricingNoticeConfig.linkUrl}
                              target='_blank'
                              rel='noreferrer'
                              className='font-semibold'
                            >
                              {pricingNoticeConfig.linkText}
                            </a>
                          </>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  )}

                {subscriptionPlans.length > 0 && (
                  <div className='mt-6 w-full max-w-5xl'>
                    <h2 className='mb-6 text-center text-xl font-semibold md:text-2xl'>
                      {t('Subscription Plans')}
                    </h2>
                    {pricingNoticeConfig.enabled && (
                      <Alert className='mb-4 text-center backdrop-blur-sm'>
                        <AlertDescription>
                          {pricingNoticeConfig.text}
                          {pricingNoticeConfig.linkText &&
                          pricingNoticeConfig.linkUrl ? (
                            <>
                              {' '}
                              <a
                                href={pricingNoticeConfig.linkUrl}
                                target='_blank'
                                rel='noreferrer'
                                className='font-semibold'
                              >
                                {pricingNoticeConfig.linkText}
                              </a>
                            </>
                          ) : null}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
                      {subscriptionPlans.map((item) => {
                        const plan = item.plan
                        const totalAmount = Number(plan.total_amount || 0)
                        const resetPeriod = formatResetPeriod(plan, t)
                        const benefits = [
                          `${t('Validity Period')}: ${formatDuration(plan, t)}`,
                          resetPeriod !== t('No Reset')
                            ? `${t('Quota Reset')}: ${resetPeriod}`
                            : null,
                          totalAmount > 0
                            ? `${t('Total Quota')}: ${formatQuota(totalAmount)}`
                            : `${t('Total Quota')}: ${t('Unlimited')}`,
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
                                  {formatSubscriptionPrice(
                                    plan.price_amount || 0
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
                              <Link to='/wallet' className='w-full'>
                                <Button
                                  variant='outline'
                                  className='w-full rounded-full'
                                >
                                  {t('Subscribe Now')}
                                </Button>
                              </Link>
                            </CardFooter>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
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
