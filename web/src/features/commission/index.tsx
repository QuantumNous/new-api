import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Gift, TrendingUp, Users, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { CopyButton } from '@/components/copy-button'
import {
  getCommissionWallet,
  getCommissionTierInfo,
  getCommissionRecords,
  transferCommissionToBalance,
  createWithdrawalRequest,
  getUserWithdrawals,
  getDownlineUsers,
} from './api'
import type {
  CommissionWallet as WalletType,
  TierInfo,
  CommissionRecord,
  WithdrawalRequest,
  DownlineUser,
} from './types'

export function Commission() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'records' | 'withdrawals' | 'downline'>('records')

  // Wallet state
  const [wallet, setWallet] = useState<WalletType | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)

  // Tier info state
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null)
  const [tierLoading, setTierLoading] = useState(true)

  // Records state
  const [records, setRecords] = useState<CommissionRecord[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsLoading, setRecordsLoading] = useState(false)

  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [withdrawalsTotal, setWithdrawalsTotal] = useState(0)
  const [withdrawalsPage, setWithdrawalsPage] = useState(1)
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false)

  // Downline state
  const [downlines, setDownlines] = useState<DownlineUser[]>([])
  const [downlinesTotal, setDownlinesTotal] = useState(0)
  const [downlinePage, setDownlinePage] = useState(1)
  const [downlineLoading, setDownlineLoading] = useState(false)

  // Dialogs
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferAmount, setTransferAmount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState(0)
  const [withdrawPayInfo, setWithdrawPayInfo] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  // Invite link from auth store (uses aff_code, not numeric user ID)
  const { user } = useAuthStore(state => state.auth)
  const inviteLink = user?.aff_code
    ? `${window.location.origin}/register?aff=${user.aff_code}`
    : `${window.location.origin}/register`

  const fetchWallet = useCallback(async () => {
    setWalletLoading(true)
    try {
      const res = await getCommissionWallet()
      if (res.success && res.data) {
        setWallet(res.data as WalletType)
      }
    } catch {
      // silently fail
    }
    setWalletLoading(false)
  }, [])

  const fetchTierInfo = useCallback(async () => {
    setTierLoading(true)
    try {
      const res = await getCommissionTierInfo()
      if (res.success && res.data) {
        setTierInfo(res.data as TierInfo)
      }
    } catch {
      // silently fail
    }
    setTierLoading(false)
  }, [])

  const fetchRecords = useCallback(async (page = 1) => {
    setRecordsLoading(true)
    try {
      const res = await getCommissionRecords(page, 20)
      if (res.success && res.data) {
        setRecords((res.data.records || []) as CommissionRecord[])
        setRecordsTotal(res.data.total || 0)
        setRecordsPage(res.data.page || 1)
      }
    } catch {
      // silently fail
    }
    setRecordsLoading(false)
  }, [])

  const fetchWithdrawals = useCallback(async (page = 1) => {
    setWithdrawalsLoading(true)
    try {
      const res = await getUserWithdrawals(page, 20)
      if (res.success && res.data) {
        setWithdrawals((res.data.withdrawals || []) as WithdrawalRequest[])
        setWithdrawalsTotal(res.data.total || 0)
        setWithdrawalsPage(res.data.page || 1)
      }
    } catch {
      // silently fail
    }
    setWithdrawalsLoading(false)
  }, [])

  const fetchDownlines = useCallback(async (page = 1) => {
    setDownlineLoading(true)
    try {
      const res = await getDownlineUsers(page, 20)
      if (res.success && res.data) {
        setDownlines((res.data.downlines || []) as DownlineUser[])
        setDownlinesTotal(res.data.total || 0)
        setDownlinePage(res.data.page || 1)
      }
    } catch {
      // silently fail
    }
    setDownlineLoading(false)
  }, [])

  useEffect(() => {
    fetchWallet()
    fetchTierInfo()
    fetchRecords()
    fetchWithdrawals()
    fetchDownlines()
  }, [fetchWallet, fetchTierInfo, fetchRecords, fetchWithdrawals, fetchDownlines])

  const handleRecordsPageChange = (page: number) => {
    fetchRecords(page)
  }

  const handleWithdrawalsPageChange = (page: number) => {
    fetchWithdrawals(page)
  }

  const handleDownlinePageChange = (page: number) => {
    fetchDownlines(page)
  }

  const handleTransfer = async () => {
    const numAmount = parseFloat(transferAmount)
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error(t('Transfer amount must be greater than 0'))
      return
    }
    if (numAmount > (wallet?.balance || 0)) {
      toast.error(t('Transfer amount cannot exceed available balance'))
      return
    }
    setTransferring(true)
    try {
      const res = await transferCommissionToBalance(numAmount)
      if (res.success) {
        toast.success(t('Transfer successful'))
        setTransferDialogOpen(false)
        setTransferAmount('')
        await fetchWallet()
      } else {
        toast.error(res.message || t('Transfer failed'))
      }
    } catch {
      toast.error(t('Transfer failed'))
    }
    setTransferring(false)
  }

  const handleWithdraw = async () => {
    if (withdrawAmount <= 0 || !withdrawPayInfo) return
    setWithdrawing(true)
    try {
      const res = await createWithdrawalRequest(withdrawAmount, withdrawPayInfo)
      if (res.success) {
        toast.success(t('Withdrawal request submitted'))
        setWithdrawDialogOpen(false)
        setWithdrawAmount(0)
        setWithdrawPayInfo('')
        fetchWallet()
        fetchWithdrawals()
      } else {
        toast.error(res.message || t('Withdrawal failed'))
      }
    } catch {
      toast.error(t('Withdrawal failed'))
    }
    setWithdrawing(false)
  }

  const formatDateTime = (ts: number) => {
    return new Date(ts * 1000).toLocaleString()
  }

  const formatMoney = (val: number | undefined | null) => {
    if (val == null) return '$0.00'
    return `$${val.toFixed(2)}`
  }

  const renderPagination = (page: number, total: number, onPageChange: (p: number) => void) => {
    const pageSize = 20
    const totalPages = Math.ceil(total / pageSize)
    if (totalPages <= 1) return null
    return (
      <div className="flex items-center justify-center gap-2 pt-4">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t('Previous')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('Next')}
        </Button>
      </div>
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('My Promotions')}</SectionPageLayout.Title>
          <SectionPageLayout.Content>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5">
          {/* Wallet Card */}
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {t('Commission Wallet')}
              </h3>
            </div>
            {walletLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : wallet ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('Balance')}</p>
                    <p className="text-2xl font-bold">{formatMoney(wallet.balance)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('Monthly Earned')}</p>
                    <p className="text-xl font-semibold text-green-600">
                      {formatMoney(wallet.monthly_earned)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('Total Earned')}</p>
                    <p className="text-xl font-semibold">{formatMoney(wallet.total_earned)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('Withdrawn')}</p>
                    <p className="text-xl font-semibold">{formatMoney(wallet.total_withdrawn)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={wallet.balance <= 0}
                    onClick={() => setTransferDialogOpen(true)}
                  >
                    {t('Transfer to Balance')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={wallet.balance <= 0}
                    onClick={() => setWithdrawDialogOpen(true)}
                  >
                    {t('Withdraw')}
                  </Button>
                </div>
              </>
            ) : null}
          </div>

          {/* Invite Card */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Gift className="h-5 w-5" />
              {t('Invite to Earn')}
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('Your referral link')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-1.5 text-sm break-all">
                    {inviteLink}
                  </code>
                  <CopyButton
                    value={inviteLink}
                    variant="outline"
                    size="sm"
                    tooltip={t('Copy referral link')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tier Progress Card */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('Commission Tier')}
            </h3>
            {tierLoading ? (
              <div className="h-16 animate-pulse rounded bg-muted" />
            ) : tierInfo ? (
              <>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">
                      {t('Current Rate')}: <strong>{(tierInfo.current_rate * 100).toFixed(1)}%</strong>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t('Active Referrals')}: <strong>{tierInfo.active_count}</strong>
                    </span>
                  </div>
                  {tierInfo.tiers.length > 0 && (
                    <>
                      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (tierInfo.active_count / Math.max(...tierInfo.tiers.map((t) => t.min_users))) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        {tierInfo.tiers.map((tier, idx) => (
                          <span key={idx}>
                            {tier.min_users}: {(tier.rate * 100).toFixed(1)}%
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {tierInfo.need_for_next > 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('Need X more to unlock next tier', { count: tierInfo.need_for_next })}
                    </p>
                  )}
                  {tierInfo.next_min_users > 0 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('Next tier: X referrals at X rate', {
                        count: tierInfo.next_min_users,
                        rate: (tierInfo.next_rate * 100).toFixed(1),
                      })}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground border-t pt-3">
                    {t('commission.effective_definition')}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {/* Tabs: Records | Withdrawals | Downline */}
          <div>
            <div className="flex border-b mb-3">
              {(['records', 'withdrawals', 'downline'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'records' && t('Commission Records')}
                  {tab === 'withdrawals' && t('Withdrawal Records')}
                  {tab === 'downline' && t('My Downline')}
                </button>
              ))}
            </div>

            {/* Commission Records Tab */}
            {activeTab === 'records' && (
              <div className="rounded-lg border bg-card">
                {recordsLoading ? (
                  <div className="p-5 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : records.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {t('No commission records yet')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">{t('Time')}</th>
                          <th className="text-left p-3 font-medium">{t('Amount')}</th>
                          <th className="text-left p-3 font-medium">{t('Rate')}</th>
                          <th className="text-left p-3 font-medium">{t('Status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3 text-muted-foreground">
                              {formatDateTime(r.created_at)}
                            </td>
                            <td className="p-3">{formatMoney(r.amount)}</td>
                            <td className="p-3">{(r.rate * 100).toFixed(1)}%</td>
                            <td className="p-3">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                                  r.status === 'settled' || r.status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : r.status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {r.status === 'settled' || r.status === 'completed'
                                  ? t('Paid')
                                  : r.status === 'pending'
                                    ? t('Pending')
                                    : r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {renderPagination(recordsPage, recordsTotal, handleRecordsPageChange)}
                  </div>
                )}
              </div>
            )}

            {/* Withdrawal Records Tab */}
            {activeTab === 'withdrawals' && (
              <div className="rounded-lg border bg-card">
                {withdrawalsLoading ? (
                  <div className="p-5 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : withdrawals.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {t('No withdrawal records yet')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">{t('Time')}</th>
                          <th className="text-left p-3 font-medium">{t('Amount')}</th>
                          <th className="text-left p-3 font-medium">{t('Status')}</th>
                          <th className="text-left p-3 font-medium">{t('Note')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map((w) => (
                          <tr key={w.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3 text-muted-foreground">
                              {formatDateTime(w.created_at)}
                            </td>
                            <td className="p-3">{formatMoney(w.amount)}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                                  w.status === 'approved'
                                    ? 'bg-green-100 text-green-700'
                                    : w.status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : w.status === 'rejected'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {w.status === 'approved'
                                  ? t('Approved')
                                  : w.status === 'pending'
                                    ? t('Pending')
                                    : w.status === 'rejected'
                                      ? t('Rejected')
                                      : w.status}
                              </span>
                            </td>
                            <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                              {w.note || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {renderPagination(withdrawalsPage, withdrawalsTotal, handleWithdrawalsPageChange)}
                  </div>
                )}
              </div>
            )}

            {/* Downline Tab */}
            {activeTab === 'downline' && (
              <div className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    {t('Total downline')}: {downlinesTotal}
                  </span>
                </div>
                {downlineLoading ? (
                  <div className="p-5 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : downlines.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {t('No downline users yet')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">{t('Username')}</th>
                          <th className="text-left p-3 font-medium">{t('Total Top-Up')}</th>
                          <th className="text-left p-3 font-medium">{t('Registered')}</th>
                          <th className="text-left p-3 font-medium">{t('Last Top-Up')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {downlines.map((d) => (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3">{d.username}</td>
                            <td className="p-3">{formatMoney(d.total_topup)}</td>
                            <td className="p-3 text-muted-foreground">
                              {formatDateTime(d.created_at)}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {d.last_topup_at > 0
                                ? formatDateTime(d.last_topup_at)
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {renderPagination(downlinePage, downlinesTotal, handleDownlinePageChange)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>

    {/* Transfer to Balance Dialog */}
    {transferDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">{t('Transfer to Balance')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {t('Amount')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  max={wallet?.balance || 0}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('Available balance')}: {formatMoney(wallet?.balance || 0)}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTransferDialogOpen(false)
                    setTransferAmount('')
                  }}
                >
                  {t('Cancel')}
                </Button>
                <Button
                  variant="default"
                  onClick={handleTransfer}
                  disabled={
                    transferring ||
                    (() => {
                      const num = parseFloat(transferAmount)
                      return isNaN(num) || num <= 0 || num > (wallet?.balance || 0)
                    })()
                  }
                >
                  {transferring ? t('Transferring...') : t('Transfer to Balance')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    {/* Withdrawal Dialog */}
    {withdrawDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">{t('Withdraw Commission')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {t('Amount')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={withdrawAmount || ''}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  placeholder="0.00"
                  max={wallet?.balance || 0}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('Available balance')}: {formatMoney(wallet?.balance || 0)}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {t('Payment Info')}
                </label>
                <textarea
                  value={withdrawPayInfo}
                  onChange={(e) => setWithdrawPayInfo(e.target.value)}
                  placeholder={t('Alipay/WeChat/PayPal account info')}
                  rows={3}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWithdrawDialogOpen(false)
                    setWithdrawAmount(0)
                    setWithdrawPayInfo('')
                  }}
                >
                  {t('Cancel')}
                </Button>
                <Button
                  variant="default"
                  onClick={handleWithdraw}
                  disabled={
                    withdrawing ||
                    withdrawAmount <= 0 ||
                    !withdrawPayInfo ||
                    withdrawAmount > (wallet?.balance || 0)
                  }
                >
                  {withdrawing ? t('Submitting...') : t('Submit')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
