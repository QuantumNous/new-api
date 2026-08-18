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
import { useState, useEffect, useCallback, useRef } from 'react'
import { PartyPopper, Wallet2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'
import { resumeMixpanelAfterRecallClaim } from '@/lib/analytics/mixpanel'
import { trackTopupOnce } from '@/lib/analytics/topup-tracking'
import { getSelf } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { TitledCard } from '@/components/ui/titled-card'
import { SectionPageLayout } from '@/components/layout'
import { consumePendingPostLoginRedirect } from '@/features/auth/lib/storage'
import { getCardStatus } from '@/features/onboarding/api'
import { RecallClaimProvider } from '@/features/subscriptions/components/dialogs/subscription-purchase-dialog'
import { getPaddleTopUpStatus, isApiSuccess, resumeStripeTopup } from './api'
import { BillingHistoryPanel } from './components/dialogs/billing-history-dialog'
import { StripeEmbeddedCheckoutDialog } from './components/dialogs/stripe-embedded-checkout-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { SubscriptionPlansCard } from './components/subscription-plans-card'
import {
  PADDLE_ORDER_SEARCH_PARAM,
  PADDLE_TRANSACTION_SEARCH_PARAM,
} from './constants'
import { useTopupInfo, usePayment } from './hooks'
import {
  clearPaddleCheckoutUrlFallback,
  getInitialPresetTopupAmount,
  getMinTopupAmount,
  getPaddleCheckoutUrlFallback,
  getWalletCheckoutInitialTopupAmount,
  isPresetTopupAmount,
  defaultCurrencyForRegion,
  normalizeStripeCheckoutCurrency,
  shouldConsumeWalletCheckoutSearchParams,
  shouldShowCurrencySelector,
  type StripeCheckoutCurrency,
  type WalletCheckoutSearch,
} from './lib'
import { openPaddleCheckoutForTransaction } from './lib/paddle-checkout'
import {
  getTopupStripePriceId,
  normalizeRecallClaim,
  removeRecallClaimFromSearch,
} from './lib/recall-claim'
import type {
  UserWalletData,
  PresetAmount,
  RecallClaimView,
  RecallOfferView,
  TopupRecord,
} from './types'
import {
  refreshWalletRecallOffers,
  validateWalletRecallClaimAndRefresh,
  type WalletRecallClaimStatus,
} from './wallet-recall-offers'

interface WalletProps {
  initialShowHistory?: boolean
  initialPaddleOrderId?: string
  initialPaddleTransactionId?: string
  initialCheckoutSearch?: WalletCheckoutSearch
  initialRecallClaim?: string
  cardJustBound?: boolean
}

type PaddleCheckoutNotice = {
  variant?: 'default' | 'destructive'
  title: string
  description: string
}

type PaddleStatusPollParams = {
  transactionId?: string
  orderId?: string
}

const PADDLE_STATUS_POLL_INTERVAL_MS = 2000
const PADDLE_STATUS_POLL_ATTEMPTS = 15
const MAX_TIMEOUT_MS = 2_147_483_647
const WALLET_CHECKOUT_SEARCH_PARAMS = [
  'amount',
  'currency',
  'amount_minor',
  'stripe_lookup_key',
] as const

function consumeWalletCheckoutSearchParams(): void {
  const url = new URL(window.location.href)
  let changed = false

  WALLET_CHECKOUT_SEARCH_PARAMS.forEach((param) => {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param)
      changed = true
    }
  })

  if (changed) {
    window.history.replaceState(
      {},
      '',
      `${url.pathname}${url.search}${url.hash}`
    )
  }
}

function waitForPaddleStatusPollInterval(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, PADDLE_STATUS_POLL_INTERVAL_MS)
  })
}

