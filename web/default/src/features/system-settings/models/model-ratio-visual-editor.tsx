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
  useState,
  useMemo,
  memo,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react'
import {
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
import { Copy, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DataTableBulkActions,
  DataTableToolbar,
  DataTablePagination,
} from '@/components/data-table'
import { combineBillingExpr } from '@/features/pricing/lib/billing-expr'
import { safeJsonParse } from '../utils/json-parser'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
  ModelPricingSheet,
  type ModelRatioData,
} from './model-pricing-sheet'
import {
  buildModelSnapshots,
  getSnapshotSignature,
  type ModelRow,
} from './model-pricing-snapshots'
import { buildModelRatioColumns } from './model-ratio-table-columns'
import {
  mergeModelRules,
  parseAllRules,
  rulesForModel,
} from './video-pricing-types'

const VIDEO_RULES_KEY = 'billing_setting_video.video_price_rules'

type ModelRatioVisualEditorProps = {
  savedModelPrice: string
  savedModelRatio: string
  savedCacheRatio: string
  savedCreateCacheRatio: string
  savedCompletionRatio: string
  savedImageRatio: string
  savedAudioRatio: string
  savedAudioCompletionRatio: string
  savedBillingMode: string
  savedBillingExpr: string
  savedVideoRules: string
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
  videoRules: string
  onChange: (field: string, value: string) => void
  onSave: () => void | Promise<void>
  isSaving: boolean
}

export type ModelRatioVisualEditorHandle = {
  commitOpenEditor: () => Promise<boolean>
}

const STORAGE_KEY = 'model-ratio-column-visibility'

const ModelRatioVisualEditorComponent = forwardRef<
  ModelRatioVisualEditorHandle,
  ModelRatioVisualEditorProps
