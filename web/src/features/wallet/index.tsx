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
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { SectionPageLayout } from '@/components/layout'
import { SubscriptionPurchaseDialog } from '@/features/subscriptions/components/dialogs/subscription-purchase-dialog'
import type { PlanRecord } from '@/features/subscriptions/types'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { getSelf } from '@/lib/api'

import { getAlipayOrderStatus } from './api'
import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { CreemConfirmDialog } from './components/dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from './components/dialogs/payment-confirm-dialog'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { WechatPayDialog } from './components/dialogs/wechatpay-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { RedemptionCodeCard } from './components/redemption-code-card'
import { SubscriptionPlansCard } from './components/subscription-plans-card'
import { WalletActionCard } from './components/wallet-action-card'
import { WalletPromotionBanner } from './components/wallet-promotion-banner'
import { WalletStatsCard } from './components/wallet-stats-card'
import { WalletSubscriptionOverview } from './components/wallet-subscription-overview'
import { DEFAULT_DISCOUNT_RATE, PAYMENT_TYPES } from './constants'
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
  getDefaultPaymentType,
  getMinTopupAmount,
  dispatchSelectedPayment,
} from './lib'
import type {
  UserWalletData,
  PaymentMethod,
  PresetAmount,
  CreemProduct,
  WaffoPayMethod,
} from './types'

