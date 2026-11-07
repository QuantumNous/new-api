import { useQuery } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { getAllLogs } from '@/features/usage-logs/api'
import { LOG_TYPE_ENUM } from '@/features/usage-logs/constants'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import {
  formatInteger,
  formatTimestampToDate,
  formatTimestampRelative,
} from '@/lib/format'
import {
  requireServerSuccess,
  translateServerText,
} from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

const WINDOW_SECONDS = 24 * 3600
const RECENT_LIMIT = 50
const TOP_FAILING_MODELS = 3
// Live like the rest of the control panel: poll every 3 seconds.
const REFRESH_MS = 3000

const ROW_GRID =
  'grid grid-cols-1 gap-y-0.5 sm:grid-cols-[6rem_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.6fr)] sm:items-center sm:gap-x-3'

export function FailedRequestsPanel() {
  const { t } = useTranslation()
  const logsQuery = useQuery({
    queryKey: ['admin-overview', 'failed-requests'],
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000)
      return requireServerSuccess(
        await getAllLogs({
          type: LOG_TYPE_ENUM.ERROR,
          p: 1,
          page_size: RECENT_LIMIT,
          start_timestamp: now - WINDOW_SECONDS,
          end_timestamp: now,
        })
      )
    },
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS - 100,
  })

  const logs = useMemo(() => {
    const items = logsQuery.data?.data?.items
    return Array.isArray(items) ? (items as UsageLog[]) : []
  }, [logsQuery.data])
  const total = logsQuery.data?.data?.total ?? 0
  const failingModels = useMemo(() => {
    const counts = new Map<string, number>()
    for (const log of logs) {
      const model = log.model_name || t('Unknown')
      counts.set(model, (counts.get(model) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_FAILING_MODELS)
  }, [logs, t])

  let content: React.ReactNode
  if (logsQuery.isError) {
    content = (
      <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
        {t('Failed to load')}
      </div>
    )
  } else if (logsQuery.isLoading) {
    content = (
      <div className='space-y-2.5'>
        {['failed-1', 'failed-2', 'failed-3', 'failed-4', 'failed-5'].map(
          (key) => (
            <Skeleton key={key} className='h-8 w-full' />
          )
        )}
      </div>
    )
  } else if (logs.length === 0) {
    content = (
      <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
        {t('No failed requests in the last 24 hours')}
      </div>
    )
  } else {
    content = (
      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-1.5'>
          <span className='text-foreground text-sm font-semibold tabular-nums text-red-600 dark:text-red-400'>
            {formatInteger(total)}
          </span>
          <span className='text-muted-foreground text-xs'>
            {t('Failed requests in the last 24 hours')}
          </span>
          {failingModels.length > 0 && (
            <>
              <span className='bg-border ms-1 hidden h-4 w-px sm:block' />
              <span className='text-muted-foreground text-xs'>
                {t('Top failing models')}
              </span>
              {failingModels.map(([model, count]) => (
                <span
                  key={model}
                  className='bg-muted/50 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1'
                >
                  <span
                    className='max-w-[10rem] truncate font-mono text-[11px]'
                    dir='auto'
                    title={model}
                  >
                    {model}
                  </span>
                  <span className='font-mono text-[11px] font-semibold text-red-600 tabular-nums dark:text-red-400'>
                    {count}
                  </span>
                </span>
              ))}
            </>
          )}
        </div>
        <div className={cn(ROW_GRID, 'text-muted-foreground hidden pb-1 text-[11px] font-medium sm:grid')}>
          <span>{t('Time')}</span>
          <span>{t('Model')}</span>
          <span>{t('Client')}</span>
          <span>{t('Channel')}</span>
          <span>{t('Reason')}</span>
        </div>
        <ul className='divide-border divide-y'>
          {logs.map((log) => {
            const model = log.model_name || t('Unknown')
            const reason = translateServerText(t, log.content)
            return (
              <li key={log.id} className={cn(ROW_GRID, 'py-2')}>
                <span
                  className='text-muted-foreground font-mono text-[11px] tabular-nums'
                  title={formatTimestampToDate(log.created_at)}
                >
                  {formatTimestampRelative(log.created_at)}
                </span>
                <span
                  className='truncate font-mono text-xs'
                  dir='auto'
                  title={model}
                >
                  {model}
                </span>
                <span className='flex min-w-0 items-center gap-1 text-xs'>
                  <span
                    className='truncate'
                    dir='auto'
                    title={log.username}
                  >
                    {log.username || `#${log.user_id}`}
                  </span>
                  {log.token_name && (
                    <span
                      className='text-muted-foreground truncate'
                      dir='auto'
                      title={log.token_name}
                    >
                      / {log.token_name}
                    </span>
                  )}
                </span>
                <span
                  className='text-muted-foreground truncate text-xs'
                  dir='auto'
                  title={log.channel_name || undefined}
                >
                  {log.channel_name || '-'}
                </span>
                <span
                  className='truncate text-xs text-red-600 dark:text-red-400'
                  dir='auto'
                  title={reason}
                >
                  {reason || '-'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <TitledCard
      title={t('Failed requests')}
      description={t('Failed requests in the last 24 hours')}
      icon={<ShieldAlert />}
      iconTone='destructive'
      disableHoverEffect
    >
      {content}
    </TitledCard>
  )
}
