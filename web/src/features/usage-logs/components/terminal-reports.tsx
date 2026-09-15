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
import { useTranslation } from 'react-i18next'

import { TerminalPage } from '@/components/layout/components/terminal-page'
import { formatConsoleMoney } from '@/lib/console-money'

import { useUsageSummary } from '../hooks/use-usage-summary'
import { buildUsageReportCsv } from '../lib/report-export'

export function TerminalReports() {
  const { t } = useTranslation()
  const summary = useUsageSummary(10)
  const data = summary.data
  const byDay = data?.daily ?? []

  const exportCsv = () => {
    const blob = new Blob([buildUsageReportCsv(byDay)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'usage-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <TerminalPage
      title={t('Reports')}
      description={t(
        'Review the last 10 days of usage and export daily totals.'
      )}
      actions={
        <button
          type='button'
          className='ci-button ci-button--size-xs'
          onClick={exportCsv}
          disabled={summary.isError || !data || byDay.length === 0}
        >
          {t('Export report')}
        </button>
      }
    >
      {summary.error ? (
        <p role='alert' className='text-destructive'>
          {t(summary.error.message)}
        </p>
      ) : null}
      <p className='ci-requestPeriod'>
        {t('Last 10 days: {{start}} – {{end}}', {
          start: summary.start.format('YYYY-MM-DD'),
          end: summary.end.format('YYYY-MM-DD'),
        })}
      </p>
      <section className='ci-statGrid'>
        <article>
          <span>{t('Requests')}</span>
          <strong>{data?.requests.toLocaleString() ?? '—'}</strong>
          <small>{t('Total requests in the last 10 days')}</small>
        </article>
        <article>
          <span>{t('Saved')}</span>
          <strong className='is-saved'>
            {data ? formatConsoleMoney(data.saved_quota) : '—'}
          </strong>
          <small>
            {t('Savings in the last 10 days, based on recorded rates')}
          </small>
        </article>
        <article>
          <span>{t('Billed')}</span>
          <strong>{data ? formatConsoleMoney(data.quota) : '—'}</strong>
          <small>{t('Total spent in the last 10 days')}</small>
        </article>
        <article>
          <span>{t('Tokens')}</span>
          <strong>{data?.tokens.toLocaleString() ?? '—'}</strong>
          <small>{t('Total tokens used in the last 10 days')}</small>
        </article>
      </section>
      <section className='ci-panel'>
        {summary.isPending ? (
          <div className='ci-empty'>{t('Loading...')}</div>
        ) : null}
        {data && byDay.length === 0 ? (
          <div className='ci-empty'>
            <p>{t('No requests in this window.')}</p>
          </div>
        ) : null}
        {byDay.length > 0 ? (
          <table className='ci-catalogTable'>
            <thead>
              <tr>
                <th>{t('Date')}</th>
                <th>{t('Requests')}</th>
                <th>{t('Tokens')}</th>
                <th>{t('Billed')}</th>
              </tr>
            </thead>
            <tbody>
              {byDay.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{row.requests}</td>
                  <td>{row.tokens.toLocaleString()}</td>
                  <td>{formatConsoleMoney(row.quota)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </TerminalPage>
  )
}
