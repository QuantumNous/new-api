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

import {
  Activity01Icon,
  Add01Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Edit02Icon,
  RefreshIcon,
  SearchIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
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
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  deleteChannelMonitor,
  getChannelMonitors,
  runChannelMonitor,
  updateChannelMonitor,
} from './api'
import { ChannelMonitorSheet } from './components/monitor-sheet'
import { MonitorStatusBadge } from './components/monitor-status'
import {
  formatMonitorAvailability,
  formatMonitorTime,
  getMonitorApiHost,
} from './lib/format'
import type { ChannelMonitor, ChannelMonitorPayload } from './types'

const EMPTY_CHANNEL_MONITORS: ChannelMonitor[] = []

function monitorPayload(
  monitor: ChannelMonitor,
  changes: Partial<ChannelMonitorPayload>
): ChannelMonitorPayload {
  return {
    name: monitor.name,
    api_url: monitor.api_url,
    api_key: '',
    test_model: monitor.test_model,
    interval_seconds: monitor.interval_seconds,
    timeout_seconds: monitor.timeout_seconds,
    enabled: monitor.enabled,
    visible: monitor.visible,
    manual_availability_7d: monitor.manual_availability_7d,
    manual_availability_30d: monitor.manual_availability_30d,
    ...changes,
  }
}

