import { useState, useEffect, useCallback } from 'react'
import { getSelf } from '@/lib/api'
import { AppHeader, Main } from '@/components/layout'
import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { PaymentConfirmDialog } from './components/dialogs/payment-confirm-dialog'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { WalletStatsCard } from './components/wallet-stats-card'
import { DEFAULT_DISCOUNT_RATE } from './constants'
import { useTopupInfo, usePayment, useAffiliate, useRedemption } from './hooks'
import { getDefaultPaymentType, getMinTopupAmount } from './lib'
import type { UserWalletData, PaymentMethod, PresetAmount } from './types'

export function Wallet() {
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')

  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()
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

  // Fetch and refresh user data
  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Initialize topup amount when topup info is loaded
  useEffect(() => {
    if (topupInfo && topupAmount === 0) {
      const minTopup = getMinTopupAmount(topupInfo)
      setTopupAmount(minTopup)

      // Calculate initial payment amount with default payment type
      const defaultPaymentType = getDefaultPaymentType(topupInfo)
      calculatePaymentAmount(minTopup, defaultPaymentType)
    }
  }, [topupInfo, topupAmount, calculatePaymentAmount])

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
  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    setSelectedPaymentMethod(method)
    setPaymentLoading(method.type)

    try {
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

    const success = await processPayment(
      topupAmount,
      selectedPaymentMethod.type
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

  // Get discount rate for current topup amount
  const getDiscountRate = useCallback(() => {
    return topupInfo?.discount?.[topupAmount] || DEFAULT_DISCOUNT_RATE
  }, [topupInfo, topupAmount])

  return (
    <>
      <AppHeader fixed />
      <Main>
        <div className='mb-6'>
          <h2 className='text-2xl font-bold tracking-tight'>Wallet</h2>
          <p className='text-muted-foreground'>
            Manage your balance and payment methods
          </p>
        </div>

        <div className='grid gap-6 lg:grid-cols-3'>
          {/* Left Column - Stats & Recharge */}
          <div className='space-y-6 lg:col-span-2'>
            <WalletStatsCard user={user} loading={userLoading} />
            <RechargeFormCard
              topupInfo={topupInfo}
              presetAmounts={presetAmounts}
              selectedPreset={selectedPreset}
              onSelectPreset={handleSelectPreset}
              topupAmount={topupAmount}
              onTopupAmountChange={handleTopupAmountChange}
              paymentAmount={paymentAmount}
              calculating={calculating}
              onPaymentMethodSelect={handlePaymentMethodSelect}
              paymentLoading={paymentLoading}
              redemptionCode={redemptionCode}
              onRedemptionCodeChange={setRedemptionCode}
              onRedeem={handleRedeem}
              redeeming={redeeming}
              topupLink={topupInfo?.topup_link}
              loading={topupLoading}
            />
          </div>

          {/* Right Column - Affiliate */}
          <div className='lg:col-span-1'>
            <AffiliateRewardsCard
              user={user}
              affiliateLink={affiliateLink}
              onTransfer={() => setTransferDialogOpen(true)}
              loading={affiliateLoading}
            />
          </div>
        </div>

        {/* Payment Confirmation Dialog */}
        <PaymentConfirmDialog
          open={confirmDialogOpen}
          onOpenChange={setConfirmDialogOpen}
          onConfirm={handlePaymentConfirm}
          topupAmount={topupAmount}
          paymentAmount={paymentAmount}
          paymentMethod={selectedPaymentMethod}
          calculating={calculating}
          processing={processing}
          discountRate={getDiscountRate()}
        />

        {/* Transfer Dialog */}
        <TransferDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          onConfirm={handleTransfer}
          availableQuota={user?.aff_quota ?? 0}
          transferring={transferring}
        />
      </Main>
    </>
  )
}
