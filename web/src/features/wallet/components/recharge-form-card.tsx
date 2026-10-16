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
import { Loader2, WalletCards } from 'lucide-react'
import { useState, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  getCurrencyLabel,
  getCurrencyDisplay,
  formatLocalCurrencyAmount,
} from '@/lib/currency'
import { cn } from '@/lib/utils'

import { PAYMENT_TYPES } from '../constants'
import {
  getDiscountPercentage,
  formatDirectTopUpAmount,
  getMinTopupAmount,
  calculatePresetPricing,
} from '../lib'
import { PAYMENT_ACTION_CLASS_NAME, getPaymentButtonClassName } from '../lib/ui'
import type {
  PaymentMethod,
  PresetAmount,
  TopupInfo,
  CreemProduct,
  WaffoPayMethod,
} from '../types'
import { CreemProductsSection } from './creem-products-section'
import { PaymentMethodIcons } from './payment-method-icons'
import { PaymentMethodLabel } from './payment-method-label'
import { RedemptionCodeCard } from './redemption-code-card'

interface RechargeFormCardProps {
  pendingOrderNotice?: ReactNode
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  topupAmount: number
  onTopupAmountChange: (amount: number) => void
  paymentAmount: number
  calculating: boolean
  processing?: boolean
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
  pendingOrderNotice,
  topupInfo,
  presetAmounts,
  selectedPreset,
  onSelectPreset,
  topupAmount,
  onTopupAmountChange,
  processing = false,
  onPaymentMethodSelect,
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
  const currencyMeta = getCurrencyDisplay().meta
  let inputCurrencySymbol = '$'
  if (
    ['mixpay', 'alipay_direct', 'wechatpay_native'].includes(
      selectedPaymentMethod?.type || ''
    )
  ) {
    inputCurrencySymbol =
      currencyMeta.kind === 'tokens' ? getCurrencyLabel() : currencyMeta.symbol
  }
  const [localAmount, setLocalAmount] = useState(topupAmount.toString())

  useEffect(() => {
    // Empty string must survive, otherwise the field can never be cleared
    setLocalAmount((prev) =>
      prev === '' && topupAmount === 0 ? prev : topupAmount.toString()
    )
  }, [topupAmount])

  const handleAmountChange = (value: string) => {
    if (!/^\d*$/.test(value)) return
    setLocalAmount(value)
    const numValue = Number.parseInt(value) || 0
    if (numValue >= 0) {
      onTopupAmountChange(numValue)
    }
  }

