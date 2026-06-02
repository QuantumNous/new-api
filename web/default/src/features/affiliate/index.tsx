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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { formatNumber, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge, type StatusBadgeProps } from '@/components/status-badge'
import {
  getAffiliateLogs,
  getAffiliateStatus,
  getAffiliateSummary,
} from './api'
import {
  buildAffiliateLogsParams,
  buildAffiliateLogsCsv,
  formatAffiliateRmbFromQuota,
  formatRawQuota,
  getAffiliateUnavailableMessage,
} from './lib'
import type {
  AffiliateLog,
  AffiliateLogFilters,
  AffiliateSummary as AffiliateSummaryData,
} from './types'

const DEFAULT_PAGE_SIZE = 20

const EMPTY_FILTERS: AffiliateLogFilters = {
  model: '',
  group: '',
  userId: '',
  secondLevelUserId: '',
  requestStatus: '',
  startTime: '',
  endTime: '',
}

const LOG_STATUS_META: Record<
  number,
  { labelKey: string; variant: StatusBadgeProps['variant'] }
> = {
  2: { labelKey: 'Success', variant: 'success' },
  5: { labelKey: 'Failed', variant: 'danger' },
  6: { labelKey: 'Refund', variant: 'warning' },
}

function formatRmb(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function getScopeLabel(
  scopeKind: string | undefined,
  t: (key: string) => string
) {
  switch (scopeKind) {
    case 'global':
      return t('Global affiliate scope')
    case 'affiliate':
      return t('Affiliate scope')
    default:
      return t('No affiliate scope')
  }
}

function getRuleStatusLabel(
  status: string | undefined,
  t: (key: string) => string
) {
  switch (status) {
    case 'pending_rules':
      return t('Rules pending')
    default:
      return status || t('N/A')
  }
}

function getLogTypeMeta(type: number, t: (key: string) => string) {
  const meta = LOG_STATUS_META[type]
  if (!meta) {
    return { label: t('Unknown'), variant: 'neutral' as const }
  }
  return { label: t(meta.labelKey), variant: meta.variant }
}

function SummaryMetric(props: {
  title: string
  value: string
  description?: string
  muted?: boolean
}) {
  return (
    <Card size='sm' className={cn(props.muted && 'border-dashed')}>
      <CardHeader>
        <CardDescription>{props.title}</CardDescription>
        <CardTitle className='text-xl'>{props.value}</CardTitle>
      </CardHeader>
      {props.description && (
        <CardContent>
          <p className='text-muted-foreground text-xs'>{props.description}</p>
        </CardContent>
      )}
    </Card>
  )
}

function SummaryCards(props: {
  summary: AffiliateSummaryData | undefined
  isLoading: boolean
}) {
  const { t } = useTranslation()
  const summary = props.summary
  const rulePending = summary?.rule_status === 'pending_rules'

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      <SummaryMetric
        title={t('Team Users')}
        value={props.isLoading ? '-' : formatNumber(summary?.team_user_count)}
      />
      <SummaryMetric
        title={t('Effective New Users')}
        value={
          props.isLoading
            ? '-'
            : formatNumber(summary?.effective_new_user_count)
        }
      />
      <SummaryMetric
        title={t('Net Paid Usage')}
        value={
          props.isLoading ? '-' : formatRmb(summary?.net_consumption_rmb, 4)
        }
        description={
          summary
            ? `${t('Raw quota')}: ${formatRawQuota(summary.net_consumption_quota)}`
            : undefined
        }
      />
      <SummaryMetric
        title={t('Estimated Commission')}
        value={
          props.isLoading ? '-' : formatRmb(summary?.estimated_commission_rmb)
        }
        muted={rulePending}
      />
      <SummaryMetric
        title={t('Head Fee')}
        value={props.isLoading ? '-' : formatRmb(summary?.head_fee_rmb)}
        muted={rulePending}
      />
      <SummaryMetric
        title={t('Pending Settlement')}
        value={
          props.isLoading ? '-' : formatRmb(summary?.pending_settlement_rmb)
        }
        muted={rulePending}
      />
      <SummaryMetric
        title={t('KPI Tier')}
        value={props.isLoading ? '-' : summary?.kpi_tier_name || t('N/A')}
        description={
          rulePending
            ? t('Commission, KPI and head fee rules are pending configuration')
            : getRuleStatusLabel(summary?.rule_status, t)
        }
        muted={rulePending}
      />
    </div>
  )
}

