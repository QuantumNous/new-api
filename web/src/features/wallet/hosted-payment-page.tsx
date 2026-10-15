import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { PaymentMethodLabel } from '@/features/wallet/components/payment-method-label'
import {
  getServerErrorMessage,
  getServerErrorStatus,
} from '@/lib/server-error-message'

import {
  getAntomPayment,
  getAntomCheckoutURL,
  recheckAntomPayment,
} from './antom'
import { getMixPayPayment, recheckMixPayPayment } from './mixpay'

export function HostedPaymentPage({
  tradeNo,
  provider = 'antom',
}: {
  tradeNo: string
  provider?: 'antom' | 'mixpay'
}) {
  const { t } = useTranslation()
  const hostedReturn =
    provider === 'mixpay' ||
    new URLSearchParams(window.location.search).get('hosted_return') === '1'
  const verificationAttempts = useRef(0)
  const session = useQuery({
    queryKey: ['antom-checkout-session', tradeNo],
    enabled: !hostedReturn,
    queryFn: () => getAntomCheckoutURL(tradeNo),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    meta: { errorToast: false },
  })
  // No preliminary order request: the session endpoint validates ownership and status.
  // On return (or a rejected session), inspect the authoritative order result.
  const showResult = hostedReturn || session.isError
  const order = useQuery({
    queryKey: [`${provider}-return-order`, tradeNo],
    queryFn: () => {
      const recheck = hostedReturn && verificationAttempts.current++ < 3
      if (provider === 'mixpay')
        {return recheck
          ? recheckMixPayPayment(tradeNo)
          : getMixPayPayment(tradeNo)}
      return recheck ? recheckAntomPayment(tradeNo) : getAntomPayment(tradeNo)
    },
    enabled: showResult,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (q) =>
      ['success', 'expired', 'failed'].includes(q.state.data?.status || '') ||
      [401, 403, 404].includes(getServerErrorStatus(q.state.error) || 0)
        ? false
        : 5000,
    retry: false,
    meta: { errorToast: false },
  })
  useEffect(() => {
    if (!hostedReturn && session.data) window.location.replace(session.data)
  }, [hostedReturn, session.data])
  useEffect(() => {
    if (order.data?.status === 'success') window.close()
  }, [order.data?.status])

  const status = order.data?.status
  const terminal = ['success', 'expired', 'failed'].includes(status || '')
  let message = t(
    'Payment processing. You can leave this page and check My orders later.'
  )
  if (status === 'success') message = t('Payment successful')
  else if (status === 'expired') message = t('Closed')
  else if (status === 'failed') message = t('Payment failed')
  else if (order.data?.review_required) {
    message = t('Payment requires review. Please contact support.')
  } else if (order.data?.gateway_status === 'paid_less') {
    message = t(
      'Payment amount is insufficient. Complete payment using the original checkout.'
    )
  } else if (status === 'paid') {
    message = t('Payment received. Your order is being fulfilled.')
  } else if (order.data?.gateway_status === 'CANCEL_REQUESTED') {
    message = t('Closing order. Waiting for payment provider confirmation.')
  } else if (order.data && order.data.expires_at * 1000 <= Date.now()) {
    message = t('Payment time has ended. Waiting for the final payment result.')
  }
  const error = order.error || session.error
  let errorMessage = getServerErrorMessage(error, t('Payment request failed'))
  const errorStatus = getServerErrorStatus(error)
  if (errorStatus === 401) {
    errorMessage = t('Please log in with the appropriate credentials')
  } else if (errorStatus === 403) {
    errorMessage = t('No permission to perform this action')
  } else if (errorStatus === 404) errorMessage = t('Payment not found')

  return (
    <main className='bg-background flex min-h-dvh items-center justify-center p-6'>
      <section className='w-full max-w-md space-y-6 text-center'>
        <PaymentMethodLabel method={provider} className='mx-auto h-8' />
        {!showResult && (
          <LoadingState message={t('Redirecting to payment page...')} />
        )}
        {showResult && order.isPending && <LoadingState />}
        {showResult && order.data && <p role='status'>{message}</p>}
        {showResult && error && !terminal && status !== 'paid' && (
          <ErrorState
            description={errorMessage}
            onRetry={() => {
              if (order.isError || hostedReturn) {
                verificationAttempts.current = 0
                void order.refetch()
              } else void session.refetch()
            }}
          />
        )}
        {showResult && !terminal && (
          <Button
            variant='outline'
            disabled={order.isFetching}
            onClick={() => {
              verificationAttempts.current = 0
              void order.refetch()
            }}
          >
            {t('Check payment status')}
          </Button>
        )}
        {status === 'success' && (
          <Button variant='outline' onClick={() => window.close()}>
            {t('Close')}
          </Button>
        )}
        <p className='text-muted-foreground text-xs break-all'>{tradeNo}</p>
        {showResult && (
          <Link to='/wallet' className='text-sm underline'>
            {t('Wallet')}
          </Link>
        )}
      </section>
    </main>
  )
}
