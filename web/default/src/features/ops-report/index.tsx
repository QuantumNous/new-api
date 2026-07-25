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
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/context/theme-provider'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionPageLayout } from '@/components/layout'
import { AdsDailyTab } from './ads-daily-tab'
import {
  getOpsAdsDailyReport,
  getOpsReport,
  getOpsStripeReport,
  opsReportQueryKeys,
  type OpsDauScope,
} from './api'
import type {
  OpsDailyRow,
  OpsDauRow,
  OpsFunnelRow,
  OpsPayerRow,
  OpsRegisteredUserRow,
  OpsPaymentRow,
  OpsStripePersonRow,
  OpsStripeReport,
} from './types'

const DAY_OPTIONS = [7, 30, 60, 90]

// keep the active tab in the URL hash so a refresh stays on the same tab
const TAB_VALUES = [
  'registrations',
  'users',
  'ads-daily',
  'funnel',
  'payment',
  'stripe',
  'active',
  'payers',
] as const
type TabValue = (typeof TAB_VALUES)[number]

const initialTab = (): TabValue => {
  const hash = window.location.hash.slice(1)
  return (TAB_VALUES as readonly string[]).includes(hash)
    ? (hash as TabValue)
    : 'registrations'
}

// vertical + horizontal grid lines so wide tables stay scannable
const TABLE_GRID =
  '[&_th]:border [&_td]:border [&_th]:border-border/70 [&_td]:border-border/60 ' +
  '[&_th]:bg-muted/50 [&_tbody_tr:nth-child(even)]:bg-muted/20'

function chartColor(): string {
  if (typeof document === 'undefined') return '#3b82f6'
  const style = window.getComputedStyle(document.body)
  return (
    style.getPropertyValue('--chart-1').trim() ||
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--chart-1')
      .trim() ||
    '#3b82f6'
  )
}

function TrendBarChart({
  data,
  yLabel,
}: {
  data: { date: string; value: number }[]
  yLabel: string
}) {
  const { resolvedTheme } = useTheme()
  return (
    <div className='h-56 w-full'>
      <VChart
        key={`trend-${yLabel}-${resolvedTheme}`}
        spec={{
          type: 'bar',
          data: [{ id: 'trend', values: data }],
          xField: 'date',
          yField: 'value',
          color: [chartColor()],
          theme: resolvedTheme === 'dark' ? 'dark' : 'light',
          background: 'transparent',
          height: 224,
          padding: { top: 8, bottom: 4, left: 4, right: 8 },
          bar: { style: { cornerRadius: [4, 4, 0, 0] } },
          axes: [
            { orient: 'bottom', sampling: true, label: { autoHide: true } },
            { orient: 'left', title: { visible: false } },
          ],
          tooltip: {
            dimension: {
              title: { value: (datum: any) => String(datum?.date ?? '') },
              content: [
                {
                  key: () => yLabel,
                  value: (datum: any) => String(datum?.value ?? ''),
                },
              ],
            },
          },
        }}
      />
    </div>
  )
}

const pct = (part: number, total: number): string =>
  total > 0 ? `${((part / total) * 100).toFixed(part === total ? 0 : 1)}%` : '-'

const usd = (v: number): string => `$${v.toFixed(v >= 100 ? 0 : 2)}`

function countryLabel(code: string, locale: string): string {
  if (!code || code.length !== 2) return ''
  const cc = code.toUpperCase()
  const flag = String.fromCodePoint(
    ...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
  )
  let name = cc
  try {
    name = new Intl.DisplayNames([locale], { type: 'region' }).of(cc) ?? cc
  } catch {
    // fall back to the bare code
  }
  return `${flag} ${name}`
}

// All times in this report render in US Pacific Time to match the backend's
// Pacific day bucketing. (The Google Ads account itself is America/New_York;
// its dates join the Pacific buckets with a 3-hour edge skew.)
const REPORT_TZ = 'America/Los_Angeles'

const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    timeZone: REPORT_TZ,
    timeZoneName: 'short',
  })
}

