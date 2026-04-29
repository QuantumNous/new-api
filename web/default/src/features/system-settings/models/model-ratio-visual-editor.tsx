import { useState, useMemo, memo, useCallback, useEffect } from 'react'
import {
  type ColumnDef,
  type PaginationState,
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
import { StatusBadge } from '@/components/status-badge'
import {
  combineBillingExpr,
  splitBillingExprAndRequestRules,
} from '@/features/pricing/lib/billing-expr'
import { safeJsonParse } from '../utils/json-parser'
import { ModelRatioDialog, type ModelRatioData } from './model-ratio-dialog'

type ModelRatioVisualEditorProps = {
  modelPrice: string
  modelRatio: string
  cacheRatio: string
  createCacheRatio: string
  completionRatio: string
  imageRatio: string
  audioRatio: string
  audioCompletionRatio: string
  billingMode: string
  billingExpr: string
  onChange: (field: string, value: string) => void
}

type ModelRow = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  createCacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  billingMode?: string
  billingExpr?: string
  requestRuleExpr?: string
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
    createCacheRatio,
    completionRatio,
    imageRatio,
    audioRatio,
    audioCompletionRatio,
    billingMode,
    billingExpr,
    onChange,
  }: ModelRatioVisualEditorProps) {
    const { t } = useTranslation()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editData, setEditData] = useState<ModelRatioData | null>(null)
    const [sorting, setSorting] = useState<SortingState>([])
    const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 10,
    })
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
              createCacheRatio: false,
              imageRatio: false,
              audioRatio: false,
              audioCompletionRatio: false,
            }
          }
        }
        return {
          cacheRatio: false,
          createCacheRatio: false,
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
      const createCacheMap = safeJsonParse<Record<string, number>>(
        createCacheRatio,
        { fallback: {}, context: 'create cache ratios' }
      )
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
      const billingModeMap = safeJsonParse<Record<string, string>>(
        billingMode,
        {
          fallback: {},
          context: 'billing mode',
        }
      )
      const billingExprMap = safeJsonParse<Record<string, string>>(
        billingExpr,
        {
          fallback: {},
          context: 'billing expression',
        }
      )

      const modelNames = new Set([
        ...Object.keys(priceMap),
        ...Object.keys(ratioMap),
        ...Object.keys(cacheMap),
        ...Object.keys(createCacheMap),
        ...Object.keys(completionMap),
        ...Object.keys(imageMap),
        ...Object.keys(audioMap),
        ...Object.keys(audioCompletionMap),
        ...Object.keys(billingModeMap),
        ...Object.keys(billingExprMap),
      ])

      const modelData: ModelRow[] = Array.from(modelNames).map((name) => {
        const price = priceMap[name]?.toString() || ''
        const ratio = ratioMap[name]?.toString() || ''
        const cache = cacheMap[name]?.toString() || ''
        const createCache = createCacheMap[name]?.toString() || ''
        const completion = completionMap[name]?.toString() || ''
        const image = imageMap[name]?.toString() || ''
        const audio = audioMap[name]?.toString() || ''
        const audioCompletion = audioCompletionMap[name]?.toString() || ''

        const modeForModel = billingModeMap[name]
        if (modeForModel === 'tiered_expr') {
          // Tiered_expr models may also retain ratio/price values as fallback
          // during multi-instance sync delays. We preserve them in the row so
          // the edit dialog round-trip and the next save don't drop them.
          const fullExpr = billingExprMap[name] || ''
          const { billingExpr: pureExpr, requestRuleExpr } =
            splitBillingExprAndRequestRules(fullExpr)
          return {
            name,
            billingMode: 'tiered_expr',
            billingExpr: pureExpr,
            requestRuleExpr,
            price,
            ratio,
            cacheRatio: cache,
            createCacheRatio: createCache,
            completionRatio: completion,
            imageRatio: image,
            audioRatio: audio,
            audioCompletionRatio: audioCompletion,
            hasConflict: false,
          }
        }

        return {
          name,
          price,
          ratio,
          cacheRatio: cache,
          createCacheRatio: createCache,
          completionRatio: completion,
          imageRatio: image,
          audioRatio: audio,
          audioCompletionRatio: audioCompletion,
          billingMode: price !== '' ? 'per-request' : 'per-token',
          hasConflict:
            price !== '' &&
            (ratio !== '' ||
              completion !== '' ||
              cache !== '' ||
              createCache !== '' ||
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
      createCacheRatio,
      completionRatio,
      imageRatio,
      audioRatio,
      audioCompletionRatio,
      billingMode,
      billingExpr,
    ])

    const handleEdit = useCallback((model: ModelRow) => {
      setEditData({
        name: model.name,
        price: model.price,
        ratio: model.ratio,
        cacheRatio: model.cacheRatio,
        createCacheRatio: model.createCacheRatio,
        completionRatio: model.completionRatio,
        imageRatio: model.imageRatio,
        audioRatio: model.audioRatio,
        audioCompletionRatio: model.audioCompletionRatio,
        billingMode:
          model.billingMode === 'tiered_expr'
            ? 'tiered_expr'
            : model.price && model.price !== ''
              ? 'per-request'
              : 'per-token',
        billingExpr: model.billingExpr,
        requestRuleExpr: model.requestRuleExpr,
      })
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
        const createCacheMap = safeJsonParse<Record<string, number>>(
          createCacheRatio,
          { fallback: {}, silent: true }
        )
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
        const billingModeMap = safeJsonParse<Record<string, string>>(
          billingMode,
          { fallback: {}, silent: true }
        )
        const billingExprMap = safeJsonParse<Record<string, string>>(
          billingExpr,
          { fallback: {}, silent: true }
        )

        delete priceMap[name]
        delete ratioMap[name]
        delete cacheMap[name]
        delete createCacheMap[name]
        delete completionMap[name]
        delete imageMap[name]
        delete audioMap[name]
        delete audioCompletionMap[name]
        delete billingModeMap[name]
        delete billingExprMap[name]

        onChange('ModelPrice', JSON.stringify(priceMap, null, 2))
        onChange('ModelRatio', JSON.stringify(ratioMap, null, 2))
        onChange('CacheRatio', JSON.stringify(cacheMap, null, 2))
        onChange('CreateCacheRatio', JSON.stringify(createCacheMap, null, 2))
        onChange('CompletionRatio', JSON.stringify(completionMap, null, 2))
        onChange('ImageRatio', JSON.stringify(imageMap, null, 2))
        onChange('AudioRatio', JSON.stringify(audioMap, null, 2))
        onChange(
          'AudioCompletionRatio',
          JSON.stringify(audioCompletionMap, null, 2)
        )
        onChange(
          'billing_setting.billing_mode',
          JSON.stringify(billingModeMap, null, 2)
        )
        onChange(
          'billing_setting.billing_expr',
          JSON.stringify(billingExprMap, null, 2)
        )
      },
      [
        modelPrice,
        modelRatio,
        cacheRatio,
        createCacheRatio,
        completionRatio,
        imageRatio,
        audioRatio,
        audioCompletionRatio,
        billingMode,
        billingExpr,
        onChange,
      ]
    )

    const columns = useMemo<ColumnDef<ModelRow>[]>(() => {
      // Ratio fields are not the primary pricing when a per-request fixed
      // price is set, or when the model is in tiered_expr mode (the
      // expression is primary; ratios are fallback during sync delays).
      const isFallbackRow = (row: ModelRow) =>
        row.billingMode === 'tiered_expr' || !!row.price
      const fallbackClass = (row: ModelRow) =>
        isFallbackRow(row) ? 'text-muted-foreground' : ''

      return [
        {
          accessorKey: 'name',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Model name')} />
          ),
          cell: ({ row }) => (
            <div className='flex items-center gap-2 font-medium'>
              {row.getValue('name')}
              {row.original.billingMode === 'tiered_expr' && (
                <StatusBadge
                  label={t('Tiered')}
                  variant='info'
                  copyable={false}
                />
              )}
              {row.original.hasConflict && (
                <StatusBadge
                  label={t('Conflict')}
                  variant='danger'
                  copyable={false}
                />
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
          cell: ({ row }) => (
            <span
              className={
                row.original.billingMode === 'tiered_expr'
                  ? 'text-muted-foreground'
                  : ''
              }
            >
              {formatValue(row.getValue('price'))}
            </span>
          ),
          meta: { label: 'Fixed price' },
        },
        {
          accessorKey: 'ratio',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Ratio')} />
          ),
          cell: ({ row }) => (
            <span className={fallbackClass(row.original)}>
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
            <span className={fallbackClass(row.original)}>
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
            <span className={fallbackClass(row.original)}>
              {formatValue(row.getValue('cacheRatio'))}
            </span>
          ),
          meta: { label: 'Cache' },
        },
        {
          accessorKey: 'createCacheRatio',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Create cache')} />
          ),
          cell: ({ row }) => (
            <span className={fallbackClass(row.original)}>
              {formatValue(row.getValue('createCacheRatio'))}
            </span>
          ),
          meta: { label: 'Create cache' },
        },
        {
          accessorKey: 'imageRatio',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Image')} />
          ),
          cell: ({ row }) => (
            <span className={fallbackClass(row.original)}>
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
            <span className={fallbackClass(row.original)}>
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
            <span className={fallbackClass(row.original)}>
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
      ]
    }, [handleEdit, handleDelete, t])

    const table = useReactTable({
      data: models,
      columns,
      state: {
        sorting,
        columnVisibility,
        pagination,
      },
      onSortingChange: setSorting,
      onColumnVisibilityChange: setColumnVisibility,
      onPaginationChange: setPagination,
      autoResetPageIndex: false,
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
        const createCacheMap = safeJsonParse<Record<string, number>>(
          createCacheRatio,
          { fallback: {}, silent: true }
        )
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
        const billingModeMap = safeJsonParse<Record<string, string>>(
          billingMode,
          { fallback: {}, silent: true }
        )
        const billingExprMap = safeJsonParse<Record<string, string>>(
          billingExpr,
          { fallback: {}, silent: true }
        )

        delete priceMap[data.name]
        delete ratioMap[data.name]
        delete cacheMap[data.name]
        delete createCacheMap[data.name]
        delete completionMap[data.name]
        delete imageMap[data.name]
        delete audioMap[data.name]
        delete audioCompletionMap[data.name]
        delete billingModeMap[data.name]
        delete billingExprMap[data.name]

        const setIfPresent = (
          target: Record<string, number>,
          value: string | undefined
        ) => {
          if (!value || value === '') return
          const parsed = parseFloat(value)
          if (Number.isFinite(parsed)) target[data.name] = parsed
        }

        if (data.billingMode === 'tiered_expr') {
          const combined = combineBillingExpr(
            data.billingExpr || '',
            data.requestRuleExpr || ''
          )
          if (combined) {
            billingModeMap[data.name] = 'tiered_expr'
            billingExprMap[data.name] = combined
          }
          // Always serialize ratio/price values for tiered_expr models so they
          // serve as fallback during multi-instance sync delays. The backend's
          // ModelPriceHelper checks billing_mode first, so these values are
          // only consulted when billing_setting hasn't propagated yet.
          setIfPresent(priceMap, data.price)
          setIfPresent(ratioMap, data.ratio)
          setIfPresent(cacheMap, data.cacheRatio)
          setIfPresent(createCacheMap, data.createCacheRatio)
          setIfPresent(completionMap, data.completionRatio)
          setIfPresent(imageMap, data.imageRatio)
          setIfPresent(audioMap, data.audioRatio)
          setIfPresent(audioCompletionMap, data.audioCompletionRatio)
        } else if (data.price && data.price !== '') {
          setIfPresent(priceMap, data.price)
        } else {
          setIfPresent(ratioMap, data.ratio)
          setIfPresent(cacheMap, data.cacheRatio)
          setIfPresent(createCacheMap, data.createCacheRatio)
          setIfPresent(completionMap, data.completionRatio)
          setIfPresent(imageMap, data.imageRatio)
          setIfPresent(audioMap, data.audioRatio)
          setIfPresent(audioCompletionMap, data.audioCompletionRatio)
        }

        onChange('ModelPrice', JSON.stringify(priceMap, null, 2))
        onChange('ModelRatio', JSON.stringify(ratioMap, null, 2))
        onChange('CacheRatio', JSON.stringify(cacheMap, null, 2))
        onChange('CreateCacheRatio', JSON.stringify(createCacheMap, null, 2))
        onChange('CompletionRatio', JSON.stringify(completionMap, null, 2))
        onChange('ImageRatio', JSON.stringify(imageMap, null, 2))
        onChange('AudioRatio', JSON.stringify(audioMap, null, 2))
        onChange(
          'AudioCompletionRatio',
          JSON.stringify(audioCompletionMap, null, 2)
        )
        onChange(
          'billing_setting.billing_mode',
          JSON.stringify(billingModeMap, null, 2)
        )
        onChange(
          'billing_setting.billing_expr',
          JSON.stringify(billingExprMap, null, 2)
        )
      },
      [
        modelPrice,
        modelRatio,
        cacheRatio,
        createCacheRatio,
        completionRatio,
        imageRatio,
        audioRatio,
        audioCompletionRatio,
        billingMode,
        billingExpr,
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
      prevProps.createCacheRatio === nextProps.createCacheRatio &&
      prevProps.completionRatio === nextProps.completionRatio &&
      prevProps.imageRatio === nextProps.imageRatio &&
      prevProps.audioRatio === nextProps.audioRatio &&
      prevProps.audioCompletionRatio === nextProps.audioCompletionRatio &&
      prevProps.billingMode === nextProps.billingMode &&
      prevProps.billingExpr === nextProps.billingExpr &&
      prevProps.onChange === nextProps.onChange
    )
  }
)
