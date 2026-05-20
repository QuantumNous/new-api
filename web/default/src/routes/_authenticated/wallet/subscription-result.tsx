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
import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Main } from '@/components/layout'
import { getSubscriptionOrderStatus } from '@/features/subscriptions/api'
import {
  clearSubscriptionEpayCheckout,
  markSubscriptionEpayCheckoutOpened,
  readSubscriptionEpayCheckout,
  submitSubscriptionEpayCheckout,
  type SubscriptionEpayCheckout,
} from '@/features/subscriptions/lib'
import type { SubscriptionOrderPaymentStatus } from '@/features/subscriptions/types'

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 5 * 60 * 1000

const paymentResultSearchSchema = z.object({
  out_trade_no: z.string().optional(),
  outTradeNo: z.string().optional(),
  trade_no: z.string().optional(),
  mchOrderNo: z.string().optional(),
  pay: z.enum(['success', 'fail', 'pending']).optional(),
})

type PageStatus =
  | SubscriptionOrderPaymentStatus
  | 'checking'
  | 'missing'
  | 'timeout'

export const Route = createFileRoute(
  '/_authenticated/wallet/subscription-result'
)({
  component: RouteComponent,
  validateSearch: paymentResultSearchSchema,
})

function RouteComponent() {
  const search = Route.useSearch()
  const outTradeNo =
    search.out_trade_no ||
    search.outTradeNo ||
    search.trade_no ||
    search.mchOrderNo ||
    ''

  return <SubscriptionPaymentResult outTradeNo={outTradeNo} />
}

function getStatusTitle(
  status: PageStatus,
  t: (key: string) => string
): string {
  switch (status) {
    case 'paid':
      return t('Payment confirmed')
    case 'failed':
      return t('Payment failed')
    case 'expired':
      return t('Payment expired')
    case 'timeout':
      return t('Payment is still pending')
    case 'missing':
      return t('Missing payment order')
    default:
      return t('Waiting for payment')
  }
}

function getStatusDescription(
  status: PageStatus,
  t: (key: string) => string
): string {
  switch (status) {
    case 'paid':
      return t('Your subscription is active. Redirecting to wallet...')
    case 'failed':
      return t('The payment was not completed. Please start a new order.')
    case 'expired':
      return t('This payment order has expired. Please start a new order.')
    case 'timeout':
      return t(
        'If you have paid, keep this page open or refresh your subscription status later.'
      )
    case 'missing':
      return t('Open the subscription page and start payment again.')
    default:
      return t(
        'Scan the QR code or complete payment in the checkout page. This page will update automatically.'
      )
  }
}

function StatusIcon(props: { status: PageStatus }) {
  if (props.status === 'paid') {
    return <CheckCircle2 className='h-10 w-10 text-emerald-500' />
  }
  if (
    props.status === 'failed' ||
    props.status === 'expired' ||
    props.status === 'missing'
  ) {
    return <CircleAlert className='text-destructive h-10 w-10' />
  }
  if (props.status === 'timeout') {
    return <CircleAlert className='h-10 w-10 text-amber-500' />
  }
  return <Loader2 className='text-primary h-10 w-10 animate-spin' />
}

