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
import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatTimestamp } from '@/lib/format'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import {
  exportAdminAffiliateCommissionsCsv,
  getAdminAffiliateCommissions,
  getAdminAffiliateSummary,
  settleAffiliateCommissions,
} from './api'
import type {
  AffiliateCommission,
  AffiliateCommissionFilters,
  AffiliateCommissionQuery,
  AffiliateCommissionStatus,
} from './types'

const PAGE_SIZE = 20

type AffiliateCommissionOrderStatus = AffiliateCommissionStatus | 'mixed'

interface AffiliateCommissionOrderGroup {
  key: string
  tradeNo: string
  buyerId: number
  buyerUsername?: string
  baseAmountMicros: number
  totalCommissionAmountMicros: number
  currency: string
  paymentProvider: string
  paymentMethod: string
  createdAt: number
  directUplineId?: number
  directUplineUsername?: string
  directUplineDistributionEnabled?: boolean
  secondUplineId?: number
  secondUplineUsername?: string
  secondUplineDistributionEnabled?: boolean
  status: AffiliateCommissionOrderStatus
  records: AffiliateCommission[]
  pendingRecords: AffiliateCommission[]
  level1?: AffiliateCommission
  level2?: AffiliateCommission
}

interface PromoterPayoutInfo {
  method?: string
  account?: string
  accountName?: string
  isSnapshot: boolean
}

interface SettlementPromoterGroup {
  promoterId: number
  promoterUsername?: string
  payoutMethod?: string
  payoutAccount?: string
  payoutAccountName?: string
  amountMicros: number
  currency: string
  recordCount: number
  missingPayout: boolean
}

function formatMicros(micros: number | undefined, currency?: string) {
  const value = ((micros || 0) / 1_000_000).toFixed(2)
  return `${value} ${currency || ''}`.trim()
}

function statusVariant(
  status: AffiliateCommissionOrderStatus
): 'secondary' | 'outline' {
  return status === 'pending' ? 'secondary' : 'outline'
}

function getOrderStatus(
  records: AffiliateCommission[]
): AffiliateCommissionOrderStatus {
  const hasPending = records.some((record) => record.status === 'pending')
  const hasSettled = records.some((record) => record.status === 'settled')
  if (hasPending && hasSettled) return 'mixed'
  return hasPending ? 'pending' : 'settled'
}

function getPayoutInfo(record?: AffiliateCommission): PromoterPayoutInfo {
  if (!record) {
    return { isSnapshot: false }
  }
  if (record.status === 'settled' && record.settled_payout_account) {
    return {
      method: record.settled_payout_method,
      account: record.settled_payout_account,
      accountName: record.settled_payout_account_name,
      isSnapshot: true,
    }
  }
  return {
    method: record.promoter_payout_method,
    account: record.promoter_payout_account,
    accountName: record.promoter_payout_account_name,
    isSnapshot: false,
  }
}

function hasPayoutAccount(payout: PromoterPayoutInfo) {
  return Boolean(payout.account?.trim())
}

function groupSelectedCommissionsByPromoter(
  records: AffiliateCommission[]
): SettlementPromoterGroup[] {
  const groups = new Map<number, SettlementPromoterGroup>()

  records.forEach((record) => {
    const current = groups.get(record.promoter_id)
    const payout = getPayoutInfo(record)
    if (!current) {
      groups.set(record.promoter_id, {
        promoterId: record.promoter_id,
        promoterUsername: record.promoter_username,
        payoutMethod: payout.method,
        payoutAccount: payout.account,
        payoutAccountName: payout.accountName,
        amountMicros: record.commission_amount_micros,
        currency: record.currency,
        recordCount: 1,
        missingPayout: !hasPayoutAccount(payout),
      })
      return
    }

    current.amountMicros += record.commission_amount_micros
    current.recordCount += 1
    current.missingPayout ||= !hasPayoutAccount(payout)
    if (!current.payoutAccount && payout.account) {
      current.payoutMethod = payout.method
      current.payoutAccount = payout.account
      current.payoutAccountName = payout.accountName
    }
  })

  return Array.from(groups.values()).sort(
    (a, b) => b.amountMicros - a.amountMicros
  )
}

