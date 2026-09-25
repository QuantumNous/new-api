import { SortingState } from '@tanstack/react-table'
import { SortParams } from '../api/types'

export const stateToSortBy = (sorting: SortingState | undefined) => {
  if (!sorting || sorting.length == 0) return undefined

  const sort = sorting[0]

  return `${sort.id}.${sort.desc ? 'desc' : 'asc'}` as const
}

export const sortByToState = (sortBy: SortParams['sortBy'] | undefined) => {
  if (!sortBy) return []

  const [id, desc] = sortBy.split('.')
  return [{ id, desc: desc === 'desc' }]
}
