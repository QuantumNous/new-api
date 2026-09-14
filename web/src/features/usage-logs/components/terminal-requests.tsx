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
import { ChevronRight, Inbox } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TerminalPage } from '@/components/layout/components/terminal-page'
import { Sheet, SheetTrigger } from '@/components/ui/sheet'
import { toIntlLocale } from '@/i18n/languages'
import { formatConsoleMoney } from '@/lib/console-money'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { getUserRequestLogs } from '../api'
import { LOG_TYPE_ENUM } from '../constants'
import { usageLogSchema, type UsageLog } from '../data/schema'
import { useUsageSummary } from '../hooks/use-usage-summary'
import {
  getLogQuotaComparison,
  getLogChargedQuota,
} from '../lib/cost-comparison'
import { parseLogOther } from '../lib/format'
import {
  collapseRequestOutcomes,
  isFailedRequest,
} from '../lib/request-details'
import { isPerCallBilling } from '../lib/utils'
import { TerminalRequestDetails } from './terminal-request-details'

type RequestFilter = 'all' | 'ok' | 'error'

const requestCostFormat = { digitsLarge: 6, digitsSmall: 6, abbreviate: false }

function isVisibleLog(log: UsageLog): boolean {
  return log.type === LOG_TYPE_ENUM.CONSUME || log.type === LOG_TYPE_ENUM.ERROR
}