const STRIPE_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid OK',
  failed: 'Card Failed',
  no_action: 'Opened, No Action',
  setup: 'Card Binding',
}

function FunnelCells({ row }: { row: OpsFunnelRow }) {
  const n = row.registrations
  const cell = (v: number) => (
    <TableCell className='text-right whitespace-nowrap'>
      {v} <span className='text-muted-foreground text-xs'>({pct(v, n)})</span>
    </TableCell>
  )
  return (
    <>
      <TableCell className='text-right'>{n}</TableCell>
      {cell(row.real_browse)}
      {cell(row.manual_keys)}
      {cell(row.key_users)}
      {cell(row.pay_intent)}
      {cell(row.paid)}
      <TableCell className='text-right'>{usd(row.paid_usd)}</TableCell>
      <TableCell className='text-right'>{usd(row.cost_usd)}</TableCell>
    </>
  )
}

function FunnelHeader({
  firstColumn,
  ads,
}: {
  firstColumn: string
  ads?: boolean
}) {
  const { t } = useTranslation()
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{firstColumn}</TableHead>
        {ads && (
          <>
            <TableHead className='text-right'>{t('Ad Spend')}</TableHead>
            <TableHead className='text-right'>{t('Ad Clicks')}</TableHead>
          </>
        )}
        <TableHead className='text-right'>{t('Registrations')}</TableHead>
        <TableHead className='text-right'>{t('Real Browse')}</TableHead>
        <TableHead className='text-right'>{t('Manual Keys')}</TableHead>
        <TableHead className='text-right'>{t('Key Users')}</TableHead>
        <TableHead className='text-right'>{t('Payment Intent')}</TableHead>
        <TableHead className='text-right'>{t('Paid Users')}</TableHead>
        <TableHead className='text-right'>{t('Paid Amount')}</TableHead>
        <TableHead className='text-right'>{t('Op Cost')}</TableHead>
      </TableRow>
    </TableHeader>
  )
}

function FunnelTable({
  rows,
  firstColumn,
}: {
  rows: OpsFunnelRow[]
  firstColumn: string
}) {
  return (
    <div className='overflow-x-auto'>
      <Table className={TABLE_GRID}>
        <FunnelHeader firstColumn={firstColumn} />
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className='whitespace-nowrap'>{row.key}</TableCell>
              <FunnelCells row={row} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Daily funnel table with the day's paid-ads totals (spend + clicks, all
// campaigns) ahead of the registration funnel; the spend cell also shows CPC.
function DailyFunnelTable({ rows }: { rows: OpsDailyRow[] }) {
  const { t } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table className={TABLE_GRID}>
        <FunnelHeader firstColumn={t('Date')} ads />
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className='whitespace-nowrap'>{row.key}</TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                {row.ads_cost_usd > 0 ? usd(row.ads_cost_usd) : '-'}
                {row.ads_clicks > 0 && (
                  <span className='text-muted-foreground text-xs'>
                    {' '}
                    (CPC {usd(row.ads_cost_usd / row.ads_clicks)})
                  </span>
                )}
              </TableCell>
              <TableCell className='text-right'>
                {row.ads_clicks > 0 ? row.ads_clicks : '-'}
              </TableCell>
              <FunnelCells row={row} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function StripeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-muted/40 rounded-md px-3 py-2'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='text-lg font-semibold'>{value}</div>
    </div>
  )
}

function StripePersonStatus({ status }: { status: string }) {
  const { t } = useTranslation()
  const label = STRIPE_STATUS_LABELS[status] ?? status
  if (status === 'paid') {
    return (
      <Badge className='border-transparent bg-green-600 text-white dark:bg-green-700'>
        {t(label)}
      </Badge>
    )
  }
  return (
    <Badge variant={status === 'failed' ? 'destructive' : 'secondary'}>
      {t(label)}
    </Badge>
  )
}

const shortTime = (timestamp: number): string => {
  if (!timestamp) return '-'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TZ,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    // h23 so midnight renders as 00:xx, not 24:xx (some engines format the
    // midnight hour as 24 under hour12:false), keeping the PT day boundary clear.
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp * 1000))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

