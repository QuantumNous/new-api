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
import { Alert02Icon, TestTubeIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { MultiSelect } from '@/components/multi-select'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress'
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
import { getPricing } from '@/features/pricing/api'

import { getChannels } from '../../api'
import {
  channelsQueryKeys,
  formatResponseTime,
  handleTestChannel,
} from '../../lib'
import type { Channel } from '../../types'

type ChannelBatchTestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type BatchTestTask = {
  key: string
  channelId: number
  channelName: string
  model: string
}

type BatchTestStatus = 'testing' | 'success' | 'error'

type BatchTestResult = BatchTestTask & {
  status: BatchTestStatus
  responseTime?: number
  error?: string
  errorCode?: string
}

type BatchTestProgress = {
  total: number
  completed: number
  success: number
  failed: number
}

const CHANNEL_PAGE_SIZE = 100
const BATCH_TEST_CONCURRENCY = 5
const EMPTY_CHANNELS: Channel[] = []
const EMPTY_PRICED_MODELS: string[] = []

async function getBatchTestChannels(): Promise<Channel[]> {
  const firstPage = await getChannels({ p: 1, page_size: CHANNEL_PAGE_SIZE })
  if (!firstPage.success) {
    throw new Error(firstPage.message || '获取渠道列表失败')
  }

  const firstPageData = firstPage.data
  if (!firstPageData) return []

  const channelMap = new Map(
    firstPageData.items.map((channel) => [channel.id, channel])
  )
  const pageCount = Math.ceil(firstPageData.total / CHANNEL_PAGE_SIZE)
  const remainingPages: number[] = []
  for (let page = 2; page <= pageCount; page += 1) {
    remainingPages.push(page)
  }

  const responses = await Promise.all(
    remainingPages.map((page) =>
      getChannels({ p: page, page_size: CHANNEL_PAGE_SIZE })
    )
  )
  for (const response of responses) {
    if (!response.success) {
      throw new Error(response.message || '获取渠道列表失败')
    }
    for (const channel of response.data?.items ?? []) {
      channelMap.set(channel.id, channel)
    }
  }

  return [...channelMap.values()].sort((a, b) => a.id - b.id)
}

async function getPricedModelNames(): Promise<string[]> {
  const response = await getPricing()
  if (!response.success) {
    throw new Error(response.message || '获取定价模型失败')
  }

  return [
    ...new Set(
      response.data.map((model) => model.model_name.trim()).filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b))
}

function buildBatchTestTasks(
  channels: Channel[],
  models: string[]
): BatchTestTask[] {
  const tasks: BatchTestTask[] = []
  for (const channel of channels) {
    for (const model of models) {
      tasks.push({
        key: `${channel.id}::${model}`,
        channelId: channel.id,
        channelName: channel.name,
        model,
      })
    }
  }
  return tasks
}

async function runBatchTestTask(task: BatchTestTask): Promise<BatchTestResult> {
  let result: BatchTestResult | undefined
  try {
    await handleTestChannel(
      task.channelId,
      {
        channelName: task.channelName,
        testModel: task.model,
        silent: true,
      },
      (success, responseTime, error, errorCode) => {
        result = {
          ...task,
          status: success ? 'success' : 'error',
          responseTime,
          error,
          errorCode,
        }
      }
    )
  } catch (error: unknown) {
    return {
      ...task,
      status: 'error',
      error: error instanceof Error ? error.message : '测试失败',
    }
  }

  return (
    result ?? {
      ...task,
      status: 'error',
      error: '测试未返回结果',
    }
  )
}

function BatchTestStatusBadge(props: { status: BatchTestStatus }) {
  if (props.status === 'testing') {
    return (
      <Badge variant='outline' className='border-info/30 bg-info/10 text-info'>
        测试中
      </Badge>
    )
  }
  if (props.status === 'success') {
    return (
      <Badge
        variant='outline'
        className='border-success/30 bg-success/10 text-success'
      >
        成功
      </Badge>
    )
  }
  return <Badge variant='destructive'>失败</Badge>
}

function BatchTestResultContent(props: { result: BatchTestResult }) {
  if (props.result.status === 'testing') {
    return <span className='text-muted-foreground'>正在请求上游</span>
  }

  if (!props.result.error) {
    return <span className='text-success'>连通性正常</span>
  }

  const errorCode = props.result.errorCode ? ` (${props.result.errorCode})` : ''
  return (
    <span className='text-destructive'>
      {props.result.error}
      {errorCode}
    </span>
  )
}

function formatBatchTestResponseTime(responseTime?: number): string {
  if (typeof responseTime !== 'number') return '-'
  if (responseTime === 0) return '0ms'
  return formatResponseTime(responseTime)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '加载失败，请稍后重试'
}

export function ChannelBatchTestDialog(props: ChannelBatchTestDialogProps) {
  const queryClient = useQueryClient()
  const stopRequestedRef = useRef(false)
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [results, setResults] = useState<Record<string, BatchTestResult>>({})
  const [progress, setProgress] = useState<BatchTestProgress | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isStopRequested, setIsStopRequested] = useState(false)

  const channelsQuery = useQuery({
    queryKey: ['channel-batch-test', 'channels'],
    queryFn: getBatchTestChannels,
    enabled: props.open,
    staleTime: 60_000,
  })
  const pricedModelsQuery = useQuery({
    queryKey: ['channel-batch-test', 'priced-models'],
    queryFn: getPricedModelNames,
    enabled: props.open,
    staleTime: 5 * 60_000,
  })

  const channels = channelsQuery.data ?? EMPTY_CHANNELS
  const pricedModels = pricedModelsQuery.data ?? EMPTY_PRICED_MODELS
  const channelOptions = useMemo(
    () =>
      channels.map((channel) => ({
        value: String(channel.id),
        label: `#${channel.id} ${channel.name}`,
      })),
    [channels]
  )
  const modelOptions = useMemo(
    () => pricedModels.map((model) => ({ value: model, label: model })),
    [pricedModels]
  )
  const selectedChannels = useMemo(() => {
    const selectedIds = new Set(
      selectedChannelIds.map((channelId) => Number(channelId))
    )
    return channels.filter((channel) => selectedIds.has(channel.id))
  }, [channels, selectedChannelIds])
  const tasks = useMemo(
    () => buildBatchTestTasks(selectedChannels, selectedModels),
    [selectedChannels, selectedModels]
  )
  const visibleResults = useMemo(
    () =>
      tasks
        .map((task) => results[task.key])
        .filter((result): result is BatchTestResult => result !== undefined),
    [results, tasks]
  )
  const progressPercent = progress
    ? Math.round((progress.completed / progress.total) * 100)
    : 0
  const loadError = channelsQuery.error ?? pricedModelsQuery.error
  const optionsLoading = channelsQuery.isLoading || pricedModelsQuery.isLoading

  const clearResults = () => {
    setResults({})
    setProgress(null)
  }

  const resetDialog = () => {
    stopRequestedRef.current = true
    setSelectedChannelIds([])
    setSelectedModels([])
    setResults({})
    setProgress(null)
    setIsTesting(false)
    setIsStopRequested(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && isTesting) {
      toast.error('批量测试进行中，请先停止测试')
      return
    }
    if (!open) resetDialog()
    props.onOpenChange(open)
  }

  const handleStartTest = async () => {
    if (tasks.length === 0) {
      toast.error('请至少选择一个渠道和一个已定价模型')
      return
    }

    stopRequestedRef.current = false
    setIsTesting(true)
    setIsStopRequested(false)
    setResults({})
    setProgress({
      total: tasks.length,
      completed: 0,
      success: 0,
      failed: 0,
    })

    let completed = 0
    let succeeded = 0
    let failed = 0

    try {
      for (
        let start = 0;
        start < tasks.length;
        start += BATCH_TEST_CONCURRENCY
      ) {
        if (stopRequestedRef.current) break

        const batch = tasks.slice(start, start + BATCH_TEST_CONCURRENCY)
        setResults((current) => {
          const next = { ...current }
          for (const task of batch) {
            next[task.key] = { ...task, status: 'testing' }
          }
          return next
        })

        const batchResults = await Promise.all(batch.map(runBatchTestTask))
        completed += batchResults.length
        succeeded += batchResults.filter(
          (result) => result.status === 'success'
        ).length
        failed = completed - succeeded

        setResults((current) => {
          const next = { ...current }
          for (const result of batchResults) {
            next[result.key] = result
          }
          return next
        })
        setProgress({
          total: tasks.length,
          completed,
          success: succeeded,
          failed,
        })
      }
    } finally {
      const stopped = stopRequestedRef.current && completed < tasks.length
      setIsTesting(false)
      setIsStopRequested(false)
      stopRequestedRef.current = false
      void queryClient.invalidateQueries({
        queryKey: channelsQueryKeys.lists(),
      })

      if (stopped) {
        toast.warning(
          `批量测试已停止：完成 ${completed}/${tasks.length}，成功 ${succeeded}，失败 ${failed}`
        )
      } else {
        toast.success(`批量测试完成：成功 ${succeeded}，失败 ${failed}`)
      }
    }
  }

  const handleStopTest = () => {
    if (!isTesting || isStopRequested) return
    stopRequestedRef.current = true
    setIsStopRequested(true)
  }

  const footer = (
    <>
      <Button
        variant='outline'
        onClick={() => handleOpenChange(false)}
        disabled={isTesting}
      >
        关闭
      </Button>
      {isTesting ? (
        <Button
          variant='destructive'
          onClick={handleStopTest}
          disabled={isStopRequested}
        >
          {isStopRequested && <Spinner data-icon='inline-start' />}
          {isStopRequested ? '正在停止' : '停止测试'}
        </Button>
      ) : (
        <Button
          onClick={() => void handleStartTest()}
          disabled={optionsLoading || Boolean(loadError) || tasks.length === 0}
        >
          <HugeiconsIcon icon={TestTubeIcon} data-icon='inline-start' />
          {visibleResults.length > 0 ? '重新测试' : '开始测试'}
        </Button>
      )}
    </>
  )

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title='批量测试渠道'
      description='选择渠道和已设置价格的模型，批量验证上游连通性。每个渠道都会测试每个已选模型。'
      contentHeight='min(68vh, 720px)'
      contentClassName='sm:max-w-5xl'
      bodyClassName='flex flex-col gap-5'
      footer={footer}
    >
      {loadError && (
        <Alert variant='destructive'>
          <HugeiconsIcon icon={Alert02Icon} />
          <AlertTitle>批量测试选项加载失败</AlertTitle>
          <AlertDescription>{getErrorMessage(loadError)}</AlertDescription>
          <AlertAction>
            <Button
              variant='outline'
              size='xs'
              onClick={() => {
                void channelsQuery.refetch()
                void pricedModelsQuery.refetch()
              }}
            >
              重试
            </Button>
          </AlertAction>
        </Alert>
      )}

      <FieldGroup className='grid gap-4 lg:grid-cols-2'>
        <Field>
          <div className='flex items-center justify-between gap-3'>
            <FieldLabel htmlFor='batch-test-channels'>选择渠道</FieldLabel>
            <div className='flex items-center gap-1'>
              <Button
                type='button'
                variant='ghost'
                size='xs'
                onClick={() => {
                  setSelectedChannelIds(
                    channels
                      .filter((channel) => channel.status === 1)
                      .map((channel) => String(channel.id))
                  )
                  clearResults()
                }}
                disabled={isTesting || channels.length === 0}
              >
                全选启用渠道
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='xs'
                onClick={() => {
                  setSelectedChannelIds([])
                  clearResults()
                }}
                disabled={isTesting || selectedChannelIds.length === 0}
              >
                清空
              </Button>
            </div>
          </div>
          {channelsQuery.isLoading ? (
            <Skeleton className='h-9 w-full' />
          ) : (
            <MultiSelect
              id='batch-test-channels'
              options={channelOptions}
              selected={selectedChannelIds}
              onChange={(values) => {
                setSelectedChannelIds(values)
                clearResults()
              }}
              placeholder='搜索并选择渠道'
              emptyText='没有匹配的渠道'
              disabled={isTesting || Boolean(channelsQuery.error)}
              renderSelectedSummary={(values) => `已选 ${values.length} 个渠道`}
            />
          )}
          <FieldDescription>
            共 {channels.length} 个渠道，当前选择 {selectedChannelIds.length}{' '}
            个。
          </FieldDescription>
        </Field>

        <Field>
          <div className='flex items-center justify-between gap-3'>
            <FieldLabel htmlFor='batch-test-models'>选择已定价模型</FieldLabel>
            <div className='flex items-center gap-1'>
              <Button
                type='button'
                variant='ghost'
                size='xs'
                onClick={() => {
                  setSelectedModels(pricedModels)
                  clearResults()
                }}
                disabled={isTesting || pricedModels.length === 0}
              >
                全选
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='xs'
                onClick={() => {
                  setSelectedModels([])
                  clearResults()
                }}
                disabled={isTesting || selectedModels.length === 0}
              >
                清空
              </Button>
            </div>
          </div>
          {pricedModelsQuery.isLoading ? (
            <Skeleton className='h-9 w-full' />
          ) : (
            <MultiSelect
              id='batch-test-models'
              options={modelOptions}
              selected={selectedModels}
              onChange={(values) => {
                setSelectedModels(values)
                clearResults()
              }}
              placeholder='搜索并选择模型'
              emptyText='没有已设置价格的模型'
              disabled={isTesting || Boolean(pricedModelsQuery.error)}
              renderSelectedSummary={(values) => `已选 ${values.length} 个模型`}
              copyChipOnClick
            />
          )}
          <FieldDescription>
            仅显示已设置价格的模型，共 {pricedModels.length} 个。
          </FieldDescription>
        </Field>
      </FieldGroup>

      {selectedChannels.length > 0 && selectedModels.length > 0 && (
        <Alert>
          <HugeiconsIcon icon={TestTubeIcon} />
          <AlertTitle>将执行 {tasks.length} 个测试组合</AlertTitle>
          <AlertDescription>
            {selectedChannels.length} 个渠道 × {selectedModels.length}{' '}
            个模型，最多同时发起 {BATCH_TEST_CONCURRENCY} 个请求。
          </AlertDescription>
        </Alert>
      )}

      {progress && (
        <div className='flex flex-col gap-3 rounded-lg border p-3'>
          <Progress value={progressPercent}>
            <ProgressLabel>测试进度</ProgressLabel>
            <ProgressValue>
              {() => `${progress.completed}/${progress.total}`}
            </ProgressValue>
          </Progress>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline'>完成 {progress.completed}</Badge>
            <Badge
              variant='outline'
              className='border-success/30 bg-success/10 text-success'
            >
              成功 {progress.success}
            </Badge>
            <Badge variant='destructive'>失败 {progress.failed}</Badge>
          </div>
        </div>
      )}

      {visibleResults.length > 0 && (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>渠道</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>响应时间</TableHead>
                <TableHead>结果</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleResults.map((result) => (
                <TableRow key={result.key}>
                  <TableCell>
                    <div className='max-w-48'>
                      <div className='truncate font-medium'>
                        {result.channelName}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        #{result.channelId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className='max-w-64 truncate font-mono'>
                    {result.model}
                  </TableCell>
                  <TableCell>
                    <BatchTestStatusBadge status={result.status} />
                  </TableCell>
                  <TableCell>
                    {formatBatchTestResponseTime(result.responseTime)}
                  </TableCell>
                  <TableCell className='max-w-[28rem] whitespace-normal'>
                    <BatchTestResultContent result={result} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Dialog>
  )
}
