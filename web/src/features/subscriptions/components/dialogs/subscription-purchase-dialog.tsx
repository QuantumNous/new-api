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
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarClock,
  Crown,
  Loader2,
  Package,
  WalletCards,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { GroupBadge } from '@/components/group-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatSubscriptionPrice } from '@/features/subscriptions/lib/format'
import type { WechatPayCheckout } from '@/features/wallet/api'
import { MixPayDialog } from '@/features/wallet/components/dialogs/mixpay-dialog'
import { WechatPayDialog } from '@/features/wallet/components/dialogs/wechatpay-dialog'
import { PaymentMethodLabel } from '@/features/wallet/components/payment-method-label'
import { getPaymentIcon } from '@/features/wallet/lib'
import { createMixPayPayment, quoteMixPay } from '@/features/wallet/mixpay'
import { createAntomPayment, quoteAntom } from '@/features/wallet/antom'
import { createWebMoneyPayment, quoteWebMoney } from '@/features/wallet/webmoney'
import type { PaymentMethod } from '@/features/wallet/types'
import { useSystemConfig } from '@/hooks/use-system-config'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { openPaymentWindow } from '@/lib/payment-window'
import { requireServerSuccess } from '@/lib/server-error-message'
import { DEFAULT_CURRENCY_CONFIG } from '@/stores/system-config-store'

import {
  paySubscriptionStripe,
  quoteSubscriptionDirect,
  paySubscriptionDirect,
  paySubscriptionCreem,
  paySubscriptionEpay,
  paySubscriptionWaffoPancake,
  paySubscriptionBalance,
} from '../../api'
import { formatDuration, formatResetPeriod } from '../../lib'
import type { PlanRecord } from '../../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanRecord | null
  enableAntom?: boolean
  enableWebMoney?: boolean
  enableMixPay?: boolean
  enableAlipay?: boolean
  enableWechatPay?: boolean
  enableStripe?: boolean
  enableCreem?: boolean
  enableWaffoPancake?: boolean
  enableOnlineTopUp?: boolean
  epayMethods?: PaymentMethod[]
  purchaseLimit?: number
  purchaseCount?: number
  userQuota?: number
  onPurchaseSuccess?: () => void | Promise<void>
}

