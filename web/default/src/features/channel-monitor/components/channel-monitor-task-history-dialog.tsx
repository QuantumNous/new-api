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
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CloudDownloadIcon,
  HistoryIcon,
  Refresh01Icon,
  WorkflowSquare06Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  getChannelMonitorTasks,
  runChannelMonitorRatioUpdate,
  runChannelMonitorSmartSchedule,
} from '../api'
import type {
  ChannelMonitorSmartScheduleStrategy,
  ChannelMonitorTask,
  ChannelMonitorTaskKind,
  ChannelMonitorTaskStatus,
} from '../types'

const TASK_PAGE_SIZE = 20
const ACTIVE_REFRESH_INTERVAL_MS = 5000

const STATUS_LABELS: Record<ChannelMonitorTaskStatus, string> = {
  pending: '待执行',
  running: '执行中',
  succeeded: '成功',
  failed: '失败',
}

const SMART_SCHEDULE_STRATEGY_LABELS: Record<
  ChannelMonitorSmartScheduleStrategy,
  string
> = {
  ratio: '按上游倍率',
  first_token: '按首字',
  tps: '按 TPS',
  stability: '按稳定性',
  smart: '智能调度',
}

const STATUS_STYLES: Record<ChannelMonitorTaskStatus, string> = {
  pending:
    'bg-amber-500/10 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15',
  running: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 dark:bg-sky-500/15',
  succeeded:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/15',
  failed: '',
}

type ChannelMonitorTaskHistoryDialogProps = {
  initialKind: ChannelMonitorTaskKind
  open: boolean
  onOpenChange: (open: boolean) => void
}

function isActiveTask(task: ChannelMonitorTask) {
  return task.status === 'pending' || task.status === 'running'
}