export function TerminalRequests() {
  const { t, i18n } = useTranslation()
  const [filter, setFilter] = useState<RequestFilter>('all')
  const [selectedLog, setSelectedLog] = useState<UsageLog | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const userId = useAuthStore((state) => state.auth.user?.id)
  const summary = useUsageSummary(1)
  const { start, end } = summary
  const requestTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(toIntlLocale(i18n.language), {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [i18n.language]
  )

  const logsQuery = useQuery({
    queryKey: ['terminal', 'requests', userId, start.unix(), end.unix(), page],
    queryFn: async () => {
      const result = await getUserRequestLogs({
        p: page,
        page_size: 50,
        start_timestamp: start.unix(),
        end_timestamp: end.unix(),
      })
      if (!result.success || !result.data) {
        throw new Error(result.message || t('Failed to load usage report'))
      }
      const items = result.data.items.flatMap((item) => {
        const parsed = usageLogSchema.safeParse(item)
        return parsed.success && isVisibleLog(parsed.data) ? [parsed.data] : []
      })
      return {
        total: result.data.total,
        items: collapseRequestOutcomes(items),
      }
    },
  })

  const logs = logsQuery.data?.items ?? []
  const errorCount = logs.filter(isFailedRequest).length
  const okCount = logs.length - errorCount
  const visible = logs.filter((log) => {
    if (filter === 'error') return isFailedRequest(log)
    if (filter === 'ok') return !isFailedRequest(log)
    return true
  })
  const empty = logs.length === 0

  return (
    <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
      <TerminalPage
        title={t('Requests')}
        description={t('See each call, what it cost, and why it failed.')}
      >
        {summary.error || logsQuery.error ? (
          <p role='alert' className='text-destructive'>
            {t(
              summary.error?.message ||
                logsQuery.error?.message ||
                'Failed to load usage report'
            )}
          </p>
        ) : null}
        <p className='ci-requestPeriod'>
          {t('Today ({{date}}) · since 00:00 in your time zone', {
            date: start.format('YYYY-MM-DD'),
          })}
        </p>
        <section className='ci-statGrid ci-requestStats'>
          <article>
            <span>{t('Requests today')}</span>
            <strong>{summary.data?.requests.toLocaleString() ?? '—'}</strong>
          </article>
          <article>
            <span>{t('Failed requests')}</span>
            <strong
              className={
                (summary.data?.failed ?? 0) > 0 ? 'is-empty' : undefined
              }
            >
              {summary.data?.failed.toLocaleString() ?? '—'}
            </strong>
          </article>
          <article>
            <span>{t('Usage today')}</span>
            <strong>
              {summary.data ? formatConsoleMoney(summary.data.quota) : '—'}
            </strong>
          </article>
        </section>

        <section className='ci-panel'>
          <header className='ci-panelHeader'>
            <p>
              {t(
                'Charges may apply even if a request fails or is interrupted.'
              )}
            </p>
            <p>{t('Page filters do not change the daily totals above.')}</p>
          </header>
          <div className='ci-requestFilters'>
            <span>{t('Filter this page')}</span>
            {(
              [
                ['all', t('All'), logs.length],
                ['ok', t('Worked'), okCount],
                ['error', t('Failed'), errorCount],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type='button'
                aria-pressed={filter === value}
                className={cn('ci-chip', filter === value && 'is-active')}
                onClick={() => setFilter(value)}
              >
                {label} {count}
              </button>
            ))}
          </div>
          {logsQuery.isPending && (
            <div className='ci-empty'>{t('Loading...')}</div>
          )}
          {!logsQuery.isPending &&
            !logsQuery.error &&
            !empty &&
            visible.length === 0 && (
              <div className='ci-empty'>
                <p>
                  {t(
                    'No matching requests on this page. Try another filter or page.'
                  )}
                </p>
              </div>
            )}
          {!logsQuery.isPending && !logsQuery.error && empty && (
            <div className='ci-empty'>
              <span className='ci-emptyIcon'>
                <Inbox size={18} />
              </span>
              <h3>{t('No matching requests on this page')}</h3>
              <p>
                {t(
                  'Create a key, fill it into your tool, then come back here.'
                )}
              </p>
              <Link
                to='/keys'
                className='ci-button ci-button--size-sm'
                style={{ marginTop: 12 }}
              >
                {t('Go create a key')}
              </Link>
            </div>
          )}
          {!logsQuery.isPending && !logsQuery.error && !empty && (
            <div className='ci-requestList'>
              {visible.map((log) => {
                const failed = isFailedRequest(log)
                const other = parseLogOther(log.other)
                const comparison =
                  log.type === LOG_TYPE_ENUM.CONSUME
                    ? getLogQuotaComparison(log.quota, other)
                    : null
                let chargedAmount = t('No charge')
                if (log.type === LOG_TYPE_ENUM.CONSUME) {
                  chargedAmount =
                    other?.billing_source === 'subscription'
                      ? t('Subscription')
                      : formatQuotaWithCurrency(
                          getLogChargedQuota(log.quota, other),
                          requestCostFormat
                        )
                }
                const cacheRead = other?.cache_tokens || 0
                return (
                  <article
                    key={`${log.type}-${log.id}`}
                    className={cn('ci-requestRow', failed && 'is-failed')}
                  >
                    <SheetTrigger
                      className='ci-requestMain'
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className='ci-requestHeading'>
                        <div className='ci-requestIdentity'>
                          <strong>
                            {log.model_name || t('Unknown model')}
                          </strong>
                          <span>
                            {requestTimeFormatter.format(
                              dayjs.unix(log.created_at).toDate()
                            )}
                            {log.token_name ? ` · ${log.token_name}` : ''}
                          </span>
                        </div>
                        <b
                          className={cn(
                            'ci-requestStatus',
                            failed ? 'is-failed' : 'is-ok'
                          )}
                        >
                          {failed ? t('Failed') : t('Worked')}
                        </b>
                        <ChevronRight
                          className='ci-requestDisclosure'
                          size={16}
                          aria-hidden='true'
                        />
                      </div>
                      <dl>
                        <div>
                          <dt>{t('Tokens')}</dt>
                          <dd>
                            {(
                              log.prompt_tokens + log.completion_tokens
                            ).toLocaleString()}
                            {cacheRead > 0
                              ? ` · ${t('cache {{count}}', { count: cacheRead.toLocaleString() })}`
                              : ''}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('Charge')}</dt>
                          <dd>{chargedAmount}</dd>
                        </div>
                        {!isPerCallBilling(other?.model_price) && (
                          <div>
                            <dt>
                              {comparison && comparison.savedQuota < 0
                                ? t('Above base price')
                                : t('Saved')}
                            </dt>
                            <dd
                              className={
                                comparison && comparison.savedQuota > 0
                                  ? 'text-success'
                                  : undefined
                              }
                            >
                              {comparison
                                ? formatQuotaWithCurrency(
                                    Math.abs(comparison.savedQuota),
                                    requestCostFormat
                                  )
                                : '—'}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt>{t('Time taken')}</dt>
                          <dd>
                            {log.use_time > 0
                              ? `${log.use_time.toFixed(1)}s`
                              : '—'}
                          </dd>
                        </div>
                      </dl>
                    </SheetTrigger>
                  </article>
                )
              })}
            </div>
          )}
        </section>
        <div className='ci-tablePager'>
          <button
            type='button'
            className='ci-button ci-button--ghost ci-button--size-xs'
            disabled={page === 1 || logsQuery.isFetching}
            onClick={() => {
              setPage(page - 1)
            }}
          >
            {t('Previous')}
          </button>
          <span>
            {page} / {Math.max(1, Math.ceil((logsQuery.data?.total ?? 0) / 50))}
          </span>
          <button
            type='button'
            className='ci-button ci-button--ghost ci-button--size-xs'
            disabled={
              page * 50 >= (logsQuery.data?.total ?? 0) || logsQuery.isFetching
            }
            onClick={() => {
              setPage(page + 1)
            }}
          >
            {t('Next')}
          </button>
        </div>
      </TerminalPage>
      {selectedLog && <TerminalRequestDetails log={selectedLog} />}
    </Sheet>
  )
}
