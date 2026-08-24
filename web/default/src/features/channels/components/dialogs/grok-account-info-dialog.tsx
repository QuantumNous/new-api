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
import { Clock3, RefreshCw, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Dialog } from '@/components/dialog'
import { StatusBadge, type StatusBadgeProps } from '@/components/status-badge'
import type { GrokAccountQuotaWindow, GrokAccountStatus } from '../../api'
import {
  formatGrokAccountStatus,
  getGrokQuotaPercent,
} from '../../lib/grok-account-status'

type GrokAccountInfoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelName?: string
  status: GrokAccountStatus | null
  isRefreshing?: boolean
  onRefresh?: () => void
}

function statusBadge(status: string | undefined, t: (key: string) => string) {
  const normalized = status?.trim().toLowerCase()
  const values: Record<
    string,
    { label: string; variant: StatusBadgeProps['variant'] }
  > = {
    active: { label: t('Active'), variant: 'success' },
    pending: { label: t('Pending'), variant: 'warning' },
    needs_reauth: { label: t('Needs reauthorization'), variant: 'danger' },
  }
  return (
    values[normalized || ''] ?? {
      label: status || t('Unknown'),
      variant: 'neutral' as const,
    }
  )
}

function QuotaWindow({
  title,
  window,
}: {
  title: string
  window?: GrokAccountQuotaWindow
}) {
  const { t } = useTranslation()
  const percent = getGrokQuotaPercent(window)
  return (
    <div className='rounded-lg border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-sm font-medium'>{title}</span>
        <StatusBadge
          label={percent == null ? '-' : `${percent.toFixed(1)}%`}
          variant={percent != null && percent >= 90 ? 'danger' : 'info'}
          copyable={false}
        />
      </div>
      {percent != null && <Progress className='mt-3' value={percent} />}
      <div className='text-muted-foreground mt-2 space-y-1 text-xs'>
        <div>
          {t('Upstream status:')} {window?.status_code ?? '-'}
        </div>
        {window?.monthly_limit_cents != null && (
          <div>
            {t('Monthly limit (cents):')} {window.monthly_limit_cents}
          </div>
        )}
      </div>
    </div>
  )
}

export function GrokAccountInfoDialog({
  open,
  onOpenChange,
  channelName,
  status,
  isRefreshing,
  onRefresh,
}: GrokAccountInfoDialogProps) {
  const { t } = useTranslation()
  const summary = formatGrokAccountStatus(status)
  const badge = statusBadge(summary.authStatus, t)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Grok Account Info')}
      description={
        <>
          {t('Channel:')} <strong>{channelName || '-'}</strong>
        </>
      }
      contentClassName='sm:max-w-2xl'
      bodyClassName='space-y-4'
      footer={
        <Button variant='outline' onClick={() => onOpenChange(false)}>
          {t('Close')}
        </Button>
      }
    >
      <div className='rounded-lg border p-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <ShieldCheck className='h-4 w-4' />
          <StatusBadge
            label={badge.label}
            variant={badge.variant}
            copyable={false}
          />
          <StatusBadge
            label={summary.plan === '-' ? t('Plan unknown') : summary.plan}
            variant='info'
            copyable={false}
          />
        </div>
        <div className='text-muted-foreground mt-3 grid gap-2 text-xs sm:grid-cols-2'>
          <div className='flex items-center gap-2'>
            <Clock3 className='h-3.5 w-3.5' />
            {t('Billing observed:')} {summary.billingObservedAt}
          </div>
          <div className='flex items-center gap-2'>
            <RefreshCw className='h-3.5 w-3.5' />
            {t('Last refresh:')} {summary.lastRefreshAt}
          </div>
        </div>
        {onRefresh && (
          <Button
            className='mt-4'
            variant='outline'
            size='sm'
            onClick={onRefresh}
            disabled={Boolean(isRefreshing)}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            {isRefreshing ? t('Refreshing...') : t('Refresh account status')}
          </Button>
        )}
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <QuotaWindow title={t('Monthly credits')} window={status?.monthly} />
        <QuotaWindow title={t('Weekly credits')} window={status?.weekly} />
      </div>
    </Dialog>
  )
}
