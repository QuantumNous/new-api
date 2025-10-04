import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { formatLogQuota } from '@/lib/format'
import { useIsAdmin } from '@/hooks/use-admin'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams } from '../lib/utils'

const route = getRouteApi('/_authenticated/usage-logs/')

export function CommonLogsStats() {
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
    <div className='flex items-center gap-2'>
      <StatusBadge
        label={`Usage: ${formatLogQuota(stats?.quota || 0)}`}
        variant='blue'
        copyable={false}
      />
      <StatusBadge
        label={`RPM: ${stats?.rpm || 0}`}
        variant='pink'
        copyable={false}
      />
      <StatusBadge
        label={`TPM: ${stats?.tpm || 0}`}
        variant='neutral'
        copyable={false}
      />
    </div>
  )
}
