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
import { Loader2, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePagination,
  DataTableView,
  useDataTable,
} from '@/components/data-table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { DifferencesMap, RatioType } from '../types'
import { RATIO_TYPE_OPTIONS } from './constants'
import { useUpstreamRatioSyncColumns } from './upstream-ratio-sync-columns'
import {
  getAlignedRatioTypes,
  getEffectiveResolutionSelections,
  getOrderedRatioTypes,
  getUpstreamDisplayName,
  isSelectedResolutionValue,
  isSelectableUpstreamValue,
  RATIO_SYNC_FIELDS,
  type ModelRow,
  type ResolutionRemovalPlan,
  type ResolutionSelection,
  type ResolutionsMap,
} from './upstream-ratio-sync-helpers'

type UpstreamRatioSyncTableProps = {
  differences: DifferencesMap
  resolutions: ResolutionsMap
  isDisabled: boolean
  isSyncing: boolean
  onSelectValue: (
    model: string,
    ratioType: RatioType,
    value: number | string,
    sourceName: string
  ) => void
  onSelectValues: (selections: ResolutionSelection[]) => void
  onUnselectValue: (model: string, ratioType: RatioType) => void
  onUnselectValues: (plan: ResolutionRemovalPlan) => void
}

export type UpstreamBulkSelectState = {
  displayName: string
  selections: ResolutionSelection[]
  removalPlan: ResolutionRemovalPlan
  selectableCount: number
  selectedCount: number
}

