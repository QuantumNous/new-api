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
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PartyPopper } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'
import { trackTopupOnce } from '@/lib/analytics/topup-tracking'
import { getSelf } from '@/lib/api'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SectionPageLayout } from '@/components/layout'
import { getCardStatus } from '@/features/onboarding/api'
import { getPaddleTopUpStatus, isApiSuccess } from './api'
import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { BillingHistoryDialog } from './components/dialogs/billing-history-dialog'
import { CreemConfirmDialog } from './components/dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from './components/dialogs/payment-confirm-dialog'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { SubscriptionPlansCard } from './components/subscription-plans-card'
import { WalletStatsCard } from './components/wallet-stats-card'
import {
  DEFAULT_DISCOUNT_RATE,
  PADDLE_ORDER_SEARCH_PARAM,
  PADDLE_TRANSACTION_SEARCH_PARAM,
} from './constants'
import {
  useTopupInfo,
  usePayment,
  useAffiliate,
  useRedemption,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
} from './hooks'
import {
  clearPaddleCheckoutUrlFallback,
  getDefaultPaymentType,
  getInitialPresetTopupAmount,
  getMinTopupAmount,
  getPaddleCheckoutUrlFallback,
  getWalletCheckoutInitialTopupAmount,
  isPresetTopupAmount,
  isWaffoPancakePayment,
  shouldConsumeWalletCheckoutSearchParams,
  type WalletCheckoutSearch,
} from './lib'
import { openPaddleCheckoutForTransaction } from './lib/paddle-checkout'
import type {
  UserWalletData,
  PaymentMethod,
  PaymentOptions,
  PresetAmount,
  CreemProduct,
} from './types'

interface WalletProps {
  initialShowHistory?: boolean
  initialPaddleOrderId?: string
  initialPaddleTransactionId?: string
  initialCheckoutSearch?: WalletCheckoutSearch
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
const WALLET_CHECKOUT_SEARCH_PARAMS = [
  'amount',
  'currency',
  'amount_minor',
  'stripe_lookup_key',
] as const

function hasWalletCheckoutSearch(
  checkoutSearch: WalletCheckoutSearch | undefined
): boolean {
  return [
    checkoutSearch?.amount,
    checkoutSearch?.currency,
    checkoutSearch?.amountMinor,
    checkoutSearch?.stripeLookupKey,
  ].some(Boolean)
}

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
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [selectedPaymentOptions, setSelectedPaymentOptions] =
    useState<PaymentOptions>()
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(true)
  const [paddleCheckoutNotice, setPaddleCheckoutNotice] =
    useState<PaddleCheckoutNotice | null>(null)
  const handledPaddleTransactionRef = useRef<string | null>(null)
  const paddleCheckoutCompletedRef = useRef(false)
  const cardBoundHandledRef = useRef(false)
  const appliedCheckoutSearchRef = useRef(false)
  const [cardBoundDialogOpen, setCardBoundDialogOpen] = useState(false)

  const { currency } = useSystemConfig()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()