export function SubscriptionPurchaseDialog(props: Props) {
  const { t } = useTranslation()
  const { currency } = useSystemConfig()
  const [mixpayTradeNo, setMixpayTradeNo] = useState<string | null>(null)
  const [checkoutProvider, setCheckoutProvider] = useState<'mixpay' | 'antom' | 'webmoney'>('mixpay')
  const mixpayKey = useRef<{ plan: number; provider: string; key: string } | null>(null)
  const [paying, setPaying] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')

  const [wechatCheckout, setWechatCheckout] =
    useState<WechatPayCheckout | null>(null)
  const isDirect = ['mixpay', 'antom', 'webmoney', 'alipay_direct', 'wechatpay_native'].includes(
    selectedPaymentMethod
  )
  const directQuote = useQuery({
    queryKey: [
      'subscription-direct-quote',
      props.plan?.plan?.id,
      selectedPaymentMethod,
    ],
    enabled: props.open && !!props.plan?.plan?.id && isDirect,
    queryFn: async () => {
      const planID = props.plan?.plan?.id || 0
      if (selectedPaymentMethod === 'antom') return (await quoteAntom(0, planID)).data
      if (selectedPaymentMethod === 'webmoney') return (await quoteWebMoney(0, planID)).data
      if (selectedPaymentMethod === 'mixpay') return requireServerSuccess(await quoteMixPay(0, planID)).data
      return requireServerSuccess(await quoteSubscriptionDirect(planID, selectedPaymentMethod)).data
    },
    staleTime: 0,
    retry: false,
  })

  useEffect(() => {
    if (!props.open) {
      setSelectedPaymentMethod('')
      return
    }
    if (props.plan?.plan?.allow_balance_pay !== false) {
      setSelectedPaymentMethod('balance')
    } else if (props.enableAntom) {
      setSelectedPaymentMethod('antom')
    } else if (props.enableWebMoney) {
      setSelectedPaymentMethod('webmoney')
    } else if (props.enableMixPay) {
      setSelectedPaymentMethod('mixpay')
    } else if (props.enableAlipay) {
      setSelectedPaymentMethod('alipay_direct')
    } else if (props.enableWechatPay) {
      setSelectedPaymentMethod('wechatpay_native')
    } else if (props.enableOnlineTopUp && props.epayMethods?.[0]) {
      setSelectedPaymentMethod(`epay:${props.epayMethods[0].type}`)
    } else if (props.enableStripe && props.plan?.plan?.stripe_price_id) {
      setSelectedPaymentMethod('stripe')
    } else if (props.enableCreem && props.plan?.plan?.creem_product_id) {
      setSelectedPaymentMethod('creem')
    } else if (
      props.enableWaffoPancake &&
      props.plan?.plan?.waffo_pancake_product_id
    ) {
      setSelectedPaymentMethod('waffo_pancake')
    }
  }, [
    props.open,
    props.epayMethods,
    props.enableOnlineTopUp,
    props.enableAntom,
    props.enableWebMoney,
    props.enableMixPay,
    props.enableAlipay,
    props.enableWechatPay,
    props.enableStripe,
    props.enableCreem,
    props.enableWaffoPancake,
    props.plan,
  ])

  const plan = props.plan?.plan
  if (!plan) return null

  const hasStripe = props.enableStripe && !!plan.stripe_price_id
  const hasCreem = props.enableCreem && !!plan.creem_product_id
  const hasWaffoPancake =
    props.enableWaffoPancake && !!plan.waffo_pancake_product_id
  const hasEpay =
    props.enableOnlineTopUp && (props.epayMethods || []).length > 0
  const hasAnyPayment =
    props.enableAntom ||
    props.enableWebMoney ||
    props.enableMixPay ||
    props.enableAlipay ||
    props.enableWechatPay ||
    hasStripe ||
    hasCreem ||
    hasWaffoPancake ||
    hasEpay
  const selectedEpayMethod = selectedPaymentMethod.startsWith('epay:')
    ? selectedPaymentMethod.slice(5)
    : ''
  const totalAmount = Number(plan.total_amount || 0)
  let price = formatSubscriptionPrice(plan)
  if (isDirect) {
    let paymentCurrency = 'CNY'
    if (['mixpay', 'antom'].includes(selectedPaymentMethod)) paymentCurrency = 'USD'
    if (selectedPaymentMethod === 'webmoney') paymentCurrency = 'WMT'
    price = directQuote.data
      ? `${paymentCurrency} ${directQuote.data}`
      : '—'
  }
  const quotaPerUnit =
    currency?.quotaPerUnit && currency.quotaPerUnit > 0
      ? currency.quotaPerUnit
      : DEFAULT_CURRENCY_CONFIG.quotaPerUnit
  const balanceCost = Math.max(
    0,
    Math.ceil(
      (Number(plan.price_amount || 0) * quotaPerUnit) /
        (plan.currency === 'CNY' ? currency.usdExchangeRate : 1)
    )
  )
  const userQuota = Math.max(0, Number(props.userQuota || 0))
  const allowBalancePay = plan.allow_balance_pay !== false
  const insufficientBalance = userQuota < balanceCost
  const limitReached =
    (props.purchaseLimit || 0) > 0 &&
    (props.purchaseCount || 0) >= (props.purchaseLimit || 0)

  const handlePaymentContinue = () => {
    if (limitReached || paying || !selectedPaymentMethod) return
    switch (selectedPaymentMethod) {
      case 'antom':
      case 'webmoney':
      case 'mixpay':
      case 'alipay_direct':
      case 'wechatpay_native':
        void handlePayDirect()
        break
      case 'balance':
        void handlePayBalance()
        break
      case 'stripe':
        void handlePayStripe()
        break
      case 'creem':
        void handlePayCreem()
        break
      case 'waffo_pancake':
        void handlePayWaffoPancake()
        break
      default:
        if (selectedPaymentMethod.startsWith('epay:')) {
          void handlePayEpay()
        }
    }
  }

  const handlePayDirect = async () => {
    if (!directQuote.data || directQuote.isFetching || directQuote.isError) {
      return
    }
    setPaying(true)
    try {
      if (selectedPaymentMethod === 'mixpay' || selectedPaymentMethod === 'antom' || selectedPaymentMethod === 'webmoney') {
        if (!mixpayKey.current || mixpayKey.current.plan !== plan.id || mixpayKey.current.provider !== selectedPaymentMethod) {
          mixpayKey.current = { plan: plan.id, provider: selectedPaymentMethod, key: crypto.randomUUID() }
        }
        let createPayment = createMixPayPayment
        if (selectedPaymentMethod === 'antom') createPayment = createAntomPayment
        if (selectedPaymentMethod === 'webmoney') createPayment = createWebMoneyPayment
        const checkout = await createPayment(
          0,
          directQuote.data,
          mixpayKey.current.key,
          plan.id
        )
        setCheckoutProvider(selectedPaymentMethod)
        setMixpayTradeNo(checkout.trade_no)
        mixpayKey.current = null
        return
      }
      const provider =
        selectedPaymentMethod === 'alipay_direct' ? 'alipay' : 'wechatpay'
      const data = requireServerSuccess(
        await paySubscriptionDirect(provider, {
          plan_id: plan.id,
          expected_amount: directQuote.data,
          mobile: window.matchMedia('(max-width: 640px)').matches,
        })
      ).data
      if (provider === 'alipay' && data?.pay_link) {
        try {
          sessionStorage.setItem('alipay-pending-order', data.trade_no)
        } catch {
          /* Optional return tracking. */
        }
        openPaymentWindow(data.pay_link)
      } else if (data?.code_url) {
        setWechatCheckout({ ...data, code_url: data.code_url })
      } else {
        toast.error(t('Payment request failed'))
      }
    } catch (error) {
      handleServerError(error, t('Payment request failed'))
    } finally {
      setPaying(false)
    }
  }

  const handlePayStripe = async () => {
    setPaying(true)
    try {
      const res = await paySubscriptionStripe({ plan_id: plan.id })
      if (res.message === 'success' && res.data?.pay_link) {
        if (openPaymentWindow(res.data.pay_link)) {
          toast.success(t('Payment page opened'))
        }
        props.onOpenChange(false)
      } else {
        handleServerError(res, t('Payment request failed'))
      }
    } catch (error) {
      handleServerError(error, t('Payment request failed'))
    } finally {
      setPaying(false)
    }
  }

  const handlePayCreem = async () => {
    setPaying(true)
    try {
      const res = await paySubscriptionCreem({ plan_id: plan.id })
      if (res.message === 'success' && res.data?.checkout_url) {
        if (openPaymentWindow(res.data.checkout_url)) {
          toast.success(t('Payment page opened'))
        }
        props.onOpenChange(false)
      } else {
        handleServerError(res, t('Payment request failed'))
      }
    } catch (error) {
      handleServerError(error, t('Payment request failed'))
    } finally {
      setPaying(false)
    }
  }

  const handlePayWaffoPancake = async () => {
    setPaying(true)
    try {
      const res = await paySubscriptionWaffoPancake({ plan_id: plan.id })
      if (res.message === 'success' && res.data?.checkout_url) {
        if (openPaymentWindow(res.data.checkout_url)) {
          toast.success(t('Redirecting to payment page...'))
        }
      } else {
        handleServerError(res, t('Payment request failed'))
      }
    } catch (error) {
      handleServerError(error, t('Payment request failed'))
    } finally {
      setPaying(false)
    }
  }

  const handlePayEpay = async () => {
    if (!selectedEpayMethod) {
      toast.error(t('Please select a payment method'))
      return
    }
    setPaying(true)
    try {
      const res = await paySubscriptionEpay({
        plan_id: plan.id,
        payment_method: selectedEpayMethod,
      })
      if (res.message === 'success' && res.url) {
        if (openPaymentWindow(res.url, res.data || {})) {
          toast.success(t('Payment initiated'))
        }
        props.onOpenChange(false)
      } else {
        handleServerError(res, t('Payment request failed'))
      }
    } catch (error) {
      handleServerError(error, t('Payment request failed'))
    } finally {
      setPaying(false)
    }
  }

  const handlePayBalance = async () => {
    if (!allowBalancePay) {
      toast.error(t('This plan does not allow balance redemption'))
      return
    }
    setPaying(true)
    try {
      const res = await paySubscriptionBalance({ plan_id: plan.id })
      if (res.success) {
        toast.success(t('Subscription purchased successfully'))
        void props.onPurchaseSuccess?.()
        props.onOpenChange(false)
      } else {
        handleServerError(res, t('Payment request failed'))
      }
    } catch (error) {
      handleServerError(error, t('Payment request failed'))
    } finally {
      setPaying(false)
    }
  }

  return (
    <>
      <MixPayDialog
        provider={checkoutProvider}
        tradeNo={mixpayTradeNo}
        onClose={() => setMixpayTradeNo(null)}
        onPaid={() => {
          setMixpayTradeNo(null)
          props.onOpenChange(false)
          void props.onPurchaseSuccess?.()
        }}
      />
      <WechatPayDialog
        checkout={wechatCheckout}
        description={t(
          'Scan with WeChat to pay. Your subscription activates after payment is verified.'
        )}
        onClose={() => setWechatCheckout(null)}
        onPaid={() => {
          setWechatCheckout(null)
          toast.success(t('Subscription purchased successfully'))
          void props.onPurchaseSuccess?.()
          props.onOpenChange(false)
        }}
      />
      <Dialog
        open={props.open && !wechatCheckout && !mixpayTradeNo}
        onOpenChange={props.onOpenChange}
        title={
          <>
            <Crown className='h-5 w-5' />
            {t('Purchase Subscription')}
          </>
        }
        contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-xl'
        titleClassName='flex items-center gap-2'
        contentHeight='auto'
        bodyClassName='space-y-4'
      >
        <div className='space-y-3 sm:space-y-4'>
          {hasAnyPayment || allowBalancePay ? (
            <div className='space-y-2.5 sm:space-y-3'>
              <p className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                {t('Payment Method')}
              </p>
              <div
                role='radiogroup'
                aria-label={t('Payment Method')}
                className='bg-muted/20 flex min-w-0 flex-wrap gap-2 rounded-xl border p-1'
              >
                {allowBalancePay && (
                  <Button
                    type='button'
                    variant='ghost'
                    role='radio'
                    aria-checked={selectedPaymentMethod === 'balance'}
                    onClick={() => setSelectedPaymentMethod('balance')}
                    disabled={paying || limitReached}
                    className={`min-w-[min(100%,128px)] max-w-full flex-1 gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
                      selectedPaymentMethod === 'balance'
                        ? 'border-primary bg-primary/10 text-primary ring-primary/20 shadow-xs ring-1'
                        : 'bg-background hover:border-border hover:bg-background border-transparent'
                    }`}
                  >
                    <WalletCards className='h-4 w-4' />
                    {t('Balance')}
                  </Button>
                )}
                {[
                  { method: 'antom', enabled: props.enableAntom },
                  { method: 'webmoney', enabled: props.enableWebMoney },
                  { method: 'mixpay', enabled: props.enableMixPay },
                  { method: 'alipay_direct', enabled: props.enableAlipay },
                  {
                    method: 'wechatpay_native',
                    enabled: props.enableWechatPay,
                  },
                ]
                  .filter((item) => item.enabled)
                  .map((item) => (
                    <Button
                      key={item.method}
                      type='button'
                      variant='ghost'
                      role='radio'
                      aria-checked={selectedPaymentMethod === item.method}
                      disabled={paying || limitReached}
                      onClick={() => setSelectedPaymentMethod(item.method)}
                      className={`min-w-[min(100%,128px)] max-w-full flex-1 rounded-lg border px-3 py-2.5 ${selectedPaymentMethod === item.method ? 'border-primary bg-primary/10 ring-primary/20 ring-1' : 'bg-background border-transparent'}`}
                    >
                      <PaymentMethodLabel method={item.method} />
                    </Button>
                  ))}
                {hasEpay &&
                  props.epayMethods?.map((method) => {
                    const value = `epay:${method.type}`
                    const selected = selectedPaymentMethod === value
                    return (
                      <Button
                        key={value}
                        type='button'
                        variant='ghost'
                        role='radio'
                        aria-checked={selected}
                        onClick={() => setSelectedPaymentMethod(value)}
                        disabled={paying || limitReached}
                        className={`min-w-[min(100%,128px)] max-w-full flex-1 gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
                          selected
                            ? 'border-primary bg-primary/10 text-primary ring-primary/20 shadow-xs ring-1'
                            : 'bg-background hover:border-border hover:bg-background border-transparent'
                        }`}
                      >
                        {getPaymentIcon(
                          method.type,
                          'h-4 w-4',
                          method.icon,
                          method.name
                        )}
                        <span className='truncate'>
                          {method.name || method.type}
                        </span>
                      </Button>
                    )
                  })}
                {hasStripe && (
                  <Button
                    type='button'
                    variant='ghost'
                    role='radio'
                    aria-checked={selectedPaymentMethod === 'stripe'}
                    onClick={() => setSelectedPaymentMethod('stripe')}
                    disabled={paying || limitReached}
                    className={`min-w-[min(100%,112px)] max-w-full flex-1 gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
                      selectedPaymentMethod === 'stripe'
                        ? 'border-primary bg-primary/10 text-primary ring-primary/20 shadow-xs ring-1'
                        : 'bg-background hover:border-border hover:bg-background border-transparent'
                    }`}
                  >
                    {getPaymentIcon('stripe', 'h-4 w-4')}
                    Stripe
                  </Button>
                )}
                {hasCreem && (
                  <Button
                    type='button'
                    variant='ghost'
                    role='radio'
                    aria-checked={selectedPaymentMethod === 'creem'}
                    onClick={() => setSelectedPaymentMethod('creem')}
                    disabled={paying || limitReached}
                    className={`min-w-[min(100%,112px)] max-w-full flex-1 gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
                      selectedPaymentMethod === 'creem'
                        ? 'border-primary bg-primary/10 text-primary ring-primary/20 shadow-xs ring-1'
                        : 'bg-background hover:border-border hover:bg-background border-transparent'
                    }`}
                  >
                    {getPaymentIcon('creem', 'h-4 w-4')}
                    Creem
                  </Button>
                )}
                {hasWaffoPancake && (
                  <Button
                    type='button'
                    variant='ghost'
                    role='radio'
                    aria-checked={selectedPaymentMethod === 'waffo_pancake'}
                    onClick={() => setSelectedPaymentMethod('waffo_pancake')}
                    disabled={paying || limitReached}
                    className={`min-w-[min(100%,150px)] max-w-full flex-1 gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
                      selectedPaymentMethod === 'waffo_pancake'
                        ? 'border-primary bg-primary/10 text-primary ring-primary/20 shadow-xs ring-1'
                        : 'bg-background hover:border-border hover:bg-background border-transparent'
                    }`}
                  >
                    {getPaymentIcon('waffo_pancake', 'h-4 w-4')}
                    Waffo Pancake
                  </Button>
                )}
              </div>
              {selectedPaymentMethod === 'balance' && (
                <div className='bg-muted/20 flex flex-col gap-2 rounded-lg border p-3'>
                  <div className='flex items-center justify-between gap-2 text-xs'>
                    <span className='text-muted-foreground'>
                      {t('Required')}
                    </span>
                    <span>{formatQuota(balanceCost)}</span>
                  </div>
                  <div className='flex items-center justify-between gap-2 text-xs'>
                    <span className='text-muted-foreground'>
                      {t('Available')}
                    </span>
                    <span>{formatQuota(userQuota)}</span>
                  </div>
                  {insufficientBalance && (
                    <Alert variant='destructive'>
                      <AlertDescription>
                        {t('Insufficient balance')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <div className='bg-muted/50 space-y-2.5 rounded-lg border p-3 sm:space-y-3 sm:p-4'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Plan Name')}
              </span>
              <span className='max-w-[200px] truncate text-sm font-medium'>
                {plan.title}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Validity Period')}
              </span>
              <span className='flex items-center gap-1 text-sm'>
                <CalendarClock className='h-3.5 w-3.5' />
                {formatDuration(plan, t)}
              </span>
            </div>
            {formatResetPeriod(plan, t) !== t('No Reset') && (
              <div className='flex justify-between'>
                <span className='text-muted-foreground text-sm'>
                  {t('Reset Period')}
                </span>
                <span className='text-sm'>{formatResetPeriod(plan, t)}</span>
              </div>
            )}
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Plan Quota')}
              </span>
              <span className='flex items-center gap-1 text-sm'>
                <Package className='h-3.5 w-3.5' />
                {totalAmount > 0 ? formatQuota(totalAmount) : t('Unlimited')}
              </span>
            </div>
            {plan.upgrade_group && (
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-sm'>
                  {t('Upgrade Group')}
                </span>
                <GroupBadge group={plan.upgrade_group} />
              </div>
            )}
            <Separator />
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>{t('Amount Due')}</span>
              <span className='text-primary text-lg font-bold'>{price}</span>
            </div>
          </div>

          {isDirect && (
            <p className='text-muted-foreground text-sm'>
              {t(
                'One-time payment. Activates this plan for the configured duration without automatic renewal.'
              )}
            </p>
          )}
          {limitReached && (
            <Alert variant='destructive'>
              <AlertDescription>
                {t('Purchase limit reached')} ({props.purchaseCount}/
                {props.purchaseLimit})
              </AlertDescription>
            </Alert>
          )}

          {!hasAnyPayment && !allowBalancePay && (
            <Alert>
              <AlertDescription>
                {t(
                  'No payment methods available. Please contact administrator.'
                )}
              </AlertDescription>
            </Alert>
          )}

          {(hasAnyPayment || allowBalancePay) && (
            <Button
              type='button'
              className='h-11 w-full gap-2 text-sm font-semibold sm:h-12'
              onClick={handlePaymentContinue}
              disabled={
                paying ||
                (isDirect &&
                  (!directQuote.data ||
                    directQuote.isFetching ||
                    directQuote.isError)) ||
                limitReached ||
                !selectedPaymentMethod ||
                (selectedPaymentMethod === 'balance' &&
                  (!allowBalancePay || insufficientBalance))
              }
            >
              {paying && <Loader2 className='h-4 w-4 animate-spin' />}
              {t('Continue')}
              {!paying && <ArrowRight className='h-4 w-4' />}
            </Button>
          )}
        </div>
      </Dialog>
    </>
  )
}
