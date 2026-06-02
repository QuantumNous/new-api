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
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks'
import { CreditCard, KeyRound, Loader2, Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  getSelfAffiliateCdkInfo,
  quoteSelfAffiliateCdk,
  requestSelfAffiliateCdkEpay,
} from '@/features/affiliate-commissions/api'
import type { AffiliateCdkPayMethod } from '@/features/affiliate-commissions/types'
import { isApiSuccess } from '@/features/wallet/api'
import {
  formatLocalPaymentAmount,
  formatUsdCreditAmount,
  getPaymentIcon,
  submitPaymentForm,
} from '@/features/wallet/lib'

function formatBpsPercent(bps: number) {
  return `${(bps / 100).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`
}

export function AffiliateCdkPurchaseCard() {
  const { t } = useTranslation()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [quantityInput, setQuantityInput] = useState('1')
  const [selectedMethod, setSelectedMethod] =
    useState<AffiliateCdkPayMethod | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const infoQuery = useQuery({
    queryKey: ['self-affiliate-cdk-info'],
    queryFn: getSelfAffiliateCdkInfo,
  })

  const info = infoQuery.data?.success ? infoQuery.data.data : undefined
  const amountOptions = useMemo(
    () => [...(info?.amount_options || [])].sort((a, b) => a - b),
    [info?.amount_options]
  )
  const payMethods = info?.pay_methods || []

  useEffect(() => {
    if (selectedAmount == null && amountOptions.length > 0) {
      setSelectedAmount(amountOptions[0])
    }
  }, [amountOptions, selectedAmount])

  useEffect(() => {
    if (!selectedMethod && payMethods.length > 0) {
      setSelectedMethod(payMethods[0])
    }
  }, [payMethods, selectedMethod])

  const quantity = Number(quantityInput)
  const maxQuantity = info?.max_quantity || 100
  const quantityValid =
    Number.isInteger(quantity) && quantity >= 1 && quantity <= maxQuantity
  const totalFaceValue =
    selectedAmount && quantityValid ? selectedAmount * quantity : 0
  const minTopup = info?.min_topup || 0
  const totalMeetsMin = !minTopup || totalFaceValue >= minTopup
  const canPurchase =
    !!info?.discount_configured &&
    !!info?.enable_epay &&
    amountOptions.length > 0 &&
    !!selectedAmount
  const quoteEnabled = canPurchase && quantityValid && totalMeetsMin
  const debouncedAmount = useDebounce(selectedAmount || 0, 350)
  const debouncedQuantity = useDebounce(quantityValid ? quantity : 0, 350)

  const quoteQuery = useQuery({
    queryKey: ['self-affiliate-cdk-quote', debouncedAmount, debouncedQuantity],
    queryFn: () =>
      quoteSelfAffiliateCdk({
        amount: debouncedAmount,
        quantity: debouncedQuantity,
      }),
    enabled: quoteEnabled && debouncedAmount > 0 && debouncedQuantity > 0,
  })

  const quote =
    quoteQuery.data?.success &&
    quoteQuery.data.data?.amount === selectedAmount &&
    quoteQuery.data.data?.quantity === quantity
      ? quoteQuery.data.data
      : undefined
  const quoteMessage =
    quoteQuery.data && !quoteQuery.data.success ? quoteQuery.data.message : ''

  const payMutation = useMutation({
    mutationFn: requestSelfAffiliateCdkEpay,
    onSuccess: async (res) => {
      if (!isApiSuccess(res)) {
        toast.error(res.message || t('Payment request failed'))
        return
      }
      if (!res.url || !res.data) {
        toast.error(t('Payment request failed'))
        return
      }
      submitPaymentForm(res.url, res.data)
      toast.success(t('Redirecting to payment page...'))
      setConfirmOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Payment request failed'))
    },
  })

  const disabledMessage = (() => {
    if (infoQuery.isLoading) return ''
    if (!infoQuery.data?.success) {
      return infoQuery.data?.message || t('Unable to load affiliate CDK info')
    }
    if (!info?.discount_configured) {
      return t(
        'Affiliate CDK purchase is disabled. Contact an administrator to configure the affiliate CDK discount.'
      )
    }
    if (!info.enable_epay) {
      return t('Affiliate CDK purchase requires ePay to be enabled.')
    }
    if (amountOptions.length === 0) {
      return t('No wallet amount options are configured.')
    }
    return ''
  })()

  const quantityError = (() => {
    if (quantityInput.trim() === '') return t('Enter quantity')
    if (!quantityValid) {
      return t('Quantity must be between 1 and {{max}}', {
        max: maxQuantity,
      })
    }
    if (!totalMeetsMin) {
      return t('Total CDK face value must be at least {{amount}}', {
        amount: formatUsdCreditAmount(minTopup),
      })
    }
    return ''
  })()

  const openConfirm = () => {
    if (!selectedAmount || !quantityValid || !quote) {
      toast.error(
        quoteMessage || quantityError || t('Choose a valid CDK order')
      )
      return
    }
    if (!selectedMethod) {
      toast.error(t('Select a payment method'))
      return
    }
    setConfirmOpen(true)
  }

  const confirmPay = () => {
    if (!selectedAmount || !quote || !selectedMethod) return
    payMutation.mutate({
      amount: selectedAmount,
      quantity,
      payment_method: selectedMethod.type,
    })
  }

  return (
    <>
      <TitledCard
        title={t('Buy CDKs')}
        description={t(
          'Choose a face value and quantity. Codes are generated after payment succeeds.'
        )}
        icon={<Ticket className='h-4 w-4' />}
        contentClassName='space-y-4'
      >
        {infoQuery.isLoading ? (
          <div className='space-y-4'>
            <Skeleton className='h-20 w-full rounded-lg' />
            <Skeleton className='h-32 w-full rounded-lg' />
            <Skeleton className='h-40 w-full rounded-lg' />
          </div>
        ) : disabledMessage ? (
          <div className='bg-muted/30 rounded-lg border p-4'>
            <div className='flex items-start gap-3'>
              <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
                <KeyRound className='text-muted-foreground size-4' />
              </div>
              <div className='min-w-0'>
                <div className='text-sm font-semibold'>
                  {t('CDK purchase unavailable')}
                </div>
                <div className='text-muted-foreground mt-1 text-sm'>
                  {disabledMessage}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='space-y-2.5'>
              <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                {t('CDK face value')}
              </Label>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2'>
                {amountOptions.map((amount) => (
                  <Button
                    key={amount}
                    variant='outline'
                    className={cn(
                      'h-12 justify-start rounded-lg px-3 text-left text-sm font-semibold',
                      selectedAmount === amount &&
                        'border-foreground bg-foreground/5'
                    )}
                    onClick={() => setSelectedAmount(amount)}
                  >
                    {formatUsdCreditAmount(amount)}
                  </Button>
                ))}
              </div>
            </div>

            <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.65fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(150px,0.65fr)]'>
              <div className='space-y-2'>
                <Label htmlFor='affiliate-cdk-quantity'>{t('Quantity')}</Label>
                <Input
                  id='affiliate-cdk-quantity'
                  type='number'
                  inputMode='numeric'
                  min={1}
                  max={maxQuantity}
                  step={1}
                  value={quantityInput}
                  onChange={(event) => setQuantityInput(event.target.value)}
                />
                {quantityError ? (
                  <p className='text-destructive text-xs'>{quantityError}</p>
                ) : null}
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground text-xs font-medium'>
                  {t('Order face value')}
                </div>
                <div className='mt-1 text-base font-semibold tabular-nums'>
                  {formatUsdCreditAmount(totalFaceValue)}
                </div>
                <div className='text-muted-foreground mt-1 text-xs'>
                  {t('Maximum {{count}} codes per order', {
                    count: maxQuantity,
                  })}
                </div>
              </div>
            </div>

            <div className='space-y-2.5'>
              <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                {t('ePay method')}
              </Label>
              <div className='grid grid-cols-2 gap-2'>
                {payMethods.map((method) => (
                  <Button
                    key={method.type}
                    variant='outline'
                    className={cn(
                      'h-10 min-w-0 justify-start gap-2 rounded-lg px-3',
                      selectedMethod?.type === method.type &&
                        'border-foreground bg-foreground/5'
                    )}
                    disabled={payMutation.isPending}
                    onClick={() => setSelectedMethod(method)}
                  >
                    {getPaymentIcon(
                      method.type,
                      'h-4 w-4',
                      method.icon,
                      method.name
                    )}
                    <span className='truncate'>{method.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className='rounded-lg border p-3'>
              <div className='mb-3 flex items-center justify-between gap-2'>
                <div>
                  <div className='text-sm font-semibold'>
                    {t('Price preview')}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {t('Affiliate purchase rate: {{rate}} of wallet price', {
                      rate: formatBpsPercent(
                        info?.cdk_purchase_discount_bps || 0
                      ),
                    })}
                  </div>
                </div>
                {quoteQuery.isFetching ? (
                  <Loader2 className='text-muted-foreground size-4 animate-spin' />
                ) : null}
              </div>

              <div className='space-y-2 text-sm'>
                {[
                  {
                    label: t('CDK face value'),
                    value: quote ? formatQuota(quote.code_quota) : '-',
                  },
                  {
                    label: t('Unit CDK price'),
                    value: quote
                      ? formatLocalPaymentAmount(quote.unit_pay_amount)
                      : '-',
                  },
                  {
                    label: t('Codes to generate'),
                    value: quote ? String(quote.quantity) : '-',
                  },
                  {
                    label: t('Amount to pay'),
                    value: quote
                      ? formatLocalPaymentAmount(quote.pay_amount)
                      : '-',
                    strong: true,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className='flex items-center justify-between gap-3'
                  >
                    <span className='text-muted-foreground'>{item.label}</span>
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        item.strong && 'text-base font-semibold'
                      )}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {quoteMessage ? (
                <p className='text-destructive mt-3 text-xs'>{quoteMessage}</p>
              ) : null}

              <Button
                className='mt-4 w-full gap-2'
                disabled={
                  !quote ||
                  !selectedMethod ||
                  payMutation.isPending ||
                  quoteQuery.isFetching
                }
                onClick={openConfirm}
              >
                <CreditCard className='h-4 w-4' />
                {t('Pay and generate CDKs')}
              </Button>
            </div>
          </div>
        )}
      </TitledCard>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Confirm CDK order')}</DialogTitle>
            <DialogDescription>
              {t(
                'After payment succeeds, the generated CDKs will appear in your list.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-2 rounded-lg border p-3 text-sm'>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-muted-foreground'>
                {t('CDK face value')}
              </span>
              <span className='font-medium tabular-nums'>
                {selectedAmount ? formatUsdCreditAmount(selectedAmount) : '-'} x{' '}
                {quantityValid ? quantity : '-'}
              </span>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-muted-foreground'>
                {t('Unit CDK price')}
              </span>
              <span className='font-medium tabular-nums'>
                {quote ? formatLocalPaymentAmount(quote.unit_pay_amount) : '-'}
              </span>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-muted-foreground'>
                {t('Codes to generate')}
              </span>
              <span className='font-medium tabular-nums'>
                {quote ? String(quote.quantity) : '-'}
              </span>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-muted-foreground'>
                {t('Amount to pay')}
              </span>
              <span className='text-base font-semibold tabular-nums'>
                {quote ? formatLocalPaymentAmount(quote.pay_amount) : '-'}
              </span>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-muted-foreground'>
                {t('Payment Method')}
              </span>
              <span className='font-medium'>{selectedMethod?.name || '-'}</span>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant='outline' type='button' />}>
              {t('Cancel')}
            </DialogClose>
            <Button onClick={confirmPay} disabled={payMutation.isPending}>
              {payMutation.isPending ? t('Paying...') : t('Confirm payment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
