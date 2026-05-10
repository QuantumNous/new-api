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
import { useState, useMemo, memo, useCallback, useEffect } from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type VisibilityState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTableBulkActions,
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
import {
  ModelPricingEditorPanel,
  ModelPricingSheet,
  type ModelRatioData,
} from './model-pricing-sheet'

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

const hasValue = (value?: string) => value !== undefined && value !== ''

const toNumberOrNull = (value?: string) => {
  if (!hasValue(value)) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const formatPrice = (value: number) => {
  return Number.parseFloat(value.toFixed(12)).toString()
}

const ratioToPrice = (ratio?: string, denominator?: string) => {
  const ratioNumber = toNumberOrNull(ratio)
  const denominatorNumber = denominator ? toNumberOrNull(denominator) : 2
  if (ratioNumber === null || denominatorNumber === null) return ''
  return formatPrice(ratioNumber * denominatorNumber)
}

const filterBySelectedValues = (
  rowValue: unknown,
  filterValue: unknown
): boolean => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true
  return filterValue.includes(String(rowValue))
}

const getModeLabel = (mode?: string) => {
  if (mode === 'per-request') return 'Per-request'
  if (mode === 'tiered_expr') return 'Expression'
  return 'Per-token'
}

const getModeVariant = (mode?: string): 'warning' | 'info' | 'success' => {
  if (mode === 'per-request') return 'warning'
  if (mode === 'tiered_expr') return 'info'
  return 'success'
}