export function UpstreamRatioSyncTable({
  differences,
  resolutions,
  isDisabled,
  isSyncing,
  onSelectValue,
  onSelectValues,
  onUnselectValue,
  onUnselectValues,
}: UpstreamRatioSyncTableProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [ratioTypeFilter, setRatioTypeFilter] = useState<string>('')

  const dataSource = useMemo<ModelRow[]>(() => {
    return Object.entries(differences).map(([model, ratioTypes]) => {
      const hasPrice = 'model_price' in ratioTypes
      const hasOtherRatio = RATIO_SYNC_FIELDS.some((rt) => rt in ratioTypes)
      return {
        key: model,
        model,
        ratioTypes,
        billingConflict: hasPrice && hasOtherRatio,
      }
    })
  }, [differences])

  const filteredData = useMemo(() => {
    let data = dataSource

    if (search.trim()) {
      const lower = search.toLowerCase()
      data = data.filter((row) => row.model.toLowerCase().includes(lower))
    }

    if (ratioTypeFilter && ratioTypeFilter !== '__all__') {
      data = data.filter((row) => ratioTypeFilter in row.ratioTypes)
    }

    return data
  }, [dataSource, search, ratioTypeFilter])

  const upstreamNames = useMemo(() => {
    const set = new Set<string>()
    filteredData.forEach((row) => {
      getOrderedRatioTypes(row.ratioTypes, ratioTypeFilter).forEach(
        (ratioType) => {
          Object.keys(row.ratioTypes[ratioType]?.upstreams || {}).forEach(
            (name) => set.add(name)
          )
        }
      )
    })
    return [...set]
  }, [filteredData, ratioTypeFilter])

  const bulkSelectStateByUpstream = useMemo<
    Record<string, UpstreamBulkSelectState>
  >(() => {
    return upstreamNames.reduce<Record<string, UpstreamBulkSelectState>>(
      (states, upstreamName) => {
        const selections: ResolutionSelection[] = []
        const removalPlan: ResolutionRemovalPlan = new Map()

        filteredData.forEach((row) => {
          getAlignedRatioTypes(
            row.ratioTypes,
            [upstreamName],
            ratioTypeFilter
          ).forEach((ratioType) => {
            const upstreamVal =
              row.ratioTypes[ratioType]?.upstreams?.[upstreamName]
            if (isSelectableUpstreamValue(upstreamVal)) {
              selections.push({
                model: row.model,
                ratioType,
                value: upstreamVal as number | string,
                sourceName: upstreamName,
              })
              const removalRatioTypes = removalPlan.get(row.model)
              if (removalRatioTypes) {
                removalRatioTypes.add(ratioType)
              } else {
                removalPlan.set(row.model, new Set([ratioType]))
              }
            }
          })
        })

        const effectiveSelections = getEffectiveResolutionSelections(
          differences,
          selections
        )
        const selectedCount = effectiveSelections.filter((selection) =>
          isSelectedResolutionValue(
            resolutions,
            selection.model,
            selection.ratioType,
            selection.value
          )
        ).length

        states[upstreamName] = {
          displayName: getUpstreamDisplayName(upstreamName),
          selections: effectiveSelections,
          removalPlan,
          selectableCount: effectiveSelections.length,
          selectedCount,
        }
        return states
      },
      {}
    )
  }, [differences, filteredData, ratioTypeFilter, resolutions, upstreamNames])

  const handleBulkSelect = useCallback(
    (upstream: string) => {
      const selections = bulkSelectStateByUpstream[upstream]?.selections ?? []
      onSelectValues(selections)
    },
    [bulkSelectStateByUpstream, onSelectValues]
  )

  const handleBulkUnselect = useCallback(
    (upstream: string) => {
      const removalPlan =
        bulkSelectStateByUpstream[upstream]?.removalPlan ?? new Map()
      onUnselectValues(removalPlan)
    },
    [bulkSelectStateByUpstream, onUnselectValues]
  )

  const columns = useUpstreamRatioSyncColumns(
    upstreamNames,
    bulkSelectStateByUpstream,
    resolutions,
    ratioTypeFilter,
    isDisabled,
    onSelectValue,
    onUnselectValue,
    handleBulkSelect,
    handleBulkUnselect
  )

  const { table } = useDataTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.key,
    initialPagination: { pageIndex: 0, pageSize: 10 },
    withFilteredRowModel: false,
    withSortedRowModel: false,
    withFacetedRowModel: false,
  })

  if (dataSource.length === 0) {
    if (isSyncing) {
      return (
        <div className='flex h-64 flex-col items-center justify-center gap-3 rounded-md border'>
          <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
          <p className='text-muted-foreground text-sm'>
            {t('Fetching upstream prices...')}
          </p>
        </div>
      )
    }

    return (
      <div className='flex h-64 items-center justify-center rounded-md border'>
        <div className='text-center'>
          <p className='text-muted-foreground text-sm'>
            {t('No upstream price differences found')}
          </p>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('Select sync channels to compare prices')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full min-h-[520px] flex-col gap-4'>
      <div className='flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder={t('Search model name...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isDisabled}
            className='ps-8'
          />
        </div>
        <Select
          items={[
            { value: '__all__', label: t('All Types') },
            ...RATIO_TYPE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.label),
            })),
          ]}
          value={ratioTypeFilter}
          onValueChange={(v) => v !== null && setRatioTypeFilter(v)}
          disabled={isDisabled}
        >
          <SelectTrigger className='w-full sm:w-56'>
            <SelectValue placeholder={t('Filter by price field')} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              <SelectItem value='__all__'>{t('All Types')}</SelectItem>
              {RATIO_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.label)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <DataTableView
        table={table}
        containerClassName='min-h-0 flex-1 rounded-md'
        tableContainerClassName='h-full min-h-0'
        tableHeaderClassName='[background-color:var(--table-header)]'
        splitHeaderScrollClassName='h-full'
        bodyContainerClassName='[scrollbar-gutter:stable]'
        splitHeader
        getColumnClassName={(_, part) =>
          part === 'header' ? 'h-11 align-middle' : 'align-top'
        }
        getRowClassName={() => 'align-top'}
        emptyContent={t('No results found')}
        emptyCellClassName='h-24 text-center'
      />

      <div className='shrink-0'>
        <DataTablePagination table={table} />
      </div>
    </div>
  )
}
