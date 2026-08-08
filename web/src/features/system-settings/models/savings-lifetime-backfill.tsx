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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DatabaseZap, Pause, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatTimestampToDate } from '@/lib/format'

import {
  getSavingsLifetimeBackfill,
  pauseSavingsLifetimeBackfill,
  resumeSavingsLifetimeBackfill,
  retrySavingsLifetimeBackfill,
  startSavingsLifetimeBackfill,
} from '../api'
import { invalidateSavingsLifetimeQueries } from '../lib/savings-lifetime-query'
import type { SavingsLifetimeBackfillTask } from '../types'

const QUERY_KEY = ['system-settings', 'savings-lifetime-backfill'] as const

function isActiveTask(task: SavingsLifetimeBackfillTask | null | undefined) {
  return (
    task?.status === 'pending' ||
    task?.status === 'running' ||
    task?.status === 'pause_requested'
  )
}

function isUnfinishedTask(
  task: SavingsLifetimeBackfillTask | null | undefined
) {
  return isActiveTask(task) || task?.status === 'paused'
}

const STATUS_LABEL_KEYS = {
  pending: 'Pending',
  running: 'Running',
  pause_requested: 'Pausing',
  paused: 'Paused',
  succeeded: 'Completed',
  failed: 'Failed',
} as const

type SavingsLifetimeBackfillProps = {
  enabled: boolean
}

export function SavingsLifetimeBackfill(props: SavingsLifetimeBackfillProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const taskQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getSavingsLifetimeBackfill,
    refetchInterval: (query) =>
      isActiveTask(query.state.data?.data) ? 2000 : false,
  })
  const startMutation = useMutation({
    mutationFn: startSavingsLifetimeBackfill,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast.error(
          response.message || t('Failed to start historical backfill')
        )
        return
      }
      queryClient.setQueryData(QUERY_KEY, {
        success: true,
        message: '',
        data: response.data.task,
      })
      void invalidateSavingsLifetimeQueries(queryClient)
      toast.success(
        response.data.created
          ? t('Historical savings backfill started')
          : t('Historical savings backfill is already active')
      )
    },
    onError: () => toast.error(t('Failed to start historical backfill')),
  })
  const pauseMutation = useMutation({
    mutationFn: pauseSavingsLifetimeBackfill,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast.error(
          response.message || t('Failed to pause historical backfill')
        )
        return
      }
      queryClient.setQueryData(QUERY_KEY, response)
      void invalidateSavingsLifetimeQueries(queryClient)
      toast.success(t('Historical savings backfill pause requested'))
    },
    onError: () => toast.error(t('Failed to pause historical backfill')),
  })
  const resumeMutation = useMutation({
    mutationFn: resumeSavingsLifetimeBackfill,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast.error(
          response.message || t('Failed to resume historical backfill')
        )
        return
      }
      queryClient.setQueryData(QUERY_KEY, response)
      void invalidateSavingsLifetimeQueries(queryClient)
      toast.success(t('Historical savings backfill resumed'))
    },
    onError: () => toast.error(t('Failed to resume historical backfill')),
  })
  const retryMutation = useMutation({
    mutationFn: retrySavingsLifetimeBackfill,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast.error(
          response.message || t('Failed to retry historical backfill')
        )
        return
      }
      queryClient.setQueryData(QUERY_KEY, response)
      void invalidateSavingsLifetimeQueries(queryClient)
      toast.success(t('Historical savings backfill retry started'))
    },
    onError: () => toast.error(t('Failed to retry historical backfill')),
  })

  const task = taskQuery.data?.data
  const active = isActiveTask(task)
  const unfinished = isUnfinishedTask(task)
  const state = task?.state
  const processed = state?.processed_count ?? task?.result?.processed_count ?? 0
  const estimated = state?.estimated_count ?? task?.result?.estimated_count ?? 0
  const skipped = state?.skipped_count ?? task?.result?.skipped_count ?? 0
  const ambiguous =
    state?.ambiguous_cursor_count ?? task?.result?.ambiguous_cursor_count ?? 0
  const total = task?.payload?.target_count ?? 0
  const priceSnapshotAt = task?.payload?.price_snapshot_at ?? 0
  const progress = Math.min(
    100,
    Math.max(
      0,
      (state?.progress ?? (task?.status === 'succeeded' ? 1 : 0)) * 100
    )
  )
  const statusLabel = task
    ? t(STATUS_LABEL_KEYS[task.status])
    : t('Not Started')

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 space-y-1'>
          <div className='flex items-center gap-2'>
            <DatabaseZap className='size-4' aria-hidden='true' />
            <h4 className='text-sm font-medium'>{t('Historical backfill')}</h4>
            <Badge variant='outline'>
              {t('Status')}: {statusLabel}
            </Badge>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Freeze current official prices and exchange rate, then calculate lifetime savings from existing usage logs.'
            )}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {(task?.status === 'pending' || task?.status === 'running') && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={pauseMutation.isPending}
              onClick={() => pauseMutation.mutate(task.task_id)}
            >
              <Pause data-icon='inline-start' aria-hidden='true' />
              {t('Pause backfill')}
            </Button>
          )}
          {task?.status === 'paused' && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={resumeMutation.isPending}
              onClick={() => resumeMutation.mutate(task.task_id)}
            >
              <Play data-icon='inline-start' aria-hidden='true' />
              {t('Resume backfill')}
            </Button>
          )}
          {task?.status === 'failed' && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={!props.enabled || retryMutation.isPending}
              onClick={() => retryMutation.mutate(task.task_id)}
            >
              <RotateCcw data-icon='inline-start' aria-hidden='true' />
              {t('Retry from saved progress')}
            </Button>
          )}
          {task?.status !== 'failed' && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={!props.enabled || unfinished || startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              <RefreshCw
                data-icon='inline-start'
                className={startMutation.isPending ? 'animate-spin' : undefined}
                aria-hidden='true'
              />
              {active ? t('Backfill running') : t('Start historical backfill')}
            </Button>
          )}
        </div>
      </div>

      {!props.enabled && (
        <p className='text-warning text-xs'>
          {t('Enable and save lifetime savings before starting a backfill.')}
        </p>
      )}

      {task && (
        <div className='space-y-2'>
          <div className='flex items-center justify-between gap-3 text-xs'>
            <span className='text-muted-foreground'>
              {t('{{processed}} of {{total}} usage logs processed', {
                processed,
                total,
              })}
            </span>
            <span className='tabular-nums'>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
          <div className='text-muted-foreground grid gap-1 text-xs sm:grid-cols-3'>
            <span>{t('Estimated: {{count}}', { count: estimated })}</span>
            <span>{t('Skipped: {{count}}', { count: skipped })}</span>
            {priceSnapshotAt > 0 && (
              <span>
                {t('Prices frozen at {{time}}', {
                  time: formatTimestampToDate(priceSnapshotAt),
                })}
              </span>
            )}
          </div>
          {task.status === 'failed' && task.error && (
            <p className='text-destructive text-xs'>{task.error}</p>
          )}
          {ambiguous > 0 && (
            <p className='text-warning text-xs'>
              {t('Ambiguous ClickHouse rows skipped: {{count}}', {
                count: ambiguous,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
