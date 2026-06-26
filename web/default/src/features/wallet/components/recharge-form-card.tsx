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
import { useState, useEffect } from 'react'
import { Gift, ExternalLink, Loader2, Receipt, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getInvoiceProfile, isApiSuccess } from '../api'
import { formatCurrency, getPaymentIcon, getMinTopupAmount } from '../lib'
import {
  EMPTY_INVOICE_PROFILE,
  normalizeInvoiceProfile,
  validateInvoiceProfile,
} from '../lib/invoice'
import type {
  PaymentMethod,
  PaymentOptions,
  PresetAmount,
  TopupInfo,
  CreemProduct,
  WaffoPayMethod,
  InvoiceProfile,
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
  onPaymentMethodSelect: (
    method: PaymentMethod,
    options?: PaymentOptions
  ) => void
  paymentLoading: string | null
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupLink?: string
  loading?: boolean
  onOpenBilling?: () => void
  creemProducts?: CreemProduct[]
  enableCreemTopup?: boolean
  onCreemProductSelect?: (product: CreemProduct) => void
  enableWaffoTopup?: boolean
  waffoPayMethods?: WaffoPayMethod[]
  waffoMinTopup?: number
  onWaffoMethodSelect?: (method: WaffoPayMethod, index: number) => void
  enableWaffoPancakeTopup?: boolean
  currentPaymentType?: string
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
  onOpenBilling,
  creemProducts,
  enableCreemTopup,
  onCreemProductSelect,
  enableWaffoTopup,
  waffoPayMethods,
  waffoMinTopup,
  onWaffoMethodSelect,
  enableWaffoPancakeTopup,
  currentPaymentType,
}: RechargeFormCardProps) {
  const { t } = useTranslation()
  const [localAmount, setLocalAmount] = useState(topupAmount.toString())
  const [invoiceRequested, setInvoiceRequested] = useState(false)
  const [invoiceProfile, setInvoiceProfile] = useState<InvoiceProfile>(
    EMPTY_INVOICE_PROFILE
  )
  const showLocalCurrencyBreakdown = false
  const formatUsdAmount = (amount: number) => `$${formatNumber(amount)} USD`

  useEffect(() => {
    setLocalAmount(topupAmount.toString())
  }, [topupAmount])

  useEffect(() => {
    let cancelled = false
    getInvoiceProfile()
      .then((response) => {
        if (!cancelled && isApiSuccess(response) && response.data) {
          setInvoiceProfile({
            ...EMPTY_INVOICE_PROFILE,
            ...response.data,
          })
        }
      })
      .catch(() => {
        // Keep the invoice form empty if the optional profile endpoint fails.
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    topupInfo?.enable_paddle_topup ||
    enableWaffoTopup ||
    enableWaffoPancakeTopup
  const hasAnyTopup = hasConfigurableTopup || enableCreemTopup
  // Frontend-only hide-list for payment methods (e.g. Paddle is not offered right now).
  // Backend still returns them; we just don't render their buttons.
  const HIDDEN_PAY_METHOD_TYPES = ['paddle']
  const visiblePayMethods = Array.isArray(topupInfo?.pay_methods)
    ? topupInfo.pay_methods.filter(
        (method) => !HIDDEN_PAY_METHOD_TYPES.includes(method.type)
      )
    : []
  const hasStandardPaymentMethods = visiblePayMethods.length > 0
  const hasWaffoPaymentMethods =
    Array.isArray(waffoPayMethods) && waffoPayMethods.length > 0
  const minTopup = getMinTopupAmount(topupInfo)
  const redemptionEnabled = topupInfo?.enable_redemption !== false
  const hasStripePaymentMethod =
    topupInfo?.enable_stripe_topup ||
    topupInfo?.pay_methods?.some((method) => method.type === 'stripe')
  const isCurrentStripePayment = currentPaymentType === 'stripe'

  const updateInvoiceField = (field: keyof InvoiceProfile, value: string) => {
    setInvoiceProfile((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handlePaymentClick = (method: PaymentMethod) => {
    if (method.type !== 'stripe' || !invoiceRequested) {
      onPaymentMethodSelect(method)
      return
    }

    const normalized = normalizeInvoiceProfile(invoiceProfile)
    const validationMessage = validateInvoiceProfile(normalized)
    if (validationMessage) {
      toast.error(t(validationMessage))
      return
    }

    onPaymentMethodSelect(method, {
      invoiceRequested: true,
      invoiceProfile: normalized,
    })
  }

  if (loading) {
    return (
      <Card className='gap-0 overflow-hidden py-0'>
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
    <TitledCard
      title={t('Add Funds')}
      description={t('Choose an amount and payment method')}
      icon={<WalletCards className='h-4 w-4' />}
      action={
        onOpenBilling ? (
          <Button
            variant='outline'
            size='sm'
            onClick={onOpenBilling}
            className='w-full gap-2 sm:w-auto'
          >
            <Receipt className='h-4 w-4' />
            {t('Order History')}
          </Button>
        ) : null
      }
      contentClassName='space-y-4 sm:space-y-6'
    >
      {/* Online Topup Section */}
      {hasAnyTopup ? (
        <div className='space-y-4 sm:space-y-6'>
          {hasConfigurableTopup && (
            <>
              {presetAmounts.length > 0 && (
                <div className='space-y-2.5 sm:space-y-3'>
                  <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                    {t('Amount')} USD
                  </Label>
                  <div className='grid grid-cols-2 gap-1.5 sm:gap-3 md:grid-cols-4'>
                    {presetAmounts.map((preset, index) => {
                      return (
                        <Button
                          key={index}
                          variant='outline'
                          className={cn(
                            'hover:border-foreground flex min-h-16 flex-col items-start rounded-lg px-3 py-2.5 text-left whitespace-normal sm:min-h-[72px] sm:p-4',
                            selectedPreset === preset.value
                              ? 'border-foreground bg-foreground/5 dark:border-foreground dark:bg-foreground/10'
                              : 'border-muted'
                          )}
                          onClick={() => onSelectPreset(preset)}
                        >
                          <div className='flex w-full items-center justify-between'>
                            <div className='text-base font-semibold sm:text-lg'>
                              {formatUsdAmount(preset.value)}
                            </div>
                          </div>
                          {preset.bonus && preset.bonus > 0 && (
                            <div className='mt-1 text-xs font-semibold text-[#FF2D78]'>
                              {t('Get {{bonus}} free', {
                                bonus: formatUsdAmount(preset.bonus),
                              })}
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
                  {t('Custom Amount')} USD
                </Label>
                <div className='grid grid-cols-[minmax(0,1fr)_minmax(110px,0.55fr)] gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                  <Input
                    id='topup-amount'
                    type='number'
                    value={localAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    min={minTopup}
                    placeholder={t('Minimum {{amount}}', {
                      amount: formatUsdAmount(minTopup),
                    })}
                    className='h-9 text-base sm:h-10 sm:text-lg'
                  />
                  <div className='bg-muted/30 flex min-h-9 items-center justify-between gap-2 rounded-md border px-3 lg:min-w-52'>
                    <span className='text-muted-foreground truncate text-xs'>
                      {t('Amount to pay:')}
                    </span>
                    {calculating ? (
                      <Skeleton className='h-5 w-16' />
                    ) : isCurrentStripePayment ? (
                      <span className='text-sm font-semibold'>
                        {t('Final amount shown by Stripe')}
                      </span>
                    ) : (
                      <span className='text-sm font-semibold'>
                        {formatUsdAmount(paymentAmount)}
                      </span>
                    )}
                    {!calculating && showLocalCurrencyBreakdown && (
                      <span hidden>{formatCurrency(paymentAmount)}</span>
                    )}
                  </div>
                </div>
              </div>

              {hasStripePaymentMethod && (
                <div className='space-y-3 rounded-lg border p-3 sm:p-4'>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      id='stripe-invoice-requested'
                      checked={invoiceRequested}
                      onCheckedChange={(checked) =>
                        setInvoiceRequested(checked === true)
                      }
                    />
                    <Label
                      htmlFor='stripe-invoice-requested'
                      className='text-sm font-medium'
                    >
                      {t('Need company invoice')}
                    </Label>
                  </div>

                  {invoiceRequested && (
                    <div className='grid gap-3 sm:grid-cols-2'>
                      <div className='space-y-1.5'>
                        <Label htmlFor='invoice-company-name'>
                          {t('Company name')}
                        </Label>
                        <Input
                          id='invoice-company-name'
                          value={invoiceProfile.company_name}
                          onChange={(event) =>
                            updateInvoiceField(
                              'company_name',
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <Label htmlFor='invoice-country'>{t('Country')}</Label>
                        <Input
                          id='invoice-country'
                          value={invoiceProfile.country}
                          onChange={(event) =>
                            updateInvoiceField('country', event.target.value)
                          }
                          placeholder='US'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <Label htmlFor='invoice-tax-id'>{t('Tax ID')}</Label>
                        <Input
                          id='invoice-tax-id'
                          value={invoiceProfile.tax_id || ''}
                          onChange={(event) =>
                            updateInvoiceField('tax_id', event.target.value)
                          }
                        />
                      </div>
                      <div className='space-y-1.5 sm:col-span-2'>
                        <Label htmlFor='invoice-address-line1'>
                          {t('Address')}
                        </Label>
                        <Input
                          id='invoice-address-line1'
                          value={invoiceProfile.address_line1}
                          onChange={(event) =>
                            updateInvoiceField(
                              'address_line1',
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <Label htmlFor='invoice-city'>{t('City')}</Label>
                        <Input
                          id='invoice-city'
                          value={invoiceProfile.city || ''}
                          onChange={(event) =>
                            updateInvoiceField('city', event.target.value)
                          }
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <Label htmlFor='invoice-postal-code'>
                          {t('Postal code')}
                        </Label>
                        <Input
                          id='invoice-postal-code'
                          value={invoiceProfile.postal_code || ''}
                          onChange={(event) =>
                            updateInvoiceField(
                              'postal_code',
                              event.target.value
                            )
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className='space-y-2.5 sm:space-y-3'>
                <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                  {t('Payment Method')}
                </Label>
                {hasStandardPaymentMethods ? (
                  <div className='grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-3'>
                    {visiblePayMethods.map((method) => {
                      const minTopup = method.min_topup || 0
                      const disabled = minTopup > topupAmount

                      const button = (
                        <Button
                          key={method.type}
                          variant='outline'
                          onClick={() => handlePaymentClick(method)}
                          disabled={disabled || !!paymentLoading}
                          className='h-9 min-w-0 justify-start gap-2 rounded-lg px-3'
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
                          <span className='truncate'>{method.name}</span>
                        </Button>
                      )

                      return disabled ? (
                        <TooltipProvider key={method.type}>
                          <Tooltip>
                            <TooltipTrigger render={button}></TooltipTrigger>
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
                  <div className='space-y-2.5 sm:space-y-3'>
                    <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                      {t('Waffo Payment')}
                    </Label>
                    <div className='grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-3'>
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
                            className='h-9 min-w-0 justify-start gap-2 rounded-lg px-3'
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
                            <span className='truncate'>{method.name}</span>
                          </Button>
                        )

                        return belowMin ? (
                          <TooltipProvider key={`${method.name}-${index}`}>
                            <Tooltip>
                              <TooltipTrigger render={button}></TooltipTrigger>
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

      {/* Redemption Code Section */}
      {redemptionEnabled ? (
        <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
          <div className='flex items-center gap-2'>
            <Gift className='text-muted-foreground h-4 w-4' />
            <Label
              htmlFor='redemption-code'
              className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
            >
              {t('Have a Code?')}
            </Label>
          </div>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
            <Input
              id='redemption-code'
              value={redemptionCode}
              onChange={(e) => onRedemptionCodeChange(e.target.value)}
              placeholder={t('Enter your redemption code')}
              className='h-9 min-w-0'
            />
            <Button
              onClick={onRedeem}
              disabled={redeeming}
              variant='outline'
              className='h-9 px-4'
            >
              {redeeming && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
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
                <ExternalLink className='h-3 w-3' />
              </a>
            </p>
          )}
        </div>
      ) : (
        <Alert className='border-t'>
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
