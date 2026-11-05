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
import type {
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  VisibilityState,
  SortingState,
} from '@tanstack/react-table'
import { Copy, Plus } from 'lucide-react'
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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DataTableBulkActions,
  DataTableToolbar,
  DataTablePagination,
  DataTableRow,
  DataTableView,
  useDataTable,
} from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { useModelPricing } from '@/features/model-pricing/api'
import {
  applyPricingDraft,
  PRICING_KEYS,
  pricingOptions,
  pricingRows,
} from '@/features/model-pricing/pricing'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { splitPluginBillingExprKey } from '@/features/pricing/lib/plugin-pricing'
import { useMediaQuery } from '@/hooks'

import { safeJsonParse } from '../utils/json-parser'
import type { PricingMode } from './model-pricing-core'
import {
  ModelPricingIssueDetails,
  ModelPricingIssueSummary,
} from './model-pricing-issue-alerts'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
  ModelPricingSheet,
  type ModelRatioData,
} from './model-pricing-sheet'
import {
  buildModelRow,
  isBasePricingUnset,
  type ModelRow,
} from './model-pricing-snapshots'
import {
  buildModelRatioColumns,
  PRICE_ATTENTION_FILTER,
  TASK_PRICING_MODE_FILTER,
} from './model-ratio-table-columns'
import { PriceChangeCard } from './price-change-diff'
import { type ModelPricingIssue, useModelPricingIssues } from './pricing-issues'

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
  savedPluginBillingExpr?: string
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
  pluginBillingExpr?: string
  candidateModelNames?: string[]
  candidateModelsLoading?: boolean
  filterMode?: 'all' | 'unset'
  onChange: (field: string, value: string) => void
  onSave: () => void | Promise<void>
  isSaving: boolean
  /** Whether the open editor holds edits not yet committed to the draft. */
  onEditorDirtyChange?: (dirty: boolean) => void
}

