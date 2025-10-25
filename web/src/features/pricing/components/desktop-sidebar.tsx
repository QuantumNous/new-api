import { cn } from '@/lib/utils'
import {
  FILTER_SECTIONS,
  QUOTA_TYPES,
  QUOTA_TYPE_LABELS,
  ENDPOINT_TYPES,
  ENDPOINT_TYPE_LABELS,
  SIDEBAR_WIDTH,
} from '../constants'
import type { PricingVendor } from '../types'
import { FilterButton } from './filter-button'
import { FilterList } from './filter-list'
import { FilterSection } from './filter-section'

// ----------------------------------------------------------------------------
// Desktop Sidebar Component
// ----------------------------------------------------------------------------

export interface DesktopSidebarProps {
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
  openSections: Record<string, boolean>
  onToggleSection: (section: string) => void
  expandedFilters: Record<string, boolean>
  onToggleExpandFilter: (filterType: 'vendor' | 'group' | 'tag') => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function DesktopSidebar({
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
  openSections,
  onToggleSection,
  expandedFilters,
  onToggleExpandFilter,
  hasActiveFilters,
  onClearFilters,
}: DesktopSidebarProps) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 lg:block',
        SIDEBAR_WIDTH,
        'sticky top-20 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto',
        'animate-appear'
      )}
    >
      <div className='space-y-1 pr-2'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-foreground/60 text-sm font-semibold tracking-wide uppercase'>
            Filters
          </h2>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className='text-muted-foreground hover:text-foreground text-xs transition-colors'
            >
              Clear all
            </button>
          )}
        </div>

        {/* Pricing Type Filter */}
        <FilterSection
          title='Pricing Type'
          isOpen={openSections[FILTER_SECTIONS.PRICING_TYPE]}
          onToggle={() => onToggleSection(FILTER_SECTIONS.PRICING_TYPE)}
        >
          <div className='flex flex-col gap-1'>
            {Object.values(QUOTA_TYPES).map((type) => (
              <FilterButton
                key={type}
                isActive={quotaTypeFilter === type}
                onClick={() => onQuotaTypeChange(type)}
              >
                {QUOTA_TYPE_LABELS[type]}
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
            {Object.values(ENDPOINT_TYPES).map((type) => (
              <FilterButton
                key={type}
                isActive={endpointTypeFilter === type}
                onClick={() => onEndpointTypeChange(type)}
              >
                {ENDPOINT_TYPE_LABELS[type]}
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
    </aside>
  )
}
