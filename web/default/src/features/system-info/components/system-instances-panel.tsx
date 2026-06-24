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
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CircleAlert, RefreshCw, ServerCog } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ErrorState } from '@/components/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { listSystemInstances } from '../api'
import type { SystemInstance, SystemInstanceStatus } from '../types'

const INSTANCE_POLL_INTERVAL_MS = 30_000

const STATUS_CLASS_NAME: Record<SystemInstanceStatus, string> = {
  online:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  stale: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}

const STATUS_DOT_CLASS_NAME: Record<SystemInstanceStatus, string> = {
  online: 'bg-emerald-500',
  stale: 'bg-amber-500',
}

function roleLabel(instance: SystemInstance) {
  if (instance.info?.role?.is_master) return 'master'
  return 'worker'
}

function roleDescriptionKey(instance: SystemInstance) {
  if (instance.info?.role?.is_master) {
    return 'Master instances run scheduled background tasks.'
  }
  return 'Worker instances do not run master-only background tasks.'
}

function runtimeLabel(instance: SystemInstance) {
  const runtime = instance.info?.runtime
  if (!runtime?.goos && !runtime?.goarch) return '-'

  const parts: string[] = []
  if (runtime.goos || runtime.goarch) {
    parts.push([runtime.goos, runtime.goarch].filter(Boolean).join('/'))
  }
  return parts.join(' · ')
}

function getNodeName(instance: SystemInstance) {
  return instance.info?.node?.name || instance.node_name
}

type SystemInstancesTableProps = {
  instances: SystemInstance[]
}