function formatTaskDuration(task: ChannelMonitorTask) {
  if (isActiveTask(task)) return task.status === 'running' ? '执行中' : '-'

  const seconds = Math.max(0, task.updated_at - task.created_at)
  if (seconds < 1) return '< 1 秒'
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes} 分 ${remainingSeconds} 秒`
  const hours = Math.floor(minutes / 60)
  return `${hours} 小时 ${minutes % 60} 分`
}

function ChannelTaskStatusBadge(props: { task: ChannelMonitorTask }) {
  const partiallyFailed =
    props.task.status === 'succeeded' &&
    ((props.task.result?.failed ?? 0) > 0 ||
      props.task.result?.email_status === 'failed')
  const label = partiallyFailed ? '部分失败' : STATUS_LABELS[props.task.status]
  const className = partiallyFailed
    ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
    : STATUS_STYLES[props.task.status]

  return (
    <Badge
      variant={props.task.status === 'failed' ? 'destructive' : 'secondary'}
      className={className}
    >
      {label}
    </Badge>
  )
}

function FailureDot(props: { label: string }) {
  return (
    <span
      role='img'
      aria-label={props.label}
      title={props.label}
      className='bg-destructive size-2 shrink-0 rounded-full'
    />
  )
}

function ChannelTaskProgress(props: {
  task: ChannelMonitorTask
  failuresExpanded: boolean
  onToggleFailures: () => void
}) {
  const result = props.task.result
  if (result) {
    const failures = result.failures ?? []
    if (props.task.type === 'channel_smart_schedule') {
      return (
        <div className='flex min-w-52 flex-wrap gap-x-3 gap-y-1 text-xs'>
          <span>
            更新 <strong>{result.updated}</strong>
          </span>
          <span>
            保持 <strong>{result.unchanged ?? 0}</strong>
          </span>
          <span>
            跳过 <strong>{result.skipped ?? 0}</strong>
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5',
              result.failed > 0 && 'text-destructive'
            )}
          >
            失败 <strong>{result.failed}</strong>
            {result.failed > 0 && <FailureDot label='智能调度更新失败' />}
          </span>
          {failures.length > 0 && (
            <Button
              type='button'
              variant='link'
              size='xs'
              className='text-destructive h-auto p-0'
              onClick={props.onToggleFailures}
              aria-expanded={props.failuresExpanded}
            >
              <HugeiconsIcon icon={Alert02Icon} data-icon='inline-start' />
              {props.failuresExpanded ? '收起失败原因' : '查看失败原因'}
            </Button>
          )}
        </div>
      )
    }
    return (
      <div className='flex min-w-52 flex-wrap gap-x-3 gap-y-1 text-xs'>
        <span>
          成功 <strong>{result.updated}</strong> / {result.total}
        </span>
        <span>
          变化 <strong>{result.changed ?? 0}</strong>
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5',
            result.failed > 0 && 'text-destructive'
          )}
        >
          失败 <strong>{result.failed}</strong>
          {result.failed > 0 && <FailureDot label='上游更新失败' />}
        </span>
        {(result.retried ?? 0) > 0 && (
          <span>
            重试 <strong>{result.retried}</strong>
          </span>
        )}
        {(result.recovered_after_retry ?? 0) > 0 && (
          <span>
            重试恢复 <strong>{result.recovered_after_retry}</strong>
          </span>
        )}
        {result.email_status === 'sent' && <span>邮件 已发送</span>}
        {result.email_status === 'failed' && (
          <span className='text-destructive' title={result.email_error}>
            邮件 发送失败
          </span>
        )}
        {failures.length > 0 && (
          <Button
            type='button'
            variant='link'
            size='xs'
            className='text-destructive h-auto p-0'
            onClick={props.onToggleFailures}
            aria-expanded={props.failuresExpanded}
          >
            <HugeiconsIcon icon={Alert02Icon} data-icon='inline-start' />
            {props.failuresExpanded ? '收起失败原因' : '查看失败原因'}
          </Button>
        )}
      </div>
    )
  }

  const state = props.task.state
  if (!state) return <span className='text-muted-foreground'>-</span>
  return (
    <span className='text-sm tabular-nums'>
      已处理 {state.processed} / {state.total}（{state.progress}%）
    </span>
  )
}

function ChannelTaskPolicyResult(props: { task: ChannelMonitorTask }) {
  const result = props.task.result
  if (!result) return <span className='text-muted-foreground'>-</span>
  if (props.task.type === 'channel_smart_schedule') {
    const applyModeLabel =
      result.apply_mode === 'priority_weight'
        ? '优先级分层 + 权重'
        : '只调整权重'
    return (
      <div className='flex min-w-48 flex-col gap-1 text-xs'>
        <span>
          {result.strategy
            ? SMART_SCHEDULE_STRATEGY_LABELS[result.strategy]
            : '智能调度'}{' '}
          · {applyModeLabel}
        </span>
        <span className='text-muted-foreground'>
          {result.model ? `模型 ${result.model}` : '全部模型汇总'} ·{' '}
          {result.performance_minutes ?? 0} 分钟 · {result.groups ?? 0} 个分组
        </span>
      </div>
    )
  }
  return (
    <div className='flex min-w-44 flex-wrap gap-x-3 gap-y-1 text-xs'>
      <span className='inline-flex items-center gap-1.5'>
        更新分组 {result.groups_updated ?? 0}
        {result.group_update_failed && <FailureDot label='分组更新失败' />}
      </span>
      <span>禁用渠道 {result.channels_disabled ?? 0}</span>
      <span>跳过分组 {result.groups_skipped ?? 0}</span>
    </div>
  )
}

export function ChannelMonitorTaskHistoryDialog(
  props: ChannelMonitorTaskHistoryDialogProps
) {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<ChannelMonitorTaskKind>(props.initialKind)
  const [page, setPage] = useState(1)
  const [expandedFailureTaskId, setExpandedFailureTaskId] = useState<
    string | null
  >(null)
  const ratioUpdateMutation = useMutation({
    mutationFn: runChannelMonitorRatioUpdate,
    onSuccess: (response) => {
      toast.success(
        response.data.created
          ? '倍率更新任务已创建'
          : '已有倍率更新任务正在执行'
      )
      setKind('ratio')
      setPage(1)
      setExpandedFailureTaskId(null)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['channel-monitor-task-history'],
      })
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
  })
  const smartScheduleMutation = useMutation({
    mutationFn: runChannelMonitorSmartSchedule,
    onSuccess: (response) => {
      toast.success(
        response.data.created
          ? '智能调度任务已创建'
          : '已有智能调度任务正在执行'
      )
      setKind('schedule')
      setPage(1)
      setExpandedFailureTaskId(null)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['channel-monitor-task-history'],
      })
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
  })
  const query = useQuery({
    queryKey: ['channel-monitor-task-history', kind, page, TASK_PAGE_SIZE],
    queryFn: () => getChannelMonitorTasks(page, TASK_PAGE_SIZE, kind),
    enabled: props.open,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchInterval: (result) =>
      result.state.data?.data.items.some(isActiveTask)
        ? ACTIVE_REFRESH_INTERVAL_MS
        : false,
  })
  const tasks = query.data?.data.items ?? []
  const total = query.data?.data.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / TASK_PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * TASK_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * TASK_PAGE_SIZE, total)
  const latestCompletedScheduleTime =
    kind === 'schedule'
      ? tasks.reduce(
          (latest, task) =>
            isActiveTask(task) ? latest : Math.max(latest, task.updated_at),
          0
        )
      : 0

  useEffect(() => {
    if (latestCompletedScheduleTime <= 0) return
    queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
    queryClient.invalidateQueries({ queryKey: ['channels'] })
  }, [latestCompletedScheduleTime, queryClient])

  let content: ReactNode
  if (query.isLoading) {
    content = (
      <div className='flex h-full flex-col gap-3 p-4'>
        {['first', 'second', 'third', 'fourth'].map((key) => (
          <Skeleton key={key} className='h-14 w-full' />
        ))}
      </div>
    )
  } else if (query.isError) {
    content = (
      <Empty className='h-full min-h-64 border-0'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={Alert02Icon} />
          </EmptyMedia>
          <EmptyTitle>定时任务记录加载失败</EmptyTitle>
          <EmptyDescription>
            {query.error instanceof Error ? query.error.message : '请稍后重试'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant='outline' size='sm' onClick={() => query.refetch()}>
            <HugeiconsIcon icon={Refresh01Icon} data-icon='inline-start' />
            重试
          </Button>
        </EmptyContent>
      </Empty>
    )
  } else if (tasks.length === 0) {
    content = (
      <Empty className='h-full min-h-64 border-0'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={HistoryIcon} />
          </EmptyMedia>
          <EmptyTitle>
            {kind === 'schedule' ? '暂无智能调度记录' : '暂无倍率更新记录'}
          </EmptyTitle>
          <EmptyDescription>
            {kind === 'schedule'
              ? '开启智能调度或手动执行后，任务会在这里留下记录。'
              : '开启自动更新或手动执行后，任务会在这里留下记录。'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    content = (
      <Table className='min-w-[900px]'>
        <TableHeader>
          <TableRow>
            <TableHead>执行时间</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>执行结果</TableHead>
            <TableHead>规则与策略</TableHead>
            <TableHead>耗时</TableHead>
            <TableHead>错误</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const failures = task.result?.failures ?? []
            const failuresExpanded =
              expandedFailureTaskId === task.task_id && failures.length > 0
            return (
              <Fragment key={task.task_id}>
                <TableRow>
                  <TableCell className='whitespace-nowrap'>
                    {formatTimestampToDate(task.created_at)}
                  </TableCell>
                  <TableCell>
                    <ChannelTaskStatusBadge task={task} />
                  </TableCell>
                  <TableCell>
                    <ChannelTaskProgress
                      task={task}
                      failuresExpanded={failuresExpanded}
                      onToggleFailures={() =>
                        setExpandedFailureTaskId((current) =>
                          current === task.task_id ? null : task.task_id
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <ChannelTaskPolicyResult task={task} />
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {formatTaskDuration(task)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'max-w-56 truncate',
                      task.error && 'text-destructive'
                    )}
                    title={task.error || undefined}
                  >
                    {task.error || '-'}
                  </TableCell>
                </TableRow>
                {failuresExpanded && (
                  <TableRow className='bg-muted/20 hover:bg-muted/20'>
                    <TableCell colSpan={6} className='p-3 whitespace-normal'>
                      <div className='flex flex-col gap-2'>
                        {failures.map((failure) => (
                          <Alert key={failure.channel_id} variant='destructive'>
                            <HugeiconsIcon icon={Alert02Icon} />
                            <AlertTitle>
                              {failure.channel_name
                                ? `${failure.channel_name}（ID ${failure.channel_id}）`
                                : `渠道 ID ${failure.channel_id}`}
                            </AlertTitle>
                            <AlertDescription className='text-left break-all'>
                              {failure.error ||
                                (task.type === 'channel_smart_schedule'
                                  ? '智能调度更新失败'
                                  : '上游倍率获取失败')}
                            </AlertDescription>
                          </Alert>
                        ))}
                        {task.result?.failure_details_truncated && (
                          <p className='text-muted-foreground text-xs'>
                            失败渠道较多，仅显示前 {failures.length} 条明细
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='h-[min(85dvh,48rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-5xl'>
        <DialogHeader className='pr-10'>
          <DialogTitle>定时任务记录</DialogTitle>
          <DialogDescription>
            查看上游倍率更新和智能调度的执行结果，也可以立即执行任务。
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex flex-wrap items-center gap-3'>
            <ToggleGroup
              value={[kind]}
              onValueChange={(values) => {
                const nextKind = values.find((value) => value !== kind)
                if (nextKind !== 'ratio' && nextKind !== 'schedule') return
                setKind(nextKind)
                setPage(1)
                setExpandedFailureTaskId(null)
              }}
              variant='outline'
              size='sm'
              spacing={0}
              aria-label='选择定时任务类型'
            >
              <ToggleGroupItem value='ratio'>倍率更新</ToggleGroupItem>
              <ToggleGroupItem value='schedule'>智能调度</ToggleGroupItem>
            </ToggleGroup>
            <span className='text-muted-foreground text-xs'>
              显示 {rangeStart}-{rangeEnd}，共 {total} 条
            </span>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => ratioUpdateMutation.mutate()}
              disabled={ratioUpdateMutation.isPending}
            >
              {ratioUpdateMutation.isPending ? (
                <Spinner />
              ) : (
                <HugeiconsIcon
                  icon={CloudDownloadIcon}
                  data-icon='inline-start'
                />
              )}
              立即更新倍率
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => smartScheduleMutation.mutate()}
              disabled={smartScheduleMutation.isPending}
            >
              {smartScheduleMutation.isPending ? (
                <Spinner />
              ) : (
                <HugeiconsIcon
                  icon={WorkflowSquare06Icon}
                  data-icon='inline-start'
                />
              )}
              执行智能调度
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <HugeiconsIcon
                icon={Refresh01Icon}
                data-icon='inline-start'
                className={cn(query.isFetching && 'animate-spin')}
              />
              刷新
            </Button>
          </div>
        </div>
        <div
          className='min-h-0 min-w-0 overflow-x-hidden overflow-y-auto rounded-lg border'
          aria-busy={query.isFetching}
        >
          {content}
        </div>
        {total > 0 && (
          <div className='flex items-center justify-end gap-2'>
            <Button
              variant='outline'
              size='icon-sm'
              aria-label='上一页'
              title='上一页'
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || query.isFetching}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <span className='text-muted-foreground min-w-20 text-center text-xs tabular-nums'>
              第 {page} / {totalPages} 页
            </span>
            <Button
              variant='outline'
              size='icon-sm'
              aria-label='下一页'
              title='下一页'
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || query.isFetching}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