function StripePersonsTable({ rows }: { rows: OpsStripePersonRow[] }) {
  const { t, i18n } = useTranslation()
  const names = (row: OpsStripePersonRow): string => {
    const list = row.billing_names ?? []
    const shown = list.slice(0, 2).join(', ')
    return list.length > 2 ? `${shown} +${list.length - 2}` : shown
  }
  return (
    <div className='overflow-x-auto'>
      <Table
        className={`${TABLE_GRID} text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2`}
      >
        <TableHeader>
          <TableRow>
            <TableHead>{t('Last Attempt')}</TableHead>
            <TableHead>{t('User')}</TableHead>
            <TableHead>{t('Stuck At')}</TableHead>
            <TableHead>{t('Attempts')}</TableHead>
            <TableHead>{t('Card / Billing')}</TableHead>
            <TableHead>{t('Source')}</TableHead>
            <TableHead className='text-right'>{t('Usage')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.email}>
              <TableCell className='whitespace-nowrap'>
                {shortTime(row.last_at)}
              </TableCell>
              <TableCell className='max-w-40 whitespace-normal'>
                <div className='break-all'>
                  {row.email}{' '}
                  <span className='text-muted-foreground text-xs'>
                    #{row.user_id}
                  </span>
                </div>
                <div className='text-muted-foreground text-xs'>
                  {[row.display_name, row.signup_method]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {(row.billing_names ?? []).length > 0 && (
                  <div
                    className={
                      (row.billing_names ?? []).length > 1
                        ? 'text-destructive text-xs'
                        : 'text-muted-foreground text-xs'
                    }
                  >
                    {t('Cardholder')}: {names(row)}
                  </div>
                )}
              </TableCell>
              <TableCell className='max-w-36'>
                <StripePersonStatus status={row.status} />
                {(row.fail_reasons ?? []).length > 0 && (
                  <div className='mt-1 flex flex-wrap gap-1'>
                    {(row.fail_reasons ?? []).map((f) => (
                      <Badge key={f.name} variant='outline'>
                        {f.name} {f.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className='max-w-36 break-words whitespace-normal'>
                <div>
                  {(row.amounts ?? [])
                    .map((a) => `${a.name}\u00d7${a.count}`)
                    .join(', ') || '-'}
                </div>
                <div className='text-muted-foreground text-xs'>
                  {row.sessions} {t('opened')} / {row.attempts} {t('tried')}
                  {row.succeeded > 0 && ` / ${row.succeeded} OK`}
                </div>
              </TableCell>
              <TableCell className='max-w-44 break-words whitespace-normal'>
                <div>
                  {row.attempts > 0 &&
                    [
                      (row.card_country ?? [])
                        .map((cc) => countryLabel(cc, i18n.language))
                        .join(' '),
                      (row.card_brands ?? []).join(' '),
                      (row.billing_cc ?? []).join(','),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  {(row.methods ?? []).length > 0 && (
                    <span className='text-muted-foreground'>
                      {row.attempts > 0 ? ' · ' : ''}
                      {(row.methods ?? []).join('+')}
                    </span>
                  )}
                </div>
                <div className='text-muted-foreground'>
                  {countryLabel(row.ip_country, i18n.language) || '-'}
                  {row.last_ip && (
                    <>
                      {' '}
                      <a
                        href={`https://ipinfo.io/${row.last_ip}`}
                        target='_blank'
                        rel='noreferrer'
                        className='font-mono underline decoration-dotted'
                      >
                        {row.last_ip}
                      </a>
                    </>
                  )}
                  {row.browser_lang && (
                    <Badge variant='secondary' className='ml-1'>
                      {row.browser_lang}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className='max-w-44'>
                <div className='truncate'>
                  {row.campaign}
                  {row.keyword && (
                    <span className='text-muted-foreground text-xs'>
                      {' '}
                      {row.keyword}
                    </span>
                  )}
                </div>
                <div className='text-muted-foreground truncate text-xs'>
                  {[
                    [...(row.locales ?? []), row.lng]
                      .filter(Boolean)
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .join(','),
                    row.landing,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                <div>{usd(row.balance_usd)}</div>
                <div className='text-muted-foreground text-xs'>
                  {row.requests} req · {usd(row.consumed_usd)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function StripeTab({ report }: { report: OpsStripeReport }) {
  const { t } = useTranslation()
  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>{t('Payment Conversion (Stripe)')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {report.capped ? (
            <p className='text-destructive text-sm font-medium'>
              {t(
                'Stripe fetch limit reached — data below is truncated and metrics undercount. Narrow the day range for complete numbers.'
              )}
            </p>
          ) : null}
          <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
            <StripeStat
              label={t('Sessions Created')}
              value={String(report.sessions_created)}
            />
            <StripeStat
              label={t('Completed')}
              value={`${report.sessions_completed} (${pct(report.sessions_completed, report.sessions_created)})`}
            />
            <StripeStat
              label={t('Charges')}
              value={`${report.charges_succeeded} / ${report.charges_succeeded + report.charges_failed}`}
            />
            <StripeStat
              label={t('Blocked by Radar')}
              value={String(report.charges_blocked)}
            />
          </div>
          <p className='text-muted-foreground text-sm'>
            {t(
              'One row per PLG user who reached Stripe checkout in the window, newest first. Non-PLG or unmatched-email sessions are excluded.'
            )}{' '}
            ({t('Unmatched sessions')}: {report.unmatched_sessions})
          </p>
          <StripePersonsTable rows={report.persons ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}

function PaymentTable({ rows }: { rows: OpsPaymentRow[] }) {
  const { t } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table className={TABLE_GRID}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Week')}</TableHead>
            <TableHead className='text-right'>{t('Payment Intent')}</TableHead>
            <TableHead className='text-right'>{t('Unpaid')}</TableHead>
            <TableHead className='text-right'>{t('First Purchase')}</TableHead>
            <TableHead className='text-right'>
              {t('First Purchase Amount')}
            </TableHead>
            <TableHead className='text-right'>{t('Repeat Purchase')}</TableHead>
            <TableHead className='text-right'>
              {t('Repeat Purchase Amount')}
            </TableHead>
            <TableHead className='text-right'>
              {t('Intent to Paid Rate')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className='whitespace-nowrap'>{row.key}</TableCell>
              <TableCell className='text-right'>{row.intent}</TableCell>
              <TableCell className='text-right'>{row.unpaid}</TableCell>
              <TableCell className='text-right'>{row.first}</TableCell>
              <TableCell className='text-right'>{usd(row.first_usd)}</TableCell>
              <TableCell className='text-right'>{row.repeat}</TableCell>
              <TableCell className='text-right'>
                {usd(row.repeat_usd)}
              </TableCell>
              <TableCell className='text-right'>
                {pct(row.first, row.intent)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DauTable({ rows }: { rows: OpsDauRow[] }) {
  const { t } = useTranslation()
  const shown = rows
  return (
    <div className='overflow-x-auto'>
      <Table className={TABLE_GRID}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Date')}</TableHead>
            <TableHead className='text-right'>
              {t('Active Users (Key Usage)')}
            </TableHead>
            <TableHead className='text-right'>{t('Requests')}</TableHead>
            <TableHead className='text-right'>{t('Consumed')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row) => (
            <TableRow key={row.date}>
              <TableCell className='whitespace-nowrap'>{row.date}</TableCell>
              <TableCell className='text-right'>{row.active_users}</TableCell>
              <TableCell className='text-right'>{row.requests}</TableCell>
              <TableCell className='text-right'>{usd(row.quota_usd)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RegisteredUsersTable({ rows }: { rows: OpsRegisteredUserRow[] }) {
  const { t, i18n } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table
        className={`${TABLE_GRID} text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2`}
      >
        <TableHeader>
          <TableRow>
            <TableHead>{t('Registered At')}</TableHead>
            <TableHead>{t('User')}</TableHead>
            <TableHead>{t('Signup Method')}</TableHead>
            <TableHead>{t('IP / Language')}</TableHead>
            <TableHead>{t('Campaign')}</TableHead>
            <TableHead>{t('Landing Pages')}</TableHead>
            <TableHead className='text-right'>{t('Paid Amount')}</TableHead>
            <TableHead className='text-right'>{t('Balance')}</TableHead>
            <TableHead className='text-right'>{t('Usage')}</TableHead>
            <TableHead>{t('Last Active')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.user_id}>
              <TableCell className='whitespace-nowrap'>
                {shortTime(row.registered_at)}
              </TableCell>
              <TableCell className='whitespace-nowrap'>
                <div>
                  {row.email || row.username}{' '}
                  <span className='text-muted-foreground text-xs'>
                    #{row.user_id}
                  </span>
                </div>
                <div className='text-muted-foreground text-xs'>
                  {row.display_name || '-'}
                </div>
              </TableCell>
              <TableCell>{row.signup_method || '-'}</TableCell>
              <TableCell className='whitespace-nowrap'>
                <div className='font-mono text-xs'>
                  {row.last_ip ? (
                    <a
                      href={`https://ipinfo.io/${row.last_ip}`}
                      target='_blank'
                      rel='noreferrer'
                      className='underline decoration-dotted'
                    >
                      {row.last_ip}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
                <div className='text-xs'>
                  {countryLabel(row.ip_country, i18n.language) || '-'}
                  {(row.browser_lang || row.lng) && (
                    <Badge variant='secondary' className='ml-1'>
                      {[row.browser_lang, row.lng]
                        .filter(Boolean)
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .join(' · ')}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className='max-w-40'>
                <div className='truncate'>{row.campaign || '-'}</div>
                {row.keyword && (
                  <div className='text-muted-foreground truncate text-xs'>
                    {row.keyword}
                  </div>
                )}
              </TableCell>
              <TableCell className='max-w-40 truncate'>
                {row.landing || '-'}
              </TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                {row.paid_usd > 0 ? usd(row.paid_usd) : '-'}
              </TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                {usd(row.balance_usd)}
              </TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                <div>{row.requests} req</div>
                <div className='text-muted-foreground text-xs'>
                  {usd(row.consumed_usd)}
                </div>
              </TableCell>
              <TableCell className='whitespace-nowrap'>
                {shortTime(row.last_active_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function PayersTable({ rows }: { rows: OpsPayerRow[] }) {
  const { t, i18n } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table
        className={`${TABLE_GRID} text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2`}
      >
        <TableHeader>
          <TableRow>
            <TableHead>{t('User')}</TableHead>
            <TableHead>{t('Last Paid At')}</TableHead>
            <TableHead className='text-right'>{t('Paid Amount')}</TableHead>
            <TableHead>{t('Campaign')}</TableHead>
            <TableHead>{t('Region')}</TableHead>
            <TableHead className='text-right'>
              {t('Consumed')} / {t('Balance')}
            </TableHead>
            <TableHead>{t('Top Models')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const langs =
              [row.browser_lang, row.lng]
                .filter(Boolean)
                .filter((v, i, arr) => arr.indexOf(v) === i)
                .join('/') || ''
            return (
              <TableRow key={row.user_id}>
                <TableCell>
                  <div className='whitespace-nowrap'>
                    {row.display_name || row.username}{' '}
                    <span className='text-muted-foreground text-xs'>
                      #{row.user_id}
                    </span>
                  </div>
                  <div className='text-muted-foreground max-w-52 truncate text-xs'>
                    {row.email || '-'}
                    {row.signup_method ? ` · ${row.signup_method}` : ''}
                  </div>
                </TableCell>
                <TableCell className='whitespace-nowrap'>
                  <div>{shortTime(row.last_paid_at)}</div>
                  <div className='text-muted-foreground text-xs'>
                    {t('First Paid')} {shortTime(row.first_paid_at)} ·{' '}
                    {t('Reg.')} {shortTime(row.registered_at)}
                  </div>
                </TableCell>
                <TableCell className='text-right whitespace-nowrap'>
                  <div>
                    {usd(row.paid_usd)}{' '}
                    <span className='text-muted-foreground text-xs'>
                      ×{row.orders}
                    </span>
                  </div>
                  <div className='flex justify-end gap-1'>
                    {(row.currencies ?? []).map((c) => (
                      <Badge
                        key={c}
                        variant={c === 'USD' ? 'secondary' : 'default'}
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='whitespace-nowrap'>{row.campaign || '-'}</div>
                  <div className='text-muted-foreground max-w-52 truncate text-xs'>
                    {[row.keyword, row.landing, langs]
                      .filter(Boolean)
                      .join(' · ') || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap items-center gap-1 whitespace-nowrap'>
                    {row.ip_country ? (
                      <Badge
                        variant='outline'
                        className='border-blue-300 bg-blue-50 text-sm font-semibold text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
                      >
                        {countryLabel(row.ip_country, i18n.language)}
                      </Badge>
                    ) : (
                      '-'
                    )}
                    {row.pay_country && row.pay_country !== row.ip_country ? (
                      <Badge
                        variant='outline'
                        className='text-muted-foreground text-xs'
                      >
                        💳 {countryLabel(row.pay_country, i18n.language)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className='font-mono text-xs'>
                    {row.last_ip ? (
                      <a
                        href={`https://ipinfo.io/${row.last_ip}`}
                        target='_blank'
                        rel='noreferrer'
                        className='underline decoration-dotted'
                      >
                        {row.last_ip}
                      </a>
                    ) : (
                      '-'
                    )}
                  </div>
                </TableCell>
                <TableCell className='text-right whitespace-nowrap'>
                  <div>
                    {usd(row.consumed_usd)}{' '}
                    <span className='text-muted-foreground text-xs'>
                      / {usd(row.balance_usd)}
                    </span>
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {row.requests} req · {shortTime(row.last_active_at)}
                  </div>
                </TableCell>
                <TableCell className='max-w-44'>
                  <div className='flex flex-wrap gap-1'>
                    {(row.top_models ?? []).map((m) => (
                      <Badge
                        key={m}
                        variant='secondary'
                        className='max-w-40 truncate'
                        title={m}
                      >
                        {m}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function OpsReport() {
  const { t } = useTranslation()
  const [days, setDays] = useState(30)
  const [dauScope, setDauScope] = useState<OpsDauScope>('plg')
  const [tab, setTab] = useState<TabValue>(initialTab)

  const handleTabChange = (value: string) => {
    setTab(value as TabValue)
    window.history.replaceState(null, '', `#${value}`)
  }

  const reportQuery = useQuery({
    queryKey: opsReportQueryKeys.report(days, dauScope),
    queryFn: () => getOpsReport(days, dauScope),
  })
  const report = reportQuery.data?.data

  // Stripe data comes from the Stripe API server-side; fetch lazily so the
  // main report is never blocked by it.
  const stripeQuery = useQuery({
    queryKey: opsReportQueryKeys.stripe(days),
    queryFn: () => getOpsStripeReport(days),
    enabled: tab === 'stripe',
    retry: false,
  })
  const stripeReport = stripeQuery.data?.data

  // Ads Daily data is synced from the Google Ads API server-side on first
  // load (then TTL-cached); fetch lazily so the main report never waits on it.
  const adsDailyQuery = useQuery({
    queryKey: opsReportQueryKeys.adsDaily(days),
    queryFn: () => getOpsAdsDailyReport(days),
    enabled: tab === 'ads-daily',
    retry: false,
  })
  const adsDailyReport = adsDailyQuery.data?.data

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Ops Daily Report')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='flex items-center gap-1'>
          {DAY_OPTIONS.map((option) => (
            <Button
              key={option}
              size='sm'
              variant={option === days ? 'default' : 'outline'}
              onClick={() => setDays(option)}
            >
              {t('{{count}} days', { count: option })}
            </Button>
          ))}
        </div>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        {reportQuery.isLoading || !report ? (
          <div className='space-y-4'>
            <Skeleton className='h-40 w-full' />
            <Skeleton className='h-40 w-full' />
          </div>
        ) : (
          <div className='space-y-4'>
            <p className='text-muted-foreground text-sm'>
              {t(
                'PLG users only (group=plg, internal and enterprise accounts excluded). All dates and times are US Pacific Time (PT). Real browse = playground chats excluding the auto-fired signup request; manual keys = API keys created 2+ minutes after signup; key users = any API key request including auto-provisioned keys; op cost = quota burned via auto-provisioned keys (created within 2 minutes of signup).'
              )}{' '}
              {t('Generated at')}: {formatTimestamp(report.generated_at)}
            </p>

            <Tabs value={tab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value='registrations'>
                  {t('Daily Registrations')}
                </TabsTrigger>
                <TabsTrigger value='users'>{t('Registered Users')}</TabsTrigger>
                <TabsTrigger value='ads-daily'>{t('Ads Daily')}</TabsTrigger>
                <TabsTrigger value='funnel'>
                  {t('Registration Funnel (Weekly)')}
                </TabsTrigger>
                <TabsTrigger value='payment'>
                  {t('Payment Funnel (Weekly)')}
                </TabsTrigger>
                <TabsTrigger value='stripe'>
                  {t('Payment Conversion (Stripe)')}
                </TabsTrigger>
                <TabsTrigger value='active'>
                  {t('Active Users (Key Usage)')}
                </TabsTrigger>
                <TabsTrigger value='payers'>
                  {t('Paying Customers')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value='registrations'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Daily Registrations')}</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <TrendBarChart
                      data={[...report.daily]
                        .sort((a, b) => a.key.localeCompare(b.key))
                        .map((row) => ({
                          date: row.key,
                          value: row.registrations,
                        }))}
                      yLabel={t('Registrations')}
                    />
                    <DailyFunnelTable rows={report.daily} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='users'>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t('Registered Users')}{' '}
                      <span className='text-muted-foreground text-sm font-normal'>
                        {t('Newest {{count}} in the period', {
                          count: (report.registered_users ?? []).length,
                        })}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RegisteredUsersTable
                      rows={report.registered_users ?? []}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='ads-daily'>
                {adsDailyQuery.isLoading ? (
                  <Skeleton className='h-40 w-full' />
                ) : adsDailyReport ? (
                  <AdsDailyTab report={adsDailyReport} />
                ) : (
                  <Card>
                    <CardContent className='text-muted-foreground pt-6 text-sm'>
                      {t('Failed to load ads data.')}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value='funnel'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Registration Funnel (Weekly)')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FunnelTable
                      rows={report.weekly_funnel}
                      firstColumn={t('Week')}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='payment'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Payment Funnel (Weekly)')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PaymentTable rows={report.payment_weekly} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='stripe'>
                {stripeQuery.isLoading ? (
                  <Skeleton className='h-40 w-full' />
                ) : stripeReport ? (
                  <StripeTab report={stripeReport} />
                ) : (
                  <Card>
                    <CardContent className='text-muted-foreground py-8 text-center text-sm'>
                      {stripeQuery.error instanceof Error
                        ? stripeQuery.error.message
                        : t('Stripe data unavailable')}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value='active'>
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center justify-between'>
                      {t('Active Users (Key Usage)')}
                      <span className='flex items-center gap-1'>
                        <Button
                          size='sm'
                          variant={dauScope === 'plg' ? 'default' : 'outline'}
                          onClick={() => setDauScope('plg')}
                        >
                          {t('PLG Only')}
                        </Button>
                        <Button
                          size='sm'
                          variant={dauScope === 'all' ? 'default' : 'outline'}
                          onClick={() => setDauScope('all')}
                        >
                          {t('All Users')}
                        </Button>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <TrendBarChart
                      data={[...report.dau]
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((row) => ({
                          date: row.date,
                          value: row.active_users,
                        }))}
                      yLabel={t('Active Users (Key Usage)')}
                    />
                    <DauTable rows={report.dau} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='payers'>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t('Paying Customers')}{' '}
                      <span className='text-muted-foreground text-sm font-normal'>
                        {t('{{count}} paying users, {{amount}} total', {
                          count: report.total_paid_users,
                          amount: usd(report.total_paid_usd),
                        })}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PayersTable rows={report.top_payers ?? []} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
