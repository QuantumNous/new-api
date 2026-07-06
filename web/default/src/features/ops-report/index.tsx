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
import { getOpsReport, opsReportQueryKeys, type OpsDauScope } from './api'
import type {
  OpsCampaignRow,
  OpsDauRow,
  OpsFunnelRow,
  OpsPayerRow,
  OpsPaymentRow,
} from './types'

const DAY_OPTIONS = [7, 30, 60, 90]

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

const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
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
    </>
  )
}

function FunnelHeader({ firstColumn }: { firstColumn: string }) {
  const { t } = useTranslation()
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{firstColumn}</TableHead>
        <TableHead className='text-right'>{t('Registrations')}</TableHead>
        <TableHead className='text-right'>{t('Real Browse')}</TableHead>
        <TableHead className='text-right'>{t('Manual Keys')}</TableHead>
        <TableHead className='text-right'>{t('Key Users')}</TableHead>
        <TableHead className='text-right'>{t('Payment Intent')}</TableHead>
        <TableHead className='text-right'>{t('Paid Users')}</TableHead>
        <TableHead className='text-right'>{t('Paid Amount')}</TableHead>
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

function CampaignTable({ rows }: { rows: OpsCampaignRow[] }) {
  const { t } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table className={TABLE_GRID}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Campaign')}</TableHead>
            <TableHead className='text-right'>{t('Registrations')}</TableHead>
            <TableHead className='text-right'>{t('Real Browse')}</TableHead>
            <TableHead className='text-right'>{t('Key Users')}</TableHead>
            <TableHead className='text-right'>{t('Payment Intent')}</TableHead>
            <TableHead className='text-right'>{t('Paid Users')}</TableHead>
            <TableHead className='text-right'>{t('Paid Amount')}</TableHead>
            <TableHead>{t('Top Keywords')}</TableHead>
            <TableHead>{t('Languages')}</TableHead>
            <TableHead>{t('Landing Pages')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className='whitespace-nowrap'>{row.key}</TableCell>
              <TableCell className='text-right'>{row.registrations}</TableCell>
              <TableCell className='text-right'>
                {row.real_browse}{' '}
                <span className='text-muted-foreground text-xs'>
                  ({pct(row.real_browse, row.registrations)})
                </span>
              </TableCell>
              <TableCell className='text-right'>
                {row.key_users}{' '}
                <span className='text-muted-foreground text-xs'>
                  ({pct(row.key_users, row.registrations)})
                </span>
              </TableCell>
              <TableCell className='text-right'>{row.pay_intent}</TableCell>
              <TableCell className='text-right'>{row.paid}</TableCell>
              <TableCell className='text-right'>{usd(row.paid_usd)}</TableCell>
              <TableCell className='max-w-64'>
                <div className='flex flex-wrap gap-1'>
                  {(row.keywords ?? []).map((k) => (
                    <Badge key={k} variant='secondary'>
                      {k}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{(row.languages ?? []).join(', ') || '-'}</TableCell>
              <TableCell className='max-w-48 truncate'>
                {(row.landing_paths ?? []).join(', ') || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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

function PayersTable({ rows }: { rows: OpsPayerRow[] }) {
  const { t } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table className={TABLE_GRID}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('User')}</TableHead>
            <TableHead>{t('Email')}</TableHead>
            <TableHead className='text-right'>{t('Paid Amount')}</TableHead>
            <TableHead className='text-right'>{t('Orders')}</TableHead>
            <TableHead>{t('First Paid At')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.user_id}>
              <TableCell className='whitespace-nowrap'>
                {row.display_name || row.username}{' '}
                <span className='text-muted-foreground text-xs'>
                  #{row.user_id}
                </span>
              </TableCell>
              <TableCell>{row.email || '-'}</TableCell>
              <TableCell className='text-right'>{usd(row.paid_usd)}</TableCell>
              <TableCell className='text-right'>{row.orders}</TableCell>
              <TableCell className='whitespace-nowrap'>
                {formatTimestamp(row.first_paid_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function OpsReport() {
  const { t } = useTranslation()
  const [days, setDays] = useState(30)
  const [dauScope, setDauScope] = useState<OpsDauScope>('plg')

  const reportQuery = useQuery({
    queryKey: opsReportQueryKeys.report(days, dauScope),
    queryFn: () => getOpsReport(days, dauScope),
  })
  const report = reportQuery.data?.data

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Ops Daily Report')}
      </SectionPageLayout.Title>
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
                'PLG users only (group=plg, internal and enterprise accounts excluded). All dates are UTC. Real browse = playground chats excluding the auto-fired signup request; manual keys = API keys created 2+ minutes after signup; key users = any API key request including auto-provisioned keys.'
              )}{' '}
              {t('Generated at')}: {formatTimestamp(report.generated_at)}
            </p>

            <Tabs defaultValue='registrations'>
              <TabsList>
                <TabsTrigger value='registrations'>
                  {t('Daily Registrations')}
                </TabsTrigger>
                <TabsTrigger value='campaigns'>{t('Ad Campaigns')}</TabsTrigger>
                <TabsTrigger value='funnel'>
                  {t('Registration Funnel (Weekly)')}
                </TabsTrigger>
                <TabsTrigger value='payment'>
                  {t('Payment Funnel (Weekly)')}
                </TabsTrigger>
                <TabsTrigger value='active'>
                  {t('Active Users (Key Usage)')}
                </TabsTrigger>
                <TabsTrigger value='payers'>
                  {t('Top Paying Customers')}
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
                    <FunnelTable rows={report.daily} firstColumn={t('Date')} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='campaigns'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Ad Campaigns')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CampaignTable rows={report.campaign_funnel} />
                  </CardContent>
                </Card>
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
                      {t('Top Paying Customers')}{' '}
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
