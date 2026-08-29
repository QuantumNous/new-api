/* External billing page: per-account external (third-party) channel usage. */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useIsAdmin } from '@/hooks/use-admin'

import {
  fetchExternalBilling,
  fetchExternalBillingSelf,
  QUOTA_PER_USD,
  type ExternalBillingRow,
} from '@/features/external-billing/api'

export const Route = createFileRoute('/_authenticated/external-billing/')({
  component: ExternalBillingPage,
})

type RangeKey = 'all' | '30d' | '7d' | 'custom'

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function toTs(ms: number): number {
  return Math.floor(ms / 1000)
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000)
}

export function ExternalBillingPage() {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const [range, setRange] = useState<RangeKey>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [username, setUsername] = useState('')

  const { startTs, endTs } = useMemo(() => {
    const now = nowTs()
    if (range === '7d') return { startTs: now - 7 * 86400, endTs: 0 }
    if (range === '30d') return { startTs: now - 30 * 86400, endTs: 0 }
    if (range === 'custom') {
      const s = from ? toTs(new Date(from).getTime()) : 0
      const e = to ? toTs(new Date(to).getTime()) : 0
      return { startTs: s, endTs: e }
    }
    return { startTs: 0, endTs: 0 }
  }, [range, from, to])

  const query = useQuery({
    queryKey: ['external-billing', isAdmin, range, from, to, username],
    queryFn: async () =>
      isAdmin
        ? fetchExternalBilling(startTs, endTs, username || undefined)
        : fetchExternalBillingSelf(startTs, endTs),
    staleTime: 30_000,
  })

  const rows: ExternalBillingRow[] = useMemo(
    () => (query.data?.data ?? []).slice().sort((a, b) => b.quota - a.quota),
    [query.data]
  )

  const totalQuota = useMemo(() => rows.reduce((s, r) => s + r.quota, 0), [rows])
  const totalTokens = useMemo(() => rows.reduce((s, r) => s + r.total_tokens, 0), [rows])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t('External Channel Billing')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('External (third-party paid) channel usage per account. Models without a configured price are excluded.')}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 justify-between">
          <CardTitle className="text-base">{t('Usage Summary')}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All time')}</SelectItem>
                <SelectItem value="30d">{t('Last 30 days')}</SelectItem>
                <SelectItem value="7d">{t('Last 7 days')}</SelectItem>
                <SelectItem value="custom">{t('Custom')}</SelectItem>
              </SelectContent>
            </Select>
            {range === 'custom' && (
              <>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 rounded-md border border-input px-2 text-sm"
                />
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 rounded-md border border-input px-2 text-sm"
                />
              </>
            )}
            {isAdmin && (
              <input
                type="text"
                placeholder={t('Filter username…')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-9 w-44 rounded-md border border-input px-2 text-sm"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              {t('Accounts')} <b>{rows.length}</b>
            </span>
            <span>
              {t('Total external tokens')} <b>{fmtTokens(totalTokens)}</b>
            </span>
            <span>
              {t('Total external spend')} <b>{(totalQuota / QUOTA_PER_USD).toFixed(4)}</b>
            </span>
            {query.isFetching && <span className="text-muted-foreground">{t('Loading…')}</span>}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Account')}</TableHead>
                <TableHead className="text-right">{t('External tokens')}</TableHead>
                <TableHead className="text-right">{t('Quota')}</TableHead>
                <TableHead className="text-right">{t('Spend (USD)')}</TableHead>
                <TableHead className="text-right">{t('External models')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-16">
                    {t('No external usage in this range')}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.username}>
                  <TableCell className="font-medium">{r.username}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtTokens(r.total_tokens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.quota.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(r.quota / QUOTA_PER_USD).toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.model_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
