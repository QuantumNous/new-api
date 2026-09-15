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
import { Link } from '@tanstack/react-router'
import { ChevronRight, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetTrigger } from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getUserRequestLogs } from '@/features/usage-logs/api'
import { TerminalRequestDetails } from '@/features/usage-logs/components/terminal-request-details'
import { LOG_TYPE_ENUM } from '@/features/usage-logs/constants'
import {
  usageLogSchema,
  type UsageLog,
} from '@/features/usage-logs/data/schema'
import { useUsageSummary } from '@/features/usage-logs/hooks/use-usage-summary'
import { getLogChargedQuota } from '@/features/usage-logs/lib/cost-comparison'
import { parseLogOther } from '@/features/usage-logs/lib/format'
import { isFailedRequest } from '@/features/usage-logs/lib/request-details'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { formatUseTime } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import { DeveloperSetupGuide } from './developer-setup-guide'

const PAGE_SIZE = 20
const costFormat = { digitsLarge: 6, digitsSmall: 6, abbreviate: false }

export function DeveloperRequestWorkbench() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const userId = useAuthStore((state) => state.auth.user?.id)
  const [days, setDays] = useState<1 | 7>(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [requestId, setRequestId] = useState('')
  const [filter, setFilter] = useState<'all' | 'failed'>('all')
  const [selectedLog, setSelectedLog] = useState<UsageLog | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const summary = useUsageSummary(days)
  const { start, end } = summary
  const logsQuery = useQuery({
    queryKey: [
      'dashboard',
      'recent-requests',
      userId,
      start.unix(),
      end.unix(),
      page,
      requestId,
    ],
    queryFn: async () => {
      const result = await getUserRequestLogs({
        p: page,
        page_size: PAGE_SIZE,
        start_timestamp: start.unix(),
        end_timestamp: end.unix(),
        request_id: requestId || undefined,
      })
      if (!result.success || !result.data) {
        throw new Error('Failed to load usage report')
      }
      return {
        total: result.data.total,
        items: result.data.items.flatMap((item) => {
          const parsed = usageLogSchema.safeParse(item)
          if (!parsed.success) return []
          const log = parsed.data
          return log.type === LOG_TYPE_ENUM.CONSUME ||
            log.type === LOG_TYPE_ENUM.ERROR
            ? [log]
            : []
        }),
      }
    },
    staleTime: 60_000,
  })
  const totals = summary.isError ? undefined : summary.data
  const metrics = [
    {
      label: t('Requests'),
      value: totals?.requests.toLocaleString(locale) ?? '—',
    },
    {
      label: t('Success rate'),
      value:
        totals && totals.requests > 0
          ? `${((totals.succeeded / totals.requests) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`
          : '—',
    },
    { label: t('Tokens'), value: totals?.tokens.toLocaleString(locale) ?? '—' },
    {
      label: t('Cost'),
      value: totals ? formatQuotaWithCurrency(totals.quota) : '—',
    },
  ]
  const logs = logsQuery.data?.items ?? []
  const visibleLogs = filter === 'failed' ? logs.filter(isFailedRequest) : logs
  const pending = logsQuery.isPending
  const total = logsQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
      <section
        className='min-w-0 space-y-4'
        aria-label={t('Developer workbench')}
      >
        <header className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='text-lg font-semibold tracking-tight'>
              {t('Overview')}
            </h1>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('My usage')} · {start.format('YYYY-MM-DD')} —{' '}
              {end.format('YYYY-MM-DD')}
            </p>
          </div>
          <div
            className='flex flex-wrap items-center gap-1'
            aria-label={t('Time range')}
          >
            {([1, 7] as const).map((period) => (
              <Button
                key={period}
                size='sm'
                variant={days === period ? 'secondary' : 'ghost'}
                aria-pressed={days === period}
                onClick={() => {
                  setDays(period)
                  setPage(1)
                }}
              >
                {period === 1 ? t('Today') : t('Last 7 days')}
              </Button>
            ))}
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={t('Refresh')}
              disabled={summary.isFetching || logsQuery.isFetching}
              onClick={() => {
                void summary.refetch()
                void logsQuery.refetch()
              }}
            >
              <RefreshCw aria-hidden='true' className='size-4' />
            </Button>
          </div>
        </header>

        <section
          aria-label={t('My usage')}
          aria-busy={summary.isPending}
          className='border-y py-4'
        >
          <dl className='grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4'>
            {metrics.map((metric) => (
              <div key={metric.label} className='min-w-0'>
                <dt className='text-muted-foreground text-xs'>
                  {metric.label}
                </dt>
                <dd className='mt-1 text-2xl font-semibold tracking-tight tabular-nums'>
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        {(summary.isError || logsQuery.isError) && (
          <p role='alert' className='text-destructive text-sm'>
            {t('Failed to load usage report')}
          </p>
        )}

        <DeveloperSetupGuide />

        <section
          className='min-w-0 space-y-3'
          aria-label={t('Recent requests')}
        >
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='text-sm font-semibold'>{t('Recent requests')}</h2>
            <Link
              to='/usage-logs/$section'
              params={{ section: 'common' }}
              className='text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline'
            >
              {t('View all logs')}
            </Link>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <form
              className='flex w-full items-center gap-2 sm:w-auto'
              onSubmit={(event) => {
                event.preventDefault()
                setRequestId(search.trim())
                setPage(1)
              }}
            >
              <Input
                aria-label={t('Request ID')}
                placeholder={t('Search by request ID')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className='h-9 min-w-0 sm:w-64'
              />
              <Button
                type='submit'
                size='icon'
                variant='outline'
                className='size-9'
                aria-label={t('Search')}
              >
                <Search aria-hidden='true' className='size-4' />
              </Button>
            </form>
            <div className='flex items-center gap-1'>
              <span className='text-muted-foreground mr-1 text-xs'>
                {t('Filter this page')}
              </span>
              <Button
                size='sm'
                variant={filter === 'all' ? 'secondary' : 'ghost'}
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                {t('All')}
              </Button>
              <Button
                size='sm'
                variant={filter === 'failed' ? 'secondary' : 'ghost'}
                aria-pressed={filter === 'failed'}
                onClick={() => setFilter('failed')}
              >
                {t('Failed')}
              </Button>
            </div>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t('Request filters do not change the period totals above.')}
          </p>
          {pending && (
            <p
              role='status'
              className='text-muted-foreground py-10 text-center text-sm'
            >
              {t('Loading...')}
            </p>
          )}
          {!pending && !logsQuery.isError && visibleLogs.length === 0 && (
            <div className='text-muted-foreground border-y py-10 text-center text-sm'>
              {total === 0 && !requestId
                ? t('No requests in this period')
                : t(
                    'No matching requests on this page. Try another filter or page.'
                  )}
            </div>
          )}
          {!pending && !logsQuery.isError && visibleLogs.length > 0 && (
            <Table aria-label={t('Recent requests')} className='text-xs'>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Model')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead>{t('Time')}</TableHead>
                  <TableHead>{t('Duration')}</TableHead>
                  <TableHead className='text-right'>{t('Tokens')}</TableHead>
                  <TableHead className='text-right'>
                    {t('Actual charge')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLogs.map((log) => {
                  const failed = isFailedRequest(log)
                  const other = parseLogOther(log.other)
                  let charge = t('No charge')
                  if (log.type === LOG_TYPE_ENUM.CONSUME) {
                    charge =
                      other?.billing_source === 'subscription'
                        ? t('Subscription')
                        : formatQuotaWithCurrency(
                            getLogChargedQuota(log.quota, other),
                            costFormat
                          )
                  }
                  return (
                    <TableRow key={`${log.type}-${log.id}`}>
                      <TableCell className='max-w-72'>
                        <SheetTrigger
                          onClick={() => setSelectedLog(log)}
                          className='focus-visible:ring-ring flex w-full min-w-0 items-center gap-2 rounded-sm py-1 text-left outline-none focus-visible:ring-2'
                        >
                          <ChevronRight
                            aria-hidden='true'
                            className='text-muted-foreground size-3.5 shrink-0'
                          />
                          <span className='min-w-0'>
                            <span className='block truncate font-medium'>
                              {log.model_name || t('Unknown model')}
                            </span>
                            <span className='text-muted-foreground mt-0.5 block truncate font-mono text-[11px]'>
                              {log.request_id || log.token_name || '—'}
                            </span>
                          </span>
                        </SheetTrigger>
                      </TableCell>
                      <TableCell
                        className={failed ? 'text-destructive' : 'text-success'}
                      >
                        {failed ? t('Failed') : t('Success')}
                      </TableCell>
                      <TableCell className='text-muted-foreground tabular-nums'>
                        {dayjs.unix(log.created_at).format('MM-DD HH:mm:ss')}
                      </TableCell>
                      <TableCell className='tabular-nums'>
                        {formatUseTime(log.use_time)}
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {(
                          log.prompt_tokens + log.completion_tokens
                        ).toLocaleString(locale)}
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {charge}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          {pageCount > 1 && (
            <div className='flex items-center justify-end gap-3'>
              <span className='text-muted-foreground text-xs'>
                {t('Page {{current}} of {{total}}', {
                  current: page,
                  total: pageCount,
                })}
              </span>
              <Button
                size='sm'
                variant='outline'
                disabled={page === 1 || logsQuery.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                {t('Previous page')}
              </Button>
              <Button
                size='sm'
                variant='outline'
                disabled={page >= pageCount || logsQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                {t('Next page')}
              </Button>
            </div>
          )}
        </section>
      </section>
      {selectedLog && <TerminalRequestDetails log={selectedLog} />}
    </Sheet>
  )
}
