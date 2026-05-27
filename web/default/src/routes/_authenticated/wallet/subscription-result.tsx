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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react'
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
  readSubscriptionEpayCheckout,
  submitSubscriptionEpayCheckout,
  type SubscriptionEpayCheckout,
} from '@/features/subscriptions/lib'
import type { SubscriptionOrderPaymentStatus } from '@/features/subscriptions/types'

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 5 * 60 * 1000
const CHECKOUT_FALLBACK_DELAY_MS = 6000

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

  return (
    <SubscriptionPaymentResult
      key={outTradeNo || 'missing-order'}
      outTradeNo={outTradeNo}
    />
  )
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

function hasCheckoutFrameNavigated(iframe: HTMLIFrameElement): boolean {
  try {
    const href = iframe.contentWindow?.location.href
    return !!href && href !== 'about:blank'
  } catch {
    return true
  }
}

function SubscriptionPaymentResult(props: { outTradeNo: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [checkout] = useState<SubscriptionEpayCheckout | null>(() => {
    if (!props.outTradeNo) {
      return null
    }
    return readSubscriptionEpayCheckout(props.outTradeNo)
  })
  const [status, setStatus] = useState<PageStatus>(() => {
    if (!props.outTradeNo) return 'missing'
    return 'checking'
  })
  const [lastMessage, setLastMessage] = useState('')
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [checkoutFrameLoaded, setCheckoutFrameLoaded] = useState(false)
  const [checkoutFallbackVisible, setCheckoutFallbackVisible] = useState(false)
  const submittedTradeNoRef = useRef('')
  const redirectTimerRef = useRef<number | null>(null)
  const checkoutFallbackTimerRef = useRef<number | null>(null)
  const iframeName = useMemo(
    () => `subscription-epay-checkout-${props.outTradeNo || 'empty'}`,
    [props.outTradeNo]
  )

  const clearCheckoutFallbackTimer = useCallback(() => {
    if (checkoutFallbackTimerRef.current !== null) {
      window.clearTimeout(checkoutFallbackTimerRef.current)
      checkoutFallbackTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!checkout || submittedTradeNoRef.current === checkout.tradeNo) {
      return
    }
    clearCheckoutFallbackTimer()
    submitSubscriptionEpayCheckout(checkout, iframeName)
    submittedTradeNoRef.current = checkout.tradeNo
    checkoutFallbackTimerRef.current = window.setTimeout(() => {
      setCheckoutFallbackVisible(true)
      checkoutFallbackTimerRef.current = null
    }, CHECKOUT_FALLBACK_DELAY_MS)
  }, [checkout, clearCheckoutFallbackTimer, iframeName])

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
    const initialPollTimerId = window.setTimeout(() => {
      void pollOrderStatus()
    }, 0)
    const intervalId = window.setInterval(() => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setStatus('timeout')
        window.clearInterval(intervalId)
        return
      }
      void pollOrderStatus()
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearTimeout(initialPollTimerId)
      window.clearInterval(intervalId)
    }
  }, [pollOrderStatus, props.outTradeNo, status])

  useEffect(() => {
    return () => {
      clearCheckoutFallbackTimer()
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current)
      }
    }
  }, [clearCheckoutFallbackTimer])

  const handleCheckoutFrameLoad = (
    event: SyntheticEvent<HTMLIFrameElement>
  ) => {
    if (!checkout || submittedTradeNoRef.current !== checkout.tradeNo) {
      return
    }
    if (!hasCheckoutFrameNavigated(event.currentTarget)) {
      return
    }
    setCheckoutFrameLoaded(true)
    setCheckoutFallbackVisible(false)
    clearCheckoutFallbackTimer()
  }

  const handleOpenCheckout = () => {
    if (!checkout) {
      toast.error(t('Payment checkout unavailable'))
      return
    }
    submitSubscriptionEpayCheckout(checkout, '_blank')
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
  const shouldShowCheckout = !!checkout && status !== 'paid'
  const shouldShowCheckoutFallback =
    shouldShowCheckout && checkoutFallbackVisible && !checkoutFrameLoaded

  return (
    <Main>
      <div className='min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-4 sm:py-6'>
        <div className='mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px]'>
          <Card className='rounded-lg'>
            <CardHeader>
              <CardTitle>{t('Subscription payment')}</CardTitle>
              <CardDescription>
                {shouldShowCheckout
                  ? t('Payment checkout')
                  : t('Payment status')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shouldShowCheckout ? (
                <div className='space-y-3'>
                  <iframe
                    className='bg-background h-[min(68vh,680px)] min-h-[420px] w-full rounded-md border'
                    name={iframeName}
                    onLoad={handleCheckoutFrameLoad}
                    title={t('Payment checkout')}
                  />
                  {shouldShowCheckoutFallback && (
                    <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
                      <span className='text-muted-foreground'>
                        {t(
                          'Checkout page unavailable? Open it in a new window.'
                        )}
                      </span>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={handleOpenCheckout}
                      >
                        <ExternalLink className='h-4 w-4' />
                        {t('Open checkout in new window')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className='bg-muted/40 flex min-h-[420px] items-center justify-center rounded-md border p-6 text-center'>
                  <div className='max-w-sm space-y-3'>
                    <StatusIcon status={status} />
                    <h2 className='text-lg font-semibold'>{statusTitle}</h2>
                    <p className='text-muted-foreground text-sm'>
                      {statusDescription}
                    </p>
                  </div>
                </div>
              )}
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