function groupCommissionsByOrder(
  records: AffiliateCommission[]
): AffiliateCommissionOrderGroup[] {
  const groups = new Map<
    string,
    Omit<AffiliateCommissionOrderGroup, 'status'>
  >()

  records.forEach((record) => {
    const key = `${record.trade_no}:${record.buyer_id}`
    const current = groups.get(key)
    if (!current) {
      groups.set(key, {
        key,
        tradeNo: record.trade_no,
        buyerId: record.buyer_id,
        buyerUsername: record.buyer_username,
        baseAmountMicros: record.base_amount_micros,
        totalCommissionAmountMicros: record.commission_amount_micros,
        currency: record.currency,
        paymentProvider: record.payment_provider,
        paymentMethod: record.payment_method,
        createdAt: record.created_at,
        directUplineId: record.buyer_direct_inviter_id ?? undefined,
        directUplineUsername: record.buyer_direct_inviter_username ?? undefined,
        directUplineDistributionEnabled:
          record.buyer_direct_inviter_distribution_enabled ?? undefined,
        secondUplineId: record.buyer_second_inviter_id ?? undefined,
        secondUplineUsername: record.buyer_second_inviter_username ?? undefined,
        secondUplineDistributionEnabled:
          record.buyer_second_inviter_distribution_enabled ?? undefined,
        records: [record],
        pendingRecords: record.status === 'pending' ? [record] : [],
        level1: record.level === 1 ? record : undefined,
        level2: record.level === 2 ? record : undefined,
      })
      return
    }

    current.records.push(record)
    if (record.status === 'pending') {
      current.pendingRecords.push(record)
    }
    if (record.level === 1) {
      current.level1 = record
    } else {
      current.level2 = record
    }
    current.totalCommissionAmountMicros += record.commission_amount_micros
    current.baseAmountMicros = Math.max(
      current.baseAmountMicros,
      record.base_amount_micros
    )
    current.createdAt = Math.min(current.createdAt, record.created_at)
    current.directUplineId ||= record.buyer_direct_inviter_id ?? undefined
    current.directUplineUsername ||=
      record.buyer_direct_inviter_username ?? undefined
    current.directUplineDistributionEnabled ??=
      record.buyer_direct_inviter_distribution_enabled ?? undefined
    current.secondUplineId ||= record.buyer_second_inviter_id ?? undefined
    current.secondUplineUsername ||=
      record.buyer_second_inviter_username ?? undefined
    current.secondUplineDistributionEnabled ??=
      record.buyer_second_inviter_distribution_enabled ?? undefined
  })

  return Array.from(groups.values()).map((group) => {
    const records = [...group.records].sort((a, b) => a.level - b.level)
    return {
      ...group,
      records,
      pendingRecords: group.pendingRecords.sort((a, b) => a.level - b.level),
      status: getOrderStatus(records),
    }
  })
}

function toQuery(
  filters: AffiliateCommissionFilters,
  page: number
): AffiliateCommissionQuery {
  return {
    ...filters,
    p: page,
    page_size: PAGE_SIZE,
  }
}