  const hasConfigurableTopup =
    topupInfo?.pay_methods?.some((method) =>
      ['antom', 'webmoney'].includes(method.type)
    ) ||
    topupInfo?.enable_mixpay_topup ||
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
      title={t('Balance Top-up')}
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
              <div
                role='group'
                aria-label={t('Amount')}
                className='space-y-2.5 sm:space-y-3'
              >
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
                          'flex h-auto min-h-[76px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-center whitespace-normal shadow-xs hover:border-foreground/40 sm:p-3',
                          selectedPreset === preset.value
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border'
                        )}
                        onClick={() => onSelectPreset(preset)}
                      >
                        <div className='flex w-full min-w-0 flex-col items-center justify-center gap-1'>
                          <div className='flex min-w-0 flex-wrap items-baseline justify-center gap-x-2'>
                            <span className='min-w-0 truncate text-base font-semibold sm:text-lg'>
                              {[
                                'antom',
                                'webmoney',
                                'mixpay',
                                'alipay_direct',
                                'wechatpay_native',
                              ].includes(selectedPaymentMethod?.type || '')
                                ? formatDirectTopUpAmount(preset.value)
                                : formatLocalCurrencyAmount(actualPrice)}
                            </span>
                            {hasDiscount &&
                              ![
                                'antom',
                                'webmoney',
                                'mixpay',
                                'alipay_direct',
                                'wechatpay_native',
                              ].includes(selectedPaymentMethod?.type || '') && (
                                <span className='text-muted-foreground text-xs line-through'>
                                  {formatLocalCurrencyAmount(originalPrice)}
                                </span>
                              )}
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
                      </Button>
                    )
                  })}
                  <InputGroup
                    onClick={(event) => {
                      event.currentTarget.querySelector('input')?.focus()
                    }}
                    className={cn(
                      'h-[76px] min-w-0 cursor-text justify-center gap-1.5 rounded-lg px-3 shadow-xs [&>input]:pl-0',
                      selectedPreset === null
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border'
                    )}
                  >
                    <InputGroupAddon
                      className='text-foreground pl-0 text-base font-semibold sm:text-lg'
                      aria-hidden='true'
                    >
                      {inputCurrencySymbol}
                    </InputGroupAddon>
                    <InputGroupInput
                      id='topup-amount'
                      type='text'
                      inputMode='numeric'
                      pattern='[0-9]*'
                      aria-label={t('Custom Amount')}
                      value={selectedPreset === null ? localAmount : ''}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder={t('Custom')}
                      className='field-sizing-content h-full w-auto max-w-[calc(100%-2rem)] min-w-0 flex-none px-0 text-center text-base font-semibold sm:text-lg'
                    />
                  </InputGroup>
                </div>
              </div>

              {hasPaymentMethods && (
                <div className='space-y-2.5 sm:space-y-3'>
                  <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                    {t('Pay with')}
                  </Label>
                  <div
                    role='group'
                    aria-label={t('Pay with')}
                    className='grid min-w-0 grid-cols-1 gap-3'
                  >
                    {standardPaymentMethods.map((method) => {
                      const direct = [
                        'antom',
                        'webmoney',
                        'mixpay',
                        'alipay_direct',
                        'wechatpay_native',
                      ].includes(method.type)
                      const minimum = direct
                        ? method.min_topup || 1
                        : Math.max(method.min_topup || 0, minTopup)
                      return (
                        <Button
                          key={method.type}
                          type='button'
                          variant='default'
                          disabled={processing || topupAmount < minimum}
                          title={
                            topupAmount < minimum
                              ? t('Minimum topup amount: {{amount}}', {
                                  amount: minimum,
                                })
                              : undefined
                          }
                          onClick={() => onPaymentMethodSelect(method)}
                          className={cn(
                            PAYMENT_ACTION_CLASS_NAME,
                            getPaymentButtonClassName(method.type),
                            ['antom', 'mixpay'].includes(method.type) &&
                              'relative overflow-hidden'
                          )}
                        >
                          {processing &&
                            selectedPaymentMethod?.type === method.type && (
                              <Loader2 className='size-4 shrink-0 animate-spin' />
                            )}
                          <span
                            className={cn(
                              'inline-flex items-center justify-center',
                              ['antom', 'mixpay'].includes(method.type) &&
                                'payment-label-overlay pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[40%] -translate-x-1/2 bg-white px-4',
                              method.type === 'mixpay' &&
                                'bg-[#194bff] px-1 [--payment-mask-color:#194bff] [&>span]:min-w-0'
                            )}
                          >
                            <PaymentMethodLabel
                              monochrome
                              method={method.type}
                              name={
                                {
                                  alipay_direct: t('Alipay'),
                                  mixpay: t('MixPay(Crypto)'),
                                }[method.type] ?? t(method.name)
                              }
                              icon={method.icon}
                            />
                          </span>
                          {(method.type === 'antom' ||
                            method.type === 'mixpay') && (
                            <PaymentMethodIcons method={method.type} />
                          )}
                        </Button>
                      )
                    })}
                    {enableWaffoTopup &&
                      hasWaffoPaymentMethods &&
                      onWaffoMethodSelect &&
                      waffoPayMethods?.map((method, index) => (
                        <Button
                          key={`${method.payMethodType ?? method.name}-${method.payMethodName ?? method.name}`}
                          type='button'
                          variant='default'
                          disabled={
                            processing || topupAmount < (waffoMinTopup || 0)
                          }
                          onClick={() => onWaffoMethodSelect(method, index)}
                          className={cn(
                            PAYMENT_ACTION_CLASS_NAME,
                            getPaymentButtonClassName(PAYMENT_TYPES.WAFFO)
                          )}
                        >
                          {processing &&
                            selectedPaymentMethod?.type ===
                              PAYMENT_TYPES.WAFFO &&
                            selectedWaffoMethodIndex === index && (
                              <Loader2 className='size-4 shrink-0 animate-spin' />
                            )}
                          <PaymentMethodLabel
                            monochrome
                            method={PAYMENT_TYPES.WAFFO}
                            name={method.name}
                            icon={method.icon}
                          />
                        </Button>
                      ))}
                  </div>
                </div>
              )}

              {pendingOrderNotice}

              {!hasPaymentMethods && (
                <Alert>
                  <AlertDescription>
                    {t(
                      'No payment methods available. Please contact administrator.'
                    )}
                  </AlertDescription>
                </Alert>
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

      {!hasConfigurableTopup && pendingOrderNotice}

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
