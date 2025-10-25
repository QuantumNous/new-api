import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FILTER_ALL,
  QUOTA_TYPE_LABELS,
  ENDPOINT_TYPE_LABELS,
} from '../constants'
import type { PricingVendor } from '../types'

// ----------------------------------------------------------------------------
// Mobile Filters Component
// ----------------------------------------------------------------------------

export interface MobileFiltersProps {
  show: boolean
  onClose: () => void
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
  tags: string[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function MobileFilters({
  show,
  onClose,
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
  hasActiveFilters,
  onClearFilters,
}: MobileFiltersProps) {
  if (!show) return null

  return (
    <div className='border-border/40 bg-card space-y-4 rounded-lg border p-4 lg:hidden'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-semibold'>Filters</h3>
        <button
          onClick={onClose}
          className='text-muted-foreground hover:text-foreground'
          aria-label='Close filters'
        >
          <X className='h-4 w-4' />
        </button>
      </div>

      {/* Pricing Type */}
      <div className='space-y-2'>
        <label className='text-sm font-medium'>Pricing Type</label>
        <Select value={quotaTypeFilter} onValueChange={onQuotaTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(QUOTA_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Endpoint Type */}
      <div className='space-y-2'>
        <label className='text-sm font-medium'>Endpoint Type</label>
        <Select value={endpointTypeFilter} onValueChange={onEndpointTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ENDPOINT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vendor */}
      {vendors.length > 0 && (
        <div className='space-y-2'>
          <label className='text-sm font-medium'>Vendor</label>
          <Select value={vendorFilter} onValueChange={onVendorChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Vendors</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.name}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Group */}
      {groups.length > 0 && (
        <div className='space-y-2'>
          <label className='text-sm font-medium'>Group</label>
          <Select value={groupFilter} onValueChange={onGroupChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className='space-y-2'>
          <label className='text-sm font-medium'>Tags</label>
          <Select value={tagFilter} onValueChange={onTagChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All Tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasActiveFilters && (
        <Button
          variant='outline'
          size='sm'
          onClick={onClearFilters}
          className='w-full'
        >
          Clear all filters
        </Button>
      )}
    </div>
  )
}
