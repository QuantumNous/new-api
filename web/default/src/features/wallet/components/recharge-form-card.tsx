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
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  STRIPE_CHECKOUT_CURRENCY_OPTIONS,
  type StripeCheckoutCurrency,
} from '../lib/stripe-currency'
import type { PresetAmount, TopupInfo } from '../types'

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  onStripeTopUp: (preset: PresetAmount) => void
  paymentLoadingAmount?: number | null
  loading?: boolean
  checkoutCurrency?: StripeCheckoutCurrency
  onCheckoutCurrencyChange?: (currency: StripeCheckoutCurrency) => void
  showCurrencySelector?: boolean
}

const CURRENCY_SYMBOLS: Record<StripeCheckoutCurrency, string> = {
  USD: '$',
  INR: '₹',
  BRL: 'R$',
  JPY: '¥',
}

function getConfiguredPresetAmounts(
  presetAmounts: PresetAmount[]
): PresetAmount[] {
  const seen = new Set<number>()
  return presetAmounts.filter((preset) => {
    if (!Number.isFinite(preset.value) || preset.value <= 0) return false
    if (seen.has(preset.value)) return false
    seen.add(preset.value)
    return true
  })
}

export function RechargeFormCard(props: RechargeFormCardProps) {
  const { t } = useTranslation()
  const stripeEnabled =
    props.topupInfo?.enable_stripe_topup ||
    props.topupInfo?.pay_methods?.some((method) => method.type === 'stripe')
  const presets = getConfiguredPresetAmounts(props.presetAmounts)
  const selected =
    presets.find((preset) => preset.value === props.selectedPreset) ||
    presets[0]

  if (props.loading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-5 w-36' />
        <div className='grid grid-cols-3 gap-2 sm:grid-cols-5'>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className='h-12 rounded-lg' />
          ))}
        </div>
        <Skeleton className='h-10 w-full rounded-lg' />
      </div>
    )
  }

  if (!stripeEnabled || presets.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          {stripeEnabled
            ? t('No top-up packages available. Please contact administrator.')
            : t('Stripe top-up is not enabled. Please contact administrator.')}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className='space-y-5'>
      <div>
        <div className='text-sm font-semibold'>{t('Choose an amount')}</div>
        <p className='text-muted-foreground mt-1 text-xs'>
          {t('The amount you pay is added to your balance at face value.')}
        </p>
      </div>

      <div className='grid grid-cols-3 gap-2 sm:grid-cols-5'>
        {presets.map((preset) => {
          const isSelected = selected?.value === preset.value
          return (
            <Button
              key={preset.value}
              type='button'
              variant='outline'
              className={cn(
                'h-12 text-base font-semibold',
                isSelected &&
                  'border-[#5b21b6] bg-[#f0ebfa] text-[#4c1d95] hover:bg-[#e9e0f8] dark:bg-[#5b21b6]/20 dark:text-[#c4b5fd]'
              )}
              onClick={() => props.onSelectPreset(preset)}
            >
              ${formatNumber(preset.value)}
            </Button>
          )
        })}
      </div>

      {props.showCurrencySelector ? (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-muted-foreground mr-1 text-xs'>
            {t('Checkout currency')}
          </span>
          {STRIPE_CHECKOUT_CURRENCY_OPTIONS.map((currency) => (
            <Button
              key={currency}
              type='button'
              size='sm'
              variant={
                currency === (props.checkoutCurrency ?? 'USD')
                  ? 'default'
                  : 'outline'
              }
              onClick={() => props.onCheckoutCurrencyChange?.(currency)}
            >
              {CURRENCY_SYMBOLS[currency]} {currency}
            </Button>
          ))}
        </div>
      ) : null}

      <Button
        className='w-full bg-[#070707] text-white hover:bg-[#4c1d95] dark:bg-white dark:text-black'
        disabled={!selected || !!props.paymentLoadingAmount}
        onClick={() => selected && props.onStripeTopUp(selected)}
      >
        {props.paymentLoadingAmount ? (
          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
        ) : null}
        {selected
          ? t('Top up {{amount}}', {
              amount: `$${formatNumber(selected.value)}`,
            })
          : t('Choose an amount')}
      </Button>
    </div>
  )
}