function AffiliateLogFiltersForm(props: {
  draftFilters: AffiliateLogFilters
  setDraftFilters: (filters: AffiliateLogFilters) => void
  onApply: () => void
  onReset: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const update = (key: keyof AffiliateLogFilters, value: string) => {
    props.setDraftFilters({ ...props.draftFilters, [key]: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Affiliate Log Filters')}</CardTitle>
        <CardDescription>
          {t('Filters are limited to affiliate scoped fields')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <Input
            placeholder={t('Model')}
            value={props.draftFilters.model}
            disabled={props.disabled}
            onChange={(event) => update('model', event.target.value)}
          />
          <Input
            placeholder={t('Group')}
            value={props.draftFilters.group}
            disabled={props.disabled}
            onChange={(event) => update('group', event.target.value)}
          />
          <Input
            placeholder={t('User ID')}
            value={props.draftFilters.userId}
            disabled={props.disabled}
            inputMode='numeric'
            onChange={(event) => update('userId', event.target.value)}
          />
          <Input
            placeholder={t('Second-level Affiliate ID')}
            value={props.draftFilters.secondLevelUserId}
            disabled={props.disabled}
            inputMode='numeric'
            onChange={(event) =>
              update('secondLevelUserId', event.target.value)
            }
          />
          <select
            className='border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50'
            value={props.draftFilters.requestStatus}
            disabled={props.disabled}
            onChange={(event) => update('requestStatus', event.target.value)}
          >
            <option value=''>{t('All Request Statuses')}</option>
            <option value='success'>{t('Success')}</option>
            <option value='error'>{t('Failed')}</option>
            <option value='refund'>{t('Refund')}</option>
          </select>
          <Input
            type='datetime-local'
            value={props.draftFilters.startTime}
            disabled={props.disabled}
            onChange={(event) => update('startTime', event.target.value)}
          />
          <Input
            type='datetime-local'
            value={props.draftFilters.endTime}
            disabled={props.disabled}
            onChange={(event) => update('endTime', event.target.value)}
          />
          <div className='flex gap-2'>
            <Button
              className='flex-1'
              disabled={props.disabled}
              onClick={props.onApply}
            >
              {t('Apply')}
            </Button>
            <Button
              className='flex-1'
              variant='outline'
              disabled={props.disabled}
              onClick={props.onReset}
            >
              {t('Reset')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AffiliateLogsTable(props: {
  logs: AffiliateLog[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const currencyConfig = useSystemConfigStore((state) => state.config.currency)
  const hasNext = props.page * props.pageSize < props.total
  const handleExport = () => {
    if (props.logs.length === 0) return
    const csv = buildAffiliateLogsCsv(props.logs, currencyConfig)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `affiliate-logs-page-${props.page}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Affiliate Scoped Logs')}</CardTitle>
        <CardDescription>
          {t('Showing only users visible to the current affiliate scope')}
        </CardDescription>
        <CardAction>
          <Button
            variant='outline'
            size='sm'
            disabled={props.isLoading || props.logs.length === 0}
            onClick={handleExport}
          >
            <Download className='size-4' />
            {t('Download')} CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Time')}</TableHead>
              <TableHead>{t('User ID')}</TableHead>
              <TableHead>{t('Type')}</TableHead>
              <TableHead>{t('Model')}</TableHead>
              <TableHead>{t('Group')}</TableHead>
              <TableHead>{t('Request Status')}</TableHead>
              <TableHead className='text-right'>{t('Cost')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('Loading')}
                </TableCell>
              </TableRow>
            ) : props.logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('No affiliate logs')}
                </TableCell>
              </TableRow>
            ) : (
              props.logs.map((log) => {
                const status = getLogTypeMeta(log.type, t)
                return (
                  <TableRow key={`${log.id}-${log.created_at}-${log.user_id}`}>
                    <TableCell>
                      {formatTimestampToDate(log.created_at)}
                    </TableCell>
                    <TableCell>{log.user_id}</TableCell>
                    <TableCell>{log.type}</TableCell>
                    <TableCell>{log.model_name || '-'}</TableCell>
                    <TableCell>{log.group || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={status.label}
                        variant={status.variant}
                        copyable={false}
                      />
                    </TableCell>
                    <TableCell
                      className='text-right font-medium'
                      title={`${t('Raw quota')}: ${formatRawQuota(log.quota)}`}
                    >
                      {formatAffiliateRmbFromQuota(log.quota, currencyConfig)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='text-muted-foreground text-sm'>
            {t('Total')}: {props.total}
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              disabled={props.page <= 1 || props.isLoading}
              onClick={() => props.onPageChange(Math.max(1, props.page - 1))}
            >
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground text-sm'>
              {t('Page')} {props.page}
            </span>
            <Button
              variant='outline'
              disabled={!hasNext || props.isLoading}
              onClick={() => props.onPageChange(props.page + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function Affiliate() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<AffiliateLogFilters>(EMPTY_FILTERS)
  const [draftFilters, setDraftFilters] =
    useState<AffiliateLogFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const statusQuery = useQuery({
    queryKey: ['affiliate', 'status'],
    queryFn: getAffiliateStatus,
  })

  const status = statusQuery.data?.data
  const available = Boolean(status?.available)

  const summaryQuery = useQuery({
    queryKey: ['affiliate', 'summary'],
    queryFn: getAffiliateSummary,
    enabled: available,
  })

  const logParams = useMemo(
    () => buildAffiliateLogsParams(filters, page, DEFAULT_PAGE_SIZE),
    [filters, page]
  )

  const logsQuery = useQuery({
    queryKey: ['affiliate', 'logs', logParams],
    queryFn: () => getAffiliateLogs(logParams),
    enabled: available,
  })

  const summary = summaryQuery.data?.data
  const logsPage = logsQuery.data?.data
  const unavailableMessage = getAffiliateUnavailableMessage(
    status?.unavailable_reason,
    status?.message || statusQuery.data?.message,
    t
  )

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Affiliate Center')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          disabled={statusQuery.isFetching}
          onClick={() => void statusQuery.refetch()}
        >
          <RefreshCw className='size-4' />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Affiliate Scope')}</CardTitle>
              <CardDescription>
                {t('Affiliate access is enforced by backend scoped APIs')}
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap items-center gap-2'>
              <StatusBadge
                label={
                  statusQuery.isLoading
                    ? t('Loading')
                    : getScopeLabel(status?.scope?.kind, t)
                }
                variant={available ? 'success' : 'neutral'}
                copyable={false}
              />
              {status?.scope?.affiliate_level ? (
                <StatusBadge
                  label={`${t('Level')} ${status.scope.affiliate_level}`}
                  variant='info'
                  copyable={false}
                />
              ) : null}
            </CardContent>
          </Card>

          {!statusQuery.isLoading && !available ? (
            <Card className='border-warning/40 bg-warning/5'>
              <CardHeader>
                <CardTitle>{t('Affiliate feature is unavailable')}</CardTitle>
                <CardDescription>{unavailableMessage}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {available ? (
            <>
              <SummaryCards
                summary={summary}
                isLoading={summaryQuery.isLoading || summaryQuery.isFetching}
              />
              {summaryQuery.data && !summaryQuery.data.success ? (
                <Card className='border-warning/40'>
                  <CardHeader>
                    <CardTitle>{t('Failed to load affiliate data')}</CardTitle>
                    <CardDescription>
                      {t('Please refresh or contact an administrator')}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : null}
              <AffiliateLogFiltersForm
                draftFilters={draftFilters}
                setDraftFilters={setDraftFilters}
                disabled={logsQuery.isFetching}
                onApply={applyFilters}
                onReset={resetFilters}
              />
              <AffiliateLogsTable
                logs={logsPage?.items ?? []}
                total={logsPage?.total ?? 0}
                page={page}
                pageSize={DEFAULT_PAGE_SIZE}
                isLoading={logsQuery.isLoading || logsQuery.isFetching}
                onPageChange={setPage}
              />
              {logsQuery.data && !logsQuery.data.success ? (
                <Card className='border-warning/40'>
                  <CardHeader>
                    <CardTitle>{t('Failed to load affiliate data')}</CardTitle>
                    <CardDescription>
                      {t('Please adjust filters or refresh the page')}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : null}
            </>
          ) : null}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