function SubscriptionPaymentResult(props: { outTradeNo: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [checkout, setCheckout] = useState<SubscriptionEpayCheckout | null>(
    null
  )
  const [status, setStatus] = useState<PageStatus>(() => {
    if (!props.outTradeNo) return 'missing'
    return 'checking'
  })
  const [lastMessage, setLastMessage] = useState('')
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const checkoutOpeningRef = useRef(false)
  const redirectTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setStatus(props.outTradeNo ? 'checking' : 'missing')
    setLastMessage('')
    setLastCheckedAt(null)
    checkoutOpeningRef.current = false
  }, [props.outTradeNo])

  useEffect(() => {
    if (!props.outTradeNo) {
      setCheckout(null)
      return
    }
    setCheckout(readSubscriptionEpayCheckout(props.outTradeNo))
  }, [props.outTradeNo])

  const pollOrderStatus = useCallback(async () => {
    if (!props.outTradeNo) {
      setStatus('missing')
      return
    }

    try {
      const res = await getSubscriptionOrderStatus(props.outTradeNo)
      if (!res.success || !res.data) {
        setLastMessage(res.message || t('Unable to query payment status yet'))
        return
      }

      setLastCheckedAt(new Date())
      setLastMessage('')
      setStatus(res.data.status)

      if (res.data.status === 'paid') {
        clearSubscriptionEpayCheckout(props.outTradeNo)
        if (redirectTimerRef.current === null) {
          redirectTimerRef.current = window.setTimeout(() => {
            void navigate({ to: '/wallet' })
          }, 1800)
        }
      }
    } catch {
      setLastMessage(t('Unable to query payment status yet'))
    }
  }, [navigate, props.outTradeNo, t])

  useEffect(() => {
    if (!props.outTradeNo || (status !== 'checking' && status !== 'pending')) {
      return
    }

    const startedAt = Date.now()
    void pollOrderStatus()
    const intervalId = window.setInterval(() => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setStatus('timeout')
        window.clearInterval(intervalId)
        return
      }
      void pollOrderStatus()
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pollOrderStatus, props.outTradeNo, status])

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  const handleOpenCheckout = () => {
    if (!checkout) {
      toast.error(t('Payment checkout unavailable'))
      return
    }
    if (checkout.openedAt) {
      toast.info(t('Payment page has already been opened'))
      return
    }
    if (checkoutOpeningRef.current) {
      return
    }

    checkoutOpeningRef.current = true
    if (!submitSubscriptionEpayCheckout(checkout, '_blank')) {
      checkoutOpeningRef.current = false
      toast.error(t('Payment checkout unavailable'))
      return
    }
    const nextCheckout =
      markSubscriptionEpayCheckoutOpened(checkout.tradeNo) || {
        ...checkout,
        openedAt: Date.now(),
      }
    setCheckout(nextCheckout)
    toast.success(t('Payment page opened'))
  }

  const handleRefresh = () => {
    setStatus('checking')
    void pollOrderStatus()
  }

  const handleGoWallet = () => {
    void navigate({ to: '/wallet' })
  }

  const statusTitle = getStatusTitle(status, t)
  const statusDescription = getStatusDescription(status, t)
  const hasCheckout = !!checkout && status !== 'paid'
  const checkoutHint = checkout?.openedAt
    ? t(
        'The payment page has opened in a new window. Complete payment there and keep this page open.'
      )
    : t(
        'Open the payment page in a new window, then keep this page open to detect completion automatically.'
      )

  return (
    <Main>
      <div className='min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-4 sm:py-6'>
        <div className='mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px]'>
          <Card className='rounded-lg'>
            <CardHeader>
              <CardTitle>{t('Subscription payment')}</CardTitle>
              <CardDescription>
                {hasCheckout ? t('Payment checkout') : t('Payment status')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='bg-muted/40 flex min-h-[420px] items-center justify-center rounded-md border p-6 text-center'>
                <div className='max-w-sm space-y-4'>
                  <div className='flex justify-center'>
                    <StatusIcon status={status} />
                  </div>
                  <div className='space-y-2'>
                    <h2 className='text-lg font-semibold'>{statusTitle}</h2>
                    <p className='text-muted-foreground text-sm'>
                      {hasCheckout ? checkoutHint : statusDescription}
                    </p>
                  </div>
                  {hasCheckout && !checkout?.openedAt ? (
                    <Button type='button' onClick={handleOpenCheckout}>
                      <ExternalLink className='h-4 w-4' />
                      {t('Open payment page')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className='rounded-lg'>
            <CardHeader>
              <CardTitle>{statusTitle}</CardTitle>
              <CardDescription>{statusDescription}</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center gap-3'>
                <StatusIcon status={status} />
                <div className='min-w-0'>
                  <div className='text-sm font-medium'>
                    {props.outTradeNo || t('No order number')}
                  </div>
                  {lastCheckedAt && (
                    <div className='text-muted-foreground text-xs'>
                      {t('Last checked')}: {lastCheckedAt.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>

              {lastMessage && (
                <Alert>
                  <AlertDescription>{lastMessage}</AlertDescription>
                </Alert>
              )}

              <div className='grid gap-2'>
                {hasCheckout && !checkout?.openedAt ? (
                  <Button type='button' onClick={handleOpenCheckout}>
                    <ExternalLink className='h-4 w-4' />
                    {t('Open payment page')}
                  </Button>
                ) : null}
                <Button type='button' onClick={handleRefresh}>
                  <RefreshCw className='h-4 w-4' />
                  {t('Refresh status')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleGoWallet}
                >
                  {t('Go to wallet')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Main>
  )
}
