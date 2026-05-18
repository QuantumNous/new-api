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
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { SectionPageLayout } from '@/components/layout'
import { getBillingStatistics } from './api'
import type { BillingStatisticsResult, BillingStatsGranularity } from './types'

type TimePreset = 'last_hour' | 'today' | 'this_week' | 'this_month'
type ChartGranularity = Extract<BillingStatsGranularity, 'day' | 'month' | 'year'>

const TIME_PRESETS: Array<{ value: TimePreset; label: string }> = [
  { value: 'last_hour', label: 'Last 1 Hour' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
]

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm'
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const CHART_GRANULARITY_OPTIONS: Array<{
  value: ChartGranularity
  label: string
}> = [
  { value: 'day', label: 'Daily' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
]

const billingChartConfig = {
  total_amount: {
    label: 'Total Amount',
    color: 'var(--chart-1)',
  },
  consume_amount: {
    label: 'Total Usage Cost',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

function formatDateTime(value: dayjs.Dayjs) {
  return value.format(DATE_TIME_FORMAT)
}

function formatRenminbiAmount(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '-'
  const digits = Math.abs(value) >= 1 ? 2 : 4
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value)
}

function getPresetRange(preset: TimePreset) {
  const now = dayjs()
  switch (preset) {
    case 'last_hour':
      return { start: now.subtract(1, 'hour'), end: now }
    case 'this_week':
      return { start: now.startOf('week'), end: now }
    case 'this_month':
      return { start: now.startOf('month'), end: now }
    case 'today':
    default:
      return { start: now.startOf('day'), end: now }
  }
}

function StatTile(props: {
  title: string
  value: string
  description: string
  icon: typeof Wallet
  tone: string
}) {
  const Icon = props.icon
  return (
    <Card size='sm' className='rounded-lg'>
      <CardContent className='flex min-h-28 flex-col justify-between gap-3'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-muted-foreground text-xs font-medium'>
            {props.title}
          </span>
          <Icon className={cn('size-4', props.tone)} />
        </div>
        <div>
          <div className='font-mono text-2xl font-semibold tracking-normal tabular-nums'>
            {props.value}
          </div>
          <div className='text-muted-foreground mt-1 text-xs'>
            {props.description}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BillingStatisticsChart(props: {
  data: BillingStatisticsResult | null
  loading: boolean
}) {
  const { t } = useTranslation()
  const rows = props.data?.items ?? []

  return (
    <Card className='mt-4 rounded-lg'>
      <CardHeader>
        <CardTitle>{t('Billing Trend')}</CardTitle>
        <CardDescription>
          {t('Total amount and total usage cost by selected granularity')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className='text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed text-sm'>
            {props.loading ? t('Loading...') : t('No data')}
          </div>
        ) : (
          <ChartContainer
            config={billingChartConfig}
            className='h-72 w-full aspect-auto'
            initialDimension={{ width: 800, height: 288 }}
          >
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='bucket_label'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={18}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => formatRenminbiAmount(Number(value))}
                width={72}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <>
                        <span className='text-muted-foreground'>
                          {name === 'total_amount'
                            ? t('Total Amount')
                            : t('Total Usage Cost')}
                        </span>
                        <span className='font-mono font-medium tabular-nums'>
                          {formatRenminbiAmount(Number(value))}
                        </span>
                      </>
                    )}
                  />
                }
              />
              <Bar
                dataKey='total_amount'
                fill='var(--color-total_amount)'
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey='consume_amount'
                fill='var(--color-consume_amount)'
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function BillingStatistics() {
  const { t } = useTranslation()
  const initialRange = useMemo(() => getPresetRange('today'), [])
  const [startDate, setStartDate] = useState(formatDateTime(initialRange.start))
  const [endDate, setEndDate] = useState(formatDateTime(initialRange.end))
  const [activePreset, setActivePreset] = useState<TimePreset | null>('today')
  const [username, setUsername] = useState('')
  const [chartGranularity, setChartGranularity] =
    useState<ChartGranularity>('day')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<BillingStatisticsResult | null>(null)
  const [loading, setLoading] = useState(false)

  const params = useMemo(
    () => ({
      start_timestamp: dayjs(startDate).unix(),
      end_timestamp: dayjs(endDate).unix(),
      granularity: chartGranularity,
      username: username.trim() || undefined,
      p: page,
      page_size: pageSize,
    }),
    [chartGranularity, endDate, page, pageSize, startDate, username]
  )

  const applyPreset = useCallback((preset: TimePreset) => {
    const range = getPresetRange(preset)
    setStartDate(formatDateTime(range.start))
    setEndDate(formatDateTime(range.end))
    setActivePreset(preset)
    setPage(1)
  }, [])

  const fetchData = useCallback(async () => {
    if (params.end_timestamp <= params.start_timestamp) {
      toast.error(t('End date must be after start date'))
      return
    }
    setLoading(true)
    try {
      const res = await getBillingStatistics(params)
      if (res.success) {
        setData(res.data)
      }
    } finally {
      setLoading(false)
    }
  }, [params, t])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (data?.page && data.page !== page) {
      setPage(data.page)
    }
  }, [data?.page, page])

  const summary = data?.summary
  const rows = data?.user_items ?? []
  const totalRows = data?.user_items_total ?? 0
  const totalPages = Math.max(1, data?.total_pages ?? 1)
  const displayStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const displayEnd = totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Billing Statistics')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Track recharge, subscription and usage costs by time and user')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Actions>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
          <StatTile
            title={t('Recharge Amount')}
            value={formatRenminbiAmount(summary?.recharge_amount ?? 0)}
            description={t('Successful top-ups in the selected range')}
            icon={Wallet}
            tone='text-emerald-600'
          />
          <StatTile
            title={t('Subscription Amount')}
            value={formatRenminbiAmount(summary?.subscription_amount ?? 0)}
            description={t('Successful subscription orders')}
            icon={CreditCard}
            tone='text-sky-600'
          />
          <StatTile
            title={t('Total Amount')}
            value={formatRenminbiAmount(summary?.total_amount ?? 0)}
            description={t('Recharge plus subscription')}
            icon={WalletCards}
            tone='text-indigo-600'
          />
          <StatTile
            title={t('Usage Cost')}
            value={formatRenminbiAmount(summary?.consume_amount ?? 0)}
            description={t('Successful usage in the selected range')}
            icon={BarChart3}
            tone='text-amber-600'
          />
          <StatTile
            title={t('Redundant Amount')}
            value={formatRenminbiAmount(summary?.redundant_amount ?? 0)}
            description={t('Total amount minus usage cost')}
            icon={ShieldCheck}
            tone='text-violet-600'
          />
        </div>

        <Card className='mt-4 rounded-lg'>
          <CardHeader>
            <CardTitle>{t('Filters')}</CardTitle>
            <CardDescription>
              {t('Select a time range to calculate totals')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-3 lg:grid-cols-[220px_220px_1fr_180px_220px_auto]'>
              <Input
                type='datetime-local'
                value={startDate}
                aria-label={t('Start Time')}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setActivePreset(null)
                  setPage(1)
                }}
              />
              <Input
                type='datetime-local'
                value={endDate}
                aria-label={t('End Time')}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  setActivePreset(null)
                  setPage(1)
                }}
              />
              <div className='flex flex-wrap gap-1'>
                {TIME_PRESETS.map((item) => (
                  <Button
                    key={item.value}
                    type='button'
                    variant={activePreset === item.value ? 'default' : 'outline'}
                    onClick={() => applyPreset(item.value)}
                  >
                    {t(item.label)}
                  </Button>
                ))}
              </div>
              <Select
                items={CHART_GRANULARITY_OPTIONS.map((option) => ({
                  value: option.value,
                  label: t(option.label),
                }))}
                value={chartGranularity}
                onValueChange={(value) => {
                  setChartGranularity(value as ChartGranularity)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Granularity')} />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {CHART_GRANULARITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.label)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Input
                value={username}
                placeholder={t('Username')}
                onChange={(event) => {
                  setUsername(event.target.value)
                  setPage(1)
                }}
              />
              <Button onClick={fetchData} disabled={loading}>
                <Search className='size-4' />
                {t('Search')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <BillingStatisticsChart data={data} loading={loading} />

        <Card className='mt-4 rounded-lg'>
          <CardHeader>
            <CardTitle>{t('Breakdown')}</CardTitle>
            <CardDescription>
              {t('Merged by user in the selected range')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('User')}</TableHead>
                  <TableHead className='text-right'>
                    {t('Recharge Amount')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('Subscription Amount')}
                  </TableHead>
                  <TableHead className='text-right'>{t('Usage Cost')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className='text-muted-foreground h-24 text-center'
                    >
                      {loading ? t('Loading...') : t('No data')}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={`${row.user_id}-${row.username}`}
                      className='tabular-nums'
                    >
                      <TableCell>
                        {row.username || `${t('User')} #${row.user_id}`}
                      </TableCell>
                      <TableCell className='text-right'>
                        {formatRenminbiAmount(row.recharge_amount)}
                      </TableCell>
                      <TableCell className='text-right'>
                        {formatRenminbiAmount(row.subscription_amount)}
                      </TableCell>
                      <TableCell className='text-right'>
                        {formatRenminbiAmount(row.consume_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className='mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='text-muted-foreground text-sm'>
                {t('Showing {{start}}-{{end}} of {{total}} users', {
                  start: displayStart,
                  end: displayEnd,
                  total: totalRows,
                })}
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Select
                  items={PAGE_SIZE_OPTIONS.map((option) => ({
                    value: String(option),
                    label: option,
                  }))}
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className='h-8 w-[72px]'>
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side='top' alignItemWithTrigger={false}>
                    <SelectGroup>
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <span className='text-sm font-medium'>{t('Rows per page')}</span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={loading || page <= 1}
                >
                  <ChevronLeft className='size-4' />
                  {t('Previous')}
                </Button>
                <div className='text-sm font-medium tabular-nums'>
                  {t('Page {{current}} of {{total}}', {
                    current: Math.min(page, totalPages),
                    total: totalPages,
                  })}
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={loading || page >= totalPages}
                >
                  {t('Next')}
                  <ChevronRight className='size-4' />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