export function ChannelMonitors() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedMonitor, setSelectedMonitor] = useState<ChannelMonitor | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = useState<ChannelMonitor | null>(null)

  const monitorsQuery = useQuery({
    queryKey: ['channel-monitors'],
    queryFn: getChannelMonitors,
    refetchInterval: 10_000,
  })

  const updateMutation = useMutation({
    mutationFn: (input: {
      monitor: ChannelMonitor
      changes: Partial<ChannelMonitorPayload>
    }) =>
      updateChannelMonitor(
        input.monitor.id,
        monitorPayload(input.monitor, input.changes)
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['channel-monitors'] })
      await queryClient.invalidateQueries({ queryKey: ['group-status'] })
    },
    onError: (error) => toast.error(error.message || t('Operation failed')),
  })

  const runMutation = useMutation({
    mutationFn: runChannelMonitor,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['channel-monitors'] })
      await queryClient.invalidateQueries({ queryKey: ['group-status'] })
      if (result.result.success) toast.success(t('Availability test succeeded'))
      else toast.error(t('Availability test failed'))
    },
    onError: (error) => toast.error(error.message || t('Operation failed')),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteChannelMonitor,
    onSuccess: async () => {
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['channel-monitors'] })
      await queryClient.invalidateQueries({ queryKey: ['group-status'] })
      toast.success(t('Monitor deleted successfully'))
    },
    onError: (error) => toast.error(error.message || t('Operation failed')),
  })

  const monitors = monitorsQuery.data ?? EMPTY_CHANNEL_MONITORS
  const normalizedSearch = search.trim().toLowerCase()
  const filteredMonitors = useMemo(() => {
    if (!normalizedSearch) return monitors
    return monitors.filter((monitor) =>
      [monitor.name, monitor.api_url, monitor.test_model].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    )
  }, [monitors, normalizedSearch])

  const operationalCount = monitors.filter(
    (monitor) => monitor.status === 'success'
  ).length
  const failedCount = monitors.filter(
    (monitor) => monitor.status === 'failed'
  ).length
  const visibleCount = monitors.filter((monitor) => monitor.visible).length

  const openCreate = () => {
    setSelectedMonitor(null)
    setSheetOpen(true)
  }

  const openEdit = (monitor: ChannelMonitor) => {
    setSelectedMonitor(monitor)
    setSheetOpen(true)
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Channel Monitors')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button onClick={openCreate}>
            <HugeiconsIcon icon={Add01Icon} data-icon='inline-start' />
            {t('Create monitor')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex h-full min-h-0 flex-col gap-4 overflow-auto'>
            <div className='divide-border bg-background grid shrink-0 grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4 sm:divide-x'>
              <SummaryItem
                label={t('Monitor tasks')}
                value={monitors.length}
                icon={Activity01Icon}
              />
              <SummaryItem
                label={t('Operational')}
                value={operationalCount}
                icon={CheckmarkCircle02Icon}
                tone='success'
              />
              <SummaryItem
                label={t('Failed')}
                value={failedCount}
                icon={Alert02Icon}
                tone='destructive'
              />
              <SummaryItem
                label={t('Visible to users')}
                value={visibleCount}
                icon={CheckmarkCircle02Icon}
              />
            </div>

            <div className='bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border'>
              <div className='flex shrink-0 flex-wrap items-center gap-2 border-b p-3'>
                <InputGroup className='max-w-sm'>
                  <InputGroupAddon>
                    <HugeiconsIcon icon={SearchIcon} />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('Search monitor name, API, or model')}
                    aria-label={t('Search monitors')}
                  />
                </InputGroup>
                <Button
                  variant='outline'
                  className='ms-auto'
                  onClick={() => void monitorsQuery.refetch()}
                  disabled={monitorsQuery.isFetching}
                >
                  {monitorsQuery.isFetching ? (
                    <Spinner data-icon='inline-start' />
                  ) : (
                    <HugeiconsIcon
                      icon={RefreshIcon}
                      data-icon='inline-start'
                    />
                  )}
                  {t('Refresh')}
                </Button>
              </div>

              {monitorsQuery.isError && (
                <Alert variant='destructive' className='m-3'>
                  <HugeiconsIcon icon={Alert02Icon} />
                  <AlertTitle>{t('Failed to load monitors')}</AlertTitle>
                  <AlertDescription>
                    {monitorsQuery.error.message}
                  </AlertDescription>
                </Alert>
              )}

              <div className='min-h-0 flex-1 overflow-auto'>
                {monitorsQuery.isLoading && <MonitorTableSkeleton />}
                {!monitorsQuery.isLoading && filteredMonitors.length === 0 && (
                  <Empty className='min-h-72'>
                    <EmptyHeader>
                      <EmptyMedia variant='icon'>
                        <HugeiconsIcon icon={Activity01Icon} />
                      </EmptyMedia>
                      <EmptyTitle>
                        {search ? t('No matching monitors') : t('No monitors')}
                      </EmptyTitle>
                      <EmptyDescription>
                        {search
                          ? t('Try a different search term')
                          : t('Create a monitor to start availability checks')}
                      </EmptyDescription>
                    </EmptyHeader>
                    {!search && (
                      <EmptyContent>
                        <Button onClick={openCreate}>
                          <HugeiconsIcon
                            icon={Add01Icon}
                            data-icon='inline-start'
                          />
                          {t('Create monitor')}
                        </Button>
                      </EmptyContent>
                    )}
                  </Empty>
                )}
                {!monitorsQuery.isLoading && filteredMonitors.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-16'>{t('Enabled')}</TableHead>
                        <TableHead>{t('Group / API')}</TableHead>
                        <TableHead>{t('Test model')}</TableHead>
                        <TableHead>{t('Test interval')}</TableHead>
                        <TableHead>{t('Status')}</TableHead>
                        <TableHead>{t('7-day / 30-day')}</TableHead>
                        <TableHead>{t('Latest test')}</TableHead>
                        <TableHead className='w-32 text-end'>
                          {t('Actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMonitors.map((monitor) => (
                        <TableRow key={monitor.id}>
                          <TableCell>
                            <Switch
                              checked={monitor.enabled}
                              onCheckedChange={(enabled) =>
                                updateMutation.mutate({
                                  monitor,
                                  changes: { enabled },
                                })
                              }
                              disabled={updateMutation.isPending}
                              aria-label={t(
                                'Toggle scheduled tests for {{name}}',
                                {
                                  name: monitor.name,
                                }
                              )}
                            />
                          </TableCell>
                          <TableCell className='max-w-64'>
                            <div className='flex min-w-0 flex-col gap-1'>
                              <div className='flex items-center gap-2'>
                                <span className='truncate font-medium'>
                                  {monitor.name}
                                </span>
                                {!monitor.visible && (
                                  <span className='text-muted-foreground text-xs'>
                                    {t('Hidden')}
                                  </span>
                                )}
                              </div>
                              <code className='text-muted-foreground truncate text-xs'>
                                {getMonitorApiHost(monitor.api_url)}
                              </code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className='text-xs'>
                              {monitor.test_model}
                            </code>
                          </TableCell>
                          <TableCell>
                            {monitor.interval_seconds} {t('seconds')}
                          </TableCell>
                          <TableCell>
                            <MonitorStatusBadge status={monitor.status} />
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-col gap-1'>
                              <span className='flex items-center gap-1.5'>
                                {formatMonitorAvailability(
                                  monitor.availability_7d
                                )}
                                {monitor.manual_availability_7d != null && (
                                  <Badge variant='outline'>
                                    {t('Manual override')}
                                  </Badge>
                                )}
                              </span>
                              <span className='text-muted-foreground flex items-center gap-1.5'>
                                {formatMonitorAvailability(
                                  monitor.availability_30d
                                )}
                                {monitor.manual_availability_30d != null && (
                                  <Badge variant='outline'>
                                    {t('Manual override')}
                                  </Badge>
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-col gap-1'>
                              <span>
                                {monitor.latest_latency_ms == null
                                  ? '--'
                                  : `${monitor.latest_latency_ms} ms`}
                              </span>
                              <span className='text-muted-foreground text-xs'>
                                {formatMonitorTime(monitor.last_checked_at)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center justify-end gap-1'>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      aria-label={t('Run test now')}
                                      onClick={() =>
                                        runMutation.mutate(monitor.id)
                                      }
                                      disabled={runMutation.isPending}
                                    />
                                  }
                                >
                                  {runMutation.isPending &&
                                  runMutation.variables === monitor.id ? (
                                    <Spinner />
                                  ) : (
                                    <HugeiconsIcon icon={Activity01Icon} />
                                  )}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t('Run test now')}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      aria-label={t('Edit')}
                                      onClick={() => openEdit(monitor)}
                                    />
                                  }
                                >
                                  <HugeiconsIcon icon={Edit02Icon} />
                                </TooltipTrigger>
                                <TooltipContent>{t('Edit')}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      aria-label={t('Delete')}
                                      onClick={() => setDeleteTarget(monitor)}
                                    />
                                  }
                                >
                                  <HugeiconsIcon icon={Delete02Icon} />
                                </TooltipTrigger>
                                <TooltipContent>{t('Delete')}</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ChannelMonitorSheet
        open={sheetOpen}
        monitor={selectedMonitor}
        onOpenChange={setSheetOpen}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('Delete monitor')}
        desc={t(
          'This deletes the monitor and all of its test history. Continue?'
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
      />
    </>
  )
}

type SummaryItemProps = {
  label: string
  value: number
  icon: typeof Activity01Icon
  tone?: 'success' | 'destructive'
}

function SummaryItem(props: SummaryItemProps) {
  return (
    <div className='flex min-h-20 items-center gap-3 px-4 py-3'>
      <div className='bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-lg'>
        <HugeiconsIcon
          icon={props.icon}
          className={cn(
            props.tone === 'success' && 'text-success',
            props.tone === 'destructive' && 'text-destructive'
          )}
        />
      </div>
      <div className='min-w-0'>
        <p className='text-lg leading-none font-semibold tabular-nums'>
          {props.value}
        </p>
        <p className='text-muted-foreground mt-1 truncate text-xs'>
          {props.label}
        </p>
      </div>
    </div>
  )
}

function MonitorTableSkeleton() {
  return (
    <div className='flex flex-col gap-3 p-4'>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className='h-14 w-full' />
      ))}
    </div>
  )
}
