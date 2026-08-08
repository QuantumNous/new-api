import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Settings, Users, Wallet, Check, X, Search, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  getCommissionDashboard,
  getCommissionConfigAdmin,
  updateCommissionConfig,
  getPromoterList,
  getAllWithdrawals,
  getAllCommissionRecords,
  reviewWithdrawal,
} from '../api'
import type {
  CommissionDashboardStats,
  CommissionConfig,
  PromoterItem,
  WithdrawalRequest,
  CommissionRecord,
} from '../types'

export function CommissionManage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'config' | 'promoters' | 'withdrawals'>('dashboard')

  // Dashboard state
  const [dashboard, setDashboard] = useState<CommissionDashboardStats | null>(null)
  const [dashLoading, setDashLoading] = useState(false)

  // Records state
  const [records, setRecords] = useState<CommissionRecord[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsFilter, setRecordsFilter] = useState('')

  // Config state
  const [config, setConfig] = useState<CommissionConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [editDefaultRate, setEditDefaultRate] = useState(0)
  const [editTiers, setEditTiers] = useState<{ min_users: number; rate: number }[]>([])
  const [editMinWithdraw, setEditMinWithdraw] = useState(0)

  // Promoters state
  const [promoters, setPromoters] = useState<PromoterItem[]>([])
  const [promotersTotal, setPromotersTotal] = useState(0)
  const [promotersPage, setPromotersPage] = useState(1)
  const [promotersLoading, setPromotersLoading] = useState(false)
  const [promoterKeyword, setPromoterKeyword] = useState('')

  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [withdrawalsTotal, setWithdrawalsTotal] = useState(0)
  const [withdrawalsPage, setWithdrawalsPage] = useState(1)
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false)
  const [withdrawFilter, setWithdrawFilter] = useState('')

  const fetchDashboard = useCallback(async () => {
    setDashLoading(true)
    try {
      const res = await getCommissionDashboard()
      if (res.success && res.data) {
        setDashboard(res.data as CommissionDashboardStats)
      }
    } catch {
      // silently fail
    }
    setDashLoading(false)
  }, [])

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await getCommissionConfigAdmin()
      if (res.success && res.data) {
        setConfig(res.data as CommissionConfig)
        setEditDefaultRate(res.data.default_rate)
        setEditTiers(res.data.tiers ? [...res.data.tiers] : [])
        setEditMinWithdraw(res.data.min_withdraw_amount ?? 0)
      }
    } catch {
      // silently fail
    }
    setConfigLoading(false)
  }, [])

  const fetchPromoters = useCallback(async (page = 1, keyword = '') => {
    setPromotersLoading(true)
    try {
      const res = await getPromoterList(page, 20, keyword)
      if (res.success && res.data) {
        setPromoters((res.data.promoters || []) as PromoterItem[])
        setPromotersTotal(res.data.total || 0)
        setPromotersPage(res.data.page || 1)
      }
    } catch {
      // silently fail
    }
    setPromotersLoading(false)
  }, [])

  const fetchWithdrawals = useCallback(async (page = 1, status = '') => {
    setWithdrawalsLoading(true)
    try {
      const res = await getAllWithdrawals(page, 20, status)
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

  const fetchRecords = useCallback(async (page = 1, status = '') => {
    setRecordsLoading(true)
    try {
      const res = await getAllCommissionRecords(page, 20, 0, status)
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

  useEffect(() => {
    fetchDashboard()
    fetchRecords()
    fetchConfig()
    fetchPromoters()
    fetchWithdrawals()
  }, [fetchDashboard, fetchRecords, fetchConfig, fetchPromoters, fetchWithdrawals])

  const handleSaveConfig = async () => {
    setConfigSaving(true)
    try {
      const res = await updateCommissionConfig({
        default_rate: editDefaultRate,
        tiers: editTiers.filter((t) => t.min_users > 0),
        min_withdraw_amount: editMinWithdraw,
      })
      if (res.success) {
        toast.success(t('Configuration saved'))
        fetchConfig()
      } else {
        toast.error(res.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    }
    setConfigSaving(false)
  }

  const handleReview = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res = await reviewWithdrawal(id, action)
      if (res.success) {
        toast.success(action === 'approve' ? t('Approved') : t('Rejected'))
        fetchWithdrawals(withdrawalsPage, withdrawFilter)
        fetchDashboard()
      } else {
        toast.error(res.message || t('Operation failed'))
      }
    } catch {
      toast.error(t('Operation failed'))
    }
  }

  const handleSearchPromoters = () => {
    fetchPromoters(1, promoterKeyword)
  }

  const formatMoney = (val: number | undefined | null) => {
    if (val == null) return '$0.00'
    return `$${val.toFixed(2)}`
  }

  const formatDateTime = (ts: number | undefined) => {
    if (!ts) return '-'
    return new Date(ts * 1000).toLocaleString()
  }

  const renderPagination = (page: number, total: number, onPageChange: (p: number) => void) => {
    const pageSize = 20
    const totalPages = Math.ceil(total / pageSize)
    if (totalPages <= 1) return null
    return (
      <div className="flex items-center justify-center gap-2 pt-4">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {t('Previous')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {t('Next')}
        </Button>
      </div>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Commission Management')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className="flex border-b mb-4">
          {(['dashboard', 'records', 'config', 'promoters', 'withdrawals'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'dashboard' && <BarChart3 className="h-4 w-4" />}
              {tab === 'records' && <Receipt className="h-4 w-4" />}
              {tab === 'config' && <Settings className="h-4 w-4" />}
              {tab === 'promoters' && <Users className="h-4 w-4" />}
              {tab === 'withdrawals' && <Wallet className="h-4 w-4" />}
              {tab === 'dashboard' && t('Dashboard')}
              {tab === 'records' && t('Commission Records')}
              {tab === 'config' && t('Commission Config')}
              {tab === 'promoters' && t('Promoters')}
              {tab === 'withdrawals' && t('Withdrawals Review')}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            {dashLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : dashboard ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">{t('Total Commission Paid')}</p>
                    <p className="text-2xl font-bold mt-1">{formatMoney(dashboard.total_commission_paid)}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">{t('Active Promoters')}</p>
                    <p className="text-2xl font-bold mt-1">{dashboard.active_promoters}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">{t('Pending Withdrawals')}</p>
                    <p className="text-2xl font-bold mt-1">{dashboard.pending_withdrawals}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">{t('Pending Amount')}</p>
                    <p className="text-2xl font-bold mt-1">{formatMoney(dashboard.pending_withdrawal_amount)}</p>
                  </div>
                </div>

                {dashboard.tier_distribution && dashboard.tier_distribution.length > 0 && (
                  <div className="rounded-lg border bg-card p-4 mb-6">
                    <h4 className="text-sm font-semibold mb-3">{t('Tier Distribution')}</h4>
                    <div className="space-y-2">
                      {dashboard.tier_distribution.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-sm w-20">{item.rate}</span>
                          <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                            <div
                              className="h-full rounded bg-primary"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (item.count / Math.max(...dashboard.tier_distribution.map((t) => t.count))) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-10 text-right">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dashboard.top_promoters && dashboard.top_promoters.length > 0 && (
                  <div className="rounded-lg border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-3">{t('Top Promoters')}</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">{t('Username')}</th>
                          <th className="text-right p-2 font-medium">{t('Total Earned')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.top_promoters.map((p, idx) => (
                          <tr key={p.id || idx} className="border-b last:border-0">
                            <td className="p-2">{p.username}</td>
                            <td className="p-2 text-right">{formatMoney(p.total_earned)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Records Tab */}
        {activeTab === 'records' && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 p-3 border-b">
              {['', 'pending', 'paid', 'cancelled'].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setRecordsFilter(s)
                    fetchRecords(1, s)
                  }}
                  className={`px-3 py-1 text-sm rounded-full border ${
                    recordsFilter === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s === '' ? t('All') : s === 'pending' ? t('Pending') : s === 'paid' ? t('Paid') : t('Cancelled')}
                </button>
              ))}
              <span className="text-sm text-muted-foreground ml-auto">
                {t('Total')}: {recordsTotal}
              </span>
            </div>
            {recordsLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t('No commission records')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">ID</th>
                      <th className="text-left p-3 font-medium">{t('Promoter')}</th>
                      <th className="text-left p-3 font-medium">{t('From User')}</th>
                      <th className="text-left p-3 font-medium">{t('Amount')}</th>
                      <th className="text-left p-3 font-medium">{t('Rate')}</th>
                      <th className="text-left p-3 font-medium">{t('Status')}</th>
                      <th className="text-left p-3 font-medium">{t('Created')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-3">{r.id}</td>
                        <td className="p-3">{r.username || r.user_id}</td>
                        <td className="p-3">{r.from_user_id}</td>
                        <td className="p-3">{formatMoney(r.amount)}</td>
                        <td className="p-3">{(r.rate * 100).toFixed(1)}%</td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                              r.status === 'paid' || r.status === 'settled'
                                ? 'bg-green-100 text-green-700'
                                : r.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : r.status === 'cancelled'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {r.status === 'paid' || r.status === 'settled'
                              ? t('Paid')
                              : r.status === 'pending'
                                ? t('Pending')
                                : r.status === 'cancelled'
                                  ? t('Cancelled')
                                  : r.status}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{formatDateTime(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renderPagination(recordsPage, recordsTotal, (page) => fetchRecords(page, recordsFilter))}
              </div>
            )}
          </div>
        )}

        {/* Config Tab */}
        {activeTab === 'config' && (
          <div className="max-w-lg rounded-lg border bg-card p-5">
            {configLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('Default Commission Rate')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editDefaultRate}
                      onChange={(e) => setEditDefaultRate(Number(e.target.value))}
                      step="0.01"
                      min="0"
                      max="1"
                      className="w-32 rounded border px-3 py-2 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">
                      ({(editDefaultRate * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {t('Minimum Withdrawal Amount (USD)')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editMinWithdraw}
                      onChange={(e) => setEditMinWithdraw(Number(e.target.value))}
                      min="0"
                      step="0.01"
                      className="w-32 rounded border px-3 py-2 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">
                      (0 = {t('no limit')})
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">{t('Tiered Rates')}</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditTiers([...editTiers, { min_users: 0, rate: 0 }])}
                    >
                      {t('Add Tier')}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editTiers.map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">{t('Min')}</span>
                        <input
                          type="number"
                          value={tier.min_users}
                          onChange={(e) => {
                            const newTiers = [...editTiers]
                            newTiers[idx] = { ...newTiers[idx], min_users: Number(e.target.value) }
                            setEditTiers(newTiers)
                          }}
                          min="0"
                          className="w-20 rounded border px-2 py-1.5 text-sm"
                        />
                        <span className="text-sm text-muted-foreground">{t('users')}</span>
                        <input
                          type="number"
                          value={tier.rate}
                          onChange={(e) => {
                            const newTiers = [...editTiers]
                            newTiers[idx] = { ...newTiers[idx], rate: Number(e.target.value) }
                            setEditTiers(newTiers)
                          }}
                          step="0.01"
                          min="0"
                          max="1"
                          className="w-20 rounded border px-2 py-1.5 text-sm"
                        />
                        <span className="text-sm text-muted-foreground">
                          ({(tier.rate * 100).toFixed(1)}%)
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditTiers(editTiers.filter((_, i) => i !== idx))}
                        >
                          {t('Remove')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <Button variant="default" onClick={handleSaveConfig} disabled={configSaving}>
                  {configSaving ? t('Saving...') : t('Save')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Promoters Tab */}
        {activeTab === 'promoters' && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 p-3 border-b">
              <div className="flex items-center gap-1 flex-1 max-w-xs">
                <input
                  type="text"
                  value={promoterKeyword}
                  onChange={(e) => setPromoterKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPromoters()}
                  placeholder={t('Search by username...')}
                  className="flex-1 rounded border px-3 py-1.5 text-sm"
                />
                <Button variant="outline" size="sm" onClick={handleSearchPromoters}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                {t('Total')}: {promotersTotal}
              </span>
            </div>
            {promotersLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : promoters.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t('No promoters found')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">{t('Username')}</th>
                      <th className="text-left p-3 font-medium">{t('Active Referrals')}</th>
                      <th className="text-left p-3 font-medium">{t('Rate')}</th>
                      <th className="text-left p-3 font-medium">{t('Balance')}</th>
                      <th className="text-left p-3 font-medium">{t('Total Earned')}</th>
                      <th className="text-left p-3 font-medium">{t('Withdrawn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promoters.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-3">{p.username}</td>
                        <td className="p-3">{p.active_aff_count}</td>
                        <td className="p-3">{(p.commission_rate * 100).toFixed(1)}%</td>
                        <td className="p-3">{formatMoney(p.wallet_balance)}</td>
                        <td className="p-3">{formatMoney(p.total_earned)}</td>
                        <td className="p-3">{formatMoney(p.total_withdrawn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renderPagination(promotersPage, promotersTotal, (page) => fetchPromoters(page, promoterKeyword))}
              </div>
            )}
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 p-3 border-b">
              {['', 'pending', 'approved', 'rejected'].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setWithdrawFilter(s)
                    fetchWithdrawals(1, s)
                  }}
                  className={`px-3 py-1 text-sm rounded-full border ${
                    withdrawFilter === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s === '' ? t('All') : s === 'pending' ? t('Pending') : s === 'approved' ? t('Approved') : t('Rejected')}
                </button>
              ))}
              <span className="text-sm text-muted-foreground ml-auto">
                {t('Total')}: {withdrawalsTotal}
              </span>
            </div>
            {withdrawalsLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t('No withdrawal requests')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">{t('User')}</th>
                      <th className="text-left p-3 font-medium">{t('Amount')}</th>
                      <th className="text-left p-3 font-medium">{t('Pay Info')}</th>
                      <th className="text-left p-3 font-medium">{t('Status')}</th>
                      <th className="text-left p-3 font-medium">{t('Created')}</th>
                      <th className="text-left p-3 font-medium">{t('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-3">{w.username || w.user_id}</td>
                        <td className="p-3">{formatMoney(w.amount)}</td>
                        <td className="p-3 max-w-[150px] truncate" title={w.pay_info}>
                          {w.pay_info || '-'}
                        </td>
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
                        <td className="p-3 text-muted-foreground">{formatDateTime(w.created_at)}</td>
                        <td className="p-3">
                          {w.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600"
                                onClick={() => handleReview(w.id, 'approve')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => handleReview(w.id, 'reject')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renderPagination(withdrawalsPage, withdrawalsTotal, (page) => fetchWithdrawals(page, withdrawFilter))}
              </div>
            )}
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
