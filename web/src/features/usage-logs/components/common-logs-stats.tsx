import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { getLogStats, getUserLogStats } from '../api'
import { formatLogQuota } from '../lib/format'
import { buildApiParams } from '../lib/utils'

const route = getRouteApi('/_authenticated/usage-logs/')

export function CommonLogsStats() {
  const { user } = useAuthStore((state) => state.auth)
  const isAdmin = user?.role === 100
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

      if (!result.success) {
        return { quota: 0, rpm: 0, tpm: 0 }
      }

      return result.data || { quota: 0, rpm: 0, tpm: 0 }
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
