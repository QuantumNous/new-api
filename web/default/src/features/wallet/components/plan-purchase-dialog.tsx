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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  FlexiblePaymentChoice,
  PlanRecord,
  SubscriptionPaymentAvailability,
  SubscriptionPaymentQuote,
  SubscriptionPaymentQuotes,
} from '@/features/subscriptions/types'
import {
  getMatchingPaymentQuote,
  requiresLocalCurrencyQuote,
  requiresSignedCheckoutQuote,
} from '../lib/subscription-plan-lifecycle'

type PlanPurchaseDialogProps = {
  open: boolean
  plan: PlanRecord | null
  currentPlanId: number
  paymentAvailability: SubscriptionPaymentAvailability | undefined
  paymentQuotes?: SubscriptionPaymentQuotes
  selectedPaymentChoice?: FlexiblePaymentChoice
  months?: number
  isLoading?: boolean
  projectedStart?: number
  projectedEnd?: number
  projectedRemainingDays?: number
  refundableNotStartedValue?: number
  isQuoteLoading?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (choice: FlexiblePaymentChoice, months: number) => void
  onQuoteRequest?: (choice: FlexiblePaymentChoice, months: number) => void
}

type PlanPurchaseDialogContentProps = Omit<PlanPurchaseDialogProps, 'open'> & {
  plan: PlanRecord
}

const PAYMENT_CHOICES: FlexiblePaymentChoice[] = [
  'stripe_recurring',
  'alipay',
  'pix',
  'upi',
  'balance',
]
const MONTH_SHORTCUTS = [1, 3, 12]

export function normalizePurchaseMonths(value: number | string): number {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return 1
  return Math.min(12, Math.max(1, parsed))
}

function getPaymentChoiceLabel(
  choice: FlexiblePaymentChoice,
  t: (key: string) => string
): string {
  switch (choice) {
    case 'stripe_recurring':
      return t('Stripe automatic subscription')
    case 'alipay':
      return t('Alipay')
    case 'pix':
      return t('Pix')
    case 'upi':
      return t('UPI')
    case 'balance':
      return t('Flatkey balance')
  }
}

function getDisabledReason(
  availability: SubscriptionPaymentAvailability | undefined,
  choice: FlexiblePaymentChoice
): string {
  const item = availability?.[choice]
  if (item?.available === false)
    return item.disabled_reason || item.reason || ''
  return ''
}

