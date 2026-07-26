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
  ArrowUpDown,
  Check,
  ChevronDown,
  Filter,
  Grid2X2,
  Table2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  PRICING_CURRENCIES,
  VIEW_MODES,
  getSortLabels,
  type PricingCurrency,
  type SortOption,
  type ViewMode,
} from '../constants'
import { formatGroupRatio } from '../lib/model-helpers'
import type { PricingModel, PricingVendor, TokenUnit } from '../types'
import { PricingSidebar } from './pricing-sidebar'
import { SearchBar } from './search-bar'

type SegmentOption = {
  value: string
  label?: string
  icon?: React.ComponentType<{ className?: string }>
  tooltip?: string
}

export interface PricingToolbarProps {
  searchInput: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  filteredCount: number
  totalCount?: number
  sortBy: string
  onSortChange: (value: string) => void
  tokenUnit: TokenUnit
  onTokenUnitChange: (value: TokenUnit) => void
  displayCurrency: PricingCurrency
  onCurrencyChange: (value: PricingCurrency) => void
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
  activeFilterCount: number
  onClearFilters: () => void
}

type FilterDropdownOption = {
  value: string
  label: string
}

function SegmentedControl(props: {
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <div
      role='group'
      aria-label={props.ariaLabel}
      className='bg-muted/60 inline-flex h-8 items-center rounded-lg border p-0.5'
    >
      {props.options.map((option) => {
        const Icon = option.icon
        const isActive = option.value === props.value
        const button = (
          <button
            key={option.value}
            type='button'
            onClick={() => props.onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex h-full items-center justify-center rounded-md text-xs font-medium transition-all',
              Icon && !option.label ? 'w-7' : 'gap-1.5 px-3',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className='size-3.5' />}
            {option.label}
          </button>
        )

        if (!option.tooltip) {
          return button
        }

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger render={button} />
            <TooltipContent side='bottom' className='text-xs'>
              {option.tooltip}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

function FilterDropdown(props: {
  label: string
  value: string
  options: FilterDropdownOption[]
  onChange: (value: string) => void
}) {
  const selectedLabel =
    props.options.find((option) => option.value === props.value)?.label ||
    props.options[0]?.label ||
    props.label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type='button'
            variant='outline'
            className='h-10 w-full justify-between px-3 font-normal'
          />
        }
      >
        <span className='flex min-w-0 items-center gap-2'>
          <span className='text-muted-foreground shrink-0 text-xs'>
            {props.label}
          </span>
          <span className='truncate text-sm font-medium'>{selectedLabel}</span>
        </span>
        <ChevronDown data-icon='inline-end' />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='start'
        className='min-w-[var(--anchor-width)]'
      >
        <DropdownMenuGroup>
          {props.options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => props.onChange(option.value)}
            >
              <Check
                className={cn(
                  props.value === option.value ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span className='truncate'>{option.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PricingToolbar(props: PricingToolbarProps) {
  const { t } = useTranslation()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const sortLabels = getSortLabels(t)

  const handleTokenUnitChange = (value: string) => {
    props.onTokenUnitChange(value as TokenUnit)
  }

  const handleViewModeChange = (value: string) => {
    props.onViewModeChange(value as ViewMode)
  }

  const handleCurrencyChange = (value: string) => {
    props.onCurrencyChange(value as PricingCurrency)
  }

  const vendorOptions: FilterDropdownOption[] = [
    { value: 'all', label: t('All Vendors') },
    ...props.vendors.map((vendor) => ({
      value: vendor.name,
      label: vendor.name,
    })),
  ]
  const groupOptions: FilterDropdownOption[] = [
    { value: 'all', label: t('All Groups') },
    ...props.groups.map((group) => {
      const ratioLabel = formatGroupRatio(props.groupRatios?.[group])
      return {
        value: group,
        label: ratioLabel ? `${group} · ${ratioLabel}` : group,
      }
    }),
  ]

  return (
    <section className='flex flex-col gap-3'>
      <div className='grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_220px_220px_auto]'>
        <SearchBar
          value={props.searchInput}
          onChange={props.onSearchChange}
          onClear={props.onClearSearch}
          placeholder={t('Search model name, provider, endpoint, or tag...')}
          className='md:col-span-2 lg:col-span-1'
        />
        <FilterDropdown
          label={t('Provider')}
          value={props.vendorFilter}
          options={vendorOptions}
          onChange={props.onVendorChange}
        />
        <FilterDropdown
          label={t('Pricing group')}
          value={props.groupFilter}
          options={groupOptions}
          onChange={props.onGroupChange}
        />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={() => setMobileFiltersOpen(true)}
                className='relative size-10'
                aria-label={t('More filters')}
              />
            }
          >
            <Filter />
            {props.activeFilterCount > 0 && (
              <Badge className='absolute -top-2 -right-2 size-5 justify-center p-0 text-[10px]'>
                {props.activeFilterCount}
              </Badge>
            )}
          </TooltipTrigger>
          <TooltipContent>{t('More filters')}</TooltipContent>
        </Tooltip>
      </div>

      <div className='border-border/70 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-2'>
          <div className='text-muted-foreground flex items-baseline gap-1 text-sm'>
            <span className='text-foreground font-semibold tabular-nums'>
              {props.filteredCount.toLocaleString()}
            </span>
            <span>{props.filteredCount === 1 ? t('model') : t('models')}</span>
            {props.hasActiveFilters && props.totalCount && (
              <span className='text-muted-foreground/60 text-xs'>
                / {props.totalCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-2'>
            <SegmentedControl
              options={[
                { value: PRICING_CURRENCIES.CNY, label: '¥ CNY' },
                { value: PRICING_CURRENCIES.USD, label: '$ USD' },
              ]}
              value={props.displayCurrency}
              onChange={handleCurrencyChange}
              ariaLabel={t('Currency')}
            />
            <SegmentedControl
              options={[
                { value: 'M', label: '/1M' },
                { value: 'K', label: '/1K' },
              ]}
              value={props.tokenUnit}
              onChange={handleTokenUnitChange}
              ariaLabel={t('Token unit')}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-8 gap-1.5 px-3 text-xs'
                />
              }
            >
              <ArrowUpDown className='size-3.5' />
              <span>{sortLabels[props.sortBy as SortOption] || t('Sort')}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44'>
              <DropdownMenuGroup>
                {Object.entries(sortLabels).map(([value, label]) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => props.onSortChange(value)}
                  >
                    <Check
                      className={cn(
                        props.sortBy === value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

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

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent
          side='right'
          className={sideDrawerContentClassName('sm:max-w-md')}
        >
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle>{t('Filter')}</SheetTitle>
            <SheetDescription>
              {t('Filter models by provider, group, type, endpoint, and tags.')}
            </SheetDescription>
          </SheetHeader>
          <div className={sideDrawerFormClassName('gap-0')}>
            <PricingSidebar
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
              className='border-0 bg-transparent p-0 shadow-none'
            />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