export function AffiliateCommissions() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<AffiliateCommissionFilters>({
    status: '',
    level: '',
    promoter_id: '',
    buyer_id: '',
    trade_no: '',
  })
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [expandedOrderKeys, setExpandedOrderKeys] = useState<string[]>([])
  const [settleOpen, setSettleOpen] = useState(false)
  const [settleRemark, setSettleRemark] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const query = useMemo(() => toQuery(filters, page), [filters, page])

  const commissionsQuery = useQuery({
    queryKey: ['affiliate-commissions', query],
    queryFn: () => getAdminAffiliateCommissions(query),
  })

  const summaryQuery = useQuery({
    queryKey: ['affiliate-commissions-summary', filters],
    queryFn: () => getAdminAffiliateSummary(filters),
  })

  const settleMutation = useMutation({
    mutationFn: () => settleAffiliateCommissions(selectedIds, settleRemark),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to settle commissions'))
        return
      }
      toast.success(t('Commissions marked as settled'))
      setSettleOpen(false)
      setSettleRemark('')
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['affiliate-commissions'] })
      queryClient.invalidateQueries({
        queryKey: ['affiliate-commissions-summary'],
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to settle commissions'))
    },
  })

  const data = commissionsQuery.data?.data
  const rows = data?.items || []
  const orderGroups = useMemo(() => groupCommissionsByOrder(rows), [rows])
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pendingRows = useMemo(
    () => orderGroups.flatMap((group) => group.pendingRecords),
    [orderGroups]
  )
  const selectedPendingRows = useMemo(
    () => pendingRows.filter((row) => selectedIds.includes(row.id)),
    [pendingRows, selectedIds]
  )
  const settlementGroups = useMemo(
    () => groupSelectedCommissionsByPromoter(selectedPendingRows),
    [selectedPendingRows]
  )
  const hasMissingPayout = settlementGroups.some((group) => group.missingPayout)
  const selectedOrderCount = orderGroups.filter((group) =>
    group.pendingRecords.some((record) => selectedIds.includes(record.id))
  ).length
  const allPendingSelected =
    pendingRows.length > 0 &&
    pendingRows.every((row) => selectedIds.includes(row.id))
  const summary = summaryQuery.data?.data

  const updateFilter = (
    key: keyof AffiliateCommissionFilters,
    value: string
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
    setSelectedIds([])
  }

  const toggleSelected = (
    group: AffiliateCommissionOrderGroup,
    checked: boolean
  ) => {
    if (group.pendingRecords.length === 0) return
    const groupIds = group.pendingRecords.map((record) => record.id)
    setSelectedIds((prev) =>
      checked
        ? [...new Set([...prev, ...groupIds])]
        : prev.filter((id) => !groupIds.includes(id))
    )
  }

  const isOrderSelected = (group: AffiliateCommissionOrderGroup) =>
    group.pendingRecords.length > 0 &&
    group.pendingRecords.every((record) => selectedIds.includes(record.id))

  const toggleSelectAllPending = (checked: boolean) => {
    setSelectedIds((prev) => {
      const pendingIds = pendingRows.map((row) => row.id)
      if (checked) return [...new Set([...prev, ...pendingIds])]
      return prev.filter((id) => !pendingIds.includes(id))
    })
  }

  const exportCsv = async () => {
    setIsExporting(true)
    try {
      const { blob, filename } =
        await exportAdminAffiliateCommissionsCsv(filters)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to export CSV')
      )
    } finally {
      setIsExporting(false)
    }
  }

  const toggleExpanded = (key: string) => {
    setExpandedOrderKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }

  const renderStatus = (status: AffiliateCommissionOrderStatus) => {
    if (status === 'mixed') return t('Mixed')
    return status === 'pending' ? t('Pending') : t('Settled')
  }

  const renderPayoutStatus = (record?: AffiliateCommission) => {
    if (!record) return null
    const payout = getPayoutInfo(record)
    if (hasPayoutAccount(payout)) {
      return (
        <div className='mt-1 flex min-w-0 flex-wrap items-center gap-1.5'>
          <Badge variant='outline' className='max-w-full'>
            <span className='truncate'>PayPal: {payout.account}</span>
          </Badge>
          {payout.accountName ? (
            <span className='text-muted-foreground max-w-full truncate text-xs'>
              {payout.accountName}
            </span>
          ) : null}
          {payout.isSnapshot ? (
            <Badge variant='secondary'>{t('Settlement snapshot')}</Badge>
          ) : null}
        </div>
      )
    }
    return (
      <div className='text-destructive mt-1 flex items-center gap-1 text-xs'>
        <AlertCircle className='size-3.5 shrink-0' />
        {t('Missing PayPal, cannot settle')}
      </div>
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Affiliate Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t(
            'Manage wallet top-up affiliate commissions and offline settlement'
          )}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <Button
            variant='outline'
            onClick={() => {
              commissionsQuery.refetch()
              summaryQuery.refetch()
            }}
          >
            <RefreshCw className='size-4' />
            {t('Refresh')}
          </Button>
          <Button variant='outline' onClick={exportCsv} disabled={isExporting}>
            <Download className='size-4' />
            {isExporting ? t('Exporting...') : t('Export CSV')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4'>
            <div className='grid gap-3 sm:grid-cols-3'>
              {[
                [
                  t('Pending Commissions'),
                  formatMicros(
                    summary?.pending_amount_micros,
                    summary?.currency
                  ),
                  summary?.pending_count || 0,
                ],
                [
                  t('Settled Commissions'),
                  formatMicros(
                    summary?.settled_amount_micros,
                    summary?.currency
                  ),
                  summary?.settled_count || 0,
                ],
                [
                  t('Total Commissions'),
                  formatMicros(summary?.total_amount_micros, summary?.currency),
                  summary?.total_count || 0,
                ],
              ].map(([label, amount, count]) => (
                <Card key={String(label)}>
                  <CardHeader className='pb-2'>
                    <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                      <WalletCards className='text-muted-foreground size-4' />
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-semibold tabular-nums'>
                      {amount}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {t('{{count}} records', { count })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className='space-y-4 p-4'>
                <div className='grid gap-3 md:grid-cols-6'>
                  <div className='space-y-1.5'>
                    <Label>{t('Status')}</Label>
                    <NativeSelect
                      className='w-full'
                      value={filters.status || ''}
                      onChange={(e) => updateFilter('status', e.target.value)}
                    >
                      <NativeSelectOption value=''>
                        {t('All statuses')}
                      </NativeSelectOption>
                      <NativeSelectOption value='pending'>
                        {t('Pending')}
                      </NativeSelectOption>
                      <NativeSelectOption value='settled'>
                        {t('Settled')}
                      </NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>{t('Level')}</Label>
                    <NativeSelect
                      className='w-full'
                      value={filters.level || ''}
                      onChange={(e) => updateFilter('level', e.target.value)}
                    >
                      <NativeSelectOption value=''>
                        {t('All levels')}
                      </NativeSelectOption>
                      <NativeSelectOption value='1'>
                        {t('Level 1')}
                      </NativeSelectOption>
                      <NativeSelectOption value='2'>
                        {t('Level 2')}
                      </NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>{t('Promoter ID')}</Label>
                    <Input
                      value={filters.promoter_id || ''}
                      onChange={(e) =>
                        updateFilter('promoter_id', e.target.value)
                      }
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>{t('Buyer ID')}</Label>
                    <Input
                      value={filters.buyer_id || ''}
                      onChange={(e) => updateFilter('buyer_id', e.target.value)}
                    />
                  </div>
                  <div className='space-y-1.5 md:col-span-2'>
                    <Label>{t('Trade No')}</Label>
                    <Input
                      value={filters.trade_no || ''}
                      onChange={(e) => updateFilter('trade_no', e.target.value)}
                    />
                  </div>
                </div>

                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='text-muted-foreground text-sm'>
                    {selectedIds.length > 0
                      ? t(
                          '{{orderCount}} orders selected, {{commissionCount}} pending commissions',
                          {
                            orderCount: selectedOrderCount,
                            commissionCount: selectedIds.length,
                          }
                        )
                      : t('{{count}} selected', { count: 0 })}
                  </div>
                  <Button
                    disabled={selectedIds.length === 0}
                    onClick={() => setSettleOpen(true)}
                  >
                    {t('Mark selected as settled')}
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-10'>
                        <Checkbox
                          checked={allPendingSelected}
                          onCheckedChange={(value) =>
                            toggleSelectAllPending(Boolean(value))
                          }
                          aria-label={t('Select pending orders')}
                        />
                      </TableHead>
                      <TableHead>{t('Trade No')}</TableHead>
                      <TableHead>{t('Buyer')}</TableHead>
                      <TableHead>{t('Order Amount')}</TableHead>
                      <TableHead>{t('Order Commission')}</TableHead>
                      <TableHead>{t('Status')}</TableHead>
                      <TableHead>{t('Created At')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderGroups.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='text-muted-foreground h-24 text-center'
                        >
                          {commissionsQuery.isLoading
                            ? t('Loading...')
                            : t('No commission records')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      orderGroups.map((group) => {
                        const expanded = expandedOrderKeys.includes(group.key)
                        return (
                          <Fragment key={group.key}>
                            <TableRow className='border-b-0'>
                              <TableCell>
                                <Checkbox
                                  checked={isOrderSelected(group)}
                                  disabled={group.pendingRecords.length === 0}
                                  onCheckedChange={(value) =>
                                    toggleSelected(group, Boolean(value))
                                  }
                                  aria-label={t('Select order')}
                                />
                              </TableCell>
                              <TableCell className='min-w-56'>
                                <div className='font-mono text-xs'>
                                  {group.tradeNo}
                                </div>
                                <div className='text-muted-foreground mt-1 text-xs'>
                                  {t('Payment Method')}: {group.paymentProvider}
                                  {group.paymentMethod
                                    ? ` / ${group.paymentMethod}`
                                    : ''}
                                </div>
                              </TableCell>
                              <TableCell>
                                #{group.buyerId}{' '}
                                <span className='text-muted-foreground'>
                                  {group.buyerUsername || ''}
                                </span>
                              </TableCell>
                              <TableCell className='tabular-nums'>
                                {formatMicros(
                                  group.baseAmountMicros,
                                  group.currency
                                )}
                              </TableCell>
                              <TableCell className='tabular-nums'>
                                {formatMicros(
                                  group.totalCommissionAmountMicros,
                                  group.currency
                                )}
                                <div className='text-muted-foreground text-xs'>
                                  {t('{{count}} records', {
                                    count: group.records.length,
                                  })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant(group.status)}>
                                  {renderStatus(group.status)}
                                </Badge>
                              </TableCell>
                              <TableCell className='text-muted-foreground'>
                                {formatTimestamp(group.createdAt)}
                              </TableCell>
                            </TableRow>
                            <TableRow
                              className={
                                expanded
                                  ? 'border-b-0 hover:bg-transparent'
                                  : 'hover:bg-transparent'
                              }
                            >
                              <TableCell colSpan={7} className='h-8 p-0'>
                                <div className='flex justify-center'>
                                  <Button
                                    variant='ghost'
                                    size='icon-sm'
                                    aria-expanded={expanded}
                                    aria-label={
                                      expanded
                                        ? t('Collapse Order Details')
                                        : t('Expand Order Details')
                                    }
                                    className='text-muted-foreground rounded-full'
                                    onClick={() => toggleExpanded(group.key)}
                                  >
                                    {expanded ? (
                                      <ChevronUp className='size-4' />
                                    ) : (
                                      <ChevronDown className='size-4' />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {expanded && (
                              <TableRow className='bg-muted/20 hover:bg-muted/20'>
                                <TableCell colSpan={7} className='p-0 pb-3'>
                                  <div className='bg-background/80 mx-4 overflow-hidden rounded-md border'>
                                    <div className='text-muted-foreground border-b px-3 py-2 text-xs font-medium'>
                                      {t('Commission Details')}
                                    </div>
                                    <div className='divide-y'>
                                      {[
                                        {
                                          label: t('Direct Upline'),
                                          level: t('Level 1'),
                                          userId:
                                            group.directUplineId ||
                                            group.level1?.promoter_id,
                                          username:
                                            group.directUplineUsername ||
                                            group.level1?.promoter_username,
                                          distributionEnabled:
                                            group.directUplineDistributionEnabled,
                                          record: group.level1,
                                        },
                                        {
                                          label: t('Second Upline'),
                                          level: t('Level 2'),
                                          userId:
                                            group.secondUplineId ||
                                            group.level2?.promoter_id,
                                          username:
                                            group.secondUplineUsername ||
                                            group.level2?.promoter_username,
                                          distributionEnabled:
                                            group.secondUplineDistributionEnabled,
                                          record: group.level2,
                                        },
                                      ].map(
                                        ({
                                          label,
                                          level,
                                          userId,
                                          username,
                                          distributionEnabled,
                                          record,
                                        }) => (
                                          <div
                                            key={level}
                                            className='grid gap-3 px-3 py-3 md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center'
                                          >
                                            <div>
                                              <div className='font-medium'>
                                                {label}
                                              </div>
                                              <div className='text-muted-foreground text-xs'>
                                                {level}
                                              </div>
                                            </div>
                                            <div>
                                              <div className='text-muted-foreground text-xs'>
                                                {t('Promoter')}
                                              </div>
                                              {userId ? (
                                                <div>
                                                  #{userId}{' '}
                                                  <span className='text-muted-foreground'>
                                                    {username || ''}
                                                  </span>
                                                  {renderPayoutStatus(record)}
                                                </div>
                                              ) : (
                                                <div className='text-muted-foreground'>
                                                  {t('No Qualified Promoter')}
                                                </div>
                                              )}
                                            </div>
                                            <div>
                                              <div className='text-muted-foreground text-xs'>
                                                {t('Commission')}
                                              </div>
                                              {record ? (
                                                <div className='tabular-nums'>
                                                  {formatMicros(
                                                    record.commission_amount_micros,
                                                    record.currency
                                                  )}
                                                  <span className='text-muted-foreground ml-2 text-xs'>
                                                    {record.commission_rate_bps /
                                                      100}
                                                    %
                                                  </span>
                                                </div>
                                              ) : (
                                                <div className='text-muted-foreground'>
                                                  {t('No commission records')}
                                                </div>
                                              )}
                                            </div>
                                            <div>
                                              {record ? (
                                                <Badge
                                                  variant={statusVariant(
                                                    record.status
                                                  )}
                                                >
                                                  {renderStatus(record.status)}
                                                </Badge>
                                              ) : distributionEnabled ===
                                                false ? (
                                                <Badge variant='outline'>
                                                  {t('Agent disabled')}
                                                </Badge>
                                              ) : null}
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        )
                      })
                    )}
                  </TableBody>
                </Table>

                <div className='flex items-center justify-between gap-2'>
                  <p className='text-muted-foreground text-sm'>
                    {t('Page {{page}} of {{total}}', {
                      page,
                      total: totalPages,
                    })}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      disabled={page <= 1}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      {t('Previous')}
                    </Button>
                    <Button
                      variant='outline'
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      {t('Next')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Settle commissions')}</DialogTitle>
            <DialogDescription>
              {t(
                'Selected pending commissions will be marked as settled after offline PayPal payout.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <div className='space-y-2'>
              <div className='text-sm font-medium'>
                {t('Offline payout summary by promoter')}
              </div>
              <div className='max-h-72 overflow-y-auto rounded-md border'>
                {settlementGroups.length === 0 ? (
                  <div className='text-muted-foreground p-3 text-sm'>
                    {t('No commission records')}
                  </div>
                ) : (
                  <div className='divide-y'>
                    {settlementGroups.map((group) => (
                      <div
                        key={group.promoterId}
                        className='grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto] sm:items-center'
                      >
                        <div className='min-w-0'>
                          <div className='text-muted-foreground text-xs'>
                            {t('Promoter')}
                          </div>
                          <div className='truncate font-medium'>
                            #{group.promoterId}{' '}
                            <span className='text-muted-foreground'>
                              {group.promoterUsername || ''}
                            </span>
                          </div>
                          <div className='text-muted-foreground mt-1 text-xs'>
                            {t('{{count}} records', {
                              count: group.recordCount,
                            })}
                          </div>
                        </div>
                        <div className='min-w-0'>
                          <div className='text-muted-foreground text-xs'>
                            {t('Payout account')}
                          </div>
                          {group.missingPayout ? (
                            <div className='text-destructive mt-0.5 flex items-center gap-1 text-sm'>
                              <AlertCircle className='size-3.5 shrink-0' />
                              {t('Missing PayPal, cannot settle')}
                            </div>
                          ) : (
                            <div className='min-w-0'>
                              <div className='truncate text-sm'>
                                PayPal: {group.payoutAccount}
                              </div>
                              {group.payoutAccountName ? (
                                <div className='text-muted-foreground truncate text-xs'>
                                  {t('Account holder name')}:{' '}
                                  {group.payoutAccountName}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <div className='font-medium tabular-nums sm:text-right'>
                          {formatMicros(group.amountMicros, group.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {hasMissingPayout ? (
              <Alert variant='destructive'>
                <AlertCircle className='size-4' />
                <AlertDescription>
                  {t(
                    'Ask the promoter to add a PayPal payout account before settlement.'
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
          <div className='space-y-2'>
            <Label>{t('Settlement remark')}</Label>
            <Textarea
              value={settleRemark}
              onChange={(e) => setSettleRemark(e.target.value)}
              placeholder={t('Offline payout note')}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant='outline' />}>
              {t('Cancel')}
            </DialogClose>
            <Button
              onClick={() => settleMutation.mutate()}
              disabled={
                settleMutation.isPending ||
                selectedPendingRows.length === 0 ||
                hasMissingPayout
              }
            >
              {settleMutation.isPending ? t('Saving...') : t('Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