function formatPlanPrice(amount: number, currency = 'USD'): string {
  if (currency === 'BRL') {
    return Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  if (currency === 'INR') {
    return Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  return `$${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`
}

function getQuoteReadinessReason(
  choice: FlexiblePaymentChoice,
  quote: SubscriptionPaymentQuote | undefined,
  isQuoteLoading: boolean,
  t: (key: string) => string
): string {
  if (!requiresSignedCheckoutQuote(choice) || quote) return ''
  if (requiresLocalCurrencyQuote(choice)) {
    if (isQuoteLoading) return t('Loading local currency quote...')
    return t('Local currency quote is unavailable.')
  }
  return t('Payment choice is unavailable')
}

function getMonthLabel(
  count: number,
  t: (key: string, values?: { count: number }) => string
): string {
  if (count === 1) return t('{{count}} month', { count })
  return t('{{count}} months', { count })
}

export function PlanPurchaseDialogContent(props: PlanPurchaseDialogContentProps) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<FlexiblePaymentChoice>(
    props.selectedPaymentChoice ?? 'stripe_recurring'
  )
  const [months, setMonths] = useState(props.months ?? 1)
  const selectedChoice = props.selectedPaymentChoice ?? choice
  const selectedMonths = normalizePurchaseMonths(props.months ?? months)
  const showMonths = selectedChoice !== 'stripe_recurring'
  const setPurchaseMonths = (value: number | string) => {
    const nextMonths = normalizePurchaseMonths(value)
    setMonths(nextMonths)
    props.onQuoteRequest?.(selectedChoice, nextMonths)
  }
  const selectedQuote = getMatchingPaymentQuote(
    selectedChoice,
    props.paymentQuotes,
    selectedMonths
  )

  const totalPrice = useMemo(() => {
    if (selectedQuote) return selectedQuote.total
    const unitPrice = Number(props.plan?.plan.price_amount || 0)
    return showMonths ? unitPrice * selectedMonths : unitPrice
  }, [props.plan?.plan.price_amount, selectedQuote, selectedMonths, showMonths])
  const selectedDisabledReason = getDisabledReason(
    props.paymentAvailability,
    selectedChoice
  )
  const selectedQuoteReadinessReason = getQuoteReadinessReason(
    selectedChoice,
    selectedQuote,
    props.isQuoteLoading === true,
    t
  )
  const totalPriceLabel =
    requiresLocalCurrencyQuote(selectedChoice) && selectedQuoteReadinessReason
    ? '—'
    : formatPlanPrice(totalPrice, selectedQuote?.currency)

  return (
    <>
      <div className='space-y-4'>
        <div className='grid gap-2' role='radiogroup'>
          {PAYMENT_CHOICES.map((paymentChoice) => {
            const disabledReason = getDisabledReason(
              props.paymentAvailability,
              paymentChoice
            )
            const disabled = disabledReason.length > 0
            return (
              <label
                key={paymentChoice}
                className='border-input has-[:focus-visible]:ring-ring/50 flex min-h-11 items-start gap-3 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:ring-3'
              >
                <input
                  type='radio'
                  name='wallet-payment-choice'
                  value={paymentChoice}
                  checked={selectedChoice === paymentChoice}
                  disabled={disabled}
                  onChange={() => {
                    setChoice(paymentChoice)
                    props.onQuoteRequest?.(paymentChoice, selectedMonths)
                  }}
                  className='mt-1'
                />
                <span className='min-w-0'>
                  <span className='block font-medium'>
                    {getPaymentChoiceLabel(paymentChoice, t)}
                  </span>
                  {disabledReason ? (
                    <span className='text-muted-foreground block text-xs'>
                      {disabledReason}
                    </span>
                  ) : null}
                </span>
              </label>
            )
          })}
        </div>

        {showMonths ? (
          <label className='grid gap-1.5 text-sm'>
            <span className='font-medium'>{t('Months')}</span>
            <Input
              type='number'
              min={1}
              max={12}
              step={1}
              value={selectedMonths}
              onChange={(event) => {
                setPurchaseMonths(event.target.value)
              }}
              aria-label={t('Months')}
            />
            <span className='flex flex-wrap gap-2'>
              {MONTH_SHORTCUTS.map((month) => (
                <Button
                  key={month}
                  type='button'
                  variant={selectedMonths === month ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    setPurchaseMonths(month)
                  }}
                >
                  {getMonthLabel(month, t)}
                </Button>
              ))}
            </span>
          </label>
        ) : null}

        <div className='rounded-lg border p-3 text-sm'>
          <div className='flex items-center justify-between gap-3'>
            <span className='text-muted-foreground'>{t('Total price')}</span>
            <span className='font-semibold tabular-nums'>
              {totalPriceLabel}
            </span>
          </div>
          <div className='mt-2 grid gap-1 text-xs'>
            {selectedQuote ? (
              <div className='flex items-center justify-between gap-3'>
                <span className='text-muted-foreground'>{t('Unit price')}</span>
                <span className='font-medium tabular-nums'>
                  {formatPlanPrice(
                    selectedQuote.unit_price,
                    selectedQuote.currency
                  )}
                </span>
              </div>
            ) : null}
            {selectedQuoteReadinessReason ? (
              <div className='text-muted-foreground'>
                {selectedQuoteReadinessReason}
              </div>
            ) : null}
            {props.projectedStart ? (
              <div>
                {t('Start date')}: {formatTimestampToDate(props.projectedStart)}
              </div>
            ) : null}
            {props.projectedEnd ? (
              <div>
                {t('End date')}: {formatTimestampToDate(props.projectedEnd)}
              </div>
            ) : null}
            {typeof props.projectedRemainingDays === 'number' ? (
              <div>
                {t('Remaining days')}:{' '}
                {t('{{count}} days', {
                  count: Math.max(0, props.projectedRemainingDays),
                })}
              </div>
            ) : null}
          </div>
        </div>

        {props.currentPlanId > 0 ? (
          <Alert>
            <AlertDescription>
              {t(
                'Replacement charges the full target price. No prorating or credit is applied.'
              )}{' '}
              {t(
                'The active started term is not refunded. Monthly and Image + video usage reset; 5-hour and 7-day rolling usage is retained and re-evaluated.'
              )}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          className='min-h-11'
          disabled={
            props.isLoading ||
            selectedDisabledReason.length > 0 ||
            selectedQuoteReadinessReason.length > 0
          }
          onClick={() =>
            props.onConfirm(
              selectedChoice,
              normalizePurchaseMonths(selectedMonths)
            )
          }
        >
          {t('Continue')}
        </Button>
        <Button
          variant='outline'
          className='min-h-11'
          disabled={props.isLoading}
          onClick={() => props.onOpenChange(false)}
        >
          {t('Close')}
        </Button>
      </DialogFooter>
    </>
  )
}

export function PlanPurchaseDialog(props: PlanPurchaseDialogProps) {
  const { t } = useTranslation()

  if (!props.plan) return null

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-xl' showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('Purchase plan')}</DialogTitle>
          <DialogDescription>
            {t('Review the payment choice and term before continuing.')}
          </DialogDescription>
        </DialogHeader>
        <PlanPurchaseDialogContent {...props} plan={props.plan} />
      </DialogContent>
    </Dialog>
  )
}