>(function ModelRatioVisualEditor(
  {
    savedModelPrice,
    savedModelRatio,
    savedCacheRatio,
    savedCreateCacheRatio,
    savedCompletionRatio,
    savedImageRatio,
    savedAudioRatio,
    savedAudioCompletionRatio,
    savedBillingMode,
    savedBillingExpr,
    savedVideoRules,
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
    videoRules,
    onChange,
    onSave,
    isSaving,
  },
  ref
) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editData, setEditData] = useState<ModelRatioData | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const editorPanelRef = useRef<ModelPricingEditorPanelHandle>(null)
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
    const savedRows = buildModelSnapshots({
      modelPrice: savedModelPrice,
      modelRatio: savedModelRatio,
      cacheRatio: savedCacheRatio,
      createCacheRatio: savedCreateCacheRatio,
      completionRatio: savedCompletionRatio,
      imageRatio: savedImageRatio,
      audioRatio: savedAudioRatio,
      audioCompletionRatio: savedAudioCompletionRatio,
      billingMode: savedBillingMode,
      billingExpr: savedBillingExpr,
      videoRules: savedVideoRules,
    })
    const draftRows = buildModelSnapshots({
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
      videoRules,
    })

    const savedByName = new Map(savedRows.map((row) => [row.name, row]))
    const draftByName = new Map(draftRows.map((row) => [row.name, row]))
    const modelNames = new Set([...savedByName.keys(), ...draftByName.keys()])

    return Array.from(modelNames)
      .map((name) => {
        const saved = savedByName.get(name)
        const draft = draftByName.get(name)
        const displayed = saved ?? draft
        const savedSignature = getSnapshotSignature(saved)
        const draftSignature = getSnapshotSignature(draft)

        return {
          ...displayed!,
          saved,
          draft,
          isDraftChanged: savedSignature !== draftSignature,
          isDraftDeleted: Boolean(saved && !draft),
          isDraftNew: Boolean(!saved && draft),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [
    savedModelPrice,
    savedModelRatio,
    savedCacheRatio,
    savedCreateCacheRatio,
    savedCompletionRatio,
    savedImageRatio,
    savedAudioRatio,
    savedAudioCompletionRatio,
    savedBillingMode,
    savedBillingExpr,
    savedVideoRules,
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
    videoRules,
  ])

  const modeCounts = useMemo(
    () =>
      models.reduce(
        (acc, model) => {
          const mode =
            model.billingMode === 'per-request' ||
            model.billingMode === 'tiered_expr' ||
            model.billingMode === 'video'
              ? model.billingMode
              : 'per-token'
          acc[mode] += 1
          return acc
        },
        {
          'per-token': 0,
          'per-request': 0,
          tiered_expr: 0,
          video: 0,
        } as Record<
          'per-token' | 'per-request' | 'tiered_expr' | 'video',
          number
        >
      ),
    [models]
  )

  const handleEdit = useCallback(
    (model: ModelRow) => {
      const editableModel = model.draft ?? model.saved ?? model
      // A video model also carries a ModelPrice entry -- the divisor the
      // per-second chain cancels out -- so the price check below would claim it
      // for per-request. The snapshot's mode has to win.
      const resolveMode = () => {
        if (editableModel.billingMode === 'video') return 'video' as const
        if (editableModel.billingMode === 'tiered_expr') {
          return 'tiered_expr' as const
        }
        return editableModel.price && editableModel.price !== ''
          ? ('per-request' as const)
          : ('per-token' as const)
      }
      setEditData({
        name: editableModel.name,
        price: editableModel.price,
        ratio: editableModel.ratio,
        cacheRatio: editableModel.cacheRatio,
        createCacheRatio: editableModel.createCacheRatio,
        completionRatio: editableModel.completionRatio,
        imageRatio: editableModel.imageRatio,
        audioRatio: editableModel.audioRatio,
        audioCompletionRatio: editableModel.audioCompletionRatio,
        billingMode: resolveMode(),
        billingExpr: editableModel.billingExpr,
        requestRuleExpr: editableModel.requestRuleExpr,
        // Narrowed to this model: the sheet must never see, and so can never
        // drop, another model's rules.
        videoRules: JSON.stringify(
          rulesForModel(parseAllRules(videoRules), editableModel.name)
        ),
      })
      setEditorOpen(true)
      if (isMobile) setSheetOpen(true)
    },
    [isMobile, videoRules]
  )

  const handleAdd = useCallback(() => {
    setEditData(null)
    setEditorOpen(true)
    if (isMobile) setSheetOpen(true)
  }, [isMobile])

  const handleGlobalFilterChange = useCallback<OnChangeFn<string>>(
    (updater) => {
      setGlobalFilter((previous) => {
        const next = typeof updater === 'function' ? updater(previous) : updater
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
      // Presence in this table is what selects per-second billing, so a deleted
      // model has to leave it or it keeps being billed per second with no row in
      // the sheet to show for it. mergeModelRules drops only this model.
      onChange(
        VIDEO_RULES_KEY,
        JSON.stringify(mergeModelRules(parseAllRules(videoRules), name, []))
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
      videoRules,
      onChange,
    ]
  )

  const columns = useMemo(
    () =>
      buildModelRatioColumns({
        onDelete: handleDelete,
        onEdit: handleEdit,
        t,
      }),
    [handleEdit, handleDelete, t]
  )

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

      // The rule list is one flat array across every model, so it is threaded
      // through the loop rather than rebuilt per target: a batch copy applies
      // the same rules to several models and each merge has to see the previous
      // one's result. mergeModelRules replaces only the named model and stamps
      // its name onto every rule.
      const editedRules = parseAllRules(data.videoRules)
      let nextVideoRules = parseAllRules(videoRules)

      targetNames.forEach((name) => {
        // Captured before the delete below: an existing base is deliberate for
        // two models (0.14 and 0.08) and rescaling it to 1 would break
        // continuity with historical video_billing_units in the logs.
        const existingModelPrice = priceMap[name]

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
          nextVideoRules = mergeModelRules(nextVideoRules, name, [])
        } else if (data.billingMode === 'video') {
          // billing_setting.billing_mode is deliberately NOT set to 'video'.
          // The backend selects per-second billing by the model's presence in
          // the rule table (IsVideoModelConfigured), and its website pricing
          // endpoint rejects any billing_mode it does not recognize -- writing
          // 'video' there would fail that endpoint for the whole catalogue.
          //
          // ModelPrice is the divisor in price_per_second * seconds /
          // ModelPrice and the surrounding chain multiplies it back in, so its
          // value cancels and cannot change what a customer pays. Its presence
          // is what switches the model off token settlement, and a non-positive
          // value makes the backend reject every request -- so it must exist.
          priceMap[name] = existingModelPrice ?? 1
          nextVideoRules = mergeModelRules(nextVideoRules, name, editedRules)
        } else if (data.price && data.price !== '') {
          setIfPresent(priceMap, name, data.price)
          nextVideoRules = mergeModelRules(nextVideoRules, name, [])
        } else {
          setIfPresent(ratioMap, name, data.ratio)
          setIfPresent(cacheMap, name, data.cacheRatio)
          setIfPresent(createCacheMap, name, data.createCacheRatio)
          setIfPresent(completionMap, name, data.completionRatio)
          setIfPresent(imageMap, name, data.imageRatio)
          setIfPresent(audioMap, name, data.audioRatio)
          setIfPresent(audioCompletionMap, name, data.audioCompletionRatio)
          nextVideoRules = mergeModelRules(nextVideoRules, name, [])
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
      onChange(VIDEO_RULES_KEY, JSON.stringify(nextVideoRules))
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
      videoRules,
      onChange,
    ]
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

  useImperativeHandle(
    ref,
    () => ({
      commitOpenEditor: async () => {
        if (!editorOpen || !editorPanelRef.current) return true
        const data = await editorPanelRef.current.commitDraft()
        if (!data) return false
        persistPricingData(data)
        setEditData(data)
        return true
      },
    }),
    [editorOpen, persistPricingData]
  )

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid h-[clamp(720px,calc(100vh-12rem),900px)] min-h-0 gap-4 md:grid-cols-[minmax(300px,0.72fr)_minmax(520px,1.28fr)] xl:grid-cols-[minmax(320px,0.68fr)_minmax(640px,1.32fr)]'>
        <div className='flex min-h-0 min-w-0 flex-col gap-3'>
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
                  {
                    label: 'Video per-second',
                    value: 'video',
                    count: modeCounts.video,
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
            <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
              <table className='w-full caption-bottom text-sm tabular-nums'>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className='border-b'>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          colSpan={header.colSpan}
                          className={cn(
                            'bg-background text-foreground sticky top-0 z-10 h-10 px-2 text-left align-middle text-sm font-medium whitespace-nowrap',
                            header.column.id === 'actions' &&
                              'right-0 z-30 w-24 min-w-24 shadow-[-10px_0_14px_-14px_hsl(var(--foreground))]'
                          )}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className={
                        editData?.name === row.original.name
                          ? 'bg-muted/45 hover:bg-muted/50 data-[state=selected]:bg-muted group border-b transition-colors'
                          : 'hover:bg-muted/50 data-[state=selected]:bg-muted group border-b transition-colors'
                      }
                      onClick={(event) => {
                        const target = event.target as HTMLElement
                        if (target.closest('button, [role="checkbox"]')) return
                        handleEdit(row.original)
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'p-2 align-middle text-sm whitespace-nowrap',
                            cell.column.id === 'actions' &&
                              (editData?.name === row.original.name
                                ? 'bg-muted/45 group-hover:bg-muted/50 group-data-[state=selected]:bg-muted sticky right-0 z-10 w-24 min-w-24 shadow-[-10px_0_14px_-14px_hsl(var(--foreground))]'
                                : 'bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted sticky right-0 z-10 w-24 min-w-24 shadow-[-10px_0_14px_-14px_hsl(var(--foreground))]')
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {table.getRowModel().rows.length > 0 && (
            <DataTablePagination table={table} />
          )}
        </div>

        <div className='hidden min-h-0 min-w-0 md:block'>
          {editorOpen ? (
            <ModelPricingEditorPanel
              ref={editorPanelRef}
              editData={editData}
              onSave={onSave}
              isSaving={isSaving}
              className='h-full min-h-0'
            />
          ) : (
            <div className='bg-card text-muted-foreground flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center'>
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
          ref={editorPanelRef}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editData={editData}
          onSave={onSave}
          isSaving={isSaving}
        />
      )}
    </div>
  )
})

export const ModelRatioVisualEditor = memo(
  ModelRatioVisualEditorComponent,
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
      prevProps.videoRules === nextProps.videoRules &&
      prevProps.onChange === nextProps.onChange &&
      prevProps.onSave === nextProps.onSave &&
      prevProps.isSaving === nextProps.isSaving
    )
  }
)
