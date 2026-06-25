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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatLocalCurrencyAmount } from '@/lib/currency'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_DISCOUNT_RATE } from '../../constants'
import { getPaymentIcon } from '../../lib'
import type { PaymentMethod } from '../../types'

interface PaymentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  topupAmount: number
  paymentAmount: number
  paymentMethod: PaymentMethod | undefined
  calculating: boolean
  processing: boolean
  discountRate?: number
  usdExchangeRate?: number
  bonusAmount?: number
}

function formatUsdAmount(amount: number): string {
  return `${new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(amount) >= 1 ? 2 : 4,
  }).format(amount)} USD`
}

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  topupAmount,
  paymentAmount,
  paymentMethod,
  calculating,
  processing,
  discountRate = DEFAULT_DISCOUNT_RATE,
  usdExchangeRate = 1,
  bonusAmount = 0,
}: PaymentConfirmDialogProps) {
  const { t } = useTranslation()
  const normalizedBonusAmount =
    Number.isFinite(bonusAmount) && bonusAmount > 0 ? bonusAmount : 0
  const creditAmount = topupAmount + normalizedBonusAmount
  const hasDiscount = discountRate > 0 && discountRate < 1 && paymentAmount > 0
  const originalAmount = hasDiscount ? paymentAmount / discountRate : 0
  const discountAmount = hasDiscount ? originalAmount - paymentAmount : 0
  const isStripePayment = paymentMethod?.type === 'stripe'
  const hiddenLocalTopupAmount = formatLocalCurrencyAmount(
    topupAmount * usdExchangeRate,
    {
      digitsLarge: 2,
      digitsSmall: 2,
      abbreviate: false,
    }
  )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-xl font-semibold'>
            {t('Confirm Payment')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('Review your payment details')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='space-y-3 py-3 sm:space-y-4 sm:py-4'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              {t('Topup Amount')} <span className='text-xs'>USD</span>
            </span>
            <span className='text-lg font-semibold'>
              {formatUsdAmount(topupAmount)}
            </span>
            <span aria-hidden='true' className='hidden'>
              {hiddenLocalTopupAmount}
            </span>
          </div>

          {normalizedBonusAmount > 0 && (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Bonus Credit')} <span className='text-xs'>USD</span>
              </span>
              <span className='text-lg font-semibold text-[#FF2D78]'>
                +{formatUsdAmount(normalizedBonusAmount)}
              </span>
            </div>
          )}

          {normalizedBonusAmount > 0 && (
            <div className='bg-muted/50 rounded-lg p-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>
                  {t('Wallet Credit')}
                </span>
                <span className='font-semibold'>
                  {formatUsdAmount(creditAmount)}
                </span>
              </div>
            </div>
          )}

          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              {isStripePayment ? t('Checkout Amount') : t('You Pay')}{' '}
              {!isStripePayment && <span className='text-xs'>USD</span>}
            </span>
            {calculating ? (
              <Skeleton className='h-6 w-24' />
            ) : isStripePayment ? (
              <div className='text-right'>
                <span className='text-base font-semibold'>
                  {t('Final amount shown by Stripe')}
                </span>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {t('Stripe will apply your local currency and coupon code at checkout.')}
                </p>
              </div>
            ) : (
              <div className='flex items-baseline gap-2'>
                <span className='text-2xl font-semibold'>
                  {formatUsdAmount(paymentAmount)}
                </span>
                {hasDiscount && (
                  <span className='text-muted-foreground text-sm line-through'>
                    {formatUsdAmount(originalAmount)}
                  </span>
                )}
              </div>
            )}
          </div>

          {hasDiscount && !calculating && (
            <div className='bg-muted/50 rounded-lg p-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>{t('You save')}</span>
                <span className='font-semibold text-green-600'>
                  {formatUsdAmount(discountAmount)}
                </span>
              </div>
            </div>
          )}

          <div className='border-t pt-4'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Payment Method')}
              </span>
              <div className='flex items-center gap-2'>
                {getPaymentIcon(
                  paymentMethod?.type,
                  'h-4 w-4',
                  paymentMethod?.icon,
                  paymentMethod?.name
                )}
                <span className='font-medium'>{paymentMethod?.name}</span>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
          <AlertDialogCancel disabled={processing}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={processing}>
            {processing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Confirm Payment')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
