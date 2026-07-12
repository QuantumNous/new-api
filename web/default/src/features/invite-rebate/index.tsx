import { Link } from '@tanstack/react-router'
import { Share2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TransferDialog } from '@/features/wallet/components/dialogs/transfer-dialog'
import { formatQuota } from '@/lib/format'

import {
  fetchAdminInviteRebateSummary,
  fetchAdminInviteRebates,
  triggerInviteRebateBackfill,
  fetchInviteRebateInvitees,
  fetchInviteRebateLogs,
  fetchInviteRebateSummary,
  transferAffiliateQuota,
} from './api'
import type {
  AdminInviteRebateSummary,
  InviteeRebateStat,
  InviteRebateLog,
  InviteRebateSummary,
} from './types'

export function InviteRebatePage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<InviteRebateSummary | null>(null)
  const [logs, setLogs] = useState<InviteRebateLog[]>([])
  const [invitees, setInvitees] = useState<InviteeRebateStat[]>([])
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [s, l, i] = await Promise.all([
        fetchInviteRebateSummary(),
        fetchInviteRebateLogs(1, 50),
        fetchInviteRebateInvitees(1, 50),
      ])
      if (s.success && s.data) setSummary(s.data)
      if (l.success && l.data) setLogs(l.data.items || [])
      if (i.success && i.data) setInvitees(i.data.items || [])
    } catch (e) {
      console.error(e)
      toast.error(t('Failed to load invite rebate data'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void reload()
  }, [reload])

  const onTransfer = async (quota: number) => {
    try {
      setTransferring(true)
      const res = await transferAffiliateQuota({ quota })
      if (res.success) {
        toast.success(res.message || t('Transfer successful'))
        await reload()
        return true
      }
      toast.error(res.message || t('Transfer failed'))
      return false
    } finally {
      setTransferring(false)
    }
  }

  if (loading && !summary) {
    return (
      <div className='space-y-4 p-4'>
        <Skeleton className='h-8 w-48' />
        <div className='grid gap-3 sm:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-24' />
          ))}
        </div>
      </div>
    )
  }

  const ratioPct = ((summary?.ratio_bp ?? 0) / 100).toFixed(2)

  return (
    <div className='mx-auto flex max-w-6xl flex-col gap-4 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Share2 className='size-5' />
          <div>
            <h1 className='text-lg font-semibold'>{t('Invite Rebate')}</h1>
            <p className='text-muted-foreground text-xs'>
              {summary?.enabled
                ? t('Rebate rate: {{rate}}% of invitee credited top-ups', {
                    rate: ratioPct,
                  })
                : t('Top-up rebate is currently disabled by admin')}
            </p>
          </div>
        </div>
        <div className='flex gap-2'>
          <Link
            to='/wallet'
            className='border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm'
          >
            {t('Wallet')}
          </Link>
          <Button
            onClick={() => setTransferOpen(true)}
            disabled={!summary || summary.aff_quota <= 0}
          >
            {t('Transfer to Balance')}
          </Button>
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {[
          [t('Invitees'), String(summary?.invitee_count ?? 0)],
          [t('Invitee top-up total'), formatQuota(summary?.topup_quota_sum ?? 0)],
          [t('Rebate total'), formatQuota(summary?.rebate_quota_sum ?? 0)],
          [t('Pending rewards'), formatQuota(summary?.aff_quota ?? 0)],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className='pb-2'>
              <CardTitle className='text-muted-foreground text-xs font-medium'>
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className='text-xl font-semibold tabular-nums'>
              {value}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>{t('Rebate logs')}</CardTitle>
        </CardHeader>
        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Time')}</TableHead>
                <TableHead>{t('Invitee')}</TableHead>
                <TableHead>{t('Trade no')}</TableHead>
                <TableHead>{t('Top-up')}</TableHead>
                <TableHead>{t('Rebate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground'>
                    {t('No rebate records yet')}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className='tabular-nums text-xs'>
                      {row.created_at
                        ? new Date(row.created_at * 1000).toLocaleString()
                        : '-'}
                    </TableCell>
                    <TableCell>#{row.invitee_id}</TableCell>
                    <TableCell className='font-mono text-xs'>
                      {row.trade_no}
                    </TableCell>
                    <TableCell>{formatQuota(row.topup_quota)}</TableCell>
                    <TableCell>{formatQuota(row.rebate_quota)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>{t('Invitees')}</CardTitle>
        </CardHeader>
        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('User')}</TableHead>
                <TableHead>{t('Top-up total')}</TableHead>
                <TableHead>{t('Rebate total')}</TableHead>
                <TableHead>{t('Count')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='text-muted-foreground'>
                    {t('No invitees yet')}
                  </TableCell>
                </TableRow>
              ) : (
                invitees.map((row) => (
                  <TableRow key={row.invitee_id}>
                    <TableCell>
                      {row.display_name || row.username || `#${row.invitee_id}`}
                    </TableCell>
                    <TableCell>{formatQuota(row.topup_quota_sum)}</TableCell>
                    <TableCell>{formatQuota(row.rebate_quota_sum)}</TableCell>
                    <TableCell>{row.rebate_count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onConfirm={onTransfer}
        availableQuota={summary?.aff_quota ?? 0}
        transferring={transferring}
      />
    </div>
  )
}

export function InviteRebateAdminPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [backfilling, setBackfilling] = useState(false)
  const [inviterId, setInviterId] = useState('')
  const [inviteeId, setInviteeId] = useState('')
  const [summary, setSummary] = useState<AdminInviteRebateSummary | null>(null)
  const [rows, setRows] = useState<InviteRebateLog[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const params: {
        p: number
        page_size: number
        inviter_id?: number
        invitee_id?: number
      } = { p: 1, page_size: 50 }
      if (inviterId) params.inviter_id = Number(inviterId)
      if (inviteeId) params.invitee_id = Number(inviteeId)
      const [s, list] = await Promise.all([
        fetchAdminInviteRebateSummary(
          inviterId ? Number(inviterId) : undefined
        ),
        fetchAdminInviteRebates(params),
      ])
      if (s.success && s.data) setSummary(s.data)
      if (list.success && list.data) setRows(list.data.items || [])
    } catch (e) {
      console.error(e)
      toast.error(t('Failed to load admin rebate data'))
    } finally {
      setLoading(false)
    }
  }, [inviteeId, inviterId, t])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className='mx-auto flex max-w-6xl flex-col gap-4 p-4'>
      <h1 className='text-lg font-semibold'>{t('Invite Rebates (Admin)')}</h1>
      <div className='flex flex-wrap items-end gap-2'>
        <label className='text-xs'>
          {t('Inviter ID')}
          <input
            className='border-input bg-background mt-1 block h-9 rounded-md border px-2'
            value={inviterId}
            onChange={(e) => setInviterId(e.target.value)}
          />
        </label>
        <label className='text-xs'>
          {t('Invitee ID')}
          <input
            className='border-input bg-background mt-1 block h-9 rounded-md border px-2'
            value={inviteeId}
            onChange={(e) => setInviteeId(e.target.value)}
          />
        </label>
        <Button onClick={() => void reload()}>{t('Filter')}</Button>
        <Button
          variant='outline'
          disabled={backfilling}
          onClick={async () => {
            try {
              setBackfilling(true)
              const res = await triggerInviteRebateBackfill(100)
              if (res.success) {
                toast.success(t('Backfill queued'))
                await reload()
              } else {
                toast.error(res.message || t('Backfill failed'))
              }
            } catch (e) {
              toast.error(t('Backfill failed'))
            } finally {
              setBackfilling(false)
            }
          }}
        >
          {t('Run rebate backfill')}
        </Button>
      </div>
      <div className='grid gap-3 sm:grid-cols-3'>
        {[
          [t('Rows'), String(summary?.row_count ?? 0)],
          [t('Top-up sum'), formatQuota(summary?.topup_quota_sum ?? 0)],
          [t('Rebate sum'), formatQuota(summary?.rebate_quota_sum ?? 0)],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className='pb-2'>
              <CardTitle className='text-muted-foreground text-xs'>
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className='text-xl font-semibold'>{value}</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className='overflow-x-auto pt-4'>
          {loading ? (
            <Skeleton className='h-40 w-full' />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t('Inviter')}</TableHead>
                  <TableHead>{t('Invitee')}</TableHead>
                  <TableHead>{t('Trade no')}</TableHead>
                  <TableHead>{t('Top-up')}</TableHead>
                  <TableHead>{t('Rebate')}</TableHead>
                  <TableHead>{t('Time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>#{r.inviter_id}</TableCell>
                    <TableCell>#{r.invitee_id}</TableCell>
                    <TableCell className='font-mono text-xs'>
                      {r.trade_no}
                    </TableCell>
                    <TableCell>{formatQuota(r.topup_quota)}</TableCell>
                    <TableCell>{formatQuota(r.rebate_quota)}</TableCell>
                    <TableCell className='text-xs tabular-nums'>
                      {r.created_at
                        ? new Date(r.created_at * 1000).toLocaleString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
