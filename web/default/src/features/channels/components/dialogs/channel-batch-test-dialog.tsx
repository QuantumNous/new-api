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
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getPricing } from '@/features/pricing/api'

import { getChannels } from '../../api'
import {
  channelsQueryKeys,
  formatResponseTime,
  handleTestChannel,
} from '../../lib'
import type { Channel } from '../../types'

type BatchTestChannel = Pick<Channel, 'id' | 'name' | 'status'> &
  Partial<Pick<Channel, 'models'>>

type ChannelBatchTestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channels?: ReadonlyArray<BatchTestChannel>
  modelSelectionMode?: 'multiple' | 'single'
  selectAllMode?: 'all' | 'enabled'
  enableRepeatMode?: boolean
}

type BatchTestMode = 'batch' | 'repeat'

type BatchTestTask = {
  key: string
  channelId: number
  channelName: string
  model: string
  workerIndex?: number
  iteration?: number
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
const DEFAULT_REPEAT_CONCURRENCY = '3'
const DEFAULT_REPEAT_ITERATIONS = '5'
const MIN_REPEAT_CONCURRENCY = 1
const MAX_REPEAT_CONCURRENCY = 20
const MIN_REPEAT_ITERATIONS = 1
const MAX_REPEAT_ITERATIONS = 50
const MAX_REPEAT_REQUESTS = 200
const POSITIVE_INTEGER_PATTERN = /^\d+$/
const EMPTY_CHANNELS: BatchTestChannel[] = []
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
  channels: readonly BatchTestChannel[],
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

function buildRepeatTestWorkers(
  channel: BatchTestChannel,
  model: string,
  concurrency: number,
  iterations: number
): BatchTestTask[][] {
  return Array.from({ length: concurrency }, (_, workerOffset) => {
    const workerIndex = workerOffset + 1
    return Array.from({ length: iterations }, (_, iterationOffset) => {
      const iteration = iterationOffset + 1
      return {
        key: `${channel.id}::${model}::${workerIndex}::${iteration}`,
        channelId: channel.id,
        channelName: channel.name,
        model,
        workerIndex,
        iteration,
      }
    })
  })
}

function parseBoundedInteger(
  value: string,
  minimum: number,
  maximum: number
): number | null {
  const normalized = value.trim()
  if (!POSITIVE_INTEGER_PATTERN.test(normalized)) return null

  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    return null
  }
  return parsed
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
  const [testMode, setTestMode] = useState<BatchTestMode>('batch')
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [repeatConcurrencyInput, setRepeatConcurrencyInput] = useState(
    DEFAULT_REPEAT_CONCURRENCY
  )
  const [repeatIterationsInput, setRepeatIterationsInput] = useState(
    DEFAULT_REPEAT_ITERATIONS
  )
  const [results, setResults] = useState<Record<string, BatchTestResult>>({})
  const [progress, setProgress] = useState<BatchTestProgress | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isStopRequested, setIsStopRequested] = useState(false)
  const isSingleModel = props.modelSelectionMode === 'single'
  const repeatModeEnabled = Boolean(props.enableRepeatMode && isSingleModel)
  const isRepeatMode = repeatModeEnabled && testMode === 'repeat'
  const usesProvidedChannels = props.channels !== undefined

  const channelsQuery = useQuery({
    queryKey: ['channel-batch-test', 'channels'],
    queryFn: getBatchTestChannels,
    enabled: props.open && !usesProvidedChannels,
    staleTime: 60_000,
  })
  const pricedModelsQuery = useQuery({
    queryKey: ['channel-batch-test', 'priced-models'],
    queryFn: getPricedModelNames,
    enabled: props.open,
    staleTime: 5 * 60_000,
  })

  const channels = props.channels ?? channelsQuery.data ?? EMPTY_CHANNELS
  const pricedModels = pricedModelsQuery.data ?? EMPTY_PRICED_MODELS
  const channelOptions = useMemo(
    () =>
      channels.map((channel) => ({
        value: String(channel.id),
        label: `#${channel.id} ${channel.name}`,
      })),
    [channels]
  )
  const selectedChannels = useMemo(() => {
    const selectedIds = new Set(
      selectedChannelIds.map((channelId) => Number(channelId))
    )
    return channels.filter((channel) => selectedIds.has(channel.id))
  }, [channels, selectedChannelIds])
  const repeatChannel = isRepeatMode ? selectedChannels[0] : undefined
  const repeatModelNames = useMemo(() => {
    if (!repeatChannel) return EMPTY_PRICED_MODELS
    if (typeof repeatChannel.models !== 'string') return pricedModels

    const configuredModels = new Set(
      repeatChannel.models
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean)
    )
    return pricedModels.filter((model) => configuredModels.has(model))
  }, [pricedModels, repeatChannel])
  const selectableModels = isRepeatMode ? repeatModelNames : pricedModels
  const modelOptions = useMemo(
    () => pricedModels.map((model) => ({ value: model, label: model })),
    [pricedModels]
  )
  const repeatConcurrency = parseBoundedInteger(
    repeatConcurrencyInput,
    MIN_REPEAT_CONCURRENCY,
    MAX_REPEAT_CONCURRENCY
  )
  const repeatIterations = parseBoundedInteger(
    repeatIterationsInput,
    MIN_REPEAT_ITERATIONS,
    MAX_REPEAT_ITERATIONS
  )
  const repeatRequestCount =
    repeatConcurrency !== null && repeatIterations !== null
      ? repeatConcurrency * repeatIterations
      : 0
  const repeatRequestLimitExceeded = repeatRequestCount > MAX_REPEAT_REQUESTS
  const repeatConfigurationValid =
    repeatConcurrency !== null &&
    repeatIterations !== null &&
    !repeatRequestLimitExceeded
  const repeatWorkers = useMemo(() => {
    if (
      !isRepeatMode ||
      !repeatChannel ||
      selectedModels.length !== 1 ||
      repeatConcurrency === null ||
      repeatIterations === null ||
      repeatRequestLimitExceeded
    ) {
      return []
    }

    return buildRepeatTestWorkers(
      repeatChannel,
      selectedModels[0],
      repeatConcurrency,
      repeatIterations
    )
  }, [
    isRepeatMode,
    repeatChannel,
    repeatConcurrency,
    repeatIterations,
    repeatRequestLimitExceeded,
    selectedModels,
  ])
  const tasks = useMemo(
    () =>
      isRepeatMode
        ? repeatWorkers.flat()
        : buildBatchTestTasks(selectedChannels, selectedModels),
    [isRepeatMode, repeatWorkers, selectedChannels, selectedModels]
  )
  const visibleResults = useMemo(
    () =>
      tasks
        .map((task) => results[task.key])
        .filter((result): result is BatchTestResult => result !== undefined),
    [results, tasks]
  )
  const latencyStats = useMemo(() => {
    const responseTimes = visibleResults
      .filter((result) => result.status !== 'testing')
      .map((result) => result.responseTime)
      .filter(
        (responseTime): responseTime is number =>
          typeof responseTime === 'number' && Number.isFinite(responseTime)
      )
      .sort((a, b) => a - b)
    if (responseTimes.length === 0) return null

    const totalResponseTime = responseTimes.reduce(
      (total, responseTime) => total + responseTime,
      0
    )
    const p95Index = Math.ceil(responseTimes.length * 0.95) - 1
    return {
      average: Math.round(totalResponseTime / responseTimes.length),
      fastest: responseTimes.at(0),
      slowest: responseTimes.at(-1),
      p95: responseTimes.at(p95Index),
      sampleCount: responseTimes.length,
    }
  }, [visibleResults])
  const progressPercent = progress
    ? Math.round((progress.completed / progress.total) * 100)
    : 0
  const channelLoadError = usesProvidedChannels ? null : channelsQuery.error
  const loadError = channelLoadError ?? pricedModelsQuery.error
  const channelsLoading = !usesProvidedChannels && channelsQuery.isLoading
  const optionsLoading = channelsLoading || pricedModelsQuery.isLoading

  const clearResults = () => {
    setResults({})
    setProgress(null)
  }

  const resetDialog = () => {
    stopRequestedRef.current = true
    setTestMode('batch')
    setSelectedChannelIds([])
    setSelectedModels([])
    setRepeatConcurrencyInput(DEFAULT_REPEAT_CONCURRENCY)
    setRepeatIterationsInput(DEFAULT_REPEAT_ITERATIONS)
    setResults({})
    setProgress(null)
    setIsTesting(false)
    setIsStopRequested(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && isTesting) {
      toast.error(
        isRepeatMode
          ? '并发循环测试进行中，请先停止测试'
          : '批量测试进行中，请先停止测试'
      )
      return
    }
    if (!open) resetDialog()
    props.onOpenChange(open)
  }

  const handleStartTest = async () => {
    if (isRepeatMode && !repeatConfigurationValid) {
      toast.error(
        `请填写有效的并发与循环次数，总请求数不能超过 ${MAX_REPEAT_REQUESTS}`
      )
      return
    }
    if (tasks.length === 0) {
      toast.error(
        isRepeatMode
          ? '请选择一个渠道和一个该渠道支持的已定价模型'
          : '请至少选择一个渠道和一个已定价模型'
      )
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
      if (isRepeatMode) {
        await Promise.all(
          repeatWorkers.map(async (workerTasks) => {
            for (const task of workerTasks) {
              if (stopRequestedRef.current) break

              setResults((current) => ({
                ...current,
                [task.key]: { ...task, status: 'testing' },
              }))
              const result = await runBatchTestTask(task)
              completed += 1
              if (result.status === 'success') succeeded += 1
              failed = completed - succeeded
              setResults((current) => ({
                ...current,
                [result.key]: result,
              }))
              setProgress({
                total: tasks.length,
                completed,
                success: succeeded,
                failed,
              })
            }
          })
        )
      } else {
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
          `${isRepeatMode ? '并发循环测试' : '批量测试'}已停止：完成 ${completed}/${tasks.length}，成功 ${succeeded}，失败 ${failed}`
        )
      } else {
        toast.success(
          `${isRepeatMode ? '并发循环测试' : '批量测试'}完成：成功 ${succeeded}，失败 ${failed}`
        )
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
          disabled={
            optionsLoading ||
            Boolean(loadError) ||
            tasks.length === 0 ||
            (isRepeatMode && !repeatConfigurationValid)
          }
        >
          <HugeiconsIcon icon={TestTubeIcon} data-icon='inline-start' />
          {visibleResults.length > 0 ? '重新测试' : '开始测试'}
        </Button>
      )}
    </>
  )

  let dialogDescription =
    '选择渠道和已设置价格的模型，批量验证上游连通性。每个渠道都会测试每个已选模型。'
  if (repeatModeEnabled) {
    dialogDescription =
      '可批量验证多个渠道，也可固定一个渠道和模型进行并发循环测试。测试会真实请求上游。'
  } else if (isSingleModel) {
    dialogDescription =
      '选择多个渠道和一个已设置价格的模型，批量验证上游连通性。'
  }

  let modelDescription = `仅显示已设置价格的模型，共 ${pricedModels.length} 个。`
  if (isRepeatMode) {
    modelDescription = repeatChannel
      ? `仅显示该渠道支持且已设置价格的模型，共 ${selectableModels.length} 个。`
      : '请先选择渠道，再选择该渠道支持的模型。'
  } else if (isSingleModel) {
    modelDescription = `仅显示已设置价格的模型，共 ${pricedModels.length} 个，每次只能选择一个。`
  }

  let testPlanTitle = `将执行 ${tasks.length} 个测试组合`
  let testPlanDescription = `${selectedChannels.length} 个渠道 × ${selectedModels.length} 个模型，最多同时发起 ${BATCH_TEST_CONCURRENCY} 个请求。`
  if (isRepeatMode) {
    testPlanTitle = `将执行 ${repeatRequestCount} 次测试请求`
    testPlanDescription = `${repeatChannel?.name} · ${selectedModels[0]}，${repeatConcurrencyInput} 个并发 × 每并发 ${repeatIterationsInput} 次循环。`
  } else if (isSingleModel) {
    testPlanTitle = `将测试 ${selectedChannels.length} 个渠道`
    testPlanDescription = `统一使用 ${selectedModels[0]} 模型，最多同时发起 ${BATCH_TEST_CONCURRENCY} 个请求。`
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={isSingleModel ? '渠道连通性测试' : '批量测试渠道'}
      description={dialogDescription}
      contentHeight='min(68vh, 720px)'
      contentClassName='sm:max-w-5xl'
      bodyClassName='flex flex-col gap-5'
      footer={footer}
    >
      {repeatModeEnabled && (
        <ToggleGroup
          value={[testMode]}
          onValueChange={(values) => {
            const nextMode = values[0]
            if (nextMode !== 'batch' && nextMode !== 'repeat') return
            setTestMode(nextMode)
            setSelectedChannelIds([])
            setSelectedModels([])
            clearResults()
          }}
          variant='outline'
          spacing={0}
          aria-label='选择连通性测试模式'
          className='grid w-full grid-cols-2'
          disabled={isTesting}
        >
          <ToggleGroupItem value='batch' className='w-full'>
            批量渠道
          </ToggleGroupItem>
          <ToggleGroupItem value='repeat' className='w-full'>
            并发循环
          </ToggleGroupItem>
        </ToggleGroup>
      )}

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
                if (!usesProvidedChannels) void channelsQuery.refetch()
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
            {!isRepeatMode && (
              <div className='flex items-center gap-1'>
                <Button
                  type='button'
                  variant='ghost'
                  size='xs'
                  onClick={() => {
                    setSelectedChannelIds(
                      channels
                        .filter(
                          (channel) =>
                            props.selectAllMode === 'all' ||
                            channel.status === 1
                        )
                        .map((channel) => String(channel.id))
                    )
                    clearResults()
                  }}
                  disabled={isTesting || channels.length === 0}
                >
                  {props.selectAllMode === 'all' ? '全选' : '全选启用渠道'}
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
            )}
          </div>
          {channelsLoading && <Skeleton className='h-9 w-full' />}
          {!channelsLoading && isRepeatMode && (
            <Combobox
              items={channelOptions}
              itemToStringLabel={(option) => option.label}
              itemToStringValue={(option) => option.value}
              value={
                channelOptions.find(
                  (option) => option.value === selectedChannelIds[0]
                ) ?? null
              }
              onValueChange={(option) => {
                setSelectedChannelIds(option ? [option.value] : [])
                setSelectedModels([])
                clearResults()
              }}
              disabled={isTesting || Boolean(channelLoadError)}
            >
              <ComboboxInput
                id='batch-test-channels'
                className='w-full'
                placeholder='搜索并选择一个渠道'
                showClear={selectedChannelIds.length > 0}
                disabled={isTesting || Boolean(channelLoadError)}
              />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxCollection>
                    {(option: { value: string; label: string }) => (
                      <ComboboxItem key={option.value} value={option}>
                        <span className='truncate'>{option.label}</span>
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxList>
                <ComboboxEmpty>没有匹配的渠道</ComboboxEmpty>
              </ComboboxContent>
            </Combobox>
          )}
          {!channelsLoading && !isRepeatMode && (
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
              disabled={isTesting || Boolean(channelLoadError)}
              renderSelectedSummary={(values) => `已选 ${values.length} 个渠道`}
            />
          )}
          <FieldDescription>
            {isRepeatMode
              ? `共 ${channels.length} 个渠道，只能选择一个测试目标。`
              : `共 ${channels.length} 个渠道，当前选择 ${selectedChannelIds.length} 个。`}
          </FieldDescription>
        </Field>

        <Field>
          <div className='flex items-center justify-between gap-3'>
            <FieldLabel htmlFor='batch-test-models'>
              {isSingleModel ? '选择模型' : '选择已定价模型'}
            </FieldLabel>
            {!isSingleModel && (
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
            )}
          </div>
          {pricedModelsQuery.isLoading && <Skeleton className='h-9 w-full' />}
          {!pricedModelsQuery.isLoading && isSingleModel && (
            <Combobox
              items={selectableModels}
              value={selectedModels[0] ?? null}
              onValueChange={(value) => {
                setSelectedModels(value ? [value] : [])
                clearResults()
              }}
              disabled={
                isTesting ||
                Boolean(pricedModelsQuery.error) ||
                (isRepeatMode && !repeatChannel)
              }
            >
              <ComboboxInput
                id='batch-test-models'
                className='w-full'
                placeholder='搜索并选择模型'
                showClear={selectedModels.length > 0}
                disabled={
                  isTesting ||
                  Boolean(pricedModelsQuery.error) ||
                  (isRepeatMode && !repeatChannel)
                }
              />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxCollection>
                    {(model: string) => (
                      <ComboboxItem key={model} value={model}>
                        <span className='truncate font-mono'>{model}</span>
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxList>
                <ComboboxEmpty>
                  {isRepeatMode
                    ? '该渠道没有已设置价格的模型'
                    : '没有已设置价格的模型'}
                </ComboboxEmpty>
              </ComboboxContent>
            </Combobox>
          )}
          {!pricedModelsQuery.isLoading && !isSingleModel && (
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
          <FieldDescription>{modelDescription}</FieldDescription>
        </Field>
      </FieldGroup>

      {isRepeatMode && (
        <FieldGroup className='grid gap-4 sm:grid-cols-2'>
          <Field
            data-invalid={
              repeatConcurrency === null || repeatRequestLimitExceeded
            }
          >
            <FieldLabel htmlFor='repeat-test-concurrency'>并发数</FieldLabel>
            <Input
              id='repeat-test-concurrency'
              type='number'
              min={MIN_REPEAT_CONCURRENCY}
              max={MAX_REPEAT_CONCURRENCY}
              step={1}
              value={repeatConcurrencyInput}
              onChange={(event) => {
                setRepeatConcurrencyInput(event.target.value)
                clearResults()
              }}
              disabled={isTesting}
              aria-invalid={
                repeatConcurrency === null || repeatRequestLimitExceeded
              }
            />
            <FieldDescription>
              同时运行的测试任务，范围 {MIN_REPEAT_CONCURRENCY}-
              {MAX_REPEAT_CONCURRENCY}。
            </FieldDescription>
          </Field>
          <Field
            data-invalid={
              repeatIterations === null || repeatRequestLimitExceeded
            }
          >
            <FieldLabel htmlFor='repeat-test-iterations'>
              每并发循环次数
            </FieldLabel>
            <Input
              id='repeat-test-iterations'
              type='number'
              min={MIN_REPEAT_ITERATIONS}
              max={MAX_REPEAT_ITERATIONS}
              step={1}
              value={repeatIterationsInput}
              onChange={(event) => {
                setRepeatIterationsInput(event.target.value)
                clearResults()
              }}
              disabled={isTesting}
              aria-invalid={
                repeatIterations === null || repeatRequestLimitExceeded
              }
            />
            <FieldDescription>
              每个并发任务顺序执行，范围 {MIN_REPEAT_ITERATIONS}-
              {MAX_REPEAT_ITERATIONS} 次。
            </FieldDescription>
          </Field>
        </FieldGroup>
      )}

      {isRepeatMode && repeatRequestLimitExceeded && (
        <Alert variant='destructive'>
          <HugeiconsIcon icon={Alert02Icon} />
          <AlertTitle>总请求数超过限制</AlertTitle>
          <AlertDescription>
            当前为 {repeatRequestCount} 次，单次测试最多允许{' '}
            {MAX_REPEAT_REQUESTS} 次请求。
          </AlertDescription>
        </Alert>
      )}

      {selectedChannels.length > 0 && selectedModels.length > 0 && (
        <Alert>
          <HugeiconsIcon icon={TestTubeIcon} />
          <AlertTitle>{testPlanTitle}</AlertTitle>
          <AlertDescription>{testPlanDescription}</AlertDescription>
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
          {isRepeatMode && latencyStats && (
            <dl className='grid grid-cols-2 gap-2 text-sm sm:grid-cols-4'>
              <div>
                <dt className='text-muted-foreground'>平均响应</dt>
                <dd className='font-mono font-medium'>
                  {formatBatchTestResponseTime(latencyStats.average)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>最快 / 最慢</dt>
                <dd className='font-mono font-medium'>
                  {formatBatchTestResponseTime(latencyStats.fastest)} /{' '}
                  {formatBatchTestResponseTime(latencyStats.slowest)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>P95</dt>
                <dd className='font-mono font-medium'>
                  {formatBatchTestResponseTime(latencyStats.p95)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>有效样本</dt>
                <dd className='font-mono font-medium'>
                  {latencyStats.sampleCount} 次
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {visibleResults.length > 0 && (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                {isRepeatMode && <TableHead>轮次</TableHead>}
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
                  {isRepeatMode && (
                    <TableCell>
                      <div className='font-medium'>
                        并发 {result.workerIndex}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        第 {result.iteration} 次
                      </div>
                    </TableCell>
                  )}
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
