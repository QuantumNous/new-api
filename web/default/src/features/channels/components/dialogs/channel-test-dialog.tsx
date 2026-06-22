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
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type ColumnDef,
  type RowSelectionState,
  type Table as TanStackTable,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Loader2, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { DataTablePagination } from '@/components/data-table/pagination'
import { StatusBadge } from '@/components/status-badge'
import {
  formatChannelErrorMessageForOpsCenter,
  CHANNEL_BILLING_MODEL_PRICING_PATH,
} from '../../lib/channel-error-display'
import { formatResponseTime, handleTestChannel } from '../../lib'
import {
  channelTestDialogContentClassName,
  channelTestDialogOutlineButtonClassName,
  channelTestDialogTableScopeClassName,
  channelsBulkClearButtonClassName,
  channelsBulkCountTextClassName,
  channelsBulkPanelClassName,
} from '../../lib/channels-ui-styles'
import { useChannels } from '../channels-provider'

type ChannelTestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ModelRow = {
  model: string
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

type TestResult = {
  status: TestStatus
  responseTime?: number
  error?: string
  errorCode?: string
}

const endpointTypeOptions: Array<{ value: string; label: string }> = [
  { value: 'auto', label: 'Auto detect (default)' },
  { value: 'openai', label: 'OpenAI (/v1/chat/completions)' },
  { value: 'openai-response', label: 'OpenAI Responses (/v1/responses)' },
  {
    value: 'openai-response-compact',
    label: 'OpenAI Response Compaction (/v1/responses/compact)',
  },
  { value: 'anthropic', label: 'Anthropic (/v1/messages)' },
  {
    value: 'gemini',
    label: 'Gemini (/v1beta/models/{model}:generateContent)',
  },
  { value: 'jina-rerank', label: 'Jina Rerank (/v1/rerank)' },
  {
    value: 'image-generation',
    label: 'Image Generation (/v1/images/generations)',
  },
  { value: 'embeddings', label: 'Embeddings (/v1/embeddings)' },
]

const STREAM_INCOMPATIBLE_ENDPOINTS = new Set([
  'embeddings',
  'image-generation',
  'jina-rerank',
  'openai-response-compact',
])

export function ChannelTestDialog({
  open,
  onOpenChange,
}: ChannelTestDialogProps) {
  const { t } = useTranslation()
  const { currentRow } = useChannels()
  const [endpointType, setEndpointType] = useState('auto')
  const [isStreamTest, setIsStreamTest] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [testingModels, setTestingModels] = useState<Set<string>>(
    () => new Set()
  )
  const [isBatchTesting, setIsBatchTesting] = useState(false)
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const resetState = useCallback(() => {
    setEndpointType('auto')
    setIsStreamTest(false)
    setSearchTerm('')
    setTestResults({})
    setRowSelection({})
    setTestingModels(() => new Set())
    setIsBatchTesting(false)
    setPagination({ pageIndex: 0, pageSize: 10 })
  }, [])

  useEffect(() => {
    if (open && currentRow) {
      resetState()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentRow?.id, resetState])

  const streamDisabled = STREAM_INCOMPATIBLE_ENDPOINTS.has(endpointType)

  useEffect(() => {
    if (streamDisabled) {
      setIsStreamTest(false)
    }
  }, [streamDisabled])

  const modelsValue = currentRow?.models ?? ''
  const defaultTestModel = currentRow?.test_model?.trim()

  const models = useMemo(() => {
    if (!modelsValue) return []
    return modelsValue
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean)
  }, [modelsValue])

  const filteredModels = useMemo(() => {
    if (!searchTerm) return models
    const keyword = searchTerm.toLowerCase()
    return models.filter((model) => model.toLowerCase().includes(keyword))
  }, [models, searchTerm])

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [searchTerm, modelsValue])

  const tableData = useMemo<ModelRow[]>(
    () => filteredModels.map((model) => ({ model })),
    [filteredModels]
  )

  const markModelTesting = useCallback((key: string, isTesting: boolean) => {
    setTestingModels((prev) => {
      const next = new Set(prev)
      if (isTesting) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }, [])

  const updateTestResult = useCallback((key: string, result: TestResult) => {
    setTestResults((prev) => ({
      ...prev,
      [key]: result,
    }))
  }, [])

  const testSingleModel = useCallback(
    async (model: string) => {
      if (!currentRow) return

      markModelTesting(model, true)
      updateTestResult(model, { status: 'testing' })

      try {
        await handleTestChannel(
          currentRow.id,
          {
            testModel: model,
            endpointType: endpointType === 'auto' ? undefined : endpointType,
            stream: isStreamTest || undefined,
          },
          (success, responseTime, error, errorCode) => {
            updateTestResult(model, {
              status: success ? 'success' : 'error',
              responseTime,
              error,
              errorCode,
            })
          }
        )
      } catch (error: unknown) {
        updateTestResult(model, {
          status: 'error',
          error: error instanceof Error ? error.message : t('Test failed'),
        })
      } finally {
        markModelTesting(model, false)
      }
    },
    [
      currentRow,
      endpointType,
      isStreamTest,
      markModelTesting,
      t,
      updateTestResult,
    ]
  )

  const handleBatchTest = useCallback(
    async (modelsToTest: string[]) => {
      if (!modelsToTest.length) return

      setIsBatchTesting(true)
      try {
        await Promise.allSettled(
          modelsToTest.map((modelName) => testSingleModel(modelName))
        )
      } finally {
        setIsBatchTesting(false)
        setRowSelection({})
      }
    },
    [testSingleModel]
  )

  const handleClose = () => {
    resetState()
    onOpenChange(false)
  }

  const isAnyTesting = testingModels.size > 0 || isBatchTesting

  const columns = useMemo<ColumnDef<ModelRow>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label='Select all models'
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select model ${row.original.model}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: 'model',
        header: () => t('Model'),
        cell: ({ row }) => {
          const model = row.original.model
          const isDefault = defaultTestModel === model

          return (
            <div className='flex items-center gap-2 text-slate-800'>
              <span className='font-medium'>{model}</span>
              {isDefault && (
                <StatusBadge
                  label={t('Default')}
                  variant='info'
                  size='sm'
                  copyable={false}
                />
              )}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: () => t('Connectivity test status'),
        cell: ({ row }) => {
          const model = row.original.model
          const result = testResults[model]

          if (!result || result.status === 'idle') {
            return (
              <StatusBadge
                label={t('Not tested')}
                variant='neutral'
                copyable={false}
              />
            )
          }

          if (result.status === 'testing') {
            return (
              <div className='flex items-center gap-2 text-sm text-slate-600'>
                <Loader2 className='h-4 w-4 animate-spin text-slate-500' />
                {t('Testing...')}
              </div>
            )
          }

          if (result.status === 'success') {
            return (
              <div className='flex flex-col gap-1 text-xs'>
                <StatusBadge
                  label={t('Success')}
                  variant='success'
                  copyable={false}
                />
                {typeof result.responseTime === 'number' && (
                  <span className='text-slate-600'>
                    {formatResponseTime(result.responseTime, t)}
                  </span>
                )}
              </div>
            )
          }

          const formattedError = result.error
            ? formatChannelErrorMessageForOpsCenter(result.error)
            : undefined

          return (
            <div className='flex flex-col gap-1 text-xs'>
              <StatusBadge label={t('Failed')} variant='danger' copyable={false} />
              {formattedError && (
                <span className='break-all text-slate-600'>{formattedError}</span>
              )}
              {result.errorCode === 'model_price_error' && (
                <Button
                  variant='outline'
                  size='sm'
                  className={cn('w-fit', channelTestDialogOutlineButtonClassName)}
                  onClick={() =>
                    window.open(CHANNEL_BILLING_MODEL_PRICING_PATH, '_blank')
                  }
                >
                  <Settings className='mr-1 h-3 w-3' />
                  {t('Go to Model Pricing')}
                </Button>
              )}
            </div>
          )
        },
        enableSorting: false,
        size: 220,
      },
      {
        id: 'actions',
        header: () => t('Actions'),
        cell: ({ row }) => {
          const model = row.original.model
          const isTestingModel = testingModels.has(model)

          return (
            <Button
              variant='outline'
              size='sm'
              className={channelTestDialogOutlineButtonClassName}
              onClick={() => testSingleModel(model)}
              disabled={isTestingModel || isBatchTesting}
            >
              {isTestingModel && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              {t('Test Connection')}
            </Button>
          )
        },
        enableSorting: false,
        size: 120,
      },
    ],
    [
      defaultTestModel,
      isBatchTesting,
      t,
      testResults,
      testingModels,
      testSingleModel,
    ]
  )

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
  })

  if (!currentRow) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'max-h-[90vh] overflow-hidden sm:max-w-3xl',
          channelTestDialogContentClassName
        )}
      >
        <DialogHeader>
          <DialogTitle>{t('Test Channel Connection')}</DialogTitle>
          <DialogDescription>
            {t('Test connectivity for:')} <strong>{currentRow.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[78vh] space-y-4 overflow-y-auto py-4 pr-1'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='endpoint-type'>{t('Endpoint Type')}</Label>
              <Select
                items={[
                  ...endpointTypeOptions.map((option) => {
                    const itemValue = option.value
                    return { value: itemValue, label: t(option.label) }
                  }),
                ]}
                value={endpointType}
                onValueChange={(v) => v !== null && setEndpointType(v)}
              >
                <SelectTrigger id='endpoint-type'>
                  <SelectValue placeholder={t('Auto detect (default)')} />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {endpointTypeOptions.map((option) => {
                      const itemValue = option.value
                      return (
                        <SelectItem key={itemValue} value={itemValue}>
                          {t(option.label)}
                        </SelectItem>
                      )
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Override the endpoint used for testing. Leave empty to auto detect.'
                )}
              </p>
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='stream-toggle'>{t('Stream Mode')}</Label>
              <div className='flex items-center gap-2'>
                <Switch
                  id='stream-toggle'
                  checked={isStreamTest}
                  onCheckedChange={setIsStreamTest}
                  disabled={streamDisabled}
                />
                <span className='text-sm'>
                  {isStreamTest ? t('Enabled') : t('Disabled')}
                </span>
              </div>
              <p className='text-muted-foreground text-xs'>
                {t('Enable streaming mode for the test request.')}
              </p>
            </div>
          </div>

          <div className='space-y-3 max-sm:has-[div[role="toolbar"]]:pb-16'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <p className='text-sm font-medium text-slate-900'>
                  {t('Channel models')}
                </p>
                <p className='text-xs text-slate-500'>
                  {t('Select models to run batch tests.')}
                </p>
              </div>
              <Input
                placeholder={t('Filter models...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='h-8 w-full border-[#DBEAFE] bg-white text-slate-800 placeholder:text-slate-400 sm:w-64'
              />
            </div>

            <div className='space-y-3'>
              <div
                className={channelTestDialogTableScopeClassName}
                role='region'
              >
                <div className='max-h-[360px] overflow-y-auto'>
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            data-state={
                              row.getIsSelected() ? 'selected' : undefined
                            }
                            className='border-[#DBEAFE] text-slate-800 hover:bg-[#EFF6FF] data-[state=selected]:bg-blue-50 data-[state=selected]:text-blue-700'
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={table.getVisibleLeafColumns().length}
                            className='h-16 text-center text-sm text-slate-500'
                          >
                            {models.length
                              ? t('No models matched your search.')
                              : t('This channel has no configured models.')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DataTablePagination table={table} />
            </div>

            <TestModelsBulkActions
              table={table}
              disabled={isAnyTesting}
              onTestSelected={handleBatchTest}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            className={channelTestDialogOutlineButtonClassName}
            onClick={handleClose}
          >
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TestModelsBulkActions({
  table,
  disabled,
  onTestSelected,
}: {
  table: TanStackTable<ModelRow>
  disabled?: boolean
  onTestSelected: (models: string[]) => void
}) {
  const { t } = useTranslation()
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedModels = selectedRows.map((row) => row.original.model)

  const buttonLabel =
    selectedModels.length > 0
      ? t('Test {{count}} selected', { count: selectedModels.length })
      : t('Test selected models')

  const selectionSummary = useCallback(
    (count: number) =>
      count === 1
        ? t('{{count}} model resource selected', { count })
        : t('{{count}} model resources selected', { count }),
    [t]
  )

  return (
    <BulkActionsToolbar
      table={table}
      entityName='model'
      selectionSummary={selectionSummary}
      panelClassName={channelsBulkPanelClassName}
      countTextClassName={channelsBulkCountTextClassName}
      clearButtonClassName={channelsBulkClearButtonClassName}
      separatorClassName='bg-white/15'
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size='sm'
              className={channelTestDialogOutlineButtonClassName}
              onClick={() => onTestSelected(selectedModels)}
              disabled={disabled || selectedModels.length === 0}
            />
          }
        >
          {disabled ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              {t('Testing...')}
            </>
          ) : (
            buttonLabel
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('Run tests for the selected models')}</p>
        </TooltipContent>
      </Tooltip>
    </BulkActionsToolbar>
  )
}
