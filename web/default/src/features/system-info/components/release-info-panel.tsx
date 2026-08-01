/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { GitCommitHorizontal, PackageCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useStatus } from '@/hooks/use-status'
import { formatTimestampToDate } from '@/lib/format'

function valueOrFallback(value?: string) {
  return value && value !== 'unknown' ? value : '-'
}

function formatBuildTime(value: string) {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp)
    ? '-'
    : formatTimestampToDate(timestamp, 'milliseconds')
}

export function ReleaseInfoPanel() {
  const { t } = useTranslation()
  const { status, loading } = useStatus()

  const release = valueOrFallback(status?.build_release)
  const commit = valueOrFallback(status?.build_commit)
  const buildTime = valueOrFallback(status?.build_time)
  const version = valueOrFallback(status?.version)

  return (
    <section className='bg-card overflow-hidden rounded-lg border shadow-xs'>
      <div className='flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='bg-muted text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md'>
            <PackageCheck className='size-4' aria-hidden='true' />
          </span>
          <div className='min-w-0'>
            <h3 className='text-sm font-semibold'>{t('Release information')}</h3>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t('Reported by the running server process.')}
            </p>
          </div>
        </div>
        <Badge variant='outline' className='w-fit gap-1.5'>
          <GitCommitHorizontal className='size-3.5' aria-hidden='true' />
          {loading ? <Skeleton className='h-3.5 w-16' /> : release}
        </Badge>
      </div>
      <div className='grid gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5 lg:grid-cols-4'>
        <div className='min-w-0'>
          <div className='text-muted-foreground text-xs'>{t('Version')}</div>
          <div className='mt-1 truncate font-mono text-xs'>
            {loading ? <Skeleton className='h-4 w-20' /> : version}
          </div>
        </div>
        <div className='min-w-0'>
          <div className='text-muted-foreground text-xs'>{t('Release')}</div>
          <div className='mt-1 truncate font-mono text-xs'>
            {loading ? <Skeleton className='h-4 w-24' /> : release}
          </div>
        </div>
        <div className='min-w-0'>
          <div className='text-muted-foreground text-xs'>{t('Commit')}</div>
          <div className='mt-1 flex min-w-0 items-center gap-1'>
            <span className='truncate font-mono text-xs'>
              {loading ? <Skeleton className='h-4 w-32' /> : commit}
            </span>
            {!loading && commit !== '-' && (
              <CopyButton
                value={commit}
                size='icon'
                tooltip={t('Copy commit')}
                aria-label={t('Copy commit')}
              />
            )}
          </div>
        </div>
        <div className='min-w-0'>
          <div className='text-muted-foreground text-xs'>{t('Built at')}</div>
          <div className='mt-1 truncate font-mono text-xs'>
            {loading ? (
              <Skeleton className='h-4 w-36' />
            ) : buildTime === '-' ? (
              '-'
            ) : (
              formatBuildTime(buildTime)
            )}
          </div>
        </div>
      </div>
      <div className='text-muted-foreground border-t px-4 py-2.5 text-xs sm:px-5'>
        {t('Process started at')}:{' '}
        {loading ? (
          <Skeleton className='inline-block h-3.5 w-36 align-middle' />
        ) : (
          formatTimestampToDate(status?.start_time)
        )}
      </div>
    </section>
  )
}
