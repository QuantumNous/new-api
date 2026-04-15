import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { formatLogQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useIsAdmin } from '@/hooks/use-admin'
import { Skeleton } from '@/components/ui/skeleton'
import { dotColorMap, textColorMap } from '@/components/status-badge'
import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams } from '../lib/utils'

const route = getRouteApi('/_authenticated/usage-logs/$section')

export function CommonLogsStats() {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const searchParams = route.useSearch()

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
        <Skeleton className='h-6 w-[126px] rounded-md' />
        <Skeleton className='h-6 w-[58px] rounded-md' />
        <Skeleton className='h-6 w-[58px] rounded-md' />
      </div>
    )
  }

  return (
    <div className='flex items-center gap-1.5 text-xs font-medium'>
      <span
        className={cn('size-1.5 shrink-0 rounded-full', dotColorMap.blue)}
        aria-hidden='true'
      />
      <span className={cn(textColorMap.blue)}>
        {t('Usage')}: {formatLogQuota(stats?.quota || 0)}
      </span>
      <span className='text-muted-foreground/30'>·</span>
      <span className={cn(textColorMap.pink)}>
        {t('RPM')}: {stats?.rpm || 0}
      </span>
      <span className='text-muted-foreground/30'>·</span>
      <span className='text-muted-foreground'>
        {t('TPM')}: {stats?.tpm || 0}
      </span>
    </div>
  )
}
