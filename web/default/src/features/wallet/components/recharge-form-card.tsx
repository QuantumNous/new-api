import { useState, useEffect } from 'react'
import { Gift, ExternalLink, Loader2, Receipt, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  formatCurrency,
  getDiscountLabel,
  getPaymentIcon,
  getMinTopupAmount,
  calculatePresetPricing,
} from '../lib'
import type {
  PaymentMethod,
  PresetAmount,
  TopupInfo,
  CreemProduct,
  WaffoPayMethod,
} from '../types'
import { CreemProductsSection } from './creem-products-section'

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  topupAmount: number
  onTopupAmountChange: (amount: number) => void
  paymentAmount: number
  calculating: boolean
  onPaymentMethodSelect: (method: PaymentMethod) => void
  paymentLoading: string | null
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupLink?: string
  loading?: boolean
  priceRatio?: number
  usdExchangeRate?: number
  onOpenBilling?: () => void
  creemProducts?: CreemProduct[]
  enableCreemTopup?: boolean
  onCreemProductSelect?: (product: CreemProduct) => void
  enableWaffoTopup?: boolean
  waffoPayMethods?: WaffoPayMethod[]
  waffoMinTopup?: number
  onWaffoMethodSelect?: (method: WaffoPayMethod, index: number) => void
  enableWaffoPancakeTopup?: boolean
}

