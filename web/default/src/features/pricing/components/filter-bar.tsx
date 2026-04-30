import { useCallback, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Filter,
  RotateCcw,
  Table2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  FILTER_ALL,
  QUOTA_TYPES,
  ENDPOINT_TYPES,
  VIEW_MODES,
  getSortLabels,
  getQuotaTypeLabels,
  getEndpointTypeLabels,
  type SortOption,
  type ViewMode,
} from '../constants'
import type { PricingVendor, TokenUnit } from '../types'

interface FilterOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface FilterChipProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  defaultValue?: string
  searchPlaceholder?: string
  className?: string
}

function FilterChip(props: FilterChipProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const defaultVal = props.defaultValue ?? FILTER_ALL
  const isActive = props.value !== defaultVal
  const selectedOption = props.options.find((o) => o.value === props.value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          role='combobox'
          aria-expanded={open}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
            isActive
              ? 'border-foreground/30 bg-foreground/5 text-foreground'
              : 'border-border bg-muted/50 text-muted-foreground hover:border-border/80 hover:text-foreground hover:bg-muted',
            props.className
          )}
        >
          {selectedOption?.icon}
          <span className='max-w-[100px] truncate'>
            {isActive && selectedOption ? selectedOption.label : props.label}
          </span>
          <ChevronDown
            className={cn(
              'size-3.5 transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-52 p-0' align='start'>
        <Command>
          <CommandInput
            placeholder={props.searchPlaceholder || t('Search...')}
            className='h-9'
          />
          <CommandList className='max-h-64'>
            <CommandEmpty>{t('No results found')}</CommandEmpty>
            <CommandGroup>
              {props.options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    props.onChange(option.value)
                    setOpen(false)
                  }}
                  className='gap-2'
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      props.value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.icon && (
                    <span className='shrink-0'>{option.icon}</span>
                  )}
                  <span className='truncate'>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface SegmentedControlProps {
  options: Array<{
    value: string
    label?: string
    icon?: React.ComponentType<{ className?: string }>
    tooltip?: string
  }>
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}

