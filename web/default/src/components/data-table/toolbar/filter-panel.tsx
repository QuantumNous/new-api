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
import type { Table } from '@tanstack/react-table'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Input } from '@/components/design-system/input'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks'
import { cn } from '@/lib/utils'

import { DataTableViewOptions } from './view-options'

export interface DataTableFilterPanelProps<TData> {
  table: Table<TData>
  primaryFilters: ReactNode
  advancedFilters?: ReactNode
  mobilePinnedFilters?: ReactNode
  mobileFilters?: ReactNode
  mobileFilterCount?: number
  stats?: ReactNode
  actionStart?: ReactNode
  viewToggle?: ReactNode
  hideViewOptions?: boolean
  hasActiveFilters: boolean
  hasAdvancedActiveFilters?: boolean
  advancedFilterCount?: number
  searchLoading?: boolean
  onReset: () => void
  onSearch?: () => void
  inlineActions?: boolean
  className?: string
}

interface DataTableFilterFieldProps {
  children: ReactNode
  wide?: boolean
  className?: string
}

export function DataTableFilterField(props: DataTableFilterFieldProps) {
  return (
    <div
      className={cn(
        'min-w-0 [&>button]:w-full [&>input]:w-full [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:text-sm [&_[data-slot=select-value]]:leading-5',
        props.wide && 'sm:col-span-2',
        props.className
      )}
    >
      {props.children}
    </div>
  )
}

export function DataTableFilterInput(props: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn('min-w-0 text-sm leading-5', props.className)}
    />
  )
}