const getExpressionSummary = (row: ModelRow, t: (key: string) => string) => {
  const tierCount = (row.billingExpr?.match(/tier\(/g) || []).length
  if (tierCount > 0) {
    return `${t('Tiered pricing')} · ${tierCount} ${t('tiers')}`
  }
  return t('Expression pricing')
}

const getPriceSummary = (row: ModelRow, t: (key: string) => string) => {
  if (row.billingMode === 'tiered_expr') {
    return getExpressionSummary(row, t)
  }
  if (row.billingMode === 'per-request') {
    return row.price ? `$${row.price} / ${t('request')}` : t('Unset price')
  }

  const inputPrice = ratioToPrice(row.ratio)
  if (!inputPrice) return t('Unset price')

  const extraCount = [
    row.completionRatio,
    row.cacheRatio,
    row.createCacheRatio,
    row.imageRatio,
    row.audioRatio,
    row.audioCompletionRatio,
  ].filter(hasValue).length

  return extraCount > 0
    ? `${t('Input')} $${inputPrice} · ${extraCount} ${t('extras')}`
    : `${t('Input')} $${inputPrice}`
}

const getPriceDetail = (row: ModelRow, t: (key: string) => string) => {
  if (row.billingMode === 'tiered_expr') {
    return row.requestRuleExpr
      ? t('Includes request rules')
      : t('Expression based')
  }
  if (row.billingMode === 'per-request') {
    return t('Fixed request price')
  }

  const inputPrice = ratioToPrice(row.ratio)
  if (!inputPrice) return t('No base input price')

  const details = [
    row.completionRatio &&
      `${t('Output')} $${ratioToPrice(row.completionRatio, inputPrice)}`,
    row.cacheRatio &&
      `${t('Cache')} $${ratioToPrice(row.cacheRatio, inputPrice)}`,
    row.createCacheRatio &&
      `${t('Cache write')} $${ratioToPrice(row.createCacheRatio, inputPrice)}`,
  ].filter(Boolean)

  return details.length > 0 ? details.join(' · ') : t('Base input price only')
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
    const isMobile = useMediaQuery('(max-width: 767px)')
    const [sheetOpen, setSheetOpen] = useState(false)
    const [editorOpen, setEditorOpen] = useState(false)
    const [editData, setEditData] = useState<ModelRatioData | null>(null)
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [globalFilter, setGlobalFilter] = useState('')
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
    const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 20,
    })
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
      () => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          try {
            return safeJsonParse<VisibilityState>(saved, {
              fallback: {
                cacheRatio: false,
                createCacheRatio: false,
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

    const modeCounts = useMemo(
      () =>
        models.reduce(
          (acc, model) => {
            const mode =
              model.billingMode === 'per-request' ||
              model.billingMode === 'tiered_expr'
                ? model.billingMode
                : 'per-token'
            acc[mode] += 1
            return acc
          },
          {
            'per-token': 0,
            'per-request': 0,
            tiered_expr: 0,
          } as Record<'per-token' | 'per-request' | 'tiered_expr', number>
        ),
      [models]
    )

    const handleEdit = useCallback(
      (model: ModelRow) => {
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
        setEditorOpen(true)
        if (isMobile) setSheetOpen(true)
      },
      [isMobile]
    )

    const handleAdd = useCallback(() => {
      setEditData(null)
      setEditorOpen(true)
      if (isMobile) setSheetOpen(true)
    }, [isMobile])

    const handleCancel = useCallback(() => {
      setEditData(null)
      setEditorOpen(false)
      setSheetOpen(false)
    }, [])

    const handleGlobalFilterChange = useCallback<OnChangeFn<string>>(
      (updater) => {
        setGlobalFilter((previous) => {
          const next =
            typeof updater === 'function' ? updater(previous) : updater
          if (next !== previous) {
            setEditData(null)
            setEditorOpen(false)
            setSheetOpen(false)
          }
          return next
        })
      },
      []
    )

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
      return [
        {
          id: 'select',
          header: ({ table }) => (
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label={t('Select all')}
              className='translate-y-[2px]'
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={t('Select row')}
              className='translate-y-[2px]'
            />
          ),
          enableSorting: false,
          enableHiding: false,
          meta: { label: t('Select') },
        },
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
          accessorKey: 'billingMode',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Mode')} />
          ),
          cell: ({ row }) => (
            <StatusBadge
              label={t(getModeLabel(row.original.billingMode))}
              variant={getModeVariant(row.original.billingMode)}
              copyable={false}
            />
          ),
          filterFn: (row, id, value) =>
            filterBySelectedValues(row.getValue(id), value),
          meta: { label: t('Mode') },
        },
        {
          id: 'priceSummary',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('Price summary')} />
          ),
          cell: ({ row }) => (
            <div className='flex min-w-[180px] flex-col gap-1'>
              <span className='font-medium'>
                {getPriceSummary(row.original, t)}
              </span>
              <span className='text-muted-foreground max-w-[320px] truncate text-xs'>
                {getPriceDetail(row.original, t)}
              </span>
            </div>
          ),
          sortingFn: (rowA, rowB) =>
            getPriceSummary(rowA.original, t).localeCompare(
              getPriceSummary(rowB.original, t)
            ),
          meta: { label: t('Price summary') },
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
                <Pencil />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => handleDelete(row.original.name)}
              >
                <Trash2 />
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
        columnFilters,
        globalFilter,
        columnVisibility,
        pagination,
        rowSelection,
      },
      enableRowSelection: true,
      onSortingChange: setSorting,
      onColumnFiltersChange: setColumnFilters,
      onGlobalFilterChange: handleGlobalFilterChange,
      onColumnVisibilityChange: setColumnVisibility,
      onPaginationChange: setPagination,
      onRowSelectionChange: setRowSelection,
      autoResetPageIndex: false,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getFacetedRowModel: getFacetedRowModel(),
      getFacetedUniqueValues: getFacetedUniqueValues(),
      globalFilterFn: (row, _columnId, filterValue) => {
        const searchValue = String(filterValue).toLowerCase()
        return row.original.name.toLowerCase().includes(searchValue)
      },
    })

    const persistPricingData = useCallback(
      (data: ModelRatioData, targetNames: string[] = [data.name]) => {
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

        const setIfPresent = (
          target: Record<string, number>,
          name: string,
          value: string | undefined
        ) => {
          if (!value || value === '') return
          const parsed = parseFloat(value)
          if (Number.isFinite(parsed)) target[name] = parsed
        }

        targetNames.forEach((name) => {
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

          if (data.billingMode === 'tiered_expr') {
            const combined = combineBillingExpr(
              data.billingExpr || '',
              data.requestRuleExpr || ''
            )
            if (combined) {
              billingModeMap[name] = 'tiered_expr'
              billingExprMap[name] = combined
            }
            // Always serialize ratio/price values for tiered_expr models so they
            // serve as fallback during multi-instance sync delays. The backend's
            // ModelPriceHelper checks billing_mode first, so these values are
            // only consulted when billing_setting hasn't propagated yet.
            setIfPresent(priceMap, name, data.price)
            setIfPresent(ratioMap, name, data.ratio)
            setIfPresent(cacheMap, name, data.cacheRatio)
            setIfPresent(createCacheMap, name, data.createCacheRatio)
            setIfPresent(completionMap, name, data.completionRatio)
            setIfPresent(imageMap, name, data.imageRatio)
            setIfPresent(audioMap, name, data.audioRatio)
            setIfPresent(audioCompletionMap, name, data.audioCompletionRatio)
          } else if (data.price && data.price !== '') {
            setIfPresent(priceMap, name, data.price)
          } else {
            setIfPresent(ratioMap, name, data.ratio)
            setIfPresent(cacheMap, name, data.cacheRatio)
            setIfPresent(createCacheMap, name, data.createCacheRatio)
            setIfPresent(completionMap, name, data.completionRatio)
            setIfPresent(imageMap, name, data.imageRatio)
            setIfPresent(audioMap, name, data.audioRatio)
            setIfPresent(audioCompletionMap, name, data.audioCompletionRatio)
          }
        })

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

    const handleSave = useCallback(
      (data: ModelRatioData) => {
        persistPricingData(data)
        setEditData(data)
        setEditorOpen(true)
      },
      [persistPricingData]
    )

    const handleBatchCopy = useCallback(() => {
      if (!editData) {
        toast.error(t('Open a source model first'))
        return
      }

      const targetNames = table
        .getFilteredSelectedRowModel()
        .rows.map((row) => row.original.name)

      if (targetNames.length === 0) {
        toast.error(t('Select at least one target model'))
        return
      }

      persistPricingData(editData, targetNames)
      table.resetRowSelection()
      toast.success(
        t('Applied {{name}} pricing to {{count}} models', {
          name: editData.name,
          count: targetNames.length,
        })
      )
    }, [editData, persistPricingData, t, table])

    const selectedTargetCount = table.getFilteredSelectedRowModel().rows.length

    return (
      <div className='flex flex-col gap-4'>
        <div className='grid min-h-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(520px,0.9fr)]'>
          <div className='flex min-w-0 flex-col gap-4'>
            <DataTableToolbar
              table={table}
              searchPlaceholder={t('Search models...')}
              filters={[
                {
                  columnId: 'billingMode',
                  title: t('Mode'),
                  options: [
                    {
                      label: 'Per-token',
                      value: 'per-token',
                      count: modeCounts['per-token'],
                    },
                    {
                      label: 'Per-request',
                      value: 'per-request',
                      count: modeCounts['per-request'],
                    },
                    {
                      label: 'Expression',
                      value: 'tiered_expr',
                      count: modeCounts.tiered_expr,
                    },
                  ],
                },
              ]}
              preActions={
                <Button onClick={handleAdd}>
                  <Plus data-icon='inline-start' />
                  {t('Add model')}
                </Button>
              }
            />

            {table.getRowModel().rows.length === 0 ? (
              <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center'>
                {table.getState().globalFilter
                  ? t('No models match your search')
                  : t('No models configured. Use Add model to get started.')}
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
                      <TableRow
                        key={row.id}
                        data-state={
                          row.getIsSelected() ? 'selected' : undefined
                        }
                        className={
                          editData?.name === row.original.name
                            ? 'bg-muted/45'
                            : undefined
                        }
                        onClick={(event) => {
                          const target = event.target as HTMLElement
                          if (target.closest('button, [role="checkbox"]'))
                            return
                          handleEdit(row.original)
                        }}
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
            )}

            {table.getRowModel().rows.length > 0 && (
              <DataTablePagination table={table} />
            )}
          </div>

          <div className='hidden min-w-0 md:block'>
            {editorOpen ? (
              <ModelPricingEditorPanel
                onSave={handleSave}
                onCancel={handleCancel}
                editData={editData}
                selectedTargetCount={selectedTargetCount}
                className='sticky top-4 h-[calc(100vh-8rem)] min-h-[620px]'
              />
            ) : (
              <div className='bg-card text-muted-foreground sticky top-4 flex h-[calc(100vh-8rem)] min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center'>
                <div className='text-foreground text-base font-medium'>
                  {t('Select a model to edit pricing')}
                </div>
                <p className='max-w-sm text-sm'>
                  {t(
                    'Use the full-width table to scan prices, then select a row to edit it here.'
                  )}
                </p>
                <Button variant='outline' onClick={handleAdd}>
                  <Plus data-icon='inline-start' />
                  {t('Add model')}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DataTableBulkActions table={table} entityName={t('model')}>
          <Button size='sm' disabled={!editData} onClick={handleBatchCopy}>
            <Copy data-icon='inline-start' />
            {editData
              ? t('Copy {{name}} pricing', { name: editData.name })
              : t('Open a source model first')}
          </Button>
        </DataTableBulkActions>

        {isMobile && (
          <ModelPricingSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            onSave={handleSave}
            onCancel={handleCancel}
            editData={editData}
            selectedTargetCount={selectedTargetCount}
          />
        )}
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
