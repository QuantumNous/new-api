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
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  Search,
  Info,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import { applyUpstreamOverwrite } from '../../api'
import { modelsQueryKeys, vendorsQueryKeys } from '../../lib'
import type { SyncOverwritePayload } from '../../types'
import { useModels } from '../models-provider'

const FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  icon: 'Icon',
  tags: 'Tags',
  vendor: 'Vendor',
  name_rule: 'Name Rule',
  status: 'Status',
  endpoints: 'Endpoints',
  quota_types: 'Quota Types',
  enable_groups: 'Enable Groups',
}

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value || '—'
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

type UpstreamConflictDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ConflictFieldRow = {
  id: string
  modelName: string
  fieldKey: string
  fieldLabel: string
  localValue: unknown
  upstreamValue: unknown
}

function ValuePreview({ value }: { value: unknown }) {
  return (
    <pre className='bg-muted/70 text-muted-foreground max-h-32 overflow-auto rounded-md border px-2 py-1.5 font-mono text-xs break-words whitespace-pre-wrap'>
      {formatValue(value)}
    </pre>
  )
}

export function UpstreamConflictDialog({
  open,
  onOpenChange,
}: UpstreamConflictDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    upstreamConflicts = [],
    setUpstreamConflicts,
    syncWizardOptions,
  } = useModels()
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageSize, setPageSize] = useState(10)
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    if (open) {
      setRowSelection({})
      setSearch('')
      setPageIndex(0)
    }
  }, [open, upstreamConflicts])

  const conflictRows = useMemo<ConflictFieldRow[]>(() => {
    return upstreamConflicts.flatMap((conflict) => {
      if (!conflict.fields?.length) {
        return []
      }

      return conflict.fields.map((field) => ({
        id: `${conflict.model_name}-${field.field}`,
        modelName: conflict.model_name,
        fieldKey: field.field,
        fieldLabel: FIELD_LABELS[field.field] || field.field,
        localValue: field.local,
        upstreamValue: field.upstream,
      }))
    })
  }, [upstreamConflicts])

  const totalModels = upstreamConflicts.length
  const totalFields = conflictRows.length
  const normalizedSearch = search.trim().toLowerCase()

  const { matchingModelNames, visibleRowIds } = useMemo(() => {
    if (!normalizedSearch) {
      return { matchingModelNames: null, visibleRowIds: null }
    }

    const modelMatches = new Set<string>()
    upstreamConflicts.forEach((conflict) => {
      const modelMatch = conflict.model_name
        ?.toLowerCase()
        .includes(normalizedSearch)

      if (modelMatch) {
        modelMatches.add(conflict.model_name)
        return
      }

      const fieldMatch = conflict.fields?.some((field) => {
        const label = FIELD_LABELS[field.field] || field.field
        return (
          label.toLowerCase().includes(normalizedSearch) ||
          field.field.toLowerCase().includes(normalizedSearch)
        )
      })

      if (fieldMatch) {
        modelMatches.add(conflict.model_name)
      }
    })

    const rowIdSet = new Set<string>()
    conflictRows.forEach((row) => {
      if (
        modelMatches.has(row.modelName) ||
        row.fieldLabel.toLowerCase().includes(normalizedSearch) ||
        row.fieldKey.toLowerCase().includes(normalizedSearch)
      ) {
        rowIdSet.add(row.id)
      }
    })

    return { matchingModelNames: modelMatches, visibleRowIds: rowIdSet }
  }, [normalizedSearch, upstreamConflicts, conflictRows])

  const columns = useMemo<ColumnDef<ConflictFieldRow>[]>(() => {
    const modelColumn: ColumnDef<ConflictFieldRow> = {
      accessorKey: 'modelName',
      header: 'Model',
      cell: ({ row }) => (
        <div className='flex items-start gap-3'>
          {isMobile ? (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label='Select row'
            />
          ) : null}
          <div className='space-y-1'>
            <p className='leading-none font-medium'>{row.original.modelName}</p>
            <span className='text-muted-foreground font-mono text-xs'>
              {row.original.fieldKey}
            </span>
            {isMobile ? (
              <StatusBadge
                label={row.original.fieldLabel}
                variant='neutral'
                size='sm'
                copyable={false}
              />
            ) : null}
          </div>
        </div>
      ),
      size: 220,
    }

    const diffColumn: ColumnDef<ConflictFieldRow> = {
      id: 'actions',
      header: 'Diff',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant='ghost'
                size='sm'
                className={isMobile ? 'h-7 w-7 p-0' : 'h-7 gap-2 px-2 text-xs'}
              />
            }
          >
            <MousePointerClick className='h-3.5 w-3.5' />
            {!isMobile && 'View diff'}
          </PopoverTrigger>
          <PopoverContent className='w-[min(90vw,24rem)] space-y-4 text-sm'>
            <div>
              <StatusBadge
                label='Local'
                variant='neutral'
                size='sm'
                copyable={false}
                className='mb-1'
              />
              <pre className='bg-muted rounded-md p-2 text-xs'>
                {formatValue(row.original.localValue)}
              </pre>
            </div>
            <div>
              <StatusBadge
                label='Upstream'
                variant='info'
                size='sm'
                copyable={false}
                className='mb-1'
              />
              <pre className='bg-muted rounded-md p-2 text-xs'>
                {formatValue(row.original.upstreamValue)}
              </pre>
            </div>
          </PopoverContent>
        </Popover>
      ),
      size: isMobile ? 50 : 140,
    }

    if (isMobile) {
      return [modelColumn, diffColumn]
    }

    const selectionColumn: ColumnDef<ConflictFieldRow> = {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    }

    return [
      selectionColumn,
      modelColumn,
      {
        accessorKey: 'fieldLabel',
        header: 'Field',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.fieldLabel}
            variant='neutral'
            size='sm'
            copyable={false}
          />
        ),
        enableSorting: false,
        size: 160,
      },
      {
        accessorKey: 'localValue',
        header: 'Local Value',
        cell: ({ row }) => <ValuePreview value={row.original.localValue} />,
      },
      {
        accessorKey: 'upstreamValue',
        header: 'Upstream Value',
        cell: ({ row }) => <ValuePreview value={row.original.upstreamValue} />,
      },
    ]
  }, [isMobile])

  const table = useReactTable({
    data: conflictRows,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  })

  const totalSelectedFields = table.getSelectedRowModel().rows.length
  const hasSelection = totalSelectedFields > 0
  const allRows = table.getRowModel().rows
  const filteredRows = visibleRowIds
    ? allRows.filter((row) => visibleRowIds.has(row.id))
    : allRows

  const totalFilteredFields = filteredRows.length
  const totalPages =
    totalFilteredFields === 0 ? 1 : Math.ceil(totalFilteredFields / pageSize)

  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, Math.max(0, totalPages - 1)))
  }, [totalPages])

  const pageStart = pageIndex * pageSize
  const paginatedRows = filteredRows.slice(pageStart, pageStart + pageSize)
  const displayStart = totalFilteredFields === 0 ? 0 : pageStart + 1
  const displayEnd =
    totalFilteredFields === 0
      ? 0
      : Math.min(pageStart + pageSize, totalFilteredFields)
  const currentPageDisplay = totalFilteredFields === 0 ? 0 : pageIndex + 1
  const totalPagesDisplay = totalFilteredFields === 0 ? 0 : totalPages

  const visibleModelCount = matchingModelNames?.size ?? totalModels
  const visibleFieldCount = totalFilteredFields
  const hasConflicts = totalFields > 0
  const showSearchEmptyState = hasConflicts && totalFilteredFields === 0

  const clearSelections = useCallback(() => {
    setRowSelection({})
  }, [])

  const handleApplyOverwrite = async () => {
    const selectedRows = table.getSelectedRowModel().rows
    const groupedSelections = selectedRows.reduce<Record<string, Set<string>>>(
      (acc, row) => {
        const key = row.original.modelName
        if (!acc[key]) {
          acc[key] = new Set()
        }
        acc[key].add(row.original.fieldKey)
        return acc
      },
      {}
    )

    const payload: SyncOverwritePayload[] = Object.entries(groupedSelections)
      .map(([modelName, fields]) => ({
        model_name: modelName,
        fields: Array.from(fields),
      }))
      .filter((item) => item.fields.length > 0)

    if (payload.length === 0) {
      toast.warning(t('Select at least one field to overwrite.'))
      return
    }

    setIsSubmitting(true)
    try {
      const response = await applyUpstreamOverwrite({
        overwrite: payload,
        locale: syncWizardOptions.locale,
        source: syncWizardOptions.source,
      })

      if (response.success) {
        toast.success(t('Selected conflicts were overwritten successfully.'))
        queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
        queryClient.invalidateQueries({ queryKey: vendorsQueryKeys.lists() })
        setUpstreamConflicts([])
        onOpenChange(false)
      } else {
        toast.error(response.message || t('Failed to apply overwrite.'))
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || t('Failed to apply overwrite.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setUpstreamConflicts([])
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className='flex max-h-[90vh] w-full flex-col gap-4 p-4 sm:max-w-5xl sm:p-6'
        initialFocus={!isMobile}
      >
        <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden'>
          <DialogHeader className='flex-shrink-0 text-start'>
            <DialogTitle>{t('Resolve Conflicts')}</DialogTitle>
            <DialogDescription>
              {t(
                'Select the fields you want to overwrite with upstream data. Unselected fields keep their local values.'
              )}
            </DialogDescription>
          </DialogHeader>

          {!hasConflicts ? (
            <div className='text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed p-8 text-center text-sm'>
              {t('No conflict entries available.')}
            </div>
          ) : (
            <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='space-y-1'>
                  <div className='text-sm font-medium'>
                    {visibleModelCount} {t('model')}
                    {visibleModelCount === 1 ? '' : 's'} {t('with conflicts')}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {visibleFieldCount} {t('field')}
                    {visibleFieldCount === 1 ? '' : 's'} {t('showing •')}{' '}
                    {totalSelectedFields} {t('selected')}
                  </div>
                </div>
                <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row'>
                  <div className='relative flex-1'>
                    <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                    <Input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value)
                        setPageIndex(0)
                      }}
                      placeholder={t('Search models or fields...')}
                      className='pl-9'
                      aria-label={t('Search conflicting models or fields')}
                    />
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={clearSelections}
                    disabled={!hasSelection}
                  >
                    {t('Clear selection')}
                  </Button>
                </div>
              </div>

              {showSearchEmptyState ? (
                <div className='text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed p-8 text-center text-sm'>
                  {t('No conflicts match your search.')}
                </div>
              ) : (
                <div className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border'>
                  <div className='flex-1 overflow-auto'>
                    <div className={isMobile ? 'min-w-full' : 'min-w-[720px]'}>
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
                          {paginatedRows.map((row) => (
                            <TableRow
                              key={row.id}
                              data-state={row.getIsSelected() && 'selected'}
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
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className='bg-muted/40 flex flex-col gap-2 border-t px-2 py-1.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3 sm:py-2'>
                    <div className='text-muted-foreground text-xs'>
                      {t('Showing')} {displayStart}-{displayEnd} {t('of')}{' '}
                      {visibleFieldCount} {t('field')}
                      {visibleFieldCount === 1 ? '' : 's'}
                    </div>
                    <div className='flex items-center justify-between gap-2 sm:flex-wrap sm:gap-3'>
                      <div className='flex items-center gap-1.5 text-xs sm:gap-2'>
                        <span className='hidden sm:inline'>
                          {t('Rows per page')}
                        </span>
                        <Select
                          items={[
                            ...[5, 10, 20, 50].map((size) => ({
                              value: String(size),
                              label: size,
                            })),
                          ]}
                          value={String(pageSize)}
                          onValueChange={(value) => {
                            setPageSize(Number(value))
                            setPageIndex(0)
                          }}
                        >
                          <SelectTrigger className='h-8 w-[70px] text-xs sm:h-8 sm:w-[72px]'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false}>
                            <SelectGroup>
                              {[5, 10, 20, 50].map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='flex items-center gap-1'>
                        <Button
                          variant='outline'
                          size='icon'
                          className='h-7 w-7 sm:h-8 sm:w-8'
                          onClick={() =>
                            setPageIndex((prev) => Math.max(0, prev - 1))
                          }
                          disabled={pageIndex === 0}
                          aria-label={t('Previous page')}
                        >
                          <ChevronLeft className='h-3.5 w-3.5 sm:h-4 sm:w-4' />
                        </Button>
                        <span className='text-xs font-medium'>
                          {t('Page {{current}} of {{total}}', {
                            current: currentPageDisplay,
                            total: totalPagesDisplay,
                          })}
                        </span>
                        <Button
                          variant='outline'
                          size='icon'
                          className='h-7 w-7 sm:h-8 sm:w-8'
                          onClick={() =>
                            setPageIndex((prev) =>
                              Math.min(totalPages - 1, prev + 1)
                            )
                          }
                          disabled={
                            pageIndex >= totalPages - 1 ||
                            totalFilteredFields === 0
                          }
                          aria-label={t('Next page')}
                        >
                          <ChevronRight className='h-3.5 w-3.5 sm:h-4 sm:w-4' />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className='flex-shrink-0'>
          <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='text-muted-foreground flex flex-1 items-start gap-2 text-xs'>
              <Info className='h-4 w-4 flex-shrink-0' />
              <span>
                {t(
                  'Only selected fields will be overwritten. You can re-run the sync wizard if new conflicts appear.'
                )}
              </span>
            </div>
            <div className='flex flex-col gap-2 sm:flex-row sm:justify-end'>
              <Button
                variant='outline'
                onClick={() => {
                  setUpstreamConflicts([])
                  onOpenChange(false)
                }}
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={handleApplyOverwrite}
                disabled={isSubmitting || !hasSelection}
              >
                {isSubmitting ? t('Applying...') : t('Apply Overwrite')}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
