/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  getOverview,
  getRules,
  listRecords,
  settleNow,
  updateRule,
  voidRecord,
} from './api'
import type { AdminCommissionRecord, CommissionRule } from './types'

const PAGE_SIZE = 20

function formatTs(ts: number) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

function centsToYuan(c: number) {
  return (c / 100).toFixed(2)
}

// ---------- Rules section ----------

function RulesSection() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const rules = useQuery({
    queryKey: ['commission-admin', 'rules'],
    queryFn: getRules,
  })
  const settle = useMutation({
    mutationFn: settleNow,
    onSuccess: (d) => {
      toast.success(`${t('Settled')}: ${d.settled}`)
      void qc.invalidateQueries({ queryKey: ['commission-admin'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>{t('Commission Rules')}</CardTitle>
          <Button onClick={() => settle.mutate()} disabled={settle.isPending}>
            {t('Settle Now')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Level')}</TableHead>
              <TableHead>{t('Rate (%)')}</TableHead>
              <TableHead>{t('Min Topup')}</TableHead>
              <TableHead>{t('Frozen Days')}</TableHead>
              <TableHead>{t('Enabled')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.data?.map((r) => (
              <RuleRow key={r.id} rule={r} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function RuleRow({ rule }: { rule: CommissionRule }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [rate, setRate] = useState(rule.rate_percent)
  const [minCents, setMinCents] = useState(rule.min_topup_cents)
  const [days, setDays] = useState(rule.frozen_days)
  const [enabled, setEnabled] = useState(rule.enabled)
  const patch = useMutation({
    mutationFn: () =>
      updateRule(rule.id, {
        rate_percent: rate,
        min_topup_cents: minCents,
        frozen_days: days,
        enabled,
      }),
    onSuccess: () => {
      toast.success(t('Saved'))
      void qc.invalidateQueries({ queryKey: ['commission-admin', 'rules'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <TableRow>
      <TableCell>L{rule.level}</TableCell>
      <TableCell>
        <Input
          type='number'
          step='0.01'
          className='w-24'
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
        />
      </TableCell>
      <TableCell>
        <Input
          type='number'
          step='1'
          className='w-32'
          value={minCents}
          onChange={(e) => setMinCents(Number(e.target.value))}
        />
      </TableCell>
      <TableCell>
        <Input
          type='number'
          step='1'
          className='w-20'
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </TableCell>
      <TableCell>
        <Input
          type='checkbox'
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </TableCell>
      <TableCell>
        <Button
          size='sm'
          onClick={() => patch.mutate()}
          disabled={patch.isPending}
        >
          {t('Save')}
        </Button>
      </TableCell>
    </TableRow>
  )
}

// ---------- Records section (with void) ----------

function RecordsSection() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>('')
  const [voidTarget, setVoidTarget] = useState<AdminCommissionRecord | null>(
    null
  )
  const data = useQuery({
    queryKey: ['commission-admin', 'records', page, status],
    queryFn: () => listRecords({ page, size: PAGE_SIZE, status }),
  })
  const totalPages = data.data
    ? Math.max(1, Math.ceil(data.data.total / PAGE_SIZE))
    : 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Commission Records')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex gap-2'>
          {['', 'pending', 'settled', 'voided'].map((s) => (
            <Button
              key={s || 'all'}
              size='sm'
              variant={status === s ? 'default' : 'outline'}
              onClick={() => {
                setStatus(s)
                setPage(1)
              }}
            >
              {s ? t(s) : t('All')}
            </Button>
          ))}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>{t('Time')}</TableHead>
              <TableHead>{t('Beneficiary')}</TableHead>
              <TableHead>{t('Source User')}</TableHead>
              <TableHead>{t('Level')}</TableHead>
              <TableHead>{t('Commission')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data?.records.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{formatTs(r.created_at)}</TableCell>
                <TableCell>#{r.beneficiary_id}</TableCell>
                <TableCell>#{r.source_user_id}</TableCell>
                <TableCell>L{r.level}</TableCell>
                <TableCell className='font-semibold'>
                  ¥{centsToYuan(r.commission_amount_cents)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.status === 'settled'
                        ? 'default'
                        : r.status === 'pending'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {t(r.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.status !== 'voided' && (
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() => setVoidTarget(r)}
                    >
                      {t('Void')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className='text-muted-foreground flex justify-between text-sm'>
          <span>
            {t('Page')} {page} / {totalPages}
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </CardContent>
      <VoidDialog
        target={voidTarget}
        onOpenChange={(v) => !v && setVoidTarget(null)}
      />
    </Card>
  )
}

function VoidDialog({
  target,
  onOpenChange,
}: {
  target: AdminCommissionRecord | null
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const submit = useMutation({
    mutationFn: () => voidRecord(target!.id, reason),
    onSuccess: () => {
      toast.success(t('Voided'))
      void qc.invalidateQueries({ queryKey: ['commission-admin'] })
      setReason('')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('Void Record')} #{target?.id}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='text-sm'>
            {t('Commission')}: ¥
            {centsToYuan(target?.commission_amount_cents ?? 0)}
          </div>
          <div className='text-sm'>
            {t('Status')}: {target?.status && t(target.status)}
          </div>
          <Input
            placeholder={t('Void reason (required)')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            variant='destructive'
            disabled={!reason.trim() || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {t('Confirm Void')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Overview section ----------

function OverviewSection() {
  const { t } = useTranslation()
  const overview = useQuery({
    queryKey: ['commission-admin', 'overview'],
    queryFn: getOverview,
  })
  const d = overview.data

  const tile = (label: string, value: string) => (
    <div className='rounded-md border p-3'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='mt-1 text-xl font-semibold'>{value}</div>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Overview')}</CardTitle>
      </CardHeader>
      <CardContent>
        {overview.isLoading || !d ? (
          <div className='text-muted-foreground'>{t('Loading…')}</div>
        ) : (
          <div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
            {tile(t('Total Commissions'), `¥${centsToYuan(d.total_cents)}`)}
            {tile(t('Settled'), `¥${centsToYuan(d.settled_cents)}`)}
            {tile(t('Pending'), `¥${centsToYuan(d.pending_cents)}`)}
            {tile(t('Redeemed'), `¥${centsToYuan(d.redeemed_cents)}`)}
            {tile(t('Participants'), String(d.participants_count))}
            {tile(t('First-topup users'), String(d.first_topup_count))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CommissionAdmin() {
  const { t } = useTranslation()
  return (
    <div className='space-y-6 p-6'>
      <h1 className='text-2xl font-bold'>{t('Commission')}</h1>
      <Tabs defaultValue='overview'>
        <TabsList>
          <TabsTrigger value='overview'>{t('Overview')}</TabsTrigger>
          <TabsTrigger value='rules'>{t('Rules')}</TabsTrigger>
          <TabsTrigger value='records'>{t('Records')}</TabsTrigger>
        </TabsList>
        <TabsContent value='overview'>
          <OverviewSection />
        </TabsContent>
        <TabsContent value='rules'>
          <RulesSection />
        </TabsContent>
        <TabsContent value='records'>
          <RecordsSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