function SegmentedControl(props: SegmentedControlProps) {
  return (
    <div
      role='group'
      aria-label={props.ariaLabel}
      className='bg-muted/60 inline-flex h-8 items-center rounded-md border p-0.5'
    >
      {props.options.map((option) => {
        const isActive = option.value === props.value
        const Icon = option.icon
        const isIconOnly = Icon && !option.label
        const button = (
          <button
            key={option.value}
            type='button'
            onClick={() => props.onChange(option.value)}
            className={cn(
              'inline-flex h-[calc(100%)] items-center justify-center rounded-[5px] text-xs font-medium transition-all',
              isIconOnly ? 'w-7' : 'gap-1.5 px-2.5',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={isActive}
          >
            {Icon && <Icon className='size-3.5' />}
            {option.label}
          </button>
        )

        if (option.tooltip) {
          return (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side='bottom' className='text-xs'>
                {option.tooltip}
              </TooltipContent>
            </Tooltip>
          )
        }

        return button
      })}
    </div>
  )
}

interface ActiveFilterBadgeProps {
  label: string
  onRemove: () => void
}

function ActiveFilterBadge(props: ActiveFilterBadgeProps) {
  const { t } = useTranslation()

  return (
    <Badge
      variant='secondary'
      className='gap-1 py-1 pr-1 pl-2.5 text-xs font-medium'
    >
      {props.label}
      <button
        type='button'
        onClick={props.onRemove}
        className='hover:bg-secondary-foreground/10 rounded-full p-0.5 transition-colors'
        aria-label={`${t('Remove filter')}: ${props.label}`}
      >
        <X className='size-3' />
      </button>
    </Badge>
  )
}

interface MobileFilterGroupProps {
  title: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

function MobileFilterGroup(props: MobileFilterGroupProps) {
  return (
    <div className='space-y-2.5'>
      <h3 className='text-foreground text-sm font-semibold'>{props.title}</h3>
      <div className='flex flex-wrap gap-2'>
        {props.options.map((option) => {
          const isActive = props.value === option.value
          return (
            <button
              key={option.value}
              type='button'
              onClick={() => props.onChange(option.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                isActive
                  ? 'border-foreground/30 bg-foreground/5 text-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              {option.icon}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export interface FilterBarProps {
  quotaTypeFilter: string
  endpointTypeFilter: string
  vendorFilter: string
  groupFilter: string
  tagFilter: string
  onQuotaTypeChange: (v: string) => void
  onEndpointTypeChange: (v: string) => void
  onVendorChange: (v: string) => void
  onGroupChange: (v: string) => void
  onTagChange: (v: string) => void
  vendors: PricingVendor[]
  groups: string[]
  tags: string[]
  sortBy: string
  onSortChange: (v: string) => void
  tokenUnit: TokenUnit
  onTokenUnitChange: (v: TokenUnit) => void
  showRechargePrice: boolean
  onRechargePriceChange: (v: boolean) => void
  viewMode: ViewMode
  onViewModeChange: (v: ViewMode) => void
  hasActiveFilters: boolean
  activeFilterCount: number
  onClearFilters: () => void
  filteredCount: number
  totalCount?: number
}

export function FilterBar(props: FilterBarProps) {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const {
    quotaTypeFilter,
    endpointTypeFilter,
    vendorFilter,
    groupFilter,
    tagFilter,
    onQuotaTypeChange,
    onEndpointTypeChange,
    onVendorChange,
    onGroupChange,
    onTagChange,
    vendors,
    groups,
    tags,
    onTokenUnitChange,
    onViewModeChange,
    onRechargePriceChange,
  } = props

  const quotaTypeLabels = getQuotaTypeLabels(t)
  const endpointTypeLabels = getEndpointTypeLabels(t)
  const sortLabels = getSortLabels(t)

  const typeOptions = useMemo<FilterOption[]>(
    () =>
      Object.entries(quotaTypeLabels).map(([value, label]) => ({
        value,
        label,
      })),
    [quotaTypeLabels]
  )

  const endpointOptions = useMemo<FilterOption[]>(
    () =>
      Object.entries(endpointTypeLabels).map(([value, label]) => ({
        value,
        label,
      })),
    [endpointTypeLabels]
  )

  const vendorOptions = useMemo<FilterOption[]>(
    () => [
      { value: FILTER_ALL, label: t('All Vendors') },
      ...vendors.map((v) => ({
        value: v.name,
        label: v.name,
        icon: v.icon ? getLobeIcon(v.icon, 14) : undefined,
      })),
    ],
    [vendors, t]
  )

  const groupOptions = useMemo<FilterOption[]>(
    () => [
      { value: FILTER_ALL, label: t('All Groups') },
      ...groups.map((g) => ({ value: g, label: g })),
    ],
    [groups, t]
  )

  const tagOptions = useMemo<FilterOption[]>(
    () => [
      { value: FILTER_ALL, label: t('All Tags') },
      ...tags.map((tag) => ({ value: tag, label: tag })),
    ],
    [tags, t]
  )

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; onRemove: () => void }> =
      []

    if (quotaTypeFilter !== QUOTA_TYPES.ALL) {
      filters.push({
        key: 'quotaType',
        label:
          quotaTypeLabels[quotaTypeFilter as keyof typeof quotaTypeLabels] ||
          quotaTypeFilter,
        onRemove: () => onQuotaTypeChange(QUOTA_TYPES.ALL),
      })
    }

    if (endpointTypeFilter !== ENDPOINT_TYPES.ALL) {
      filters.push({
        key: 'endpointType',
        label:
          endpointTypeLabels[
            endpointTypeFilter as keyof typeof endpointTypeLabels
          ] || endpointTypeFilter,
        onRemove: () => onEndpointTypeChange(ENDPOINT_TYPES.ALL),
      })
    }

    if (vendorFilter !== FILTER_ALL) {
      filters.push({
        key: 'vendor',
        label: vendorFilter,
        onRemove: () => onVendorChange(FILTER_ALL),
      })
    }

    if (groupFilter !== FILTER_ALL) {
      filters.push({
        key: 'group',
        label: groupFilter,
        onRemove: () => onGroupChange(FILTER_ALL),
      })
    }

    if (tagFilter !== FILTER_ALL) {
      filters.push({
        key: 'tag',
        label: tagFilter,
        onRemove: () => onTagChange(FILTER_ALL),
      })
    }

    return filters
  }, [
    quotaTypeFilter,
    endpointTypeFilter,
    vendorFilter,
    groupFilter,
    tagFilter,
    onQuotaTypeChange,
    onEndpointTypeChange,
    onVendorChange,
    onGroupChange,
    onTagChange,
    quotaTypeLabels,
    endpointTypeLabels,
  ])

  const handleTokenUnitChange = useCallback(
    (v: string) => onTokenUnitChange(v as TokenUnit),
    [onTokenUnitChange]
  )

  const handleViewModeChange = useCallback(
    (v: string) => onViewModeChange(v as ViewMode),
    [onViewModeChange]
  )

  const handleRechargePriceChange = useCallback(
    (v: string) => onRechargePriceChange(v === 'recharge'),
    [onRechargePriceChange]
  )

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-3'>
        <div className='hidden flex-1 flex-wrap items-center gap-2 lg:flex'>
          <FilterChip
            label={t('Pricing')}
            value={props.quotaTypeFilter}
            options={typeOptions}
            onChange={props.onQuotaTypeChange}
            defaultValue={QUOTA_TYPES.ALL}
          />
          <FilterChip
            label={t('Endpoint')}
            value={props.endpointTypeFilter}
            options={endpointOptions}
            onChange={props.onEndpointTypeChange}
            defaultValue={ENDPOINT_TYPES.ALL}
          />
          {props.vendors.length > 0 && (
            <FilterChip
              label={t('Vendor')}
              value={props.vendorFilter}
              options={vendorOptions}
              onChange={props.onVendorChange}
              searchPlaceholder={t('Search vendors...')}
            />
          )}
          {props.groups.length > 0 && (
            <FilterChip
              label={t('Group')}
              value={props.groupFilter}
              options={groupOptions}
              onChange={props.onGroupChange}
              searchPlaceholder={t('Search groups...')}
            />
          )}
          {props.tags.length > 0 && (
            <FilterChip
              label={t('Tag')}
              value={props.tagFilter}
              options={tagOptions}
              onChange={props.onTagChange}
              searchPlaceholder={t('Search tags...')}
            />
          )}
        </div>

        <Button
          variant='outline'
          size='sm'
          onClick={() => setMobileOpen(true)}
          className='gap-1.5 lg:hidden'
        >
          <Filter className='size-4' />
          {t('Filters')}
          {props.activeFilterCount > 0 && (
            <Badge className='ml-0.5 size-5 justify-center rounded-full p-0 text-[10px]'>
              {props.activeFilterCount}
            </Badge>
          )}
        </Button>

        <div className='flex-1 lg:hidden' />

        <div className='flex items-center gap-1.5'>
          <div className='hidden items-center gap-1.5 sm:flex'>
            <SegmentedControl
              options={[
                { value: 'standard', label: t('Standard') },
                { value: 'recharge', label: t('Recharge') },
              ]}
              value={props.showRechargePrice ? 'recharge' : 'standard'}
              onChange={handleRechargePriceChange}
              ariaLabel={t('Price display mode')}
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
            <div className='bg-border mx-0.5 h-4 w-px' />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className='h-8 gap-1.5 px-2.5 text-xs font-medium'
              >
                <ArrowUpDown className='size-3.5' />
                <span className='hidden sm:inline'>
                  {sortLabels[props.sortBy as SortOption] || t('Sort')}
                </span>
              </Button>
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

          <SegmentedControl
            options={[
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

      {activeFilters.length > 0 && (
        <div className='flex flex-wrap items-center gap-2'>
          {activeFilters.map((filter) => (
            <ActiveFilterBadge
              key={filter.key}
              label={filter.label}
              onRemove={filter.onRemove}
            />
          ))}
          <Button
            variant='ghost'
            size='sm'
            onClick={props.onClearFilters}
            className='text-muted-foreground hover:text-foreground h-6 gap-1 px-2 text-xs'
          >
            <RotateCcw className='size-3' />
            {t('Clear all')}
          </Button>
        </div>
      )}

      <div className='text-muted-foreground flex items-baseline gap-1 text-sm'>
        <span className='text-foreground font-semibold tabular-nums'>
          {props.filteredCount.toLocaleString()}
        </span>
        <span>{props.filteredCount === 1 ? t('model') : t('models')}</span>
        {props.hasActiveFilters && props.totalCount && (
          <span className='text-muted-foreground/60'>
            {t('of')} {props.totalCount.toLocaleString()}
          </span>
        )}
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side='right'
          className='flex h-dvh w-full flex-col overflow-hidden p-0 sm:max-w-md'
        >
          <SheetHeader className='border-b px-4 py-3 sm:px-6 sm:py-4'>
            <SheetTitle>{t('Filters')}</SheetTitle>
            <SheetDescription className='sr-only'>
              {t('Filter models by type, endpoint, vendor, group and tags')}
            </SheetDescription>
          </SheetHeader>

          <div className='flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5'>
            <MobileFilterGroup
              title={t('Pricing Type')}
              value={props.quotaTypeFilter}
              options={typeOptions}
              onChange={props.onQuotaTypeChange}
            />
            <MobileFilterGroup
              title={t('Endpoint Type')}
              value={props.endpointTypeFilter}
              options={endpointOptions}
              onChange={props.onEndpointTypeChange}
            />
            {props.vendors.length > 0 && (
              <MobileFilterGroup
                title={t('Vendor')}
                value={props.vendorFilter}
                options={vendorOptions}
                onChange={props.onVendorChange}
              />
            )}
            {props.groups.length > 0 && (
              <MobileFilterGroup
                title={t('Group')}
                value={props.groupFilter}
                options={groupOptions}
                onChange={props.onGroupChange}
              />
            )}
            {props.tags.length > 0 && (
              <MobileFilterGroup
                title={t('Tag')}
                value={props.tagFilter}
                options={tagOptions}
                onChange={props.onTagChange}
              />
            )}

            <div className='border-t pt-5'>
              <h3 className='text-foreground mb-3 text-sm font-semibold'>
                {t('Display Options')}
              </h3>
              <div className='space-y-3 sm:space-y-4'>
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-xs'>
                    {t('Price display')}
                  </p>
                  <SegmentedControl
                    options={[
                      { value: 'standard', label: t('Standard') },
                      { value: 'recharge', label: t('Recharge') },
                    ]}
                    value={props.showRechargePrice ? 'recharge' : 'standard'}
                    onChange={handleRechargePriceChange}
                    ariaLabel={t('Price display mode')}
                  />
                </div>
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-xs'>
                    {t('Token unit')}
                  </p>
                  <SegmentedControl
                    options={[
                      { value: 'M', label: t('Per 1M tokens') },
                      { value: 'K', label: t('Per 1K tokens') },
                    ]}
                    value={props.tokenUnit}
                    onChange={handleTokenUnitChange}
                    ariaLabel={t('Token unit')}
                  />
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className='border-t px-4 py-3 sm:px-6 sm:py-4'>
            <div className='grid w-full grid-cols-2 gap-2 sm:flex sm:gap-3'>
              {props.hasActiveFilters && (
                <Button
                  variant='outline'
                  onClick={props.onClearFilters}
                  className='flex-1'
                >
                  {t('Reset')}
                </Button>
              )}
              <Button onClick={() => setMobileOpen(false)} className='flex-1'>
                {t('Show')} {props.filteredCount} {t('models')}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
