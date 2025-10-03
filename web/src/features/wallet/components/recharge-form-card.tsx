import { useState, useEffect } from 'react'
import { Gift, ExternalLink, Loader2 } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
} from '../lib'
import type { PaymentMethod, PresetAmount, TopupInfo } from '../types'

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
}: RechargeFormCardProps) {
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

  const hasOnlineTopup =
    topupInfo?.enable_online_topup || topupInfo?.enable_stripe_topup
  const minTopup = getMinTopupAmount(topupInfo)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-6'>
          <Skeleton className='h-32 w-full' />
          <Skeleton className='h-20 w-full' />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <h3 className='text-xl font-semibold tracking-tight'>Add Funds</h3>
        <p className='text-muted-foreground mt-2 text-sm'>
          Choose an amount and payment method
        </p>
      </CardHeader>
      <CardContent className='space-y-8'>
        {/* Online Topup Section */}
        {hasOnlineTopup ? (
          <div className='space-y-6'>
            {/* Preset Amounts */}
            {presetAmounts.length > 0 && (
              <div className='space-y-3'>
                <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                  Amount
                </Label>
                <div className='grid grid-cols-4 gap-3'>
                  {presetAmounts.map((preset, index) => {
                    const discount =
                      preset.discount ||
                      topupInfo?.discount?.[preset.value] ||
                      1.0
                    const hasDiscount = discount < 1.0
                    return (
                      <button
                        key={index}
                        className={`hover:border-foreground relative rounded-lg border p-4 text-left transition-all ${
                          selectedPreset === preset.value
                            ? 'border-foreground bg-foreground/5'
                            : 'border-muted'
                        }`}
                        onClick={() => onSelectPreset(preset)}
                      >
                        <div className='text-lg font-semibold'>
                          {formatNumber(preset.value)}
                        </div>
                        {hasDiscount && (
                          <div className='text-muted-foreground mt-1 text-xs'>
                            {getDiscountLabel(discount)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Custom Amount Input */}
            <div className='space-y-3'>
              <Label
                htmlFor='topup-amount'
                className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
              >
                Custom Amount
              </Label>
              <div className='relative'>
                <Input
                  id='topup-amount'
                  type='number'
                  value={localAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  min={minTopup}
                  placeholder={`Minimum ${minTopup}`}
                  className='pr-32 text-lg'
                />
                <div className='absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-2'>
                  <span className='text-muted-foreground text-xs'>
                    Amount to pay:
                  </span>
                  {calculating ? (
                    <Skeleton className='h-5 w-16' />
                  ) : (
                    <span className='text-sm font-semibold'>
                      ${formatCurrency(paymentAmount)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className='space-y-3'>
              <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                Payment Method
              </Label>
              {topupInfo?.pay_methods && topupInfo.pay_methods.length > 0 ? (
                <div className='flex flex-wrap gap-3'>
                  {topupInfo.pay_methods.map((method) => {
                    const minTopup = method.min_topup || 0
                    const disabled = minTopup > topupAmount

                    const button = (
                      <Button
                        key={method.type}
                        variant='outline'
                        onClick={() => onPaymentMethodSelect(method)}
                        disabled={disabled || !!paymentLoading}
                        className='gap-2 rounded-lg'
                      >
                        {paymentLoading === method.type ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          getPaymentIcon(method.type)
                        )}
                        {method.name}
                      </Button>
                    )

                    return disabled ? (
                      <TooltipProvider key={method.type}>
                        <Tooltip>
                          <TooltipTrigger asChild>{button}</TooltipTrigger>
                          <TooltipContent>
                            Minimum topup amount: {minTopup}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      button
                    )
                  })}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No payment methods available. Please contact administrator.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              Online topup is not enabled. Please use redemption code or contact
              administrator.
            </AlertDescription>
          </Alert>
        )}

        {/* Redemption Code Section */}
        <div className='space-y-3 border-t pt-8'>
          <div className='flex items-center gap-2'>
            <Gift className='text-muted-foreground h-4 w-4' />
            <Label
              htmlFor='redemption-code'
              className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
            >
              Have a Code?
            </Label>
          </div>
          <div className='flex gap-2'>
            <Input
              id='redemption-code'
              value={redemptionCode}
              onChange={(e) => onRedemptionCodeChange(e.target.value)}
              placeholder='Enter your redemption code'
              className='flex-1'
            />
            <Button onClick={onRedeem} disabled={redeeming} variant='outline'>
              {redeeming && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Redeem
            </Button>
          </div>
          {topupLink && (
            <p className='text-muted-foreground text-xs'>
              Need a code?{' '}
              <a
                href={topupLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
              >
                Purchase here
                <ExternalLink className='h-3 w-3' />
              </a>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
