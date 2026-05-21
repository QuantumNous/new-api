import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useIsAdmin } from '@/hooks/use-admin'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getTokenStats } from '../api'
import type { TokenStat } from '../types'

function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateFromInput(dateStr: string): Date | undefined {
  if (!dateStr) return undefined
  const parts = dateStr.split('-')
  if (parts.length !== 3) return undefined
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    startDate: formatDateForInput(start),
    endDate: formatDateForInput(now),
  }
}

function formatTokensInM(tokens: number): string {
  if (tokens === 0) return '0'
  const millions = tokens / 1_000_000
  if (millions < 0.01) {
    return millions.toFixed(4) + 'm'
  }
  return millions.toFixed(2) + 'm'
}

export function TokenStatsTable() {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()

  const [filters, setFilters] = useState(() => {
    const { startDate, endDate } = getDefaultDateRange()
    return { startDate, endDate, username: '' }
  })

  const [searchParams, setSearchParams] = useState<{
    startDate: string
    endDate: string
    username: string
  } | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['token-stats', searchParams, t],
    queryFn: async () => {
      if (!searchParams) return []
      
      const startDate = parseDateFromInput(searchParams.startDate)
      const endDate = searchParams.endDate ? parseDateFromInput(searchParams.endDate) : undefined
      
      const result = await getTokenStats({
        start_timestamp: startDate ? Math.floor(startDate.getTime() / 1000) : undefined,
        end_timestamp: endDate ? Math.floor(endDate.getTime() / 1000) + 86399 : undefined,
        username: searchParams.username || undefined,
      })

      if (!result?.success) {
        toast.error(result?.message || t('Failed to load token statistics'))
        return []
      }

      return result.data || []
    },
    enabled: !!searchParams,
  })

  const handleSearch = () => {
    setSearchParams(filters)
  }

  const stats: TokenStat[] = data || []

  // Calculate totals
  const totalPromptTokens = stats.reduce((sum, s) => sum + s.prompt_tokens, 0)
  const totalCompletionTokens = stats.reduce(
    (sum, s) => sum + s.completion_tokens,
    0
  )
  const totalTokens = stats.reduce((sum, s) => sum + s.total_tokens, 0)

  return (
    <div className='space-y-4'>
      {/* Filter Bar */}
      <div className='rounded-md border bg-card/50 p-3 shadow-xs'>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2'>
            <label className='text-sm text-muted-foreground'>{t('Start Date')}:</label>
            <Input
              type='date'
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className='w-36'
            />
          </div>
          <div className='flex items-center gap-2'>
            <label className='text-sm text-muted-foreground'>{t('End Date')}:</label>
            <Input
              type='date'
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className='w-36'
            />
          </div>
          {isAdmin && (
            <div className='flex items-center gap-2'>
              <label className='text-sm text-muted-foreground'>{t('User')}:</label>
              <Input
                placeholder={t('Username')}
                value={filters.username}
                onChange={(e) => setFilters((f) => ({ ...f, username: e.target.value }))}
                className='w-32'
              />
            </div>
          )}
          <Button
            variant='default'
            size='sm'
            onClick={handleSearch}
            disabled={isFetching}
          >
            {t('Query')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className='grid gap-4 md:grid-cols-3'>
        <div className='rounded-lg border bg-card p-4 shadow-sm'>
          <div className='text-muted-foreground text-sm'>{t('Input Tokens (Prompt)')}</div>
          <div className='mt-1 text-2xl font-bold'>{formatTokensInM(totalPromptTokens)}</div>
        </div>
        <div className='rounded-lg border bg-card p-4 shadow-sm'>
          <div className='text-muted-foreground text-sm'>{t('Output Tokens (Completion)')}</div>
          <div className='mt-1 text-2xl font-bold'>{formatTokensInM(totalCompletionTokens)}</div>
        </div>
        <div className='rounded-lg border bg-card p-4 shadow-sm'>
          <div className='text-muted-foreground text-sm'>{t('Total Tokens')}</div>
          <div className='mt-1 text-2xl font-bold'>{formatTokensInM(totalTokens)}</div>
        </div>
      </div>

      {/* Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('User')}</TableHead>
              <TableHead className='text-right'>{t('Input (Prompt)')}</TableHead>
              <TableHead className='text-right'>{t('Output (Completion)')}</TableHead>
              <TableHead className='text-right'>{t('Total')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className='text-center'>
                  {t('Loading...')}
                </TableCell>
              </TableRow>
            ) : stats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className='text-center'>
                  {t('No data available')}
                </TableCell>
              </TableRow>
            ) : (
              stats.map((stat) => (
                <TableRow key={stat.username}>
                  <TableCell className='font-medium'>{stat.username}</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    {formatTokensInM(stat.prompt_tokens)}
                  </TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    {formatTokensInM(stat.completion_tokens)}
                  </TableCell>
                  <TableCell className='text-right font-mono tabular-nums font-semibold'>
                    {formatTokensInM(stat.total_tokens)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}