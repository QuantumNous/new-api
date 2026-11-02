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
import { ArrowUpDown, Check, Filter, Grid2X2, Table2, TrendingDown } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { sideDrawerContentClassName, sideDrawerFormClassName } from '@/components/drawer-layout'

import {
  SORT_OPTIONS,
  VIEW_MODES,
  getSortLabels,
  type SortOption,
  type ViewMode,
} from '../constants'
import type { PricingModel, PricingVendor } from '../types'
import { PricingSidebar } from './pricing-sidebar'
import { SearchBar } from './search-bar'

type SegmentOption = {
  value: string
  label?: string
  icon?: React.ComponentType<{ className?: string }>
  tooltip?: string
}

export interface PricingToolbarProps {
  filteredCount: number
  sortBy: string
  onSortChange: (value: string) => void
  viewMode: ViewMode
  onViewModeChange: (value: ViewMode) => void
  quotaTypeFilter: string
  endpointTypeFilter: string
  vendorFilter: string
  groupFilter: string
  tagFilter: string
  onQuotaTypeChange: (value: string) => void
  onEndpointTypeChange: (value: string) => void
  onVendorChange: (value: string) => void
  onGroupChange: (value: string) => void
  onTagChange: (value: string) => void
  vendors: PricingVendor[]
  groups: string[]
  groupRatios?: Record<string, number>
  tags: string[]
  models: PricingModel[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  searchInput: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  searchPlaceholder: string
}

function SegmentedControl(props: {
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <ToggleGroup
      value={[props.value]}
      onValueChange={(values) => {
        if (values[0]) props.onChange(values[0])
      }}
      aria-label={props.ariaLabel}
      variant='outline'
      size='sm'
    >
      {props.options.map((option) => {
        const Icon = option.icon
        const button = (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.tooltip || option.label}
            className='h-8 px-3 text-xs'
          >
            {Icon && <Icon className='size-3.5' />}
            {option.label}
          </ToggleGroupItem>
        )

        if (!option.tooltip) {
          return button
        }

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger render={button}></TooltipTrigger>
            <TooltipContent side='bottom' className='text-xs'>
              {option.tooltip}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </ToggleGroup>
  )
}

export function PricingToolbar(props: PricingToolbarProps) {
  const { t } = useTranslation()
  const sortLabels = getSortLabels(t)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const handleViewModeChange = useCallback(
    (value: string) => props.onViewModeChange(value as ViewMode),
    [props]
  )

  return (
    <Card size='sm'>
      <CardContent>
        <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
          {/* Search bar: full-width on mobile (top), centered on desktop */}
          <SearchBar
            compact
            value={props.searchInput}
            onChange={props.onSearchChange}
            onClear={props.onClearSearch}
            placeholder={props.searchPlaceholder}
            className='w-full md:max-w-md md:order-2'
          />

          {/* Bottom row on mobile (filter left, controls right);
              display:contents on desktop so children join the parent flex row */}
          <div className='flex flex-row items-center justify-between gap-2 md:contents'>
            {/* Filter button */}
            <div className='md:order-1'>
              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <SheetTrigger
                  render={
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='h-8 gap-1.5 px-3 text-xs'
                    />
                  }
                >
                  <Filter className='size-3.5' />
                  <span className='hidden sm:inline'>
                    {t('Filter')} {props.filteredCount.toLocaleString()}
                  </span>
                </SheetTrigger>
                <SheetContent side='left' className={sideDrawerContentClassName('bg-popover w-3/4 sm:max-w-[360px] p-0')}>
                  <SheetTitle className='sr-only'>{t('Filter')}</SheetTitle>
                  <div className={sideDrawerFormClassName()}>
                    <PricingSidebar
                      className='rounded-none border-0 bg-transparent! p-0 shadow-none ring-0'
                      quotaTypeFilter={props.quotaTypeFilter}
                      endpointTypeFilter={props.endpointTypeFilter}
                      vendorFilter={props.vendorFilter}
                      groupFilter={props.groupFilter}
                      tagFilter={props.tagFilter}
                      onQuotaTypeChange={props.onQuotaTypeChange}
                      onEndpointTypeChange={props.onEndpointTypeChange}
                      onVendorChange={props.onVendorChange}
                      onGroupChange={props.onGroupChange}
                      onTagChange={props.onTagChange}
                      vendors={props.vendors}
                      groups={props.groups}
                      groupRatios={props.groupRatios}
                      tags={props.tags}
                      models={props.models}
                      hasActiveFilters={props.hasActiveFilters}
                      onClearFilters={props.onClearFilters}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Other controls: sort, success rate, view mode */}
            <div className='flex flex-row items-center gap-2 md:order-3'>
              <div role='status' aria-live='polite' className='sr-only'>
                {t('Filter')} {props.filteredCount.toLocaleString()}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='h-8 gap-1.5 px-3 text-xs'
                      aria-label={sortLabels[props.sortBy as SortOption] || t('Sort')}
                    />
                  }
                >
                  <ArrowUpDown className='size-3.5' />
                  <span className='hidden sm:inline'>
                    {sortLabels[props.sortBy as SortOption] || t('Sort')}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-44'>
                  {Object.entries(sortLabels).map(([value, label]) => (
                    <DropdownMenuItem
                      key={value}
                      onClick={() => props.onSortChange(value)}
                      className='gap-2'
                    >
                      <Check
                        className={cn(
                          'size-4 shrink-0',
                          props.sortBy === value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type='button'
                variant={
                  props.sortBy === SORT_OPTIONS.SUCCESS_RATE
                    ? 'secondary'
                    : 'outline'
                }
                size='sm'
                className='h-8 gap-1.5 px-2.5 text-xs'
                aria-label={props.sortBy === SORT_OPTIONS.SUCCESS_RATE ? t('Sort by Name') : t('Success rate: High to Low')}
                aria-pressed={props.sortBy === SORT_OPTIONS.SUCCESS_RATE}
                onClick={() =>
                  props.onSortChange(
                    props.sortBy === SORT_OPTIONS.SUCCESS_RATE
                      ? SORT_OPTIONS.NAME
                      : SORT_OPTIONS.SUCCESS_RATE
                  )
                }
              >
                <TrendingDown className='size-3.5' />
                <span className='hidden sm:inline'>{t('Success rate')}</span>
              </Button>

              <SegmentedControl
                options={[
                  {
                    value: VIEW_MODES.CARD,
                    icon: Grid2X2,
                    tooltip: t('Card view'),
                  },
                  {
                    value: VIEW_MODES.TABLE,
                    icon: Table2,
                    tooltip: t('Table view'),
                  },
                ]}
                value={props.viewMode}
                onChange={handleViewModeChange}
                ariaLabel={t('View mode')}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
