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
import { ArrowDown01Icon, Refresh01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { FILTER_ALL, FUNCTION_TYPES, getFunctionTypeLabels } from '../constants'
import {
  filterByFunction,
  filterByVendor,
  modelSupportsFunction,
} from '../lib/filters'
import type { PricingModel, PricingVendor } from '../types'

type FilterOption = {
  value: string
  label: string
  count?: number
  icon?: ReactNode
}

type FilterSectionProps = {
  title: string
  value: string
  options: FilterOption[]
  onChange?: (value: string) => void
}

export interface PricingSidebarProps {
  vendorFilter: string
  functionFilter: string
  onVendorChange: (value: string) => void
  onFunctionChange: (value: string) => void
  vendors: PricingVendor[]
  models: PricingModel[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  className?: string
}

function countBy(
  models: PricingModel[],
  predicate: (model: PricingModel) => boolean
): number {
  return models.reduce((count, model) => count + (predicate(model) ? 1 : 0), 0)
}

function FilterChip(props: {
  option: FilterOption
  active: boolean
  onClick?: () => void
}) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      disabled={!props.onClick}
      aria-pressed={props.active}
      className={cn(
        'group inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-all',
        props.active
          ? 'border-foreground/30 bg-foreground/5 text-foreground shadow-sm'
          : 'border-border/70 bg-background text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground'
      )}
      title={props.option.label}
    >
      {props.option.icon && (
        <span className='shrink-0'>{props.option.icon}</span>
      )}
      <span className='truncate'>{props.option.label}</span>
      {props.option.count != null && (
        <Badge
          variant='secondary'
          className={cn(
            'h-5 min-w-5 justify-center rounded-md px-1.5 text-[12px]',
            props.active
              ? 'bg-background text-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {props.option.count}
        </Badge>
      )}
    </button>
  )
}

function FilterSection(props: FilterSectionProps) {
  return (
    <Collapsible
      defaultOpen
      className='border-border/70 border-b pb-3 last:border-b-0'
    >
      <CollapsibleTrigger className='group flex w-full items-center justify-between py-2.5 text-left'>
        <span className='text-foreground text-sm font-semibold'>
          {props.title}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className='text-muted-foreground size-4 transition-transform group-data-[panel-open]:rotate-180'
          strokeWidth={2}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='flex flex-wrap gap-1.5'>
          {props.options.map((option) => (
            <FilterChip
              key={option.value}
              option={option}
              active={props.value === option.value}
              onClick={
                props.onChange
                  ? () => props.onChange?.(option.value)
                  : undefined
              }
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function PricingSidebar(props: PricingSidebarProps) {
  const { t } = useTranslation()
  const functionTypeLabels = getFunctionTypeLabels(t)
  const modelsMatchingFunction = filterByFunction(
    props.models,
    props.functionFilter
  )
  const modelsMatchingVendor = filterByVendor(props.models, props.vendorFilter)
  const matchingModels = filterByFunction(
    modelsMatchingVendor,
    props.functionFilter
  )

  const vendorOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All Model Vendors'),
      count: modelsMatchingFunction.length,
    },
    ...props.vendors
      .map((vendor) => ({
        value: vendor.name,
        label: vendor.name,
        count: countBy(
          modelsMatchingFunction,
          (model) => model.vendor_name === vendor.name
        ),
        icon: vendor.icon ? getLobeIcon(vendor.icon, 14) : undefined,
      }))
      .filter(
        (vendor) => vendor.count > 0 || vendor.value === props.vendorFilter
      ),
  ]

  const groupOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('Default Group'),
      count: matchingModels.length,
    },
  ]

  const functionOptions: FilterOption[] = [
    {
      value: FUNCTION_TYPES.ALL,
      label: functionTypeLabels[FUNCTION_TYPES.ALL],
      count: modelsMatchingVendor.length,
    },
    ...Object.entries(functionTypeLabels)
      .filter(([value]) => value !== FUNCTION_TYPES.ALL)
      .map(([value, label]) => ({
        value,
        label,
        count: countBy(modelsMatchingVendor, (model) =>
          modelSupportsFunction(model, value)
        ),
      }))
      .filter(
        (option) => option.count > 0 || option.value === props.functionFilter
      ),
  ]

  return (
    <aside className={cn('rounded-xl border p-3', props.className)}>
      <div className='mb-2.5 flex items-center justify-between gap-2'>
        <div>
          <h2 className='text-foreground text-sm font-bold'>{t('Filter')}</h2>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('Filter models by model vendor and function category.')}
          </p>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={props.onClearFilters}
          disabled={!props.hasActiveFilters}
          className='h-7 gap-1.5 px-2 text-xs'
        >
          <HugeiconsIcon
            icon={Refresh01Icon}
            data-icon='inline-start'
            strokeWidth={2}
            aria-hidden
          />
          {t('Reset')}
        </Button>
      </div>

      {props.hasActiveFilters && (
        <Badge variant='secondary' className='mb-3'>
          {t('Filters active')}
        </Badge>
      )}

      <div className='space-y-1'>
        <FilterSection
          title={t('Groups')}
          value={FILTER_ALL}
          options={groupOptions}
        />
        <FilterSection
          title={t('Model Vendors')}
          value={props.vendorFilter}
          options={vendorOptions}
          onChange={props.onVendorChange}
        />
        <FilterSection
          title={t('Function Categories')}
          value={props.functionFilter}
          options={functionOptions}
          onChange={props.onFunctionChange}
        />
      </div>
    </aside>
  )
}
