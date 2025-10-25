import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  FILTER_SECTIONS,
  QUOTA_TYPE_LABELS,
  ENDPOINT_TYPE_LABELS,
} from '../constants'
import type { PricingVendor } from '../types'
import { FilterButton } from './filter-button'
import { FilterList } from './filter-list'
import { FilterSection } from './filter-section'

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
  openSections: Record<string, boolean>
  onToggleSection: (section: string) => void
  expandedFilters: Record<string, boolean>
  onToggleExpandFilter: (filterType: 'vendor' | 'group' | 'tag') => void
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
  openSections,
  onToggleSection,
  expandedFilters,
  onToggleExpandFilter,
}: MobileFiltersProps) {
  return (
    <Sheet open={show} onOpenChange={onClose}>
      <SheetContent
        side='right'
        className='flex w-full flex-col overflow-hidden p-0 sm:max-w-md'
      >
        <SheetHeader className='border-b px-6 py-4'>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        {/* Filter Content - Scrollable */}
        <div className='flex-1 space-y-1 overflow-y-auto px-6'>
          {/* Pricing Type Filter */}
          <FilterSection
            title='Pricing Type'
            isOpen={openSections[FILTER_SECTIONS.PRICING_TYPE]}
            onToggle={() => onToggleSection(FILTER_SECTIONS.PRICING_TYPE)}
          >
            <div className='flex flex-col gap-1'>
              {Object.entries(QUOTA_TYPE_LABELS).map(([value, label]) => (
                <FilterButton
                  key={value}
                  isActive={quotaTypeFilter === value}
                  onClick={() => onQuotaTypeChange(value)}
                >
                  {label}
                </FilterButton>
              ))}
            </div>
          </FilterSection>

          {/* Endpoint Type Filter */}
          <FilterSection
            title='Endpoint Type'
            isOpen={openSections[FILTER_SECTIONS.ENDPOINT_TYPE]}
            onToggle={() => onToggleSection(FILTER_SECTIONS.ENDPOINT_TYPE)}
          >
            <div className='flex flex-col gap-1'>
              {Object.entries(ENDPOINT_TYPE_LABELS).map(([value, label]) => (
                <FilterButton
                  key={value}
                  isActive={endpointTypeFilter === value}
                  onClick={() => onEndpointTypeChange(value)}
                >
                  {label}
                </FilterButton>
              ))}
            </div>
          </FilterSection>

          {/* Vendor Filter */}
          {vendors.length > 0 && (
            <FilterSection
              title='Vendor'
              isOpen={openSections[FILTER_SECTIONS.VENDOR]}
              onToggle={() => onToggleSection(FILTER_SECTIONS.VENDOR)}
            >
              <FilterList
                items={vendors.map((v) => ({
                  id: v.id,
                  name: v.name,
                  icon: v.icon,
                }))}
                activeValue={vendorFilter}
                onSelect={onVendorChange}
                isExpanded={expandedFilters.vendor}
                onToggleExpand={() => onToggleExpandFilter('vendor')}
                allOptionLabel='All Vendors'
              />
            </FilterSection>
          )}

          {/* Group Filter */}
          {groups.length > 0 && (
            <FilterSection
              title='Group'
              isOpen={openSections[FILTER_SECTIONS.GROUP]}
              onToggle={() => onToggleSection(FILTER_SECTIONS.GROUP)}
            >
              <FilterList
                items={groups.map((g) => ({ id: g, name: g }))}
                activeValue={groupFilter}
                onSelect={onGroupChange}
                isExpanded={expandedFilters.group}
                onToggleExpand={() => onToggleExpandFilter('group')}
                allOptionLabel='All Groups'
              />
            </FilterSection>
          )}

          {/* Tag Filter */}
          {tags.length > 0 && (
            <FilterSection
              title='Tags'
              isOpen={openSections[FILTER_SECTIONS.TAG]}
              onToggle={() => onToggleSection(FILTER_SECTIONS.TAG)}
            >
              <FilterList
                items={tags.map((t) => ({ id: t, name: t }))}
                activeValue={tagFilter}
                onSelect={onTagChange}
                isExpanded={expandedFilters.tag}
                onToggleExpand={() => onToggleExpandFilter('tag')}
                allOptionLabel='All Tags'
              />
            </FilterSection>
          )}
        </div>

        {/* Footer with Actions */}
        <SheetFooter className='border-t px-6 py-4'>
          <div className='flex w-full gap-3'>
            {hasActiveFilters && (
              <Button
                variant='outline'
                onClick={onClearFilters}
                className='flex-1'
              >
                Reset Filters
              </Button>
            )}
            <Button onClick={onClose} className='flex-1'>
              Close
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