export function Wallet() {
  const { t } = useTranslation()
  const [pendingAlipayOrder, setPendingAlipayOrder] = useState(() => {
    try {
      return sessionStorage.getItem('alipay-pending-order') || ''
    } catch {
      return ''
    }
  })
  const alipayOrder = useQuery({
    queryKey: ['alipay-order', pendingAlipayOrder],
    enabled: !!pendingAlipayOrder,
    queryFn: () => getAlipayOrderStatus(pendingAlipayOrder),
    retry: false,
    refetchInterval: (query) =>
      query.state.error ||
      ['success', 'expired'].includes(query.state.data?.data?.status || '')
        ? false
        : 5000,
  })

  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [selectedWaffoMethodIndex, setSelectedWaffoMethodIndex] = useState<
    number | null
  >(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false)
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false)
  const [subscriptionPurchaseDialogOpen, setSubscriptionPurchaseDialogOpen] =
    useState(false)
  const [selectedSubscriptionPlan, setSelectedSubscriptionPlan] =
    useState<PlanRecord | null>(null)
  const [
    selectedSubscriptionPurchaseCount,
    setSelectedSubscriptionPurchaseCount,
  ] = useState(0)
  const [subscriptionRefreshKey, setSubscriptionRefreshKey] = useState(0)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)

  const { status } = useStatus()
  const { currency } = useSystemConfig()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()
  const subscriptionEpayMethods = useMemo(
    () =>
      (topupInfo?.pay_methods || []).filter(
        (method) =>
          method.type !== 'stripe' &&
          method.type !== 'creem' &&
          method.type !== 'alipay_direct' &&
          method.type !== 'wechatpay_native'
      ),
    [topupInfo?.pay_methods]
  )

  // Calculate effective exchange rate - when display type is USD, use rate of 1
  const effectiveUsdExchangeRate = useMemo(() => {
    return currency?.quotaDisplayType === 'USD'
      ? 1
      : currency?.usdExchangeRate || 1
  }, [currency?.quotaDisplayType, currency?.usdExchangeRate])
  const {
    wechatCheckout,
    setWechatCheckout,
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
  const { processing: waffoProcessing, processWaffoPayment } = useWaffoPayment()
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

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    const status = alipayOrder.data?.data?.status
    if (!pendingAlipayOrder || !['success', 'expired'].includes(status || '')) {
      return
    }
    try {
      sessionStorage.removeItem('alipay-pending-order')
    } catch {
      /* Storage may be unavailable. */
    }
    setPendingAlipayOrder('')
    if (status === 'success') {
      void fetchUser()
    }
  }, [alipayOrder.data, pendingAlipayOrder, fetchUser])

  // Initialize topup amount when topup info is loaded
  const topupAmountInitializedRef = useRef(false)
  useEffect(() => {
    if (topupInfo && !topupAmountInitializedRef.current) {
      topupAmountInitializedRef.current = true
      const minTopup = getMinTopupAmount(topupInfo)
      setTopupAmount(minTopup)

      // Calculate initial payment amount with default payment type
      const defaultPaymentType = getDefaultPaymentType(topupInfo)
      calculatePaymentAmount(minTopup, defaultPaymentType)

      if (
        defaultPaymentType === PAYMENT_TYPES.WAFFO &&
        topupInfo.waffo_pay_methods?.[0]
      ) {
        const method = topupInfo.waffo_pay_methods[0]
        setSelectedPaymentMethod({
          name: method.name,
          type: PAYMENT_TYPES.WAFFO,
          icon: method.icon,
          min_topup: topupInfo.waffo_min_topup,
        })
        setSelectedWaffoMethodIndex(0)
      } else {
        const defaultMethod = topupInfo.pay_methods?.find(
          (method) => method.type === defaultPaymentType
        )
        if (defaultMethod) {
          setSelectedPaymentMethod(defaultMethod)
        }
      }
    }
  }, [topupInfo, calculatePaymentAmount])

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

  // Handle topup amount change
  const handleTopupAmountChange = (amount: number) => {
    setTopupAmount(amount)
    setSelectedPreset(null)
    calculatePaymentAmount(amount, getCurrentPaymentType())
  }

  // Handle payment method selection
  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method)
    setSelectedWaffoMethodIndex(null)
    void calculatePaymentAmount(topupAmount, method.type)
  }

  const handlePaymentContinue = async () => {
    if (!selectedPaymentMethod) return

    let minimum = Math.max(
      selectedPaymentMethod.min_topup || 0,
      selectedPaymentMethod.type === PAYMENT_TYPES.WAFFO
        ? topupInfo?.waffo_min_topup || 0
        : getMinTopupAmount(topupInfo)
    )
    if (
      ['alipay_direct', 'wechatpay_native'].includes(selectedPaymentMethod.type)
    ) {
      minimum = selectedPaymentMethod.min_topup || 1
    }
    if (topupAmount < minimum) return

    if (selectedPaymentMethod.type === PAYMENT_TYPES.WAFFO) {
      if (selectedWaffoMethodIndex === null) return
      await calculatePaymentAmount(topupAmount, PAYMENT_TYPES.WAFFO)
    } else {
      await calculatePaymentAmount(topupAmount, selectedPaymentMethod.type)
    }
    setRechargeDialogOpen(false)
    setConfirmDialogOpen(true)
  }

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    if (!selectedPaymentMethod) return

    const success = await dispatchSelectedPayment(
      selectedPaymentMethod,
      topupAmount,
      selectedWaffoMethodIndex,
      {
        regular: processPayment,
        waffo: processWaffoPayment,
        waffoPancake: processWaffoPancakePayment,
      }
    )

    if (success) {
      setConfirmDialogOpen(false)
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
    setRechargeDialogOpen(false)
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

  const handleWaffoMethodSelect = (method: WaffoPayMethod, index: number) => {
    setSelectedPaymentMethod({
      name: method.name,
      type: PAYMENT_TYPES.WAFFO,
      icon: method.icon,
      min_topup: topupInfo?.waffo_min_topup,
    })
    setSelectedWaffoMethodIndex(index)
  }

  // Get discount rate for current topup amount
  const getDiscountRate = useCallback(() => {
    return topupInfo?.discount?.[topupAmount] || DEFAULT_DISCOUNT_RATE
  }, [topupInfo, topupAmount])

  return (
    <>
      <WechatPayDialog
        checkout={wechatCheckout}
        onClose={() => setWechatCheckout(null)}
        onPaid={fetchUser}
      />
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <div
              data-testid='wallet-header'
              className='bg-card overflow-hidden rounded-lg border'
            >
              <WalletStatsCard
                embedded
                user={user}
                loading={userLoading}
                subscription={
                  <WalletSubscriptionOverview
                    refreshKey={subscriptionRefreshKey}
                  />
                }
              />
            </div>

            <WalletPromotionBanner config={status?.wallet_promotion} />

            <div className='grid gap-3 sm:grid-cols-2'>
              <WalletActionCard
                kind='recharge'
                onClick={() => setRechargeDialogOpen(true)}
              />
              <WalletActionCard
                kind='subscription'
                onClick={() => setSubscriptionDialogOpen(true)}
              />
            </div>

            <RedemptionCodeCard
              topupInfo={topupInfo}
              redemptionCode={redemptionCode}
              onRedemptionCodeChange={setRedemptionCode}
              onRedeem={handleRedeem}
              redeeming={redeeming}
              topupLink={topupInfo?.topup_link}
              loading={topupLoading}
            />

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
        processing={processing || waffoProcessing || pancakeProcessing}
        discountRate={getDiscountRate()}
        usdExchangeRate={effectiveUsdExchangeRate}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />

      <Dialog
        open={rechargeDialogOpen}
        onOpenChange={setRechargeDialogOpen}
        title={t('Add Funds')}
        description={t('Choose an amount and payment method')}
        contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-2xl'
        bodyClassName='space-y-4'
      >
        <RechargeFormCard
          embedded
          topupInfo={topupInfo}
          presetAmounts={presetAmounts}
          selectedPreset={selectedPreset}
          onSelectPreset={handleSelectPreset}
          topupAmount={topupAmount}
          onTopupAmountChange={handleTopupAmountChange}
          paymentAmount={paymentAmount}
          calculating={calculating}
          onPaymentMethodSelect={handlePaymentMethodSelect}
          onPaymentContinue={handlePaymentContinue}
          selectedPaymentMethod={selectedPaymentMethod}
          selectedWaffoMethodIndex={selectedWaffoMethodIndex}
          redemptionCode={redemptionCode}
          onRedemptionCodeChange={setRedemptionCode}
          onRedeem={handleRedeem}
          redeeming={redeeming}
          topupLink={topupInfo?.topup_link}
          showRedemption={false}
          loading={topupLoading}
          priceRatio={(status?.price as number) || 1}
          usdExchangeRate={effectiveUsdExchangeRate}
          creemProducts={topupInfo?.creem_products}
          enableCreemTopup={topupInfo?.enable_creem_topup}
          onCreemProductSelect={handleCreemProductSelect}
          enableWaffoTopup={topupInfo?.enable_waffo_topup}
          waffoPayMethods={topupInfo?.waffo_pay_methods}
          waffoMinTopup={topupInfo?.waffo_min_topup}
          onWaffoMethodSelect={handleWaffoMethodSelect}
          enableWaffoPancakeTopup={topupInfo?.enable_waffo_pancake_topup}
        />
      </Dialog>

      <Dialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
        title={t('Purchase Subscription')}
        description={t('Subscribe to a plan for model access')}
        contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-4xl'
        bodyClassName='space-y-4'
      >
        <SubscriptionPlansCard
          embedded
          showOverview={false}
          topupInfo={topupInfo}
          onPlanSelect={(plan, purchaseCount) => {
            setSelectedSubscriptionPlan(plan)
            setSelectedSubscriptionPurchaseCount(purchaseCount)
            setSubscriptionDialogOpen(false)
            setSubscriptionPurchaseDialogOpen(true)
          }}
          userQuota={user?.quota}
          onPurchaseSuccess={fetchUser}
          refreshKey={subscriptionRefreshKey}
        />
      </Dialog>

      <SubscriptionPurchaseDialog
        open={subscriptionPurchaseDialogOpen}
        onOpenChange={(open) => {
          setSubscriptionPurchaseDialogOpen(open)
          if (!open) {
            setSubscriptionRefreshKey((value) => value + 1)
          }
        }}
        plan={selectedSubscriptionPlan}
        enableStripe={!!topupInfo?.enable_stripe_topup}
        enableCreem={!!topupInfo?.enable_creem_topup}
        enableWaffoPancake={!!topupInfo?.enable_waffo_pancake_topup}
        enableOnlineTopUp={!!topupInfo?.enable_online_topup}
        epayMethods={subscriptionEpayMethods}
        userQuota={user?.quota}
        onPurchaseSuccess={fetchUser}
        purchaseLimit={
          selectedSubscriptionPlan?.plan?.max_purchase_per_user
            ? Number(selectedSubscriptionPlan.plan.max_purchase_per_user)
            : undefined
        }
        purchaseCount={selectedSubscriptionPurchaseCount}
      />
    </>
  )
}