  // Calculate effective exchange rate - when display type is USD, use rate of 1
  const effectiveUsdExchangeRate = useMemo(() => {
    return currency?.quotaDisplayType === 'USD'
      ? 1
      : currency?.usdExchangeRate || 1
  }, [currency?.quotaDisplayType, currency?.usdExchangeRate])
  const {
    amount: paymentAmount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
  } = usePayment()
  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()
  const { redeeming, redeemCode } = useRedemption()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } =
    useWaffoPancakePayment()

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
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (props.initialShowHistory) {
      setBillingDialogOpen(true)
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

    // The card-binding bonus is granted by an async Stripe webhook, which may not
    // have arrived yet at the moment we land back here. Poll the card status until
    // the binding is confirmed, then show success and refresh; otherwise tell the
    // user it's still processing.
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
      const pendingToast = toast.loading(t('Confirming your card binding…'))
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        try {
          const res = await getCardStatus()
          if (res?.success && res.data?.card_bound) {
            // Funnel final step: card actually bound (the conversion we're chasing).
            trackAdsFunnelEvent('flatkey_cardbind_success')
            toast.dismiss(pendingToast)
            await refreshAuthUser()
            await fetchUser()
            // Celebratory confirmation that the bonus has landed.
            setCardBoundDialogOpen(true)
            return
          }
        } catch {
          // Ignore transient errors and keep polling.
        }
        await sleep(POLL_INTERVAL_MS)
      }
      // Webhook hasn't landed in time; reassure the user instead of claiming success.
      trackAdsFunnelEvent('flatkey_cardbind_pending')
      toast.dismiss(pendingToast)
      toast.info(
        t(
          'Recharge successful. Your bonus is being credited — refresh in a moment.'
        )
      )
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

    const paymentType =
      selectedPaymentMethod?.type || getDefaultPaymentType(topupInfo)

    if (!appliedCheckoutSearchRef.current) {
      const hasCheckoutSearch = hasWalletCheckoutSearch(
        props.initialCheckoutSearch
      )
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
      } else if (hasCheckoutSearch) {
        toast.error(t('Please select a top-up package'))
      }

      if (checkoutInitialAmount > 0) {
        const timeoutId = window.setTimeout(() => {
          setTopupAmount(checkoutInitialAmount)
          setSelectedPreset(checkoutInitialAmount)
          calculatePaymentAmount(checkoutInitialAmount, paymentType)
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
        calculatePaymentAmount(initialAmount, paymentType)
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [
    topupInfo,
    topupLoading,
    topupAmount,
    presetAmounts,
    selectedPaymentMethod?.type,
    calculatePaymentAmount,
    props.initialCheckoutSearch,
    t,
  ])

  // Get current payment type (selected or default)
  const getCurrentPaymentType = useCallback(() => {
    return selectedPaymentMethod?.type || getDefaultPaymentType(topupInfo)
  }, [selectedPaymentMethod, topupInfo])

  // Handle preset selection
  const handleSelectPreset = (preset: PresetAmount) => {
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
    calculatePaymentAmount(preset.value, getCurrentPaymentType())
  }

  // Handle payment method selection
  const handlePaymentMethodSelect = async (
    method: PaymentMethod,
    options?: PaymentOptions
  ) => {
    setSelectedPaymentMethod(method)
    setSelectedPaymentOptions(options)
    setPaymentLoading(method.type)

    try {
      if (!isPresetTopupAmount(topupAmount, presetAmounts)) {
        toast.error(t('Please select a top-up package'))
        return
      }

      // Validate minimum topup
      const minTopup = getMinTopupAmount(topupInfo)
      if (topupAmount < minTopup) {
        return
      }

      // Calculate payment amount and show confirmation dialog
      await calculatePaymentAmount(topupAmount, method.type)
      setConfirmDialogOpen(true)
    } finally {
      setPaymentLoading(null)
    }
  }

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    if (!selectedPaymentMethod) return

    const isPancake = isWaffoPancakePayment(selectedPaymentMethod.type)
    const success = isPancake
      ? await processWaffoPancakePayment(topupAmount)
      : await processPayment(
          topupAmount,
          selectedPaymentMethod.type,
          selectedPaymentOptions
        )

    if (success) {
      setConfirmDialogOpen(false)
      setSelectedPaymentOptions(undefined)
      await fetchUser()
    }
  }

  // Handle redemption
  const handleRedeem = async () => {
    if (!redemptionCode) return

    const success = await redeemCode(redemptionCode)
    if (success) {
      setRedemptionCode('')
      await fetchUser()
    }
  }

  // Handle transfer
  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
  }

  // Handle Creem product selection
  const handleCreemProductSelect = (product: CreemProduct) => {
    setSelectedCreemProduct(product)
    setCreemDialogOpen(true)
  }

  // Handle Creem payment confirmation
  const handleCreemConfirm = async () => {
    if (!selectedCreemProduct) return

    const success = await processCreemPayment(selectedCreemProduct.productId)
    if (success) {
      setCreemDialogOpen(false)
      setSelectedCreemProduct(null)
      await fetchUser()
    }
  }

  const handleWaffoMethodSelect = async (_method: unknown, index: number) => {
    const loadingKey = `waffo-${index}`
    setPaymentLoading(loadingKey)

    try {
      await processWaffoPayment(topupAmount, index)
    } finally {
      setPaymentLoading(null)
    }
  }

  // Get discount rate for current topup amount
  const getDiscountRate = useCallback(() => {
    return topupInfo?.discount?.[topupAmount] || DEFAULT_DISCOUNT_RATE
  }, [topupInfo, topupAmount])

  const getBonusAmount = useCallback(() => {
    const bonus = topupInfo?.bonus?.[topupAmount]
    if (typeof bonus !== 'number' || !Number.isFinite(bonus) || bonus <= 0) {
      return 0
    }
    // 该档位配置了限次且当前用户已领满（剩余为 0）→ 不再赠送。
    // bonus_remaining 缺该档位 key = 不限次，照常赠送。
    const left = topupInfo?.bonus_remaining?.[topupAmount]
    if (typeof left === 'number' && left <= 0) {
      return 0
    }
    return bonus
  }, [topupInfo, topupAmount])

  const handleSubscriptionAvailabilityChange = useCallback(
    (available: boolean) => {
      setShowSubscriptionPanel(available)
    },
    []
  )

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
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

            <WalletStatsCard user={user} loading={userLoading} />

            <div
              className={
                showSubscriptionPanel
                  ? 'grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:items-start'
                  : 'grid gap-4'
              }
            >
              <div id='wallet-add-funds' className='scroll-mt-4'>
                <RechargeFormCard
                  topupInfo={topupInfo}
                  presetAmounts={presetAmounts}
                  selectedPreset={selectedPreset}
                  onSelectPreset={handleSelectPreset}
                  topupAmount={topupAmount}
                  onPaymentMethodSelect={handlePaymentMethodSelect}
                  paymentLoading={paymentLoading}
                  redemptionCode={redemptionCode}
                  onRedemptionCodeChange={setRedemptionCode}
                  onRedeem={handleRedeem}
                  redeeming={redeeming}
                  topupLink={topupInfo?.topup_link}
                  loading={topupLoading}
                  onOpenBilling={() => setBillingDialogOpen(true)}
                  creemProducts={topupInfo?.creem_products}
                  enableCreemTopup={topupInfo?.enable_creem_topup}
                  onCreemProductSelect={handleCreemProductSelect}
                  enableWaffoTopup={topupInfo?.enable_waffo_topup}
                  waffoPayMethods={topupInfo?.waffo_pay_methods}
                  waffoMinTopup={topupInfo?.waffo_min_topup}
                  onWaffoMethodSelect={handleWaffoMethodSelect}
                  enableWaffoPancakeTopup={
                    topupInfo?.enable_waffo_pancake_topup
                  }
                />
              </div>

              <SubscriptionPlansCard
                topupInfo={topupInfo}
                onAvailabilityChange={handleSubscriptionAvailabilityChange}
                userQuota={user?.quota}
                onPurchaseSuccess={fetchUser}
              />
            </div>

            <AffiliateRewardsCard
              user={user}
              affiliateLink={affiliateLink}
              onTransfer={() => setTransferDialogOpen(true)}
              complianceConfirmed={
                topupInfo?.payment_compliance_confirmed !== false
              }
              loading={affiliateLoading}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PaymentConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handlePaymentConfirm}
        topupAmount={topupAmount}
        paymentAmount={paymentAmount}
        paymentMethod={selectedPaymentMethod}
        calculating={calculating}
        processing={processing || pancakeProcessing}
        discountRate={getDiscountRate()}
        usdExchangeRate={effectiveUsdExchangeRate}
        bonusAmount={getBonusAmount()}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />

      <BillingHistoryDialog
        open={billingDialogOpen}
        onOpenChange={setBillingDialogOpen}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />

      <Dialog open={cardBoundDialogOpen} onOpenChange={setCardBoundDialogOpen}>
        <DialogContent className='sm:max-w-md' showCloseButton>
          <DialogHeader className='items-center text-center'>
            <div className='bg-primary/10 mx-auto mb-2 flex size-14 items-center justify-center rounded-full'>
              <PartyPopper className='text-primary size-7' aria-hidden='true' />
            </div>
            <DialogTitle className='text-xl'>
              {t('Recharge successful 🎉')}
            </DialogTitle>
            <DialogDescription>
              {t('Your bonus has been credited to your wallet. Enjoy!')}
            </DialogDescription>
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
