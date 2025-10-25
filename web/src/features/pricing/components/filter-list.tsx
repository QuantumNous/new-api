import { getLobeIcon } from '@/lib/lobe-icon'
import { FILTER_ALL, MAX_FILTER_ITEMS } from '../constants'
import { FilterButton } from './filter-button'

// ----------------------------------------------------------------------------
// Filter List Component
// ----------------------------------------------------------------------------

export interface FilterListProps {
  items: Array<{ id: string | number; name: string; icon?: string }>
  activeValue: string
  onSelect: (value: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
  showAllOption?: boolean
  allOptionLabel?: string
}

export function FilterList({
  items,
  activeValue,
  onSelect,
  isExpanded,
  onToggleExpand,
  showAllOption = true,
  allOptionLabel = 'All',
}: FilterListProps) {
  const displayItems = isExpanded ? items : items.slice(0, MAX_FILTER_ITEMS)

  return (
    <div className='flex flex-col gap-1'>
      {showAllOption && (
        <FilterButton
          isActive={activeValue === FILTER_ALL}
          onClick={() => onSelect(FILTER_ALL)}
        >
          {allOptionLabel}
        </FilterButton>
      )}
      {displayItems.map((item) => {
        const icon = item.icon ? getLobeIcon(item.icon, 16) : null
        return (
          <FilterButton
            key={item.id}
            isActive={activeValue === item.name}
            onClick={() => onSelect(item.name)}
            icon={icon}
          >
            {item.name}
          </FilterButton>
        )
      })}
      {items.length > MAX_FILTER_ITEMS && (
        <button
          onClick={onToggleExpand}
          className='text-muted-foreground hover:text-foreground px-3 py-1.5 text-left text-sm transition-colors'
        >
          {isExpanded ? 'Less' : 'More...'}
        </button>
      )}
    </div>
  )
}
