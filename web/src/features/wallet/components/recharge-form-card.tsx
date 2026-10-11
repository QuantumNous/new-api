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
import { ArrowRight, Loader2, WalletCards } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  formatBillingCurrencyFromUSD,
  getCurrencyLabel,
  formatLocalCurrencyAmount,
} from '@/lib/currency'
import { cn } from '@/lib/utils'

import { PAYMENT_TYPES } from '../constants'
import {
  getDiscountPercentage,
  formatDirectTopUpAmount,
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
import { RedemptionCodeCard } from './redemption-code-card'

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
  onPaymentContinue?: () => void
  selectedPaymentMethod?: PaymentMethod
  selectedWaffoMethodIndex?: number | null
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupLink?: string
  loading?: boolean
  priceRatio?: number
  usdExchangeRate?: number
  creemProducts?: CreemProduct[]
  enableCreemTopup?: boolean
  onCreemProductSelect?: (product: CreemProduct) => void
  enableWaffoTopup?: boolean
  waffoPayMethods?: WaffoPayMethod[]
  waffoMinTopup?: number
  onWaffoMethodSelect?: (method: WaffoPayMethod, index: number) => void
  enableWaffoPancakeTopup?: boolean
  embedded?: boolean
  showRedemption?: boolean
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
  onPaymentContinue,
  selectedPaymentMethod,
  selectedWaffoMethodIndex,
  redemptionCode,
  onRedemptionCodeChange,
  onRedeem,
  redeeming,
  topupLink,
  loading,
  priceRatio = 1,
  usdExchangeRate = 1,
  creemProducts,
  enableCreemTopup,
  onCreemProductSelect,
  enableWaffoTopup,
  waffoPayMethods,
  waffoMinTopup,
  onWaffoMethodSelect,
  enableWaffoPancakeTopup,
  embedded = false,
  showRedemption = true,
}: RechargeFormCardProps) {
  const { t } = useTranslation()
  const [localAmount, setLocalAmount] = useState(topupAmount.toString())

  useEffect(() => {
    // Empty string must survive, otherwise the field can never be cleared
    setLocalAmount((prev) =>
      prev === '' && topupAmount === 0 ? prev : topupAmount.toString()
    )
  }, [topupAmount])

  const handleAmountChange = (value: string) => {
    setLocalAmount(value)
    const numValue = Number.parseInt(value) || 0
    if (numValue >= 0) {
      onTopupAmountChange(numValue)
    }
  }

  const hasConfigurableTopup =
    topupInfo?.enable_wechatpay_topup ||
    topupInfo?.enable_alipay_topup ||
    topupInfo?.enable_online_topup ||
    topupInfo?.enable_stripe_topup ||
    enableWaffoTopup ||
    enableWaffoPancakeTopup
  const hasAnyTopup = hasConfigurableTopup || enableCreemTopup
  const minTopup = getMinTopupAmount(topupInfo)
  const hasWaffoPaymentMethods =
    Array.isArray(waffoPayMethods) && waffoPayMethods.length > 0
  const standardPaymentMethods = (topupInfo?.pay_methods || []).filter(
    (method) => !(method.type === PAYMENT_TYPES.WAFFO && hasWaffoPaymentMethods)
  )
  const hasPaymentMethods =
    standardPaymentMethods.length > 0 ||
    (enableWaffoTopup && hasWaffoPaymentMethods && !!onWaffoMethodSelect)
  let selectedMethodMinimum = selectedPaymentMethod
    ? Math.max(
        selectedPaymentMethod.min_topup || 0,
        selectedPaymentMethod.type === PAYMENT_TYPES.WAFFO
          ? waffoMinTopup || 0
          : minTopup
      )
    : minTopup
  if (
    ['alipay_direct', 'wechatpay_native'].includes(
      selectedPaymentMethod?.type || ''
    )
  ) {
    selectedMethodMinimum = selectedPaymentMethod?.min_topup || 1
  }
  const hasSelectedPaymentMethod =
    !!selectedPaymentMethod &&
    (selectedPaymentMethod.type !== PAYMENT_TYPES.WAFFO ||
      selectedWaffoMethodIndex !== null)
  const discount =
    topupInfo?.discount?.[topupAmount] ||
    presetAmounts.find((preset) => preset.value === topupAmount)?.discount ||
    1
  const hasDiscount = discount > 0 && discount < 1 && topupAmount > 0
  const discountPercent = hasDiscount ? getDiscountPercentage(discount) : 0
  if (loading) {
    if (embedded) {
      return (
        <div className='space-y-4 p-1 sm:space-y-6'>
          <div className='space-y-3'>
            <Skeleton className='h-3 w-16' />
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              {Array.from({ length: 8 }, (_, index) => `preset-${index}`).map(
                (key) => (
                  <Skeleton key={key} className='h-[72px] rounded-lg' />
                )
              )}
            </div>
          </div>
          <Skeleton className='h-10 w-full' />
          <div className='space-y-3'>
            <Skeleton className='h-3 w-32' />
            <div className='flex flex-wrap gap-3'>
              {['primary', 'secondary', 'tertiary'].map((key) => (
                <Skeleton key={key} className='h-10 w-24 rounded-lg' />
              ))}
            </div>
          </div>
        </div>
      )
    }

    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-3 !pb-3 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-4 p-3 sm:space-y-6 sm:p-5'>
          <div className='space-y-4 sm:space-y-6'>
            {/* Preset Amounts Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-16' />
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {Array.from({ length: 8 }, (_, index) => `preset-${index}`).map(
                  (key) => (
                    <Skeleton key={key} className='h-[72px] rounded-lg' />
                  )
                )}
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
                {['primary', 'secondary', 'tertiary'].map((key) => (
                  <Skeleton key={key} className='h-10 w-24 rounded-lg' />
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
    <TitledCard
      embedded={embedded}
      title={t('Add Funds')}
      description={t('Choose an amount and payment method')}
      icon={<WalletCards className='h-4 w-4' />}
      iconTone='success'
      disableHoverEffect
      contentClassName='space-y-4 sm:space-y-6'
    >
      {/* Online Topup Section */}
      {hasAnyTopup ? (
        <div className='space-y-4 sm:space-y-6'>
          {hasConfigurableTopup && (
            <>
              {hasPaymentMethods && (
                <div className='space-y-2.5 sm:space-y-3'>
                  <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                    {t('Payment Method')}
                  </Label>
                  <div
                    role='radiogroup'
                    aria-label={t('Payment Method')}
                    className='bg-muted/20 flex min-w-0 gap-1 overflow-x-auto rounded-xl border p-1'
                  >
                    {standardPaymentMethods.map((method) => {
                      const methodMinimum = Math.max(
                        method.min_topup || 0,
                        minTopup
                      )
                      const disabled = methodMinimum > topupAmount
                      const selected =
                        selectedPaymentMethod?.type === method.type &&
                        selectedWaffoMethodIndex === null
                      const disabledReason = disabled
                        ? t('Minimum topup amount: {{amount}}', {
                            amount: methodMinimum,
                          })
                        : undefined
                      return (
                        <Button
                          key={method.type}
                          type='button'
                          variant='ghost'
                          role='radio'
                          aria-checked={selected}
                          aria-label={
                            disabledReason
                              ? `${method.name}. ${disabledReason}`
                              : method.name
                          }
                          title={disabledReason}
                          disabled={disabled}
                          onClick={() => onPaymentMethodSelect(method)}
                          className={cn(
                            'min-w-[112px] flex-1 gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap',
                            selected
                              ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20'
                              : 'border-transparent bg-background hover:border-border hover:bg-background'
                          )}
                        >
                          {getPaymentIcon(
                            method.type,
                            'h-4 w-4',
                            method.icon,
                            method.name
                          )}
                          <span className='truncate'>
                            {method.type === 'alipay_direct'
                              ? t('Alipay')
                              : t(method.name)}
                          </span>
                        </Button>
                      )
                    })}
                    {enableWaffoTopup &&
                      hasWaffoPaymentMethods &&
                      onWaffoMethodSelect &&
                      waffoPayMethods?.map((method, index) => {
                        const waffoMin = waffoMinTopup || 0
                        const disabled = waffoMin > topupAmount
                        const selected =
                          selectedPaymentMethod?.type === PAYMENT_TYPES.WAFFO &&
                          selectedWaffoMethodIndex === index
                        const disabledReason = disabled
                          ? t('Minimum topup amount: {{amount}}', {
                              amount: waffoMin,
                            })
                          : undefined
                        return (
                          <Button
                            key={`waffo-${method.payMethodType ?? method.name}-${method.payMethodName ?? method.name}`}
                            type='button'
                            variant='ghost'
                            role='radio'
                            aria-checked={selected}
                            aria-label={
                              disabledReason
                                ? `${method.name}. ${disabledReason}`
                                : method.name
                            }
                            title={disabledReason}
                            disabled={disabled}
                            onClick={() => onWaffoMethodSelect(method, index)}
                            className={cn(
                              'min-w-[112px] flex-1 gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap',
                              selected
                                ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20'
                                : 'border-transparent bg-background hover:border-border hover:bg-background'
                            )}
                          >
                            {method.icon && (
                              <img
                                src={method.icon}
                                alt={method.name}
                                className='h-4 w-4 object-contain'
                              />
                            )}
                            {!method.icon &&
                              getPaymentIcon(PAYMENT_TYPES.WAFFO, 'h-4 w-4')}
                            <span className='truncate'>{method.name}</span>
                          </Button>
                        )
                      })}
                  </div>
                  {!hasSelectedPaymentMethod && (
                    <p className='text-muted-foreground text-xs'>
                      {t('Please select a payment method')}
                    </p>
                  )}
                </div>
              )}

              {presetAmounts.length > 0 && (
                <div className='space-y-2.5 sm:space-y-3'>
                  <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                    {t('Amount')}
                  </Label>
                  <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-3'>
                    {presetAmounts.map((preset) => {
                      const discount =
                        preset.discount ||
                        topupInfo?.discount?.[preset.value] ||
                        1.0
                      const { originalPrice, actualPrice, hasDiscount } =
                        calculatePresetPricing(
                          preset.value,
                          priceRatio,
                          discount,
                          usdExchangeRate
                        )
                      return (
                        <Button
                          key={preset.value}
                          variant='outline'
                          className={cn(
                            'flex h-[76px] min-w-0 flex-col items-start rounded-lg px-3 py-2.5 text-left whitespace-normal shadow-xs hover:border-foreground/40 sm:p-3',
                            selectedPreset === preset.value
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border'
                          )}
                          onClick={() => onSelectPreset(preset)}
                        >
                          <div className='flex w-full min-w-0 items-center justify-between gap-2'>
                            <div className='min-w-0 truncate text-base font-semibold sm:text-lg'>
                              {['alipay_direct', 'wechatpay_native'].includes(
                                selectedPaymentMethod?.type || ''
                              )
                                ? formatDirectTopUpAmount(preset.value)
                                : formatBillingCurrencyFromUSD(preset.value)}
                            </div>
                            {hasDiscount && (
                              <Badge
                                variant='outline'
                                className='border-success/30 bg-success/10 text-success'
                              >
                                {t('{{percent}}% off', {
                                  percent: getDiscountPercentage(discount),
                                })}
                              </Badge>
                            )}
                          </div>
                          {!['alipay_direct', 'wechatpay_native'].includes(
                            selectedPaymentMethod?.type || ''
                          ) && (
                            <div className='mt-1.5 flex w-full min-w-0 items-baseline gap-2 text-xs sm:mt-2'>
                              <span className='min-w-0 truncate font-medium'>
                                {t('Pay {{amount}}', {
                                  amount:
                                    formatLocalCurrencyAmount(actualPrice),
                                })}
                              </span>
                              {hasDiscount && (
                                <span
                                  aria-hidden='true'
                                  className='text-muted-foreground shrink-0 line-through'
                                >
                                  {formatLocalCurrencyAmount(originalPrice)}
                                </span>
                              )}
                            </div>
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className='space-y-2.5 sm:space-y-3'>
                <Label
                  htmlFor='topup-amount'
                  className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
                >
                  {t('Custom Amount')}
                  {['alipay_direct', 'wechatpay_native'].includes(
                    selectedPaymentMethod?.type || ''
                  ) && ` (${getCurrencyLabel()})`}
                </Label>
                <div className='grid grid-cols-[minmax(0,1fr)_minmax(110px,0.55fr)] gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                  <Input
                    id='topup-amount'
                    type='number'
                    value={localAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    min={selectedMethodMinimum}
                    placeholder={t('Minimum {{amount}}', {
                      amount: selectedMethodMinimum,
                    })}
                    className='h-9 text-base sm:h-10 sm:text-lg'
                  />
                  <div className='bg-muted/30 flex min-h-9 items-center justify-between gap-2 rounded-md border px-3 lg:min-w-52'>
                    <span className='text-muted-foreground truncate text-xs'>
                      {t('Amount to pay:')}
                    </span>
                    {calculating ? (
                      <Skeleton className='h-5 w-16' />
                    ) : (
                      <span className='text-sm font-semibold'>
                        {['alipay_direct', 'wechatpay_native'].includes(
                          selectedPaymentMethod?.type || ''
                        )
                          ? `CNY ${formatLocalCurrencyAmount(paymentAmount, { showSymbol: false, digitsLarge: 2, digitsSmall: 2, abbreviate: false })}`
                          : formatLocalCurrencyAmount(paymentAmount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!hasPaymentMethods && (
                <Alert>
                  <AlertDescription>
                    {t(
                      'No payment methods available. Please contact administrator.'
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {hasPaymentMethods && (
                <>
                  {hasDiscount && (
                    <p className='text-success flex items-center gap-2 text-sm font-semibold'>
                      {t('You save')}: {discountPercent}%
                    </p>
                  )}
                  <Button
                    type='button'
                    className='h-11 w-full gap-2 text-sm font-semibold sm:h-12'
                    onClick={onPaymentContinue}
                    disabled={
                      !onPaymentContinue ||
                      calculating ||
                      !hasSelectedPaymentMethod ||
                      topupAmount < selectedMethodMinimum
                    }
                  >
                    {calculating && (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    )}
                    {t('Continue')}
                    {!calculating && <ArrowRight className='h-4 w-4' />}
                  </Button>
                </>
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
          <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
            <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Creem Payment')}
            </Label>
            <CreemProductsSection
              products={creemProducts}
              onProductSelect={onCreemProductSelect}
            />
          </div>
        )}

      {showRedemption && (
        <RedemptionCodeCard
          embedded
          topupInfo={topupInfo}
          redemptionCode={redemptionCode}
          onRedemptionCodeChange={onRedemptionCodeChange}
          onRedeem={onRedeem}
          redeeming={redeeming}
          topupLink={topupLink}
        />
      )}
    </TitledCard>
  )
}
