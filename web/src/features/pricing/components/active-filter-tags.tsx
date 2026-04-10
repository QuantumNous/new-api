import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  FILTER_ALL,
  QUOTA_TYPES,
  ENDPOINT_TYPES,
  getEndpointTypeLabels,
  getQuotaTypeLabels,
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
  const { t } = useTranslation()
  const quotaTypeLabels = getQuotaTypeLabels(t)
  const endpointTypeLabels = getEndpointTypeLabels(t)
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
          <span>
            {t('Vendor:')} {vendorFilter}
          </span>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onRemoveVendor}
            className='hover:bg-secondary-foreground/20 size-auto rounded-sm p-0.5'
            aria-label={`Remove vendor filter: ${vendorFilter}`}
          >
            <X className='h-3 w-3' />
          </Button>
        </div>
      )}
      {groupFilter !== FILTER_ALL && (
        <div className='bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs'>
          <span>
            {t('Group:')} {groupFilter}
          </span>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onRemoveGroup}
            className='hover:bg-secondary-foreground/20 size-auto rounded-sm p-0.5'
            aria-label={`Remove group filter: ${groupFilter}`}
          >
            <X className='h-3 w-3' />
          </Button>
        </div>
      )}
      {quotaTypeFilter !== QUOTA_TYPES.ALL && (
        <div className='bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs'>
          <span>
            {t('Type:')} {quotaTypeLabels[quotaTypeFilter as QuotaTypeOption]}
          </span>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onRemoveQuotaType}
            className='hover:bg-secondary-foreground/20 size-auto rounded-sm p-0.5'
            aria-label={t('Remove pricing type filter')}
          >
            <X className='h-3 w-3' />
          </Button>
        </div>
      )}
      {endpointTypeFilter !== ENDPOINT_TYPES.ALL && (
        <div className='bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs'>
          <span>
            {t('Endpoint:')}{' '}
            {endpointTypeLabels[endpointTypeFilter as EndpointTypeOption]}
          </span>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onRemoveEndpointType}
            className='hover:bg-secondary-foreground/20 size-auto rounded-sm p-0.5'
            aria-label={t('Remove endpoint type filter')}
          >
            <X className='h-3 w-3' />
          </Button>
        </div>
      )}
      {tagFilter !== FILTER_ALL && (
        <div className='bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs'>
          <span>
            {t('Tag:')} {tagFilter}
          </span>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onRemoveTag}
            className='hover:bg-secondary-foreground/20 size-auto rounded-sm p-0.5'
            aria-label={`Remove tag filter: ${tagFilter}`}
          >
            <X className='h-3 w-3' />
          </Button>
        </div>
      )}
    </div>
  )
}
