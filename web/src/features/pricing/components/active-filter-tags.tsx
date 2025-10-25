import { X } from 'lucide-react'
import {
  FILTER_ALL,
  QUOTA_TYPES,
  QUOTA_TYPE_LABELS,
  ENDPOINT_TYPES,
  ENDPOINT_TYPE_LABELS,
  type QuotaTypeOption,
  type EndpointTypeOption,
} from '../constants'

// ----------------------------------------------------------------------------
// Active Filter Tags Component
// ----------------------------------------------------------------------------

export interface ActiveFilterTagsProps {
  vendorFilter: string
  groupFilter: string
  quotaTypeFilter: string
  endpointTypeFilter: string
  tagFilter: string
  onRemoveVendor: () => void
  onRemoveGroup: () => void
  onRemoveQuotaType: () => void
  onRemoveEndpointType: () => void
  onRemoveTag: () => void
}

export function ActiveFilterTags({
  vendorFilter,
  groupFilter,
  quotaTypeFilter,
  endpointTypeFilter,
  tagFilter,
  onRemoveVendor,
  onRemoveGroup,
  onRemoveQuotaType,
  onRemoveEndpointType,
  onRemoveTag,
}: ActiveFilterTagsProps) {
  const hasActiveFilters =
    vendorFilter !== FILTER_ALL ||
    groupFilter !== FILTER_ALL ||
    quotaTypeFilter !== QUOTA_TYPES.ALL ||
    endpointTypeFilter !== ENDPOINT_TYPES.ALL ||
    tagFilter !== FILTER_ALL

  if (!hasActiveFilters) return null

  return (
    <div className='hidden items-center gap-2 lg:flex'>
      {vendorFilter !== FILTER_ALL && (
        <div className='bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs'>
          <span>Vendor: {vendorFilter}</span>
          <button
            onClick={onRemoveVendor}
            className='hover:bg-secondary-foreground/20 rounded-sm p-0.5 transition-colors'
            aria-label={`Remove vendor filter: ${vendorFilter}`}
          >
            <X className='h-3 w-3' />
          </button>
        </div>
      )}
      {groupFilter !== FILTER_ALL && (
        <div className='bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs'>
          <span>Group: {groupFilter}</span>
          <button
            onClick={onRemoveGroup}
            className='hover:bg-secondary-foreground/20 rounded-sm p-0.5 transition-colors'
            aria-label={`Remove group filter: ${groupFilter}`}
          >
            <X className='h-3 w-3' />
          </button>
        </div>
      )}
      {quotaTypeFilter !== QUOTA_TYPES.ALL && (
        <div className='bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs'>
          <span>
            Type: {QUOTA_TYPE_LABELS[quotaTypeFilter as QuotaTypeOption]}
          </span>
          <button
            onClick={onRemoveQuotaType}
            className='hover:bg-secondary-foreground/20 rounded-sm p-0.5 transition-colors'
            aria-label='Remove pricing type filter'
          >
            <X className='h-3 w-3' />
          </button>
        </div>
      )}
      {endpointTypeFilter !== ENDPOINT_TYPES.ALL && (
        <div className='bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs'>
          <span>
            Endpoint:{' '}
            {ENDPOINT_TYPE_LABELS[endpointTypeFilter as EndpointTypeOption]}
          </span>
          <button
            onClick={onRemoveEndpointType}
            className='hover:bg-secondary-foreground/20 rounded-sm p-0.5 transition-colors'
            aria-label='Remove endpoint type filter'
          >
            <X className='h-3 w-3' />
          </button>
        </div>
      )}
      {tagFilter !== FILTER_ALL && (
        <div className='bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs'>
          <span>Tag: {tagFilter}</span>
          <button
            onClick={onRemoveTag}
            className='hover:bg-secondary-foreground/20 rounded-sm p-0.5 transition-colors'
            aria-label={`Remove tag filter: ${tagFilter}`}
          >
            <X className='h-3 w-3' />
          </button>
        </div>
      )}
    </div>
  )
}