export function RechargeFormCard({
  topupInfo,
  presetAmounts,
  selectedPreset,
  onSelectPreset,
  topupAmount,
  onTopupAmountChange,
  paymentAmount,
  calculating,
  onPaymentMethodSelect,
  paymentLoading,
  redemptionCode,
  onRedemptionCodeChange,
  onRedeem,
  redeeming,
  topupLink,
  loading,
  priceRatio = 1,
  usdExchangeRate = 1,
  onOpenBilling,
  creemProducts,
  enableCreemTopup,
  onCreemProductSelect,
  enableWaffoTopup,
  waffoPayMethods,
  waffoMinTopup,
  onWaffoMethodSelect,
  enableWaffoPancakeTopup,
}: RechargeFormCardProps) {
  const { t } = useTranslation()
  const [localAmount, setLocalAmount] = useState(topupAmount.toString())

  useEffect(() => {
    setLocalAmount(topupAmount.toString())
  }, [topupAmount])

  const handleAmountChange = (value: string) => {
    setLocalAmount(value)
    const numValue = parseInt(value) || 0
    if (numValue >= 0) {
      onTopupAmountChange(numValue)
    }
  }

  const hasConfigurableTopup =
    topupInfo?.enable_online_topup ||
    topupInfo?.enable_stripe_topup ||
    enableWaffoTopup ||
    enableWaffoPancakeTopup
  const hasAnyTopup = hasConfigurableTopup || enableCreemTopup
  const hasStandardPaymentMethods =
    Array.isArray(topupInfo?.pay_methods) && topupInfo.pay_methods.length > 0
  const hasWaffoPaymentMethods =
    Array.isArray(waffoPayMethods) && waffoPayMethods.length > 0
  const minTopup = getMinTopupAmount(topupInfo)

  if (loading) {
    return (
      <Card className='overflow-hidden'>
        <CardHeader className='border-b'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-6 pt-6'>
          <div className='space-y-6'>
            {/* Preset Amounts Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-16' />
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className='h-[72px] rounded-lg' />
                ))}
              </div>
            </div>

            {/* Custom Amount Input Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-28' />
              <Skeleton className='h-[42px] w-full' />
            </div>

            {/* Payment Methods Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-32' />
              <div className='flex flex-wrap gap-3'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className='h-10 w-24 rounded-lg' />
                ))}
              </div>
            </div>
          </div>

          {/* Redemption Code Section Skeleton */}
          <div className='space-y-3 border-t pt-8'>
            <Skeleton className='h-3 w-24' />
            <div className='flex gap-2'>
              <Skeleton className='h-10 flex-1' />
              <Skeleton className='h-10 w-20' />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className='overflow-hidden'>
      <CardHeader className='border-b'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='flex min-w-0 items-center gap-3'>
            <div className='bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'>
              <WalletCards className='h-4 w-4' />
            </div>
            <div className='min-w-0'>
              <CardTitle className='text-xl tracking-tight'>
                {t('Add Funds')}
              </CardTitle>
              <CardDescription>
                {t('Choose an amount and payment method')}
              </CardDescription>
            </div>
          </div>
          {onOpenBilling && (
            <Button
              variant='outline'
              size='sm'
              onClick={onOpenBilling}
              className='w-full gap-2 sm:w-auto'
            >
              <Receipt className='h-4 w-4' />
              {t('Order History')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-6 pt-6'>
        {/* Online Topup Section */}
        {hasAnyTopup ? (
          <div className='space-y-6'>
            {hasConfigurableTopup && (
              <>
                {presetAmounts.length > 0 && (
                  <div className='space-y-3'>
                    <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                      {t('Amount')}
                    </Label>
                    <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                      {presetAmounts.map((preset, index) => {
                        const discount =
                          preset.discount ||
                          topupInfo?.discount?.[preset.value] ||
                          1.0
                        const {
                          displayValue,
                          actualPrice,
                          savedAmount,
                          hasDiscount,
                        } = calculatePresetPricing(
                          preset.value,
                          priceRatio,
                          discount,
                          usdExchangeRate
                        )
                        return (
                          <Button
                            key={index}
                            variant='outline'
                            className={cn(
                              'hover:border-foreground flex h-auto flex-col items-start rounded-lg p-4 text-left whitespace-normal',
                              selectedPreset === preset.value
                                ? 'border-foreground bg-foreground/5'
                                : 'border-muted'
                            )}
                            onClick={() => onSelectPreset(preset)}
                          >
                            <div className='flex w-full items-center justify-between'>
                              <div className='text-lg font-semibold'>
                                {formatNumber(displayValue)}
                              </div>
                              {hasDiscount && (
                                <div className='text-xs font-medium text-green-600'>
                                  {getDiscountLabel(discount)}
                                </div>
                              )}
                            </div>
                            <div className='text-muted-foreground mt-2 w-full text-xs'>
                              Pay {formatCurrency(actualPrice)}
                              {hasDiscount && savedAmount > 0 && (
                                <span className='text-green-600'>
                                  {' '}
                                  • Save {formatCurrency(savedAmount)}
                                </span>
                              )}
                            </div>
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className='space-y-3'>
                  <Label
                    htmlFor='topup-amount'
                    className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
                  >
                    {t('Custom Amount')}
                  </Label>
                  <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                    <Input
                      id='topup-amount'
                      type='number'
                      value={localAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      min={minTopup}
                      placeholder={`Minimum ${minTopup}`}
                      className='text-lg'
                    />
                    <div className='bg-muted/30 flex min-h-10 items-center justify-between gap-3 rounded-md border px-3 lg:min-w-52'>
                      <span className='text-muted-foreground text-xs'>
                        {t('Amount to pay:')}
                      </span>
                      {calculating ? (
                        <Skeleton className='h-5 w-16' />
                      ) : (
                        <span className='text-sm font-semibold'>
                          {formatCurrency(paymentAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className='space-y-3'>
                  <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                    {t('Payment Method')}
                  </Label>
                  {hasStandardPaymentMethods ? (
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                      {topupInfo?.pay_methods?.map((method) => {
                        const minTopup = method.min_topup || 0
                        const disabled = minTopup > topupAmount

                        const button = (
                          <Button
                            key={method.type}
                            variant='outline'
                            onClick={() => onPaymentMethodSelect(method)}
                            disabled={disabled || !!paymentLoading}
                            className='justify-start gap-2 rounded-lg'
                          >
                            {paymentLoading === method.type ? (
                              <Loader2 className='h-4 w-4 animate-spin' />
                            ) : (
                              getPaymentIcon(
                                method.type,
                                'h-4 w-4',
                                method.icon,
                                method.name
                              )
                            )}
                            {method.name}
                          </Button>
                        )

                        return disabled ? (
                          <TooltipProvider key={method.type}>
                            <Tooltip>
                              <TooltipTrigger asChild>{button}</TooltipTrigger>
                              <TooltipContent>
                                {t('Minimum topup amount: {{amount}}', {
                                  amount: minTopup,
                                })}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          button
                        )
                      })}
                    </div>
                  ) : hasWaffoPaymentMethods ? null : (
                    <Alert>
                      <AlertDescription>
                        {t(
                          'No payment methods available. Please contact administrator.'
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {enableWaffoTopup &&
                  hasWaffoPaymentMethods &&
                  onWaffoMethodSelect && (
                    <div className='space-y-3'>
                      <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                        {t('Waffo Payment')}
                      </Label>
                      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                        {waffoPayMethods?.map((method, index) => {
                          const loadingKey = `waffo-${index}`
                          const waffoMin = waffoMinTopup || 0
                          const belowMin = waffoMin > topupAmount

                          const button = (
                            <Button
                              key={`${method.name}-${index}`}
                              variant='outline'
                              onClick={() => onWaffoMethodSelect(method, index)}
                              disabled={belowMin || !!paymentLoading}
                              className='justify-start gap-2 rounded-lg'
                            >
                              {paymentLoading === loadingKey ? (
                                <Loader2 className='h-4 w-4 animate-spin' />
                              ) : method.icon ? (
                                <img
                                  src={method.icon}
                                  alt={method.name}
                                  className='h-4 w-4 object-contain'
                                />
                              ) : (
                                getPaymentIcon('waffo')
                              )}
                              {method.name}
                            </Button>
                          )

                          return belowMin ? (
                            <TooltipProvider key={`${method.name}-${index}`}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {button}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t('Minimum topup amount: {{amount}}', {
                                    amount: waffoMin,
                                  })}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            button
                          )
                        })}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              {t(
                'Online topup is not enabled. Please use redemption code or contact administrator.'
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Creem Products Section */}
        {enableCreemTopup &&
          Array.isArray(creemProducts) &&
          creemProducts.length > 0 &&
          onCreemProductSelect && (
            <div className='space-y-3 border-t pt-6'>
              <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                {t('Creem Payment')}
              </Label>
              <CreemProductsSection
                products={creemProducts}
                onProductSelect={onCreemProductSelect}
              />
            </div>
          )}

        {/* Redemption Code Section */}
        <div className='space-y-3 border-t pt-6'>
          <div className='flex items-center gap-2'>
            <Gift className='text-muted-foreground h-4 w-4' />
            <Label
              htmlFor='redemption-code'
              className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
            >
              {t('Have a Code?')}
            </Label>
          </div>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Input
              id='redemption-code'
              value={redemptionCode}
              onChange={(e) => onRedemptionCodeChange(e.target.value)}
              placeholder={t('Enter your redemption code')}
              className='flex-1'
            />
            <Button
              onClick={onRedeem}
              disabled={redeeming}
              variant='outline'
              className='sm:w-auto'
            >
              {redeeming && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {t('Redeem')}
            </Button>
          </div>
          {topupLink && (
            <p className='text-muted-foreground text-xs'>
              {t('Need a code?')}{' '}
              <a
                href={topupLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
              >
                {t('Purchase here')}
                <ExternalLink className='h-3 w-3' />
              </a>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