function SystemInstancesTable(props: SystemInstancesTableProps) {
  const { t } = useTranslation()

  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table className='min-w-[980px]'>
        <TableHeader>
          <TableRow className='bg-muted/40 hover:bg-muted/40'>
            <TableHead className='h-9 w-[240px] px-4 text-xs'>
              {t('Instance')}
            </TableHead>
            <TableHead className='h-9 w-[120px] text-xs'>
              {t('Status')}
            </TableHead>
            <TableHead className='h-9 w-[110px] text-xs'>
              {t('Role')}
            </TableHead>
            <TableHead className='h-9 w-[120px] text-xs'>
              {t('Version')}
            </TableHead>
            <TableHead className='h-9 w-[190px] text-xs'>
              {t('Started')}
            </TableHead>
            <TableHead className='h-9 w-[190px] text-xs'>
              {t('Last Seen')}
            </TableHead>
            <TableHead className='h-9 w-[220px] pr-4 text-xs'>
              {t('Runtime')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.instances.map((instance) => {
            const shouldConfigure =
              instance.info?.node?.should_configure_manually === true
            return (
              <TableRow key={instance.node_name} className='hover:bg-muted/30'>
                <TableCell className='px-4 py-3 align-middle'>
                  <div className='space-y-1'>
                    <div className='flex min-w-0 items-center gap-2'>
                      <span className='truncate font-medium'>
                        {getNodeName(instance)}
                      </span>
                      {shouldConfigure && (
                        <Popover>
                          <PopoverTrigger
                            className='inline-flex shrink-0 rounded-full focus-visible:ring-2 focus-visible:outline-none'
                            aria-label={t('Configure NODE_NAME')}
                          >
                            <Badge
                              variant='outline'
                              className='border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300'
                            >
                              <AlertTriangle
                                data-icon='inline-start'
                                className='size-3'
                                aria-hidden='true'
                              />
                              {t('Configure NODE_NAME')}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent align='start' className='w-80'>
                            <PopoverHeader>
                              <PopoverTitle>
                                {t('Configure NODE_NAME')}
                              </PopoverTitle>
                              <PopoverDescription>
                                {t(
                                  'This instance is using an automatic hostname. Set NODE_NAME to a stable unique value for multi-instance management.'
                                )}
                              </PopoverDescription>
                            </PopoverHeader>
                            <div className='space-y-2 text-xs'>
                              <div>
                                <div className='mb-1 font-medium'>
                                  {t('Example')}
                                </div>
                                <code className='bg-muted block rounded-md px-2 py-1.5 font-mono text-[11px] break-all'>
                                  NODE_NAME=new-api-master-1
                                </code>
                              </div>
                              <p className='text-muted-foreground'>
                                {t(
                                  'Use a different stable value for each instance, then restart the service.'
                                )}
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    <div className='text-muted-foreground max-w-[220px] truncate font-mono text-[11px]'>
                      {instance.info?.host?.hostname || '-'}
                    </div>
                  </div>
                </TableCell>
                <TableCell className='py-3 align-middle'>
                  <Badge
                    variant='secondary'
                    className={cn('gap-1.5', STATUS_CLASS_NAME[instance.status])}
                  >
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        STATUS_DOT_CLASS_NAME[instance.status]
                      )}
                      aria-hidden='true'
                    />
                    {t(instance.status)}
                  </Badge>
                </TableCell>
                <TableCell className='py-3 align-middle'>
                  <div className='flex items-center gap-1.5'>
                    <Badge variant='outline'>{roleLabel(instance)}</Badge>
                    <TooltipProvider delay={100}>
                      <Tooltip>
                        <TooltipTrigger
                          className='text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none'
                          aria-label={t('Node role')}
                        >
                          <CircleAlert className='size-3.5' aria-hidden='true' />
                        </TooltipTrigger>
                        <TooltipContent>
                          {t(roleDescriptionKey(instance))}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground py-3 font-mono text-xs align-middle'>
                  {instance.info?.runtime?.version || '-'}
                </TableCell>
                <TableCell className='text-muted-foreground py-3 text-xs whitespace-nowrap align-middle'>
                  {formatTimestampToDate(instance.started_at)}
                </TableCell>
                <TableCell className='text-muted-foreground py-3 text-xs whitespace-nowrap align-middle'>
                  {formatTimestampToDate(instance.last_seen_at)}
                </TableCell>
                <TableCell className='text-muted-foreground py-3 pr-4 font-mono text-xs align-middle'>
                  {runtimeLabel(instance)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function SystemInstancesPanel() {
  const { t } = useTranslation()
  const instancesQuery = useQuery({
    queryKey: ['system-info', 'instances'],
    queryFn: async () => {
      const res = await listSystemInstances()
      if (!res.success || !Array.isArray(res.data)) {
        throw new Error(res.message || t('We could not load instances.'))
      }
      return res.data
    },
    staleTime: 30 * 1000,
    retry: false,
    refetchInterval: INSTANCE_POLL_INTERVAL_MS,
  })

  const instances = instancesQuery.data ?? []
  const loading = instancesQuery.isLoading
  const refreshing = instancesQuery.isFetching && !instancesQuery.isLoading

  return (
    <section className='bg-card overflow-hidden rounded-lg border shadow-xs'>
      <div className='flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <span className='bg-muted text-muted-foreground inline-flex size-7 items-center justify-center rounded-md'>
              <ServerCog className='size-4' aria-hidden='true' />
            </span>
            <div className='min-w-0'>
              <h3 className='text-sm font-semibold'>{t('Instances')}</h3>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {t(
                  'Nodes reporting from this deployment and their latest heartbeat.'
                )}
              </p>
            </div>
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-3'>
          <span className='text-muted-foreground text-xs' aria-live='polite'>
            {t('Auto-refreshing every {{seconds}}s', {
              seconds: INSTANCE_POLL_INTERVAL_MS / 1000,
            })}
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => void instancesQuery.refetch()}
            disabled={instancesQuery.isFetching}
            aria-label={t('Refresh')}
          >
            <RefreshCw
              data-icon='inline-start'
              className={cn('size-3.5', refreshing && 'animate-spin')}
              aria-hidden='true'
            />
            {refreshing ? t('Refreshing...') : t('Refresh')}
          </Button>
        </div>
      </div>

      <div aria-busy={instancesQuery.isFetching}>
        {loading ? (
          <div className='space-y-2 p-4 sm:p-5'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-9 w-full rounded-md' />
            ))}
          </div>
        ) : instancesQuery.isError ? (
          <ErrorState
            title={t('We could not load instances.')}
            description={
              instancesQuery.error instanceof Error
                ? instancesQuery.error.message
                : undefined
            }
            onRetry={() => {
              void instancesQuery.refetch()
            }}
            className='min-h-[220px]'
          />
        ) : instances.length === 0 ? (
          <div className='px-4 py-10 text-center sm:px-5'>
            <div className='bg-muted mx-auto mb-3 flex size-10 items-center justify-center rounded-lg'>
              <ServerCog
                className='text-muted-foreground size-5'
                aria-hidden='true'
              />
            </div>
            <p className='text-muted-foreground text-sm'>
              {t('No instances have reported yet.')}
            </p>
          </div>
        ) : (
          <div className='p-4 sm:p-5'>
            <SystemInstancesTable instances={instances} />
          </div>
        )}
      </div>
    </section>
  )
}
