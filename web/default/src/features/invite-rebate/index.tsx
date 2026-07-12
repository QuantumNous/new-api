import {
  Copy,
  Crown,
  Gift,
  Share2,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TransferDialog } from '@/features/wallet/components/dialogs/transfer-dialog'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  fetchAdminInviteRebateSummary,
  fetchAdminInviteRebates,
  fetchAffiliateCode,
  fetchInviteRebateInvitees,
  fetchInviteRebateLeaderboard,
  fetchInviteRebateLogs,
  fetchInviteRebateSummary,
  transferAffiliateQuota,
  triggerInviteRebateBackfill,
} from './api'
import type {
  AdminInviteRebateSummary,
  InviteeRebateStat,
  InviteRebateLeaderboardEntry,
  InviteRebateLog,
  InviteRebateSummary,
} from './types'

function StatTile(props: {
  label: string
  value: string
  hint?: string
  icon: typeof Gift
  tone?: 'success' | 'info' | 'chart-3' | 'chart-4'
}) {
  const Icon = props.icon
  return (
    <div className='bg-card flex min-w-0 items-start gap-3 rounded-xl border p-3 sm:p-4'>
      <IconBadge tone={props.tone ?? 'info'} className='shrink-0'>
        <Icon className='size-4' />
      </IconBadge>
      <div className='min-w-0 flex-1'>
        <div className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
          {props.label}
        </div>
        <div className='mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl'>
          {props.value}
        </div>
        {props.hint ? (
          <div className='text-muted-foreground mt-0.5 line-clamp-1 text-xs'>
            {props.hint}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function InviteRebatePage() {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<InviteRebateSummary | null>(null)
  const [logs, setLogs] = useState<InviteRebateLog[]>([])
  const [invitees, setInvitees] = useState<InviteeRebateStat[]>([])
  const [board, setBoard] = useState<InviteRebateLeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState(0)
  const [boardBy, setBoardBy] = useState<'rebate' | 'invitees'>('rebate')
  const [affCode, setAffCode] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [tab, setTab] = useState('overview')

  const affiliateLink = useMemo(() => {
    if (typeof window === 'undefined' || !affCode) return ''
    return `${window.location.origin}/sign-up?aff=${affCode}`
  }, [affCode])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const settled = await Promise.allSettled([
        fetchInviteRebateSummary(),
        fetchInviteRebateLogs(1, 30),
        fetchInviteRebateInvitees(1, 30),
        fetchInviteRebateLeaderboard(boardBy, 20),
        fetchAffiliateCode(),
      ])
      const val = <T,>(i: number): T | undefined => {
        const r = settled[i]
        return r.status === 'fulfilled' ? (r.value as T) : undefined
      }
      const s = val<Awaited<ReturnType<typeof fetchInviteRebateSummary>>>(0)
      const l = val<Awaited<ReturnType<typeof fetchInviteRebateLogs>>>(1)
      const i = val<Awaited<ReturnType<typeof fetchInviteRebateInvitees>>>(2)
      const b = val<Awaited<ReturnType<typeof fetchInviteRebateLeaderboard>>>(3)
      const a = val<Awaited<ReturnType<typeof fetchAffiliateCode>>>(4)

      if (s?.success && s.data) setSummary(s.data)
      else if (!s) toast.error(t('Failed to load invite rebate data'))

      if (l?.success && l.data) setLogs(l.data.items || [])
      if (i?.success && i.data) setInvitees(i.data.items || [])
      if (b?.success && b.data) {
        setBoard(b.data.items || [])
        setMyRank(b.data.my_rank || 0)
      } else {
        // Keep previous board empty on failure; do not block page
        setBoard([])
        setMyRank(0)
      }
      if (a?.success && a.data) setAffCode(a.data)
    } catch (e) {
      console.error(e)
      toast.error(t('Failed to load invite rebate data'))
    } finally {
      setLoading(false)
    }
  }, [boardBy, t])

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

  const ratioPct = ((summary?.ratio_bp ?? 0) / 100).toFixed(2)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Invite Rebate')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          size='sm'
          onClick={() => {
            if (affiliateLink) copyToClipboard(affiliateLink)
          }}
          disabled={!affiliateLink}
        >
          <Copy className='mr-1.5 size-3.5' />
          {t('Copy invite link')}
        </Button>
        <Button
          size='sm'
          onClick={() => setTransferOpen(true)}
          disabled={!summary || summary.aff_quota <= 0}
        >
          <Wallet className='mr-1.5 size-3.5' />
          {t('Transfer to Balance')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          {loading && !summary ? (
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-24 rounded-xl' />
              ))}
            </div>
          ) : (
            <>
              <Card className='border-dashed'>
                <CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <Share2 className='text-primary size-4' />
                      <span className='text-sm font-semibold'>
                        {t('Your invite program')}
                      </span>
                      {summary?.enabled ? (
                        <Badge variant='secondary' className='text-[10px]'>
                          {t('{{rate}}% rebate', { rate: ratioPct })}
                        </Badge>
                      ) : (
                        <Badge variant='outline' className='text-[10px]'>
                          {t('Rebate disabled')}
                        </Badge>
                      )}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {summary?.enabled
                        ? t(
                            'Share your link. When friends top up, you earn a rebate into pending rewards.'
                          )
                        : t('Top-up rebate is currently disabled by admin')}
                    </p>
                  </div>
                  <div className='flex min-w-0 flex-1 items-center gap-2 sm:max-w-md sm:justify-end'>
                    <Input
                      readOnly
                      value={affiliateLink}
                      className='bg-muted/40 h-9 font-mono text-xs'
                    />
                    <Button
                      size='icon'
                      variant='outline'
                      className='size-9 shrink-0'
                      onClick={() => affiliateLink && copyToClipboard(affiliateLink)}
                      disabled={!affiliateLink}
                    >
                      <Copy className='size-4' />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                <StatTile
                  label={t('Invitees')}
                  value={String(summary?.invitee_count ?? 0)}
                  hint={
                    myRank > 0
                      ? t('Leaderboard rank #{{rank}}', { rank: myRank })
                      : t('Friends who joined via you')
                  }
                  icon={Users}
                  tone='info'
                />
                <StatTile
                  label={t('Invitee top-up total')}
                  value={formatQuota(summary?.topup_quota_sum ?? 0)}
                  hint={t('Credited quota from invitees')}
                  icon={Gift}
                  tone='chart-3'
                />
                <StatTile
                  label={t('Rebate total')}
                  value={formatQuota(summary?.rebate_quota_sum ?? 0)}
                  hint={t('Lifetime earned from top-ups')}
                  icon={Trophy}
                  tone='chart-4'
                />
                <StatTile
                  label={t('Pending rewards')}
                  value={formatQuota(summary?.aff_quota ?? 0)}
                  hint={t('Ready to transfer to balance')}
                  icon={Wallet}
                  tone='success'
                />
              </div>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value='overview'>{t('Overview')}</TabsTrigger>
                  <TabsTrigger value='leaderboard'>
                    {t('Invite leaderboard')}
                  </TabsTrigger>
                  <TabsTrigger value='logs'>{t('Rebate logs')}</TabsTrigger>
                  <TabsTrigger value='invitees'>{t('My invitees')}</TabsTrigger>
                </TabsList>

                <TabsContent value='overview' className='mt-3 space-y-3'>
                  <div className='grid gap-3 lg:grid-cols-2'>
                    <Card>
                      <CardHeader className='pb-2'>
                        <CardTitle className='text-sm'>
                          {t('How it works')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className='text-muted-foreground space-y-2 text-sm'>
                        <p>1. {t('Copy and share your invite link')}</p>
                        <p>2. {t('Friends sign up with your link')}</p>
                        <p>
                          3.{' '}
                          {t(
                            'When they top up successfully, you earn {{rate}}% rebate',
                            { rate: ratioPct }
                          )}
                        </p>
                        <p>4. {t('Transfer pending rewards to your balance')}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className='flex flex-row items-center justify-between pb-2'>
                        <CardTitle className='text-sm'>
                          {t('Top inviters')}
                        </CardTitle>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-7 text-xs'
                          onClick={() => setTab('leaderboard')}
                        >
                          {t('View all')}
                        </Button>
                      </CardHeader>
                      <CardContent className='space-y-2'>
                        {board.slice(0, 5).length === 0 ? (
                          <p className='text-muted-foreground text-sm'>
                            {t('No leaderboard data yet')}
                          </p>
                        ) : (
                          board.slice(0, 5).map((row) => (
                            <div
                              key={row.user_id}
                              className={cn(
                                'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
                                row.is_me && 'border-primary/40 bg-primary/5'
                              )}
                            >
                              <div className='flex items-center gap-2'>
                                <span className='text-muted-foreground w-6 tabular-nums'>
                                  #{row.rank}
                                </span>
                                {row.rank <= 3 ? (
                                  <Crown
                                    className={cn(
                                      'size-3.5',
                                      row.rank === 1 && 'text-amber-500',
                                      row.rank === 2 && 'text-slate-400',
                                      row.rank === 3 && 'text-orange-700'
                                    )}
                                  />
                                ) : null}
                                <span className='font-medium'>
                                  {row.display_name ||
                                    row.username ||
                                    `#${row.user_id}`}
                                  {row.is_me ? (
                                    <span className='text-primary ml-1 text-xs'>
                                      ({t('You')})
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                              <span className='tabular-nums'>
                                {formatQuota(row.rebate_quota_sum)}
                              </span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value='leaderboard' className='mt-3'>
                  <Card>
                    <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2'>
                      <div>
                        <CardTitle className='text-base'>
                          {t('Invite leaderboard')}
                        </CardTitle>
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {myRank > 0
                            ? t('Your current rank: #{{rank}}', {
                                rank: myRank,
                              })
                            : t('Invite friends and climb the board')}
                        </p>
                      </div>
                      <div className='flex gap-1'>
                        <Button
                          size='sm'
                          variant={boardBy === 'rebate' ? 'default' : 'outline'}
                          onClick={() => setBoardBy('rebate')}
                        >
                          {t('By rebate')}
                        </Button>
                        <Button
                          size='sm'
                          variant={
                            boardBy === 'invitees' ? 'default' : 'outline'
                          }
                          onClick={() => setBoardBy('invitees')}
                        >
                          {t('By invitees')}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='w-16'>{t('Rank')}</TableHead>
                            <TableHead>{t('User')}</TableHead>
                            <TableHead className='text-right'>
                              {t('Invitees')}
                            </TableHead>
                            <TableHead className='text-right'>
                              {t('Invitee top-up total')}
                            </TableHead>
                            <TableHead className='text-right'>
                              {t('Rebate total')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {board.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className='text-muted-foreground'
                              >
                                {t('No leaderboard data yet')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            board.map((row) => (
                              <TableRow
                                key={row.user_id}
                                className={cn(row.is_me && 'bg-primary/5')}
                              >
                                <TableCell className='font-semibold tabular-nums'>
                                  #{row.rank}
                                </TableCell>
                                <TableCell>
                                  {row.display_name ||
                                    row.username ||
                                    `#${row.user_id}`}
                                  {row.is_me ? (
                                    <Badge
                                      variant='secondary'
                                      className='ml-2 text-[10px]'
                                    >
                                      {t('You')}
                                    </Badge>
                                  ) : null}
                                </TableCell>
                                <TableCell className='text-right tabular-nums'>
                                  {row.invitee_count}
                                </TableCell>
                                <TableCell className='text-right tabular-nums'>
                                  {formatQuota(row.topup_quota_sum)}
                                </TableCell>
                                <TableCell className='text-right font-medium tabular-nums'>
                                  {formatQuota(row.rebate_quota_sum)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value='logs' className='mt-3'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-base'>
                        {t('Rebate logs')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('Time')}</TableHead>
                            <TableHead>{t('Invitee')}</TableHead>
                            <TableHead>{t('Trade no')}</TableHead>
                            <TableHead className='text-right'>
                              {t('Top-up')}
                            </TableHead>
                            <TableHead className='text-right'>
                              {t('Rebate')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className='text-muted-foreground'
                              >
                                {t('No rebate records yet')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            logs.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className='text-xs tabular-nums'>
                                  {row.created_at
                                    ? new Date(
                                        row.created_at * 1000
                                      ).toLocaleString()
                                    : '-'}
                                </TableCell>
                                <TableCell>#{row.invitee_id}</TableCell>
                                <TableCell className='font-mono text-xs'>
                                  {row.trade_no}
                                </TableCell>
                                <TableCell className='text-right'>
                                  {formatQuota(row.topup_quota)}
                                </TableCell>
                                <TableCell className='text-right font-medium'>
                                  {formatQuota(row.rebate_quota)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value='invitees' className='mt-3'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-base'>
                        {t('My invitees')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('User')}</TableHead>
                            <TableHead className='text-right'>
                              {t('Top-up total')}
                            </TableHead>
                            <TableHead className='text-right'>
                              {t('Rebate total')}
                            </TableHead>
                            <TableHead className='text-right'>
                              {t('Count')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invitees.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className='text-muted-foreground'
                              >
                                {t('No invitees yet')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            invitees.map((row) => (
                              <TableRow key={row.invitee_id}>
                                <TableCell>
                                  {row.display_name ||
                                    row.username ||
                                    `#${row.invitee_id}`}
                                </TableCell>
                                <TableCell className='text-right'>
                                  {formatQuota(row.topup_quota_sum)}
                                </TableCell>
                                <TableCell className='text-right'>
                                  {formatQuota(row.rebate_quota_sum)}
                                </TableCell>
                                <TableCell className='text-right tabular-nums'>
                                  {row.rebate_count}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}

          <TransferDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            onConfirm={onTransfer}
            availableQuota={summary?.aff_quota ?? 0}
            transferring={transferring}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
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
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Invite Rebates (Admin)')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          size='sm'
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
            } catch {
              toast.error(t('Backfill failed'))
            } finally {
              setBackfilling(false)
            }
          }}
        >
          {t('Run rebate backfill')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-end gap-2'>
            <label className='text-xs'>
              {t('Inviter ID')}
              <Input
                className='mt-1 h-9 w-36'
                value={inviterId}
                onChange={(e) => setInviterId(e.target.value)}
              />
            </label>
            <label className='text-xs'>
              {t('Invitee ID')}
              <Input
                className='mt-1 h-9 w-36'
                value={inviteeId}
                onChange={(e) => setInviteeId(e.target.value)}
              />
            </label>
            <Button size='sm' onClick={() => void reload()}>
              {t('Filter')}
            </Button>
          </div>

          <div className='grid gap-3 sm:grid-cols-3'>
            <StatTile
              label={t('Rows')}
              value={String(summary?.row_count ?? 0)}
              icon={Gift}
            />
            <StatTile
              label={t('Top-up sum')}
              value={formatQuota(summary?.topup_quota_sum ?? 0)}
              icon={Users}
              tone='chart-3'
            />
            <StatTile
              label={t('Rebate sum')}
              value={formatQuota(summary?.rebate_quota_sum ?? 0)}
              icon={Trophy}
              tone='success'
            />
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
                      <TableHead className='text-right'>{t('Top-up')}</TableHead>
                      <TableHead className='text-right'>{t('Rebate')}</TableHead>
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
                        <TableCell className='text-right'>
                          {formatQuota(r.topup_quota)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatQuota(r.rebate_quota)}
                        </TableCell>
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
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
