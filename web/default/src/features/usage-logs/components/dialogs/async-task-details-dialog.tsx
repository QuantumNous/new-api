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
import {
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { RiskAcknowledgementDialog } from '@/components/risk-acknowledgement-dialog'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import { cancelAsyncTask, getAsyncTaskDetail, retryAsyncTask } from '../../api'
import { taskStatusMapper } from '../../lib/mappers'
import type { AsyncTaskDetail, TaskLog } from '../../types'

type AsyncTaskDetailsDialogProps = {
  log: TaskLog
  isAdmin: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailRow(props: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className='grid grid-cols-[8rem_minmax(0,1fr)] gap-3 text-xs'>
      <span className='text-muted-foreground'>{props.label}</span>
      <span
        className={
          props.mono ? 'min-w-0 font-mono break-all' : 'min-w-0 break-all'
        }
      >
        {props.value}
      </span>
    </div>
  )
}

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}m ${remainder}s`
}

function taskDurations(task: TaskLog) {
  const now = Date.now() / 1000
  const queueEnd = task.start_time || task.finish_time || now
  const executionEnd = task.finish_time || now
  return {
    queue: formatSeconds(queueEnd - task.submit_time),
    execution: task.start_time
      ? formatSeconds(executionEnd - task.start_time)
      : '-',
  }
}

function taskDetailQueryKey(taskId: string, isAdmin: boolean) {
  return ['async-task-detail', taskId, isAdmin] as const
}

export function AsyncTaskDetailsDialog(props: AsyncTaskDetailsDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [retryOpen, setRetryOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: taskDetailQueryKey(props.log.task_id, props.isAdmin),
    queryFn: async () => {
      const result = await getAsyncTaskDetail(props.log.task_id, props.isAdmin)
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to load async task')
      }
      return result.data
    },
    enabled: props.open,
  })

  const refreshTaskData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['logs'] }),
      queryClient.invalidateQueries({
        queryKey: taskDetailQueryKey(props.log.task_id, props.isAdmin),
      }),
    ])
  }

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const result = await cancelAsyncTask(props.log.task_id, props.isAdmin)
      if (!result?.success) throw new Error(result?.message || 'Cancel failed')
      return result
    },
    onSuccess: async () => {
      setCancelOpen(false)
      toast.success(t('Async task cancelled and refunded'))
      await refreshTaskData()
    },
    onError: handleServerError,
  })

  const retryMutation = useMutation({
    mutationFn: async () => {
      const result = await retryAsyncTask(props.log.task_id)
      if (!result?.success) throw new Error(result?.message || 'Retry failed')
      return result
    },
    onSuccess: async () => {
      setRetryOpen(false)
      toast.success(t('Async task queued for manual retry'))
      await refreshTaskData()
    },
    onError: handleServerError,
  })

  const detail: AsyncTaskDetail | undefined = detailQuery.data
  const task = detail?.task ?? props.log
  const status = task.async?.execution_status ?? task.status
  const durations = taskDurations(task)
  const rawResponse = useMemo(
    () => JSON.stringify(detail?.upstream_response ?? {}, null, 2),
    [detail?.upstream_response]
  )
  const canCancel = status === 'QUEUED'
  const canRetry =
    props.isAdmin && (status === 'FAILURE' || status === 'UNCERTAIN')

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('Async image task details')}
        description={props.log.task_id}
        contentClassName='sm:max-w-4xl'
        contentHeight='min(70vh, 780px)'
        footer={
          <>
            {canCancel ? (
              <Button variant='destructive' onClick={() => setCancelOpen(true)}>
                <XCircle className='size-4' />
                {t('Cancel queued task')}
              </Button>
            ) : null}
            {canRetry ? (
              <Button variant='destructive' onClick={() => setRetryOpen(true)}>
                <RefreshCw className='size-4' />
                {t('Manual retry')}
              </Button>
            ) : null}
          </>
        }
      >
        {(() => {
          if (detailQuery.isLoading) {
            return (
              <div className='flex min-h-40 items-center justify-center'>
                <Loader2 className='text-muted-foreground size-6 animate-spin' />
              </div>
            )
          }
          if (detailQuery.isError) {
            return (
              <Alert variant='destructive'>
                <AlertTitle>{t('Failed to load task details')}</AlertTitle>
                <AlertDescription>{detailQuery.error.message}</AlertDescription>
              </Alert>
            )
          }
          return (
            <div className='space-y-5'>
              {status === 'UNCERTAIN' ? (
                <Alert variant='destructive'>
                  <AlertTriangle className='size-4' />
                  <AlertTitle>{t('High-risk uncertain state')}</AlertTitle>
                  <AlertDescription>
                    {t(
                      'The upstream request may already have completed. Never retry automatically; a manual retry may duplicate both generation and billing.'
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}

              <section className='grid gap-3 rounded-lg border p-4 sm:grid-cols-2'>
                <DetailRow
                  label={t('Status')}
                  value={
                    <StatusBadge
                      label={t(taskStatusMapper.getLabel(status, status))}
                      variant={taskStatusMapper.getVariant(status)}
                      copyable={false}
                    />
                  }
                />
                <DetailRow
                  label={t('Progress')}
                  value={task.progress || '0%'}
                />
                <DetailRow
                  label={t('Queue duration')}
                  value={durations.queue}
                />
                <DetailRow
                  label={t('Execution duration')}
                  value={durations.execution}
                />
                <DetailRow
                  label={t('Worker node')}
                  value={task.async?.worker_id || '-'}
                  mono
                />
                <DetailRow
                  label={t('Attempts')}
                  value={String(task.async?.attempt ?? 0)}
                />
                <DetailRow
                  label={t('Error phase')}
                  value={task.async?.error_phase || '-'}
                  mono
                />
                <DetailRow
                  label={t('Stable error code')}
                  value={task.async?.error_code || '-'}
                  mono
                />
                <DetailRow
                  label={t('Billing status')}
                  value={task.async?.billing_status || '-'}
                  mono
                />
                <DetailRow
                  label={t('Request sent at')}
                  value={
                    task.async?.request_sent_at
                      ? formatTimestampToDate(
                          task.async.request_sent_at,
                          'seconds'
                        )
                      : '-'
                  }
                />
              </section>

              <section className='space-y-2'>
                <h3 className='text-sm font-semibold'>{t('Artifacts')}</h3>
                {detail?.artifacts.length ? (
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {detail.artifacts.map((artifact) => (
                      <a
                        key={artifact.sha256}
                        href={artifact.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='hover:bg-muted flex items-center justify-between gap-3 rounded-lg border p-3 text-xs'
                      >
                        <span className='min-w-0'>
                          <span className='block truncate font-medium'>
                            {artifact.content_type}
                          </span>
                          <span className='text-muted-foreground block truncate font-mono'>
                            {artifact.sha256}
                          </span>
                        </span>
                        <Download className='size-4 shrink-0' />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className='text-muted-foreground text-xs'>
                    {t('No archived artifacts')}
                  </p>
                )}
              </section>

              <section className='space-y-2'>
                <h3 className='text-sm font-semibold'>
                  {t('Raw upstream response')}
                </h3>
                <pre className='bg-muted/40 max-h-72 overflow-auto rounded-lg border p-3 font-mono text-xs break-all whitespace-pre-wrap'>
                  {rawResponse}
                </pre>
              </section>

              <section className='space-y-2'>
                <h3 className='text-sm font-semibold'>{t('Task events')}</h3>
                <div className='space-y-2 [content-visibility:auto]'>
                  {detail?.events.map((event) => (
                    <div
                      key={event.id}
                      className='grid gap-1 rounded-lg border p-3 text-xs sm:grid-cols-[10rem_1fr]'
                    >
                      <span className='text-muted-foreground font-mono'>
                        {formatTimestampToDate(event.created_at, 'seconds')}
                      </span>
                      <span className='min-w-0 font-mono break-all'>
                        {event.event_type}: {event.from_status || '∅'} →{' '}
                        {event.to_status || '∅'}
                        {event.error_code ? ` · ${event.error_code}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )
        })()}
      </Dialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t('Cancel queued async task?')}
        desc={t(
          'Only a task that has not been sent upstream will be cancelled. Its reserved quota will be refunded exactly once.'
        )}
        destructive
        isLoading={cancelMutation.isPending}
        handleConfirm={() => cancelMutation.mutate()}
      />

      <RiskAcknowledgementDialog
        open={retryOpen}
        onOpenChange={setRetryOpen}
        title={t('Confirm high-risk manual retry')}
        description={t(
          'This action is never performed automatically. The previous upstream execution may be impossible to verify.'
        )}
        checklist={[
          t('I understand this may generate the same image more than once.'),
          t('I understand this may charge upstream and local quota again.'),
        ]}
        confirmText={t('Accept risk and retry')}
        isLoading={retryMutation.isPending}
        onConfirm={() => retryMutation.mutate()}
      />
    </>
  )
}
