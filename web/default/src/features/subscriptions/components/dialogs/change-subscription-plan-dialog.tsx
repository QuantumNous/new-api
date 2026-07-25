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
import { CreditCard, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_CURRENCY_CONFIG } from '@/stores/system-config-store'
import { formatQuota } from '@/lib/format'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Dialog } from '@/components/dialog'
import { formatDuration, formatResetPeriod } from '../../lib'
import type {
  ChangePlanPaymentMode,
  PlanRecord,
  SubscriptionContract,
} from '../../types'

interface ChangeSubscriptionPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanRecord | null
  contract?: SubscriptionContract | null
  allowedPaymentModes: ChangePlanPaymentMode[]
  defaultPaymentMode: ChangePlanPaymentMode
  userQuota?: number
  isLoading?: boolean
  onConfirm: (paymentMode: ChangePlanPaymentMode) => void
}

function getBalanceOnePeriodCost(
  priceAmount: number,
  quotaPerUnit: number
): number {
  return Math.max(0, Math.ceil(priceAmount * quotaPerUnit))
}

export function ChangeSubscriptionPlanDialog(
  props: ChangeSubscriptionPlanDialogProps
) {
  const { t } = useTranslation()
  const { currency } = useSystemConfig()
  const [paymentMode, setPaymentMode] = useState<ChangePlanPaymentMode>(
    props.defaultPaymentMode
  )

  const plan = props.plan?.plan
  const quotaPerUnit =
    currency?.quotaPerUnit && currency.quotaPerUnit > 0
      ? currency.quotaPerUnit
      : DEFAULT_CURRENCY_CONFIG.quotaPerUnit
  const balanceCost = getBalanceOnePeriodCost(
    Number(plan?.price_amount || 0),
    quotaPerUnit
  )
  const userQuota = Math.max(0, Number(props.userQuota || 0))
  const balanceAllowed =
    props.allowedPaymentModes.includes('balance_one_period')
  const stripeAllowed = props.allowedPaymentModes.includes('stripe_recurring')
  const insufficientBalance =
    paymentMode === 'balance_one_period' && userQuota < balanceCost

  const paymentModeLabel = useMemo(() => {
    if (paymentMode === 'stripe_recurring') return t('Stripe recurring')
    return t('Balance one period')
  }, [paymentMode, t])

  if (!plan) return null

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Change subscription plan')}
      description={t('Review the plan change before continuing.')}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-lg'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={props.isLoading}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => props.onConfirm(paymentMode)}
            disabled={
              props.isLoading ||
              props.allowedPaymentModes.length === 0 ||
              insufficientBalance
            }
          >
            {props.isLoading ? t('Processing...') : t('Confirm change')}
          </Button>
        </>
      }
    >
      <div className='bg-muted/50 space-y-2.5 rounded-lg border p-3'>
        <div className='flex justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>{t('Plan Name')}</span>
          <span className='min-w-0 truncate font-medium'>{plan.title}</span>
        </div>
        <div className='flex justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>{t('Validity Period')}</span>
          <span>{formatDuration(plan, t)}</span>
        </div>
        {formatResetPeriod(plan, t) !== t('No Reset') && (
          <div className='flex justify-between gap-3 text-sm'>
            <span className='text-muted-foreground'>{t('Reset Period')}</span>
            <span>{formatResetPeriod(plan, t)}</span>
          </div>
        )}
        <div className='flex justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>{t('Total Quota')}</span>
          <span>
            {plan.total_amount > 0
              ? formatQuota(plan.total_amount)
              : t('Unlimited')}
          </span>
        </div>
        <Separator />
        <div className='flex justify-between gap-3'>
          <span className='text-sm font-medium'>{t('Amount Due')}</span>
          <span className='text-primary text-lg font-bold'>
            ${Number(plan.price_amount || 0).toFixed(2)}
          </span>
        </div>
      </div>

      <RadioGroup
        value={paymentMode}
        onValueChange={(value) =>
          setPaymentMode(value as ChangePlanPaymentMode)
        }
      >
        <Label
          className='flex items-start gap-3 rounded-md border p-3 has-data-disabled:opacity-50'
          data-disabled={!stripeAllowed || undefined}
        >
          <RadioGroupItem value='stripe_recurring' disabled={!stripeAllowed} />
          <CreditCard className='text-muted-foreground mt-0.5 h-4 w-4' />
          <span className='min-w-0 space-y-1'>
            <span className='block text-sm font-medium'>
              {t('Stripe recurring')}
            </span>
            <span className='text-muted-foreground block text-xs'>
              {t(
                'Renews automatically each period. You can cancel or resume auto-renewal from the wallet.'
              )}
            </span>
          </span>
        </Label>
        <Label
          className='flex items-start gap-3 rounded-md border p-3 has-data-disabled:opacity-50'
          data-disabled={!balanceAllowed || undefined}
        >
          <RadioGroupItem
            value='balance_one_period'
            disabled={!balanceAllowed}
          />
          <WalletCards className='text-muted-foreground mt-0.5 h-4 w-4' />
          <span className='min-w-0 space-y-1'>
            <span className='block text-sm font-medium'>
              {t('Balance one period')}
            </span>
            <span className='text-muted-foreground block text-xs'>
              {t(
                'Uses wallet balance for one period with no automatic renewal.'
              )}
            </span>
            <span className='text-muted-foreground block text-xs'>
              {t('Required')}: {formatQuota(balanceCost)} / {t('Available')}:{' '}
              {formatQuota(userQuota)}
            </span>
          </span>
        </Label>
      </RadioGroup>

      {insufficientBalance && (
        <Alert variant='destructive'>
          <AlertDescription>{t('Insufficient balance')}</AlertDescription>
        </Alert>
      )}

      {props.contract?.pending_plan_id ? (
        <Alert>
          <AlertDescription>
            {t('A downgrade is already scheduled for the next period.')}
          </AlertDescription>
        </Alert>
      ) : null}

      <p className='text-muted-foreground text-xs'>
        {t('Selected payment mode')}: {paymentModeLabel}
      </p>
    </Dialog>
  )
}
