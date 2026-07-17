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
import { ExternalLink, Loader2, Receipt } from 'lucide-react'
import { useState, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Input } from '@/components/design-system/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

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

interface PaymentOptionButtonProps {
  name: string
  icon: ReactNode
  loading: boolean
  disabled: boolean
  minHint?: string
  disabledReason?: string
  onSelect: () => void
}

function PaymentOptionButton(props: PaymentOptionButtonProps) {
  const button = (
    <Button
      variant='outline'
      onClick={props.onSelect}
      disabled={props.disabled}
      aria-label={
        props.disabledReason
          ? `${props.name}. ${props.disabledReason}`
          : props.name
      }
      className='h-auto min-h-12 min-w-0 justify-start gap-2.5 rounded-lg px-3 py-2 text-left sm:h-auto'
    >
      {props.loading ? <Loader2 className='size-4 animate-spin' /> : props.icon}
      <span className='flex min-w-0 flex-col items-start'>
        <span className='max-w-full truncate'>{props.name}</span>
        {props.minHint && (
          <span className='text-muted-foreground max-w-full truncate text-xs leading-4 font-normal'>
            {props.minHint}
          </span>
        )}
      </span>
    </Button>
  )

  if (!props.disabledReason) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{props.disabledReason}</TooltipContent>
    </Tooltip>
  )
}

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
    const numValue = Number.parseInt(value, 10) || 0
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
  const showWaffoMethods = Boolean(
    enableWaffoTopup &&
    Array.isArray(waffoPayMethods) &&
    waffoPayMethods.length > 0 &&
    onWaffoMethodSelect
  )
  const minTopup = getMinTopupAmount(topupInfo)
  const redemptionEnabled = topupInfo?.enable_redemption !== false

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-4 !pb-4 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-5 p-4 sm:space-y-6 sm:p-5'>
          <div className='space-y-2.5'>
            <Skeleton className='h-4 w-16' />
            <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
              <Skeleton className='h-16 rounded-lg' />
              <Skeleton className='h-16 rounded-lg' />
              <Skeleton className='h-16 rounded-lg' />
              <Skeleton className='h-16 rounded-lg' />
              <Skeleton className='hidden h-16 rounded-lg md:block' />
              <Skeleton className='hidden h-16 rounded-lg md:block' />
              <Skeleton className='hidden h-16 rounded-lg md:block' />
              <Skeleton className='hidden h-16 rounded-lg md:block' />
            </div>
          </div>
          <div className='space-y-2.5'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='space-y-2.5'>
            <Skeleton className='h-4 w-28' />
            <div className='grid grid-cols-2 gap-2 lg:grid-cols-3'>
              <Skeleton className='h-12 rounded-lg' />
              <Skeleton className='h-12 rounded-lg' />
              <Skeleton className='h-12 rounded-lg' />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TitledCard
      title={t('Add Funds')}
      description={t('Choose an amount and payment method')}
      disableHoverEffect
      action={
        onOpenBilling ? (
          <Button
            variant='outline'
            onClick={onOpenBilling}
            className='w-full gap-2 sm:w-auto'
          >
            <Receipt className='size-4' />
            {t('Order History')}
          </Button>
        ) : null
      }
      contentClassName='space-y-5 sm:space-y-6'
    >
      {hasAnyTopup ? (
        hasConfigurableTopup && (
          <>
            {presetAmounts.length > 0 && (
              <div className='space-y-2.5'>
                <div className='text-sm font-medium'>{t('Amount')}</div>
                <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
                  {presetAmounts.map((preset) => {
                    const discount =
                      preset.discount ||
                      topupInfo?.discount?.[preset.value] ||
                      1.0
                    const { displayValue, actualPrice, hasDiscount } =
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
                          'h-auto sm:h-auto min-h-16 flex-col items-start justify-center gap-1 rounded-lg px-3 py-2.5 text-left whitespace-normal',
                          selectedPreset === preset.value &&
                            'border-foreground bg-foreground/5 dark:bg-foreground/10'
                        )}
                        onClick={() => onSelectPreset(preset)}
                      >
                        <span className='flex w-full items-center justify-between gap-2'>
                          <span className='truncate text-base font-semibold tabular-nums'>
                            {formatNumber(displayValue)}
                          </span>
                          {hasDiscount && (
                            <span className='text-success shrink-0 text-xs font-medium'>
                              {getDiscountLabel(discount)}
                            </span>
                          )}
                        </span>
                        <span className='text-muted-foreground w-full truncate text-xs font-normal'>
                          {t('Pay {{amount}}', {
                            amount: formatCurrency(actualPrice),
                          })}
                        </span>
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className='space-y-2.5'>
              <Label htmlFor='topup-amount' className='text-sm font-medium'>
                {t('Custom Amount')}
              </Label>
              <Input
                id='topup-amount'
                type='number'
                value={localAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                min={minTopup}
                placeholder={`${t('Minimum:')} ${minTopup}`}
                className='h-9 text-base sm:h-10'
              />
              <div className='bg-muted/30 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5'>
                <span className='text-muted-foreground text-sm'>
                  {t('Amount to pay')}
                </span>
                {calculating ? (
                  <Skeleton className='h-5 w-16' />
                ) : (
                  <span className='text-base font-semibold tabular-nums'>
                    {formatCurrency(paymentAmount)}
                  </span>
                )}
              </div>
            </div>

            <div className='space-y-2.5'>
              <div className='text-sm font-medium'>{t('Payment Method')}</div>
              {hasStandardPaymentMethods || showWaffoMethods ? (
                <div className='grid grid-cols-2 gap-2 lg:grid-cols-3'>
                  {topupInfo?.pay_methods?.map((method) => {
                    const methodMin = method.min_topup || 0
                    const belowMin = methodMin > topupAmount
                    return (
                      <PaymentOptionButton
                        key={method.type}
                        name={method.name}
                        icon={getPaymentIcon(
                          method.type,
                          'size-4',
                          method.icon,
                          method.name
                        )}
                        loading={paymentLoading === method.type}
                        disabled={belowMin || !!paymentLoading}
                        minHint={
                          belowMin ? `${t('Minimum:')} ${methodMin}` : undefined
                        }
                        disabledReason={
                          belowMin
                            ? t('Minimum topup amount: {{amount}}', {
                                amount: methodMin,
                              })
                            : undefined
                        }
                        onSelect={() => onPaymentMethodSelect(method)}
                      />
                    )
                  })}
                  {showWaffoMethods &&
                    waffoPayMethods?.map((method, index) => {
                      const waffoMin = waffoMinTopup || 0
                      const belowMin = waffoMin > topupAmount
                      return (
                        <PaymentOptionButton
                          key={`waffo-${method.name}`}
                          name={method.name}
                          icon={
                            method.icon ? (
                              <img
                                src={method.icon}
                                alt={method.name}
                                className='size-4 object-contain'
                              />
                            ) : (
                              getPaymentIcon('waffo')
                            )
                          }
                          loading={paymentLoading === `waffo-${index}`}
                          disabled={belowMin || !!paymentLoading}
                          minHint={
                            belowMin
                              ? `${t('Minimum:')} ${waffoMin}`
                              : undefined
                          }
                          disabledReason={
                            belowMin
                              ? t('Minimum topup amount: {{amount}}', {
                                  amount: waffoMin,
                                })
                              : undefined
                          }
                          onSelect={() => onWaffoMethodSelect?.(method, index)}
                        />
                      )
                    })}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    {t(
                      'No payment methods available. Please contact administrator.'
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </>
        )
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Online topup is not enabled. Please use redemption code or contact administrator.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {enableCreemTopup &&
        Array.isArray(creemProducts) &&
        creemProducts.length > 0 &&
        onCreemProductSelect && (
          <div
            className={cn(
              'space-y-2.5',
              hasConfigurableTopup && 'border-t pt-5 sm:pt-6'
            )}
          >
            <div className='text-sm font-medium'>{t('Creem Payment')}</div>
            <CreemProductsSection
              products={creemProducts}
              onProductSelect={onCreemProductSelect}
            />
          </div>
        )}

      {redemptionEnabled ? (
        <div className='space-y-2.5 border-t pt-5 sm:pt-6'>
          <Label htmlFor='redemption-code' className='text-sm font-medium'>
            {t('Redemption Code')}
          </Label>
          <div className='flex gap-2'>
            <Input
              id='redemption-code'
              value={redemptionCode}
              onChange={(e) => onRedemptionCodeChange(e.target.value)}
              placeholder={t('Enter your redemption code')}
              className='min-w-0 flex-1'
            />
            <Button
              onClick={onRedeem}
              disabled={redeeming}
              variant='outline'
              className='shrink-0'
            >
              {redeeming && <Loader2 className='mr-2 size-4 animate-spin' />}
              {t('Redeem')}
            </Button>
          </div>
          {topupLink && (
            <p className='text-muted-foreground text-xs'>
              {t('Need a redemption code?')}{' '}
              <a
                href={topupLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
              >
                {t('Get one here')}
                <ExternalLink className='size-3' />
              </a>
            </p>
          )}
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Redemption codes are disabled until the administrator confirms compliance terms.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </TitledCard>
  )
}