export function Wallet(props: WalletProps) {
  const { t } = useTranslation()
  const [recallClaim] = useState(() =>
    normalizeRecallClaim(props.initialRecallClaim)
  )
  const [recallClaimStatus, setRecallClaimStatus] =
    useState<WalletRecallClaimStatus>(recallClaim ? 'loading' : 'idle')
  const [recallClaimView, setRecallClaimView] =
    useState<RecallClaimView | null>(null)
  const [recallOffers, setRecallOffers] = useState<RecallOfferView[]>([])
  const [recallOffersLoading, setRecallOffersLoading] = useState(false)
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  // settlement currency for Stripe checkout; local currencies unlock local
  // payment methods (Pix needs BRL, UPI needs INR)
  const [checkoutCurrency, setCheckoutCurrency] =
    useState<StripeCheckoutCurrency>(
      () =>
        normalizeStripeCheckoutCurrency(
          props.initialCheckoutSearch?.currency
        ) ?? 'USD'
    )
  const currencyTouchedRef = useRef(
    normalizeStripeCheckoutCurrency(props.initialCheckoutSearch?.currency) !=
      null
  )

  const handleCheckoutCurrencyChange = (currency: StripeCheckoutCurrency) => {
    currencyTouchedRef.current = true
    setCheckoutCurrency(currency)
  }

  const [paymentLoadingAmount, setPaymentLoadingAmount] = useState<
    number | null
  >(null)
  const [topupDialogOpen, setTopupDialogOpen] = useState(false)
  const [hasRechargeHistory, setHasRechargeHistory] = useState(false)
  const [paddleCheckoutNotice, setPaddleCheckoutNotice] =
    useState<PaddleCheckoutNotice | null>(null)
  const handledPaddleTransactionRef = useRef<string | null>(null)
  const paddleCheckoutCompletedRef = useRef(false)
  const cardBoundHandledRef = useRef(false)
  const appliedCheckoutSearchRef = useRef(false)
  const stripeTopUpInFlightRef = useRef(false)
  const [cardBoundDialogOpen, setCardBoundDialogOpen] = useState(false)

  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()
  // default the settlement currency by caller region (IN→INR, BR→BRL, JP→JPY)
  // unless the URL or the user already picked one
  useEffect(() => {
    if (currencyTouchedRef.current || !topupInfo?.client_region) return
    setCheckoutCurrency(defaultCurrencyForRegion(topupInfo.client_region))
  }, [topupInfo?.client_region])

  const {
    processing,
    processPayment,
    embeddedCheckout,
    closeEmbeddedCheckout,
    openStripeCheckout,
    openStripeCheckoutResponse,
  } = usePayment()

  const handleResumeStripeCheckout = useCallback(
    async (record: TopupRecord) => {
      try {
        const response = await resumeStripeTopup(record.trade_no)
        if (!isApiSuccess(response)) {
          toast.error(t('Payment request failed'))
          return
        }
        if (!openStripeCheckoutResponse(response)) {
          toast.error(t('Payment request failed'))
        }
      } catch (_error) {
        toast.error(t('Payment request failed'))
      }
    },
    [openStripeCheckoutResponse, t]
  )

  // Fetch and refresh user data
  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  const fetchRecallOffers = useCallback(async () => {
    await refreshWalletRecallOffers({
      setLoading: setRecallOffersLoading,
      setOffers: setRecallOffers,
    })
  }, [])

  const pollPaddleTopUpStatus = useCallback(
    async (params: PaddleStatusPollParams) => {
      const transactionId = params.transactionId?.trim()
      const orderId = params.orderId?.trim()
      if (!transactionId && !orderId) {
        return false
      }

      for (
        let attempt = 0;
        attempt < PADDLE_STATUS_POLL_ATTEMPTS;
        attempt += 1
      ) {
        try {
          const response = await getPaddleTopUpStatus({
            transactionId,
            orderId,
          })
          if (isApiSuccess(response) && response.data) {
            if (response.data.status === 'success') {
              if (transactionId) {
                clearPaddleCheckoutUrlFallback(transactionId)
              }
              setPaddleCheckoutNotice({
                title: t('Paddle payment completed'),
                description: t('Your wallet balance has been refreshed.'),
              })
              trackTopupOnce({
                trade_no: response.data.transaction_id || transactionId,
                money: response.data.money,
                complete_time: response.data.complete_time,
              })
              await fetchUser()
              return true
            }

            if (
              response.data.status === 'failed' ||
              response.data.status === 'expired'
            ) {
              if (transactionId) {
                clearPaddleCheckoutUrlFallback(transactionId)
              }
              setPaddleCheckoutNotice({
                variant: 'destructive',
                title: t('Paddle payment failed'),
                description: t(
                  'The Paddle top-up did not complete. Please start a new top-up if you were not charged.'
                ),
              })
              return false
            }
          }
        } catch (_error) {
          // Keep polling briefly because Paddle's webhook can arrive a few
          // seconds after the checkout completion event.
        }

        if (attempt < PADDLE_STATUS_POLL_ATTEMPTS - 1) {
          setPaddleCheckoutNotice({
            title: t('Waiting for Paddle payment confirmation'),
            description: t(
              'Paddle accepted the checkout. Waiting for the payment webhook to update your wallet.'
            ),
          })
          await waitForPaddleStatusPollInterval()
        }
      }

      setPaddleCheckoutNotice({
        title: t('Paddle payment is still pending'),
        description: t(
          'Your wallet balance will update automatically after Paddle confirms the payment.'
        ),
      })
      await fetchUser()
      return false
    },
    [fetchUser, t]
  )

  useEffect(() => {
    queueMicrotask(() => {
      void fetchUser()
    })
  }, [fetchUser])

  useEffect(() => {
    queueMicrotask(() => {
      void fetchRecallOffers()
    })
  }, [fetchRecallOffers])

  useEffect(() => {
    if (!props.initialRecallClaim) {
      return
    }

    const url = new URL(window.location.href)
    const sanitizedSearch = removeRecallClaimFromSearch(url.search)
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${sanitizedSearch}${url.hash}`
    )
    consumePendingPostLoginRedirect()
    resumeMixpanelAfterRecallClaim()
  }, [props.initialRecallClaim])

  useEffect(() => {
    if (!recallClaim) {
      return
    }

    let cancelled = false

    void validateWalletRecallClaimAndRefresh({
      claim: recallClaim,
      isCancelled: () => cancelled,
      onInvalidClaim: consumePendingPostLoginRedirect,
      refreshOffers: fetchRecallOffers,
      setStatus: setRecallClaimStatus,
      setView: setRecallClaimView,
    })

    return () => {
      cancelled = true
    }
  }, [fetchRecallOffers, recallClaim])

  useEffect(() => {
    if (recallClaimStatus !== 'active' || !recallClaimView) {
      return
    }

    let timeoutId: number | undefined
    const expireClaimWhenDue = () => {
      const remainingMs = recallClaimView.expires_at * 1000 - Date.now()
      if (remainingMs <= 0) {
        consumePendingPostLoginRedirect()
        setRecallClaimStatus('expired')
        return
      }
      timeoutId = window.setTimeout(
        expireClaimWhenDue,
        Math.min(remainingMs, MAX_TIMEOUT_MS)
      )
    }
    timeoutId = window.setTimeout(expireClaimWhenDue, 0)

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [recallClaimStatus, recallClaimView])

  useEffect(() => {
    if (props.initialShowHistory) {
      window.requestAnimationFrame(() => {
        document
          .getElementById('wallet-billing-history')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [props.initialShowHistory])

  useEffect(() => {
    if (!props.cardJustBound) return
    // Run this confirmation flow at most once per mount, even if the effect
    // re-fires due to dependency identity changes (e.g. fetchUser). Without this
    // guard, a re-render would cancel the in-flight poll before it can confirm.
    if (cardBoundHandledRef.current) return
    cardBoundHandledRef.current = true

    // Clean the query param immediately so a refresh doesn't re-trigger this.
    window.history.replaceState({}, '', window.location.pathname)

    // Card binding is confirmed by an async Stripe webhook, which may not have
    // arrived yet when we land back here. Poll until the binding is confirmed,
    // then refresh the user state; otherwise explain that confirmation is pending.
    const POLL_ATTEMPTS = 6
    const POLL_INTERVAL_MS = 2000
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const refreshAuthUser = async () => {
      try {
        const res = await getSelf()
        if (res?.success && res.data) {
          useAuthStore.getState().auth.setUser(res.data)
        }
      } catch {
        // Non-fatal: the next navigation will re-verify the session.
      }
    }

    const confirmBinding = async () => {
      const pendingToast = toast.loading(t('Confirming your card binding...'))
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        try {
          const res = await getCardStatus()
          if (res?.success && res.data?.card_bound) {
            // Funnel final step: card actually bound (the conversion we're chasing).
            trackAdsFunnelEvent('flatkey_cardbind_success')
            toast.dismiss(pendingToast)
            await refreshAuthUser()
            await fetchUser()
            setCardBoundDialogOpen(true)
            return
          }
        } catch {
          // Ignore transient errors and keep polling.
        }
        await sleep(POLL_INTERVAL_MS)
      }
      // Webhook hasn't landed in time; avoid claiming success prematurely.
      trackAdsFunnelEvent('flatkey_cardbind_pending')
      toast.dismiss(pendingToast)
      toast.info(t('Confirming your card binding…'))
      await refreshAuthUser()
      await fetchUser()
    }

    confirmBinding()
  }, [props.cardJustBound, t, fetchUser])

  useEffect(() => {
    if (!topupInfo) return

    const url = new URL(window.location.href)
    const transactionId = (
      props.initialPaddleTransactionId ||
      url.searchParams.get(PADDLE_TRANSACTION_SEARCH_PARAM) ||
      ''
    ).trim()
    const orderId = (
      props.initialPaddleOrderId ||
      url.searchParams.get(PADDLE_ORDER_SEARCH_PARAM) ||
      ''
    ).trim()
    const handledKey = `${transactionId}:${orderId}`
    if (
      (!transactionId && !orderId) ||
      handledPaddleTransactionRef.current === handledKey
    ) {
      return
    }

    handledPaddleTransactionRef.current = handledKey
    paddleCheckoutCompletedRef.current = false
    url.searchParams.delete(PADDLE_ORDER_SEARCH_PARAM)
    url.searchParams.delete(PADDLE_TRANSACTION_SEARCH_PARAM)
    window.history.replaceState(
      {},
      '',
      `${url.pathname}${url.search}${url.hash}`
    )

    setPaddleCheckoutNotice({
      title: t('Checking Paddle payment status'),
      description: t('Looking up the wallet top-up result from Paddle.'),
    })

    const openCheckout = (checkoutTransactionId: string) => {
      setPaddleCheckoutNotice({
        title: t('Opening Paddle checkout'),
        description: t(
          'Transaction {{transactionId}} is being opened in Paddle Checkout.',
          { transactionId: checkoutTransactionId }
        ),
      })

      const openHostedCheckoutFallback = (): boolean => {
        const checkoutUrl = getPaddleCheckoutUrlFallback(checkoutTransactionId)
        if (!checkoutUrl) {
          return false
        }

        window.location.assign(checkoutUrl)
        toast.success(t('Redirecting to payment page...'))
        return true
      }

      const clientToken = topupInfo.paddle_client_token?.trim()
      if (!clientToken) {
        if (openHostedCheckoutFallback()) {
          return
        }

        const message = t(
          'Paddle client-side token is missing. Please configure it in System Settings.'
        )
        setPaddleCheckoutNotice({
          variant: 'destructive',
          title: t('Unable to open Paddle checkout'),
          description: message,
        })
        toast.error(message)
        return
      }

      openPaddleCheckoutForTransaction({
        transactionId: checkoutTransactionId,
        clientToken,
        sandbox: topupInfo.paddle_sandbox !== false,
        onLoaded: () => {
          if (paddleCheckoutCompletedRef.current) {
            return
          }

          setPaddleCheckoutNotice({
            title: t('Paddle checkout is open'),
            description: t(
              'Complete the payment in the Paddle checkout window to finish the top-up.'
            ),
          })
        },
        onCompleted: async () => {
          if (paddleCheckoutCompletedRef.current) {
            return
          }

          paddleCheckoutCompletedRef.current = true
          setPaddleCheckoutNotice({
            title: t('Paddle payment completed'),
            description: t('Your wallet balance is being refreshed.'),
          })
          await pollPaddleTopUpStatus({
            transactionId: checkoutTransactionId,
            orderId,
          })
        },
        onClosed: () => {
          if (paddleCheckoutCompletedRef.current) {
            return
          }

          setPaddleCheckoutNotice({
            title: t('Paddle checkout was closed'),
            description: t(
              'No Paddle payment was confirmed. You can reopen checkout from the pending order if needed.'
            ),
          })
          void pollPaddleTopUpStatus({
            transactionId: checkoutTransactionId,
            orderId,
          })
        },
      }).catch((error) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t('Failed to open Paddle checkout')
        if (openHostedCheckoutFallback()) {
          return
        }

        setPaddleCheckoutNotice({
          variant: 'destructive',
          title: t('Unable to open Paddle checkout'),
          description: message,
        })
        toast.error(message)
      })
    }

    const handlePaddleReturn = async () => {
      try {
        const response = await getPaddleTopUpStatus({
          transactionId,
          orderId,
        })
        if (isApiSuccess(response) && response.data) {
          if (response.data.status === 'success') {
            paddleCheckoutCompletedRef.current = true
            if (response.data.transaction_id || transactionId) {
              clearPaddleCheckoutUrlFallback(
                response.data.transaction_id || transactionId
              )
            }
            setPaddleCheckoutNotice({
              title: t('Paddle payment completed'),
              description: t('Your wallet balance is being refreshed.'),
            })
            trackTopupOnce({
              trade_no: response.data.transaction_id || transactionId,
              money: response.data.money,
              complete_time: response.data.complete_time,
            })
            await fetchUser()
            return
          }

          if (
            response.data.status === 'failed' ||
            response.data.status === 'expired'
          ) {
            if (response.data.transaction_id || transactionId) {
              clearPaddleCheckoutUrlFallback(
                response.data.transaction_id || transactionId
              )
            }
            setPaddleCheckoutNotice({
              variant: 'destructive',
              title: t('Paddle payment failed'),
              description: t(
                'The Paddle top-up did not complete. Please start a new top-up if you were not charged.'
              ),
            })
            return
          }

          const checkoutTransactionId =
            response.data.transaction_id || transactionId
          if (checkoutTransactionId) {
            openCheckout(checkoutTransactionId)
            return
          }
        }
      } catch (_error) {
        // If local status is temporarily unavailable, still try to resume the
        // checkout when we have Paddle's transaction id from the return URL.
      }

      if (transactionId) {
        openCheckout(transactionId)
        return
      }

      setPaddleCheckoutNotice({
        variant: 'destructive',
        title: t('Unable to open Paddle checkout'),
        description: t('Paddle transaction ID is missing from the return URL.'),
      })
    }

    void handlePaddleReturn()
  }, [
    fetchUser,
    pollPaddleTopUpStatus,
    props.initialPaddleOrderId,
    props.initialPaddleTransactionId,
    t,
    topupInfo,
  ])

  // Initialize topup amount when topup info is loaded
  useEffect(() => {
    if (!topupInfo || topupLoading) return

    if (!appliedCheckoutSearchRef.current) {
      const checkoutInitialAmount = getWalletCheckoutInitialTopupAmount(
        props.initialCheckoutSearch,
        presetAmounts
      )
      appliedCheckoutSearchRef.current = true

      if (
        shouldConsumeWalletCheckoutSearchParams(
          props.initialCheckoutSearch,
          checkoutInitialAmount
        )
      ) {
        consumeWalletCheckoutSearchParams()
      }

      if (checkoutInitialAmount > 0) {
        const timeoutId = window.setTimeout(() => {
          setTopupAmount(checkoutInitialAmount)
          setSelectedPreset(checkoutInitialAmount)
        }, 0)
        return () => window.clearTimeout(timeoutId)
      }
    }

    if (!isPresetTopupAmount(topupAmount, presetAmounts)) {
      const initialAmount = getInitialPresetTopupAmount(presetAmounts)
      if (initialAmount <= 0) return

      const timeoutId = window.setTimeout(() => {
        setTopupAmount(initialAmount)
        setSelectedPreset(initialAmount)
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [
    topupInfo,
    topupLoading,
    topupAmount,
    presetAmounts,
    props.initialCheckoutSearch,
  ])

  // Handle preset selection
  const handleSelectPreset = (preset: PresetAmount) => {
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
  }

  const handleStripeTopUp = async (preset: PresetAmount) => {
    if (stripeTopUpInFlightRef.current) {
      return
    }

    stripeTopUpInFlightRef.current = true
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
    setPaymentLoadingAmount(preset.value)

    try {
      if (!isPresetTopupAmount(preset.value, presetAmounts)) {
        toast.error(t('Please select a top-up package'))
        return
      }

      const minTopup = getMinTopupAmount(topupInfo)
      if (preset.value < minTopup) {
        return
      }

      const stripePriceId = getTopupStripePriceId(
        topupInfo?.stripe_price_ids,
        preset.value
      )
      const validatedRecallClaim =
        recallClaimStatus === 'active' && recallClaim && stripePriceId
          ? recallClaim
          : undefined

      const success = await processPayment(preset.value, 'stripe', {
        stripeCurrency: checkoutCurrency,
        preferEmbeddedCheckout: true,
        recallClaim: validatedRecallClaim,
      })
      if (success) {
        await fetchUser()
      }
    } finally {
      stripeTopUpInFlightRef.current = false
      setPaymentLoadingAmount(null)
    }
  }

  // Stable so the embedded Stripe Checkout effect (which depends on this
  // callback) does not re-run and remount the form on every wallet re-render.
  const handleEmbeddedCheckoutOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeEmbeddedCheckout()
      }
    },
    [closeEmbeddedCheckout]
  )

  let recallDiscountLabel = ''
  if (recallClaimView?.discount.percent_off) {
    recallDiscountLabel = t('{{percent}}% off', {
      percent: recallClaimView.discount.percent_off,
    })
  } else if (recallClaimView) {
    recallDiscountLabel = t('{{amount}} {{currency}} off', {
      amount: (recallClaimView.discount.amount_off / 100).toFixed(2),
      currency: recallClaimView.discount.currency.toUpperCase(),
    })
  }
  const recallEligibleProductLabel = recallClaimView
    ? [
        recallClaimView.products.topup_price_ids.length
          ? t('eligible wallet top-up packages')
          : '',
        recallClaimView.products.subscription_price_ids.length
          ? t('eligible subscription plans')
          : '',
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  const handleRechargeHistoryAvailability = useCallback(
    (available: boolean) => setHasRechargeHistory(available),
    []
  )

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          <span className='mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3'>
            <span>{t('Plans & wallet')}</span>
            <span className='text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium'>
              <span>{t('Available balance')}:</span>
              <span className='font-mono tabular-nums'>
                {userLoading ? '-' : formatQuota(user?.quota ?? 0)}
              </span>
            </span>
          </span>
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            {paddleCheckoutNotice ? (
              <Alert variant={paddleCheckoutNotice.variant}>
                <AlertTitle>{paddleCheckoutNotice.title}</AlertTitle>
                <AlertDescription>
                  {paddleCheckoutNotice.description}
                </AlertDescription>
              </Alert>
            ) : null}

            {recallClaimStatus === 'loading' ? (
              <Alert>
                <AlertTitle>{t('Checking your recall offer')}</AlertTitle>
                <AlertDescription>
                  {t('Verifying this offer for your account...')}
                </AlertDescription>
              </Alert>
            ) : null}

            {recallClaimStatus === 'active' && recallClaimView ? (
              <Alert>
                <AlertTitle>{recallClaimView.campaign_name}</AlertTitle>
                <AlertDescription>
                  {t(
                    '{{discount}}. Applies to {{products}}. Expires {{expiresAt}}.',
                    {
                      discount: recallDiscountLabel,
                      products: recallEligibleProductLabel,
                      expiresAt: new Date(
                        recallClaimView.expires_at * 1000
                      ).toLocaleString(),
                    }
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            {recallClaimStatus === 'expired' ? (
              <Alert variant='destructive'>
                <AlertTitle>{t('This recall offer has expired')}</AlertTitle>
                <AlertDescription>
                  {t('This discount can no longer be used.')}
                </AlertDescription>
              </Alert>
            ) : null}

            {recallClaimStatus === 'invalid' ? (
              <Alert variant='destructive'>
                <AlertTitle>{t('This recall offer is invalid')}</AlertTitle>
                <AlertDescription>
                  {t(
                    'This link cannot be used for your account or is no longer available.'
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            {recallClaimStatus === 'unavailable' ? (
              <Alert variant='destructive'>
                <AlertTitle>
                  {t('Unable to verify this recall offer')}
                </AlertTitle>
                <AlertDescription>
                  {t('Please refresh the page and try again.')}
                </AlertDescription>
              </Alert>
            ) : null}

            <RecallClaimProvider
              offers={recallOffers}
              loading={recallOffersLoading}
              view={
                recallClaimStatus === 'active'
                  ? recallClaimView || undefined
                  : undefined
              }
            >
              <SubscriptionPlansCard
                topupInfo={topupInfo}
                userQuota={user?.quota}
                onPurchaseSuccess={fetchUser}
                onOpenStripeCheckout={openStripeCheckout}
              />
            </RecallClaimProvider>

            <TitledCard
              title={t('Top-ups')}
              description={t(
                'Plan usage is used first. Wallet balance is used automatically after the plan runs out.'
              )}
              icon={<Wallet2 className='h-4 w-4' />}
              iconClassName='bg-[#f0ebfa] text-[#4c1d95] dark:bg-[#5b21b6]/25 dark:text-[#c4b5fd]'
              action={
                <Button
                  className='bg-[#070707] text-white hover:bg-[#4c1d95] dark:bg-white dark:text-black'
                  onClick={() => setTopupDialogOpen(true)}
                >
                  {t('Top up')}
                </Button>
              }
              contentClassName={hasRechargeHistory ? 'space-y-4' : 'hidden'}
            >
              <div
                id='wallet-billing-history'
                className={hasRechargeHistory ? 'scroll-mt-4' : 'hidden'}
              >
                {hasRechargeHistory && <Separator className='mb-4' />}
                {hasRechargeHistory && (
                  <div className='mb-3'>
                    <h3 className='text-sm font-semibold'>
                      {t('Recharge History')}
                    </h3>
                    <p className='text-muted-foreground mt-0.5 text-xs'>
                      {t('View your top-up records and payment receipts.')}
                    </p>
                  </div>
                )}
                <BillingHistoryPanel
                  scrollAreaClassName='max-h-none pr-0 sm:pr-0'
                  onAvailabilityChange={handleRechargeHistoryAvailability}
                  onResumeStripeCheckout={handleResumeStripeCheckout}
                  onRefundSuccess={fetchUser}
                />
              </div>
            </TitledCard>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <Dialog open={topupDialogOpen} onOpenChange={setTopupDialogOpen}>
        <DialogContent className='sm:max-w-lg' showCloseButton>
          <DialogHeader>
            <DialogTitle>{t('Add to your balance')}</DialogTitle>
          </DialogHeader>
          <RechargeFormCard
            topupInfo={topupInfo}
            presetAmounts={presetAmounts}
            selectedPreset={selectedPreset}
            onSelectPreset={handleSelectPreset}
            onStripeTopUp={handleStripeTopUp}
            paymentLoadingAmount={processing ? paymentLoadingAmount : null}
            loading={topupLoading}
            checkoutCurrency={checkoutCurrency}
            onCheckoutCurrencyChange={handleCheckoutCurrencyChange}
            showCurrencySelector={
              shouldShowCurrencySelector(topupInfo?.client_region) ||
              normalizeStripeCheckoutCurrency(
                props.initialCheckoutSearch?.currency
              ) != null
            }
            recallOffers={recallOffers}
          />
        </DialogContent>
      </Dialog>

      <StripeEmbeddedCheckoutDialog
        session={embeddedCheckout}
        onOpenChange={handleEmbeddedCheckoutOpenChange}
      />

      <Dialog open={cardBoundDialogOpen} onOpenChange={setCardBoundDialogOpen}>
        <DialogContent className='sm:max-w-md' showCloseButton>
          <DialogHeader className='items-center text-center'>
            <div className='bg-primary/10 mx-auto mb-2 flex size-14 items-center justify-center rounded-full'>
              <PartyPopper className='text-primary size-7' aria-hidden='true' />
            </div>
            <DialogTitle className='text-xl'>
              {t('Binding successful!')}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button
              className='w-full'
              onClick={() => setCardBoundDialogOpen(false)}
            >
              {t('Got it')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