export type ModelRatioVisualEditorHandle = {
  commitOpenEditor: () => Promise<boolean>
  closeEditor: () => void
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
    savedPluginBillingExpr = '{}',
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
    pluginBillingExpr = '{}',
    candidateModelNames,
    candidateModelsLoading,
    filterMode = 'all',
    onChange,
    onSave,
    isSaving,
    onEditorDirtyChange,
  },
  ref
) {
  const { t } = useTranslation()
  const { models: pricingModels } = usePricingData()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editData, setEditData] = useState<ModelRatioData | null>(null)
  const [panelDirty, setPanelDirty] = useState(false)
  const pricingConfig = useModelPricing(
    editData?.name ? [editData.name] : [],
    Boolean(editData?.name)
  )
  const pricingIssuesQuery = useModelPricingIssues()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFiltersOverride, setColumnFiltersOverride] =
    useState<ColumnFiltersState | null>(null)
  const [globalFilter, setGlobalFilter] = useState('')
  const [toolbarVersion, setToolbarVersion] = useState(0)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const editorPanelRef = useRef<ModelPricingEditorPanelHandle>(null)
  // Read through a ref so the table column definitions (and therefore every
  // rendered cell) do not need to be rebuilt each time a row is opened for
  // editing; rebuilding them remounts cells and drops the user's text selection.
  const editingModelNameRef = useRef<string | null>(null)
  useEffect(() => {
    editingModelNameRef.current = editData?.name ?? null
  }, [editData])
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

  const taskModelNames = useMemo(
    () =>
      new Set(
        pricingModels
          .filter(
            (model) =>
              model.billing_usage_schema &&
              Object.keys(model.billing_usage_schema).length > 0
          )
          .map((model) => model.model_name)
      ),
    [pricingModels]
  )

  const pricingIssues = useMemo(() => {
    const byModel = new Map<string, ModelPricingIssue[]>()
    for (const issue of pricingIssuesQuery.data ?? []) {
      byModel.set(issue.model_name, [
        ...(byModel.get(issue.model_name) ?? []),
        issue,
      ])
    }
    return byModel
  }, [pricingIssuesQuery.data])

  const savedOptions = useMemo(
    () =>
      pricingOptions({
        ModelPrice: savedModelPrice,
        ModelRatio: savedModelRatio,
        CompletionRatio: savedCompletionRatio,
        CacheRatio: savedCacheRatio,
        CreateCacheRatio: savedCreateCacheRatio,
        ImageRatio: savedImageRatio,
        AudioRatio: savedAudioRatio,
        AudioCompletionRatio: savedAudioCompletionRatio,
        BillingMode: savedBillingMode,
        BillingExpr: savedBillingExpr,
        PluginBillingExpr: savedPluginBillingExpr,
      }),
    [
      savedModelPrice,
      savedModelRatio,
      savedCompletionRatio,
      savedCacheRatio,
      savedCreateCacheRatio,
      savedImageRatio,
      savedAudioRatio,
      savedAudioCompletionRatio,
      savedBillingMode,
      savedBillingExpr,
      savedPluginBillingExpr,
    ]
  )
  const draftOptions = useMemo(
    () =>
      pricingOptions({
        ModelPrice: modelPrice,
        ModelRatio: modelRatio,
        CompletionRatio: completionRatio,
        CacheRatio: cacheRatio,
        CreateCacheRatio: createCacheRatio,
        ImageRatio: imageRatio,
        AudioRatio: audioRatio,
        AudioCompletionRatio: audioCompletionRatio,
        BillingMode: billingMode,
        BillingExpr: billingExpr,
        PluginBillingExpr: pluginBillingExpr,
      }),
    [
      modelPrice,
      modelRatio,
      completionRatio,
      cacheRatio,
      createCacheRatio,
      imageRatio,
      audioRatio,
      audioCompletionRatio,
      billingMode,
      billingExpr,
      pluginBillingExpr,
    ]
  )

  const models = useMemo(() => {
    const savedByName = new Map(
      pricingRows(savedOptions).map((row) => [row.name, row])
    )
    const draftByName = new Map(
      pricingRows(draftOptions).map((row) => [row.name, row])
    )
    // A plugin model that was never priced has no saved row; list it so its
    // pricing issue can be seen and fixed here.
    const modelNames =
      filterMode === 'unset'
        ? new Set(candidateModelNames ?? [])
        : new Set([
            ...savedByName.keys(),
            ...draftByName.keys(),
            ...pricingIssues.keys(),
          ])

    return (
      [...modelNames]
        .map((name) =>
          buildModelRow(name, savedByName.get(name), draftByName.get(name))
        )
        // A pending deletion stays listed with its undo action until saved.
        .filter(
          (row) =>
            filterMode !== 'unset' ||
            (!row.isDraftDeleted && isBasePricingUnset(row.saved))
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    )
  }, [
    candidateModelNames,
    filterMode,
    pricingIssues,
    savedOptions,
    draftOptions,
  ])

  const modeCounts = useMemo(() => {
    const counts = {
      'per-token': 0,
      'per-request': 0,
      tiered_expr: 0,
      [TASK_PRICING_MODE_FILTER]: 0,
    }
    for (const model of models) {
      const mode =
        model.billingMode === 'per-request' ||
        model.billingMode === 'tiered_expr'
          ? model.billingMode
          : 'per-token'
      counts[mode] += 1
      if (
        taskModelNames.has(model.name) &&
        model.billingMode === 'tiered_expr' &&
        Boolean(model.billingExpr)
      ) {
        counts[TASK_PRICING_MODE_FILTER] += 1
      }
    }
    return counts
  }, [models, taskModelNames])
  const attentionCount = useMemo(
    () => models.filter((model) => pricingIssues.has(model.name)).length,
    [models, pricingIssues]
  )
  const defaultColumnFilters = useMemo<ColumnFiltersState>(
    () =>
      filterMode === 'all' && attentionCount > 0
        ? [{ id: 'name', value: [PRICE_ATTENTION_FILTER] }]
        : [],
    [filterMode, attentionCount]
  )
  const columnFilters = columnFiltersOverride ?? defaultColumnFilters
  const handleColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    (updater) => {
      setColumnFiltersOverride((previous) =>
        typeof updater === 'function'
          ? updater(previous ?? defaultColumnFilters)
          : updater
      )
      setPagination((previous) => ({ ...previous, pageIndex: 0 }))
    },
    [defaultColumnFilters]
  )
  const showingAttention = columnFilters.some(
    (filter) =>
      filter.id === 'name' &&
      Array.isArray(filter.value) &&
      filter.value.includes(PRICE_ATTENTION_FILTER)
  )

  const handleEdit = useCallback(
    (model: ModelRow) => {
      // A pending deletion has no draft to edit; it offers undo instead.
      if (model.isDraftDeleted) return
      const editableModel = model.draft ?? model.saved ?? model
      let editBillingMode: PricingMode = 'per-token'
      if (editableModel.billingMode === 'tiered_expr') {
        editBillingMode = 'tiered_expr'
      } else if (editableModel.price && editableModel.price !== '') {
        editBillingMode = 'per-request'
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
        billingMode: editBillingMode,
        billingExpr: editableModel.billingExpr,
        pluginBillingExpr: editableModel.pluginBillingExpr,
        requestRuleExpr: editableModel.requestRuleExpr,
      })
      setEditorOpen(true)
      if (isMobile) setSheetOpen(true)
    },
    [isMobile]
  )

  const closeEditor = useCallback(() => {
    setEditData(null)
    setEditorOpen(false)
    setSheetOpen(false)
  }, [])

  // The panel does not report when it closes, so only an open one counts.
  const editorShown = isMobile ? sheetOpen : editorOpen
  useEffect(() => {
    onEditorDirtyChange?.(editorShown && panelDirty)
  }, [editorShown, panelDirty, onEditorDirtyChange])

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
      const pluginExprMap = safeJsonParse<Record<string, string>>(
        pluginBillingExpr,
        { fallback: {} }
      )
      for (const variant of Object.keys(pluginExprMap)) {
        if (splitPluginBillingExprKey(variant)?.[1] === name) {
          delete pluginExprMap[variant]
        }
      }
      onChange(
        'billing_setting.plugin_billing_expr',
        JSON.stringify(pluginExprMap)
      )

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

      if (editingModelNameRef.current === name) closeEditor()
    },
    [
      closeEditor,
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
      pluginBillingExpr,
      onChange,
    ]
  )

  // Puts one model's saved price, provider prices included, back into the
  // draft. An open editor shows the saved price again.
  const handleRestore = useCallback(
    (name: string) => {
      for (const key of PRICING_KEYS) {
        const draft = safeJsonParse<Record<string, unknown>>(
          draftOptions[key],
          { fallback: {}, silent: true }
        )
        const saved = safeJsonParse<Record<string, unknown>>(
          savedOptions[key],
          { fallback: {}, silent: true }
        )
        for (const entry of new Set([
          ...Object.keys(draft),
          ...Object.keys(saved),
        ])) {
          const model =
            key === 'billing_setting.plugin_billing_expr'
              ? splitPluginBillingExprKey(entry)?.[1]
              : entry
          if (model !== name) continue
          if (Object.hasOwn(saved, entry)) draft[entry] = saved[entry]
          else delete draft[entry]
        }
        onChange(key, JSON.stringify(draft, null, 2))
      }
      if (editingModelNameRef.current !== name) return
      const saved = pricingRows(savedOptions).find((row) => row.name === name)
      if (saved) handleEdit(buildModelRow(name, saved, saved))
      else closeEditor()
    },
    [draftOptions, savedOptions, onChange, handleEdit, closeEditor]
  )

  const columns = useMemo(
    () =>
      buildModelRatioColumns({
        onDelete: handleDelete,
        onRestore: handleRestore,
        onEdit: handleEdit,
        deleteDisabled: filterMode === 'unset',
        taskModelNames,
        pricingIssues,
        t,
      }),
    [
      handleEdit,
      handleDelete,
      handleRestore,
      filterMode,
      t,
      taskModelNames,
      pricingIssues,
    ]
  )

  const ensurePageInRange = useCallback((pageCount: number) => {
    setPagination((prev) =>
      pageCount > 0 && prev.pageIndex >= pageCount
        ? { ...prev, pageIndex: pageCount - 1 }
        : prev
    )
  }, [])

  const { table } = useDataTable({
    data: models,
    columns,
    getRowId: (row) => row.name,
    ensurePageInRange,
    sorting,
    columnFilters,
    globalFilter,
    columnVisibility,
    pagination,
    rowSelection,
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: handleColumnFiltersChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    autoResetPageIndex: false,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      return row.original.name.toLowerCase().includes(searchValue)
    },
  })

  const persistPricingData = useCallback(
    (data: ModelRatioData, targetNames: string[] = [data.name]) => {
      const updated = applyPricingDraft(draftOptions, data, targetNames)
      for (const [key, value] of Object.entries(updated)) onChange(key, value)
    },
    [draftOptions, onChange]
  )

  const handleBatchCopy = useCallback(async () => {
    if (!editData) {
      toast.error(t('Open a source model first'))
      return
    }

    let sourceData = editData
    if (editorOpen && editorPanelRef.current) {
      const committed = await editorPanelRef.current.commitDraft()
      if (!committed) return
      sourceData = committed
      setEditData(committed)
    }

    const targetNames = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => row.original.name)

    if (targetNames.length === 0) {
      toast.error(t('Select at least one target model'))
      return
    }

    // Persist to the source model too, so targets never carry pricing the
    // source itself would lose if the editor draft were abandoned.
    persistPricingData(sourceData, [
      ...new Set([sourceData.name, ...targetNames]),
    ])
    table.resetRowSelection()
    toast.success(
      t('Applied {{name}} pricing to {{count}} models', {
        name: sourceData.name,
        count: targetNames.length,
      })
    )
  }, [editData, editorOpen, persistPricingData, t, table])

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
      closeEditor,
    }),
    [editorOpen, persistPricingData, closeEditor]
  )

  const hasRows = table.getRowModel().rows.length > 0

  let emptyStateText = t('No models configured. Use Add model to get started.')
  if (table.getState().globalFilter) {
    emptyStateText = t('No models match your search')
  } else if (table.getState().columnFilters.length > 0) {
    emptyStateText = t('No models match the selected filters')
  } else if (filterMode === 'unset') {
    emptyStateText = candidateModelsLoading
      ? t('Loading...')
      : t('No models with unset prices')
  }

  const editIssues = editData ? pricingIssues.get(editData.name) : undefined
  const editRow = editData
    ? models.find((model) => model.name === editData.name)
    : undefined
  const changedEditRow = editRow?.isDraftChanged ? editRow : undefined
  const scrollHeader =
    changedEditRow || editIssues ? (
      <>
        {changedEditRow && (
          <PriceChangeCard
            row={changedEditRow}
            onUndo={() => handleRestore(changedEditRow.name)}
          />
        )}
        {editIssues && <ModelPricingIssueDetails issues={editIssues} />}
      </>
    ) : undefined

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4'>
      {filterMode === 'all' && (
        <ModelPricingIssueSummary
          count={attentionCount}
          showingAttention={showingAttention}
          onShowAll={() => {
            setToolbarVersion((version) => version + 1)
            table.setColumnFilters([])
            table.setGlobalFilter('')
            table.setPageIndex(0)
          }}
          onReview={() => {
            const model = models.find((row) => pricingIssues.has(row.name))
            if (!model) return
            setToolbarVersion((version) => version + 1)
            setGlobalFilter('')
            table.setColumnFilters([
              { id: 'name', value: [PRICE_ATTENTION_FILTER] },
            ])
            table.setPageIndex(0)
            handleEdit(model)
          }}
        />
      )}
      <div
        role='region'
        aria-label={t('Model prices')}
        className='grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(300px,0.72fr)_minmax(520px,1.28fr)] xl:grid-cols-[minmax(320px,0.68fr)_minmax(640px,1.32fr)]'
      >
        <div className='flex min-h-0 min-w-0 flex-col gap-3'>
          <DataTableToolbar
            key={toolbarVersion}
            table={table}
            searchPlaceholder={t('Search models...')}
            searchDebounceMs={250}
            filters={[
              {
                columnId: 'billingMode',
                title: t('Mode'),
                options: [
                  {
                    label: 'Per-token (deprecated)',
                    value: 'per-token',
                    count: modeCounts['per-token'],
                  },
                  {
                    label: 'Per-request (deprecated)',
                    value: 'per-request',
                    count: modeCounts['per-request'],
                  },
                  {
                    label: 'Expression',
                    value: 'tiered_expr',
                    count: modeCounts.tiered_expr,
                  },
                  {
                    label: 'Expression - Task pricing',
                    value: TASK_PRICING_MODE_FILTER,
                    count: modeCounts[TASK_PRICING_MODE_FILTER],
                  },
                ],
              },
              {
                columnId: 'name',
                title: t('Price status'),
                options: [
                  {
                    label: 'Price needs attention',
                    value: PRICE_ATTENTION_FILTER,
                    count: attentionCount,
                  },
                ],
              },
            ]}
            preActions={
              filterMode === 'unset' ? undefined : (
                <Button onClick={handleAdd}>
                  <Plus data-icon='inline-start' />
                  {t('Add model')}
                </Button>
              )
            }
          />

          {!hasRows ? (
            <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center'>
              {emptyStateText}
            </div>
          ) : (
            <DataTableView
              table={table}
              containerClassName='min-h-0 flex-1 rounded-md'
              tableContainerClassName='h-full'
              tableClassName='min-w-[852px] table-fixed'
              tableHeaderClassName='[&_tr]:border-b-0'
              splitHeaderScrollClassName='h-full'
              bodyContainerClassName='[scrollbar-gutter:stable]'
              splitHeader
              pinnedColumns={[
                {
                  columnId: 'actions',
                  side: 'right',
                },
              ]}
              colgroup={
                <colgroup>
                  <col className='w-9' />
                  <col className='w-[300px]' />
                  <col className='w-[120px]' />
                  <col className='w-[300px]' />
                  <col className='w-auto' />
                </colgroup>
              }
              renderRow={(row, { getCellClassName }) => (
                <DataTableRow
                  key={row.id}
                  row={row}
                  className={
                    editData?.name === row.original.name
                      ? 'bg-muted/45 hover:bg-muted/50 data-[state=selected]:bg-muted group'
                      : 'group'
                  }
                  getColumnClassName={(columnId) =>
                    columnId === 'actions' &&
                    editData?.name === row.original.name
                      ? getCellClassName(columnId, 'bg-muted')
                      : getCellClassName(columnId)
                  }
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    // Clicks in the portaled row menu bubble here too; Delete
                    // must not reopen the row it just deleted.
                    if (!event.currentTarget.contains(target)) return
                    if (target.closest('button, [role="checkbox"]')) return
                    handleEdit(row.original)
                  }}
                />
              )}
            />
          )}

          {hasRows && <DataTablePagination table={table} />}
        </div>

        <div className='hidden min-h-0 min-w-0 md:block'>
          {editorOpen ? (
            <ModelPricingEditorPanel
              ref={editorPanelRef}
              editData={editData}
              scrollHeader={scrollHeader}
              onDirtyChange={setPanelDirty}
              pluginVariants={
                pricingConfig.data?.entries.find(
                  (entry) => entry.model_name === editData?.name
                )?.plugin_variants
              }
              usageSchema={
                pricingConfig.data?.entries.find(
                  (entry) => entry.model_name === editData?.name
                )?.usage_schema
              }
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
              {filterMode !== 'unset' && (
                <Button variant='outline' onClick={handleAdd}>
                  <Plus data-icon='inline-start' />
                  {t('Add model')}
                </Button>
              )}
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
          scrollHeader={scrollHeader}
          onDirtyChange={setPanelDirty}
          pluginVariants={
            pricingConfig.data?.entries.find(
              (entry) => entry.model_name === editData?.name
            )?.plugin_variants
          }
          usageSchema={
            pricingConfig.data?.entries.find(
              (entry) => entry.model_name === editData?.name
            )?.usage_schema
          }
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
      prevProps.savedModelPrice === nextProps.savedModelPrice &&
      prevProps.savedModelRatio === nextProps.savedModelRatio &&
      prevProps.savedCacheRatio === nextProps.savedCacheRatio &&
      prevProps.savedCreateCacheRatio === nextProps.savedCreateCacheRatio &&
      prevProps.savedCompletionRatio === nextProps.savedCompletionRatio &&
      prevProps.savedImageRatio === nextProps.savedImageRatio &&
      prevProps.savedAudioRatio === nextProps.savedAudioRatio &&
      prevProps.savedAudioCompletionRatio ===
        nextProps.savedAudioCompletionRatio &&
      prevProps.savedBillingMode === nextProps.savedBillingMode &&
      prevProps.savedBillingExpr === nextProps.savedBillingExpr &&
      prevProps.savedPluginBillingExpr === nextProps.savedPluginBillingExpr &&
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
      prevProps.pluginBillingExpr === nextProps.pluginBillingExpr &&
      prevProps.candidateModelNames === nextProps.candidateModelNames &&
      prevProps.candidateModelsLoading === nextProps.candidateModelsLoading &&
      prevProps.filterMode === nextProps.filterMode &&
      prevProps.onChange === nextProps.onChange &&
      prevProps.onSave === nextProps.onSave &&
      prevProps.isSaving === nextProps.isSaving &&
      prevProps.onEditorDirtyChange === nextProps.onEditorDirtyChange
    )
  }
)
