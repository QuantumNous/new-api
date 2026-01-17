import { useState, useMemo, memo, useCallback, useEffect } from 'react'
import {
  type ColumnDef,
  type VisibilityState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTableColumnHeader,
  DataTableToolbar,
  DataTablePagination,
} from '@/components/data-table'
import { safeJsonParse } from '../utils/json-parser'
import { ModelRatioDialog, type ModelRatioData } from './model-ratio-dialog'

type ModelRatioVisualEditorProps = {
  modelPrice: string
  modelRatio: string
  cacheRatio: string
  completionRatio: string
  imageRatio: string
  audioRatio: string
  audioCompletionRatio: string
  onChange: (field: string, value: string) => void
}

type ModelRow = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  hasConflict: boolean
}

const STORAGE_KEY = 'model-ratio-column-visibility'

const formatValue = (value?: string) => {
  if (!value || value === '') return '—'
  return value
}

export const ModelRatioVisualEditor = memo(
  function ModelRatioVisualEditor({
    modelPrice,
    modelRatio,
    cacheRatio,
    completionRatio,
    imageRatio,
    audioRatio,
    audioCompletionRatio,
    onChange,
  }: ModelRatioVisualEditorProps) {
    const { t } = useTranslation()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editData, setEditData] = useState<ModelRatioData | null>(null)
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
      () => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          try {
            return safeJsonParse<VisibilityState>(saved, {
              fallback: {
                cacheRatio: false,
                imageRatio: false,
                audioRatio: false,
                audioCompletionRatio: false,
              },
              silent: true,
            })
          } catch {
            return {
              cacheRatio: false,
              imageRatio: false,
              audioRatio: false,
              audioCompletionRatio: false,
            }
          }
        }
        return {
          cacheRatio: false,
          imageRatio: false,
          audioRatio: false,
          audioCompletionRatio: false,
        }
      }
    )

    useEffect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility))
    }, [columnVisibility])

    const models = useMemo(() => {
      const priceMap = safeJsonParse<Record<string, number>>(modelPrice, {
        fallback: {},
        context: 'model prices',
      })
      const ratioMap = safeJsonParse<Record<string, number>>(modelRatio, {
        fallback: {},
        context: 'model ratios',
      })
      const cacheMap = safeJsonParse<Record<string, number>>(cacheRatio, {
        fallback: {},
        context: 'cache ratios',
      })
      const completionMap = safeJsonParse<Record<string, number>>(
        completionRatio,
        { fallback: {}, context: 'completion ratios' }
      )
      const imageMap = safeJsonParse<Record<string, number>>(imageRatio, {
        fallback: {},
        context: 'image ratios',
      })
      const audioMap = safeJsonParse<Record<string, number>>(audioRatio, {
        fallback: {},
        context: 'audio ratios',
      })
      const audioCompletionMap = safeJsonParse<Record<string, number>>(
        audioCompletionRatio,
        { fallback: {}, context: 'audio completion ratios' }
      )

      const modelNames = new Set([
        ...Object.keys(priceMap),
        ...Object.keys(ratioMap),
        ...Object.keys(cacheMap),
        ...Object.keys(completionMap),
        ...Object.keys(imageMap),
        ...Object.keys(audioMap),
        ...Object.keys(audioCompletionMap),
      ])

      const modelData: ModelRow[] = Array.from(modelNames).map((name) => {
        const price = priceMap[name]?.toString() || ''
        const ratio = ratioMap[name]?.toString() || ''
        const cache = cacheMap[name]?.toString() || ''
        const completion = completionMap[name]?.toString() || ''
        const image = imageMap[name]?.toString() || ''
        const audio = audioMap[name]?.toString() || ''
        const audioCompletion = audioCompletionMap[name]?.toString() || ''

        return {
          name,
          price,
          ratio,
          cacheRatio: cache,
          completionRatio: completion,
          imageRatio: image,
          audioRatio: audio,
          audioCompletionRatio: audioCompletion,
          hasConflict:
            price !== '' &&
            (ratio !== '' ||
              completion !== '' ||
              cache !== '' ||
              image !== '' ||
              audio !== '' ||
              audioCompletion !== ''),
        }
      })

      return modelData.sort((a, b) => a.name.localeCompare(b.name))
    }, [
      modelPrice,
      modelRatio,
      cacheRatio,
      completionRatio,
      imageRatio,
      audioRatio,
      audioCompletionRatio,
    ])

    const handleEdit = useCallback((model: ModelRow) => {
      setEditData(model)
      setDialogOpen(true)
    }, [])

    const handleAdd = useCallback(() => {
      setEditData(null)
      setDialogOpen(true)
    }, [])

    const handleDelete = useCallback(
      (name: string) => {
        const priceMap = safeJsonParse<Record<string, number>>(modelPrice, {
          fallback: {},
          silent: true,
        })
        const ratioMap = safeJsonParse<Record<string, number>>(modelRatio, {
          fallback: {},
          silent: true,
        })
        const cacheMap = safeJsonParse<Record<string, number>>(cacheRatio, {
          fallback: {},
          silent: true,
        })
        const completionMap = safeJsonParse<Record<string, number>>(
          completionRatio,
          { fallback: {}, silent: true }
        )
        const imageMap = safeJsonParse<Record<string, number>>(imageRatio, {
          fallback: {},
          silent: true,
        })
        const audioMap = safeJsonParse<Record<string, number>>(audioRatio, {
          fallback: {},
          silent: true,
        })
        const audioCompletionMap = safeJsonParse<Record<string, number>>(
          audioCompletionRatio,
          { fallback: {}, silent: true }
        )

        delete priceMap[name]
        delete ratioMap[name]
        delete cacheMap[name]
        delete completionMap[name]
        delete imageMap[name]
        delete audioMap[name]
        delete audioCompletionMap[name]

        onChange('ModelPrice', JSON.stringify(priceMap, null, 2))
        onChange('ModelRatio', JSON.stringify(ratioMap, null, 2))
        onChange('CacheRatio', JSON.stringify(cacheMap, null, 2))
        onChange('CompletionRatio', JSON.stringify(completionMap, null, 2))
        onChange('ImageRatio', JSON.stringify(imageMap, null, 2))
        onChange('AudioRatio', JSON.stringify(audioMap, null, 2))
        onChange(
          'AudioCompletionRatio',
          JSON.stringify(audioCompletionMap, null, 2)
        )
      },
      [
        modelPrice,
        modelRatio,
        cacheRatio,
        completionRatio,
        imageRatio,
        audioRatio,
        audioCompletionRatio,
        onChange,
      ]
    )

    const columns = useMemo<ColumnDef<ModelRow>[]>(
      () => [
        {
          accessorKey: 'name',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Model name')} />
          ),
          cell: ({ row }) => (
            <div className='flex items-center gap-2 font-medium'>
              {row.getValue('name')}
              {row.original.hasConflict && (
                <Badge variant='destructive' className='text-xs'>
                  {t('Conflict')}
                </Badge>
              )}
            </div>
          ),
          enableHiding: false,
        },
        {
          accessorKey: 'price',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Fixed price')} />
          ),
          cell: ({ row }) => formatValue(row.getValue('price')),
          meta: { label: 'Fixed price' },
        },
        {
          accessorKey: 'ratio',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Ratio')} />
          ),
          cell: ({ row }) => (
            <span className={row.original.price ? 'text-muted-foreground' : ''}>
              {formatValue(row.getValue('ratio'))}
            </span>
          ),
          meta: { label: 'Ratio' },
        },
        {
          accessorKey: 'completionRatio',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Completion')} />
          ),
          cell: ({ row }) => (
            <span className={row.original.price ? 'text-muted-foreground' : ''}>
              {formatValue(row.getValue('completionRatio'))}
            </span>
          ),
          meta: { label: 'Completion' },
        },
        {
          accessorKey: 'cacheRatio',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Cache')} />
          ),
          cell: ({ row }) => (
            <span className={row.original.price ? 'text-muted-foreground' : ''}>
              {formatValue(row.getValue('cacheRatio'))}
            </span>
          ),
          meta: { label: 'Cache' },
        },
        {
          accessorKey: 'imageRatio',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Image')} />
          ),
          cell: ({ row }) => (
            <span className={row.original.price ? 'text-muted-foreground' : ''}>
              {formatValue(row.getValue('imageRatio'))}
            </span>
          ),
          meta: { label: 'Image' },
        },
        {
          accessorKey: 'audioRatio',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Audio')} />
          ),
          cell: ({ row }) => (
            <span className={row.original.price ? 'text-muted-foreground' : ''}>
              {formatValue(row.getValue('audioRatio'))}
            </span>
          ),
          meta: { label: 'Audio' },
        },
        {
          accessorKey: 'audioCompletionRatio',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Audio comp.')} />
          ),
          cell: ({ row }) => (
            <span className={row.original.price ? 'text-muted-foreground' : ''}>
              {formatValue(row.getValue('audioCompletionRatio'))}
            </span>
          ),
          meta: { label: 'Audio comp.' },
        },
        {
          id: 'actions',
          cell: ({ row }) => (
            <div className='flex justify-end gap-2'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => handleEdit(row.original)}
              >
                <Pencil className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => handleDelete(row.original.name)}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          ),
          enableHiding: false,
        },
      ],
      [handleEdit, handleDelete]
    )

    const table = useReactTable({
      data: models,
      columns,
      state: {
        sorting,
        columnVisibility,
        pagination: {
          pageIndex: 0,
          pageSize: 10,
        },
      },
      onSortingChange: setSorting,
      onColumnVisibilityChange: setColumnVisibility,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      globalFilterFn: (row, _columnId, filterValue) => {
        const searchValue = String(filterValue).toLowerCase()
        return row.original.name.toLowerCase().includes(searchValue)
      },
    })

    const handleSave = useCallback(
      (data: ModelRatioData) => {
        const priceMap = safeJsonParse<Record<string, number>>(modelPrice, {
          fallback: {},
          silent: true,
        })
        const ratioMap = safeJsonParse<Record<string, number>>(modelRatio, {
          fallback: {},
          silent: true,
        })
        const cacheMap = safeJsonParse<Record<string, number>>(cacheRatio, {
          fallback: {},
          silent: true,
        })
        const completionMap = safeJsonParse<Record<string, number>>(
          completionRatio,
          { fallback: {}, silent: true }
        )
        const imageMap = safeJsonParse<Record<string, number>>(imageRatio, {
          fallback: {},
          silent: true,
        })
        const audioMap = safeJsonParse<Record<string, number>>(audioRatio, {
          fallback: {},
          silent: true,
        })
        const audioCompletionMap = safeJsonParse<Record<string, number>>(
          audioCompletionRatio,
          { fallback: {}, silent: true }
        )

        // Remove from all maps first (in case of edit or mode switch)
        delete priceMap[data.name]
        delete ratioMap[data.name]
        delete cacheMap[data.name]
        delete completionMap[data.name]
        delete imageMap[data.name]
        delete audioMap[data.name]
        delete audioCompletionMap[data.name]

        // Add to appropriate maps based on data
        if (data.price && data.price !== '') {
          priceMap[data.name] = parseFloat(data.price)
        } else {
          if (data.ratio && data.ratio !== '')
            ratioMap[data.name] = parseFloat(data.ratio)
          if (data.cacheRatio && data.cacheRatio !== '')
            cacheMap[data.name] = parseFloat(data.cacheRatio)
          if (data.completionRatio && data.completionRatio !== '')
            completionMap[data.name] = parseFloat(data.completionRatio)
          if (data.imageRatio && data.imageRatio !== '')
            imageMap[data.name] = parseFloat(data.imageRatio)
          if (data.audioRatio && data.audioRatio !== '')
            audioMap[data.name] = parseFloat(data.audioRatio)
          if (data.audioCompletionRatio && data.audioCompletionRatio !== '')
            audioCompletionMap[data.name] = parseFloat(
              data.audioCompletionRatio
            )
        }

        onChange('ModelPrice', JSON.stringify(priceMap, null, 2))
        onChange('ModelRatio', JSON.stringify(ratioMap, null, 2))
        onChange('CacheRatio', JSON.stringify(cacheMap, null, 2))
        onChange('CompletionRatio', JSON.stringify(completionMap, null, 2))
        onChange('ImageRatio', JSON.stringify(imageMap, null, 2))
        onChange('AudioRatio', JSON.stringify(audioMap, null, 2))
        onChange(
          'AudioCompletionRatio',
          JSON.stringify(audioCompletionMap, null, 2)
        )
      },
      [
        modelPrice,
        modelRatio,
        cacheRatio,
        completionRatio,
        imageRatio,
        audioRatio,
        audioCompletionRatio,
        onChange,
      ]
    )

    return (
      <div className='space-y-4'>
        <div className='flex items-center justify-between gap-4'>
          <DataTableToolbar
            table={table}
            searchPlaceholder={t('Search models...')}
          />
          <Button onClick={handleAdd}>
            <Plus className='mr-2 h-4 w-4' />
            {t('Add model')}
          </Button>
        </div>

        {table.getRowModel().rows.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center'>
            {table.getState().globalFilter
              ? t('No models match your search')
              : t('No models configured. Click "Add model" to get started.')}
          </div>
        ) : (
          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
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
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
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
        )}

        {table.getRowModel().rows.length > 0 && (
          <DataTablePagination table={table} />
        )}

        <ModelRatioDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleSave}
          editData={editData}
        />
      </div>
    )
  },
  // Custom equality check - only re-render if JSON props actually changed
  (prevProps, nextProps) => {
    return (
      prevProps.modelPrice === nextProps.modelPrice &&
      prevProps.modelRatio === nextProps.modelRatio &&
      prevProps.cacheRatio === nextProps.cacheRatio &&
      prevProps.completionRatio === nextProps.completionRatio &&
      prevProps.imageRatio === nextProps.imageRatio &&
      prevProps.audioRatio === nextProps.audioRatio &&
      prevProps.audioCompletionRatio === nextProps.audioCompletionRatio &&
      prevProps.onChange === nextProps.onChange
    )
  }
)