export function DataTableFilterPanel<TData>(
  props: DataTableFilterPanelProps<TData>
) {
  const { t } = useTranslation()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 640px)')

  const hasAdvancedFilters = props.advancedFilters != null
  const hasMobileFilters =
    props.mobileFilters != null || props.advancedFilters != null
  const activeAdvancedCount =
    props.advancedFilterCount ?? (props.hasAdvancedActiveFilters ? 1 : 0)
  const activeMobileFilterCount = props.mobileFilterCount ?? activeAdvancedCount

  const handleMobileReset = () => {
    props.onReset()
    setMobileFiltersOpen(false)
  }

  const handleMobileSubmit = () => {
    props.onSearch?.()
    setMobileFiltersOpen(false)
  }

  const advancedToggle = hasAdvancedFilters ? (
    <Button
      type='button'
      variant='ghost'
      onClick={() => setAdvancedOpen((open) => !open)}
      aria-expanded={advancedOpen}
      className={cn(
        'text-muted-foreground hover:text-foreground gap-1 px-2',
        props.hasAdvancedActiveFilters &&
          !advancedOpen &&
          'text-primary hover:text-primary'
      )}
    >
      {advancedOpen ? t('Collapse') : t('Expand')}
      {activeAdvancedCount > 0 && (
        <Badge variant='secondary' className='ml-0.5'>
          {activeAdvancedCount}
        </Badge>
      )}
      <ChevronDown
        className={cn(
          'size-3.5 transition-transform duration-200',
          advancedOpen && 'rotate-180'
        )}
      />
    </Button>
  ) : null

  const viewOptions = !props.hideViewOptions ? (
    <DataTableViewOptions table={props.table} />
  ) : null

  const desktopActions = (
    <div className='ms-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2'>
      {props.actionStart}
      <Button
        type='button'
        variant={props.onSearch ? 'outline' : 'ghost'}
        onClick={props.onReset}
        disabled={!props.hasActiveFilters}
        className={cn(
          !props.onSearch && 'text-muted-foreground hover:text-foreground px-2'
        )}
      >
        {t('Reset')}
      </Button>
      {props.onSearch && (
        <Button
          type='button'
          onClick={props.onSearch}
          disabled={props.searchLoading}
        >
          {props.searchLoading && <Loader2 className='animate-spin' />}
          {t('Search')}
        </Button>
      )}
      {props.viewToggle}
      {viewOptions}
    </div>
  )

  if (isMobile && props.mobilePinnedFilters != null) {
    return (
      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <div
          className={cn(
            'bg-card/50 min-w-0 rounded-lg border p-2.5',
            props.className
          )}
        >
          <div className='grid min-w-0 gap-2'>{props.mobilePinnedFilters}</div>

          <div className='mt-2 flex min-w-0 flex-col gap-2'>
            {props.stats}
            <div className='flex flex-wrap items-center justify-end gap-1.5'>
              {props.actionStart}
              {hasMobileFilters && (
                <DrawerTrigger
                  render={
                    <Button
                      type='button'
                      variant='ghost'
                      className={cn(
                        'text-muted-foreground hover:text-foreground gap-1 px-2',
                        activeMobileFilterCount > 0 &&
                          'text-primary hover:text-primary'
                      )}
                    >
                      {t('Filter')}
                      {activeMobileFilterCount > 0 && (
                        <Badge variant='secondary' className='ml-0.5'>
                          {activeMobileFilterCount}
                        </Badge>
                      )}
                    </Button>
                  }
                />
              )}
              {!hasMobileFilters && (
                <Button
                  type='button'
                  variant='ghost'
                  onClick={props.onReset}
                  disabled={!props.hasActiveFilters}
                  className='text-muted-foreground hover:text-foreground px-2'
                >
                  {t('Reset')}
                </Button>
              )}
              {props.onSearch && (
                <Button
                  type='button'
                  onClick={props.onSearch}
                  disabled={props.searchLoading}
                >
                  {props.searchLoading && <Loader2 className='animate-spin' />}
                  {t('Search')}
                </Button>
              )}
              {props.viewToggle}
              {viewOptions}
            </div>
          </div>
        </div>

        {hasMobileFilters && (
          <DrawerContent className='max-h-[85dvh] p-0'>
            <div className='mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden'>
              <DrawerHeader className='border-border/70 border-b px-4 py-3 text-left'>
                <DrawerTitle>{t('Filter')}</DrawerTitle>
                <DrawerDescription>{t('Filters')}</DrawerDescription>
              </DrawerHeader>
              <div className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3'>
                {props.mobileFilters ?? (
                  <>
                    {props.primaryFilters}
                    {props.advancedFilters}
                  </>
                )}
              </div>
              <DrawerFooter className='border-border/70 grid grid-cols-2 gap-2 border-t px-4 py-3'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleMobileReset}
                  disabled={!props.hasActiveFilters}
                >
                  {t('Reset')}
                </Button>
                <Button
                  type='button'
                  onClick={handleMobileSubmit}
                  disabled={props.searchLoading}
                >
                  {props.searchLoading && <Loader2 className='animate-spin' />}
                  {props.onSearch ? t('Search') : t('Done')}
                </Button>
              </DrawerFooter>
            </div>
          </DrawerContent>
        )}
      </Drawer>
    )
  }

  return (
    <div
      className={cn(
        'bg-card/50 min-w-0 rounded-lg border p-2.5 sm:p-3',
        props.className
      )}
    >
      <div className='flex min-w-0 flex-wrap items-start gap-2'>
        <div className='grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] [&>input]:w-full'>
          {props.primaryFilters}
        </div>
        {advancedToggle && (
          <div className='flex shrink-0 items-center justify-end'>
            {advancedToggle}
          </div>
        )}
        {props.inlineActions && desktopActions}
      </div>

      {advancedOpen && props.advancedFilters && (
        <div className='mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] [&>input]:w-full'>
          {props.advancedFilters}
        </div>
      )}

      {(!props.inlineActions || props.stats != null) && (
        <div className='mt-2 flex min-w-0 flex-wrap items-center gap-2'>
          {props.stats}
          {!props.inlineActions && desktopActions}
        </div>
      )}
    </div>
  )
}
