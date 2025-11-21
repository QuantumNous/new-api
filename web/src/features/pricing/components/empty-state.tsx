import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

// ----------------------------------------------------------------------------
// Empty State Component
// ----------------------------------------------------------------------------

export interface EmptyStateProps {
  searchQuery?: string
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function EmptyState({
  searchQuery,
  hasActiveFilters,
  onClearFilters,
}: EmptyStateProps) {
  const { t } = useTranslation()
  return (
    <Empty className='min-h-[400px] border'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <Search />
        </EmptyMedia>
        <EmptyTitle>{t('No models found')}</EmptyTitle>
        <EmptyDescription>
          {searchQuery
            ? "Try adjusting your search or filters to find what you're looking for."
            : 'No models match your current filters. Try changing your filter criteria.'}
        </EmptyDescription>
      </EmptyHeader>
      {hasActiveFilters && (
        <EmptyContent>
          <Button variant='outline' onClick={onClearFilters} size='sm'>
            {t('Clear filters')}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}
