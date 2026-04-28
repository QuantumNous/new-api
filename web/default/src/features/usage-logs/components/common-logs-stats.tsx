import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { formatLogQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useIsAdmin } from '@/hooks/use-admin'
import { Skeleton } from '@/components/ui/skeleton'
import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams } from '../lib/utils'
import { useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

export function CommonLogsStats() {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const searchParams = route.useSearch()
  const { sensitiveVisible } = useUsageLogsContext()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['usage-logs-stats', isAdmin, searchParams],
    queryFn: async () => {
      const params = buildApiParams({
        page: 1,
        pageSize: 1,
        searchParams,
        columnFilters: [],
        isAdmin,
      })

      const result = isAdmin
        ? await getLogStats(params)
        : await getUserLogStats(params)

      return result.success
        ? result.data || DEFAULT_LOG_STATS
        : DEFAULT_LOG_STATS
    },
    placeholderData: (previousData) => previousData,
  })

  if (isLoading) {
    return (
      <div className='flex items-center gap-2'>
        <Skeleton className='h-7 w-[150px] rounded-md' />
        <Skeleton className='h-7 w-[100px] rounded-md' />
        <Skeleton className='h-7 w-[120px] rounded-md' />
      </div>
    )
  }

  const tagClass =
    'inline-flex h-7 items-center rounded-md border px-3 py-1 text-xs font-medium shadow-xs'

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <span
        className={cn(
          tagClass,
          'border-blue-200/70 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300'
        )}
      >
        {t('Usage')}:{' '}
        {sensitiveVisible ? formatLogQuota(stats?.quota || 0) : '••••'}
      </span>
      <span
        className={cn(
          tagClass,
          'border-pink-200/70 bg-pink-50 text-pink-700 dark:border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-300'
        )}
      >
        {t('RPM')}: {stats?.rpm || 0}
      </span>
      <span
        className={cn(
          tagClass,
          'border-border bg-background text-muted-foreground'
        )}
      >
        {t('TPM')}: {stats?.tpm || 0}
      </span>
    </div>
  )
}
