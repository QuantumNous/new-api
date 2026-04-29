import type { GetModelsParams, SearchModelsParams } from '../types'

/**
 * React Query cache keys for models
 */
export const modelsQueryKeys = {
  all: ['models'] as const,
  lists: () => [...modelsQueryKeys.all, 'list'] as const,
  list: (filters: GetModelsParams | SearchModelsParams) =>
    [...modelsQueryKeys.lists(), filters] as const,
  detail: (id: number) => [...modelsQueryKeys.all, 'detail', id] as const,
  missing: () => [...modelsQueryKeys.all, 'missing'] as const,
}

/**
 * React Query cache keys for vendors
 */
export const vendorsQueryKeys = {
  all: ['vendors'] as const,
  lists: () => [...vendorsQueryKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...vendorsQueryKeys.lists(), filters] as const,
  detail: (id: number) => [...vendorsQueryKeys.all, 'detail', id] as const,
}

/**
 * React Query cache keys for prefill groups
 */
export const prefillGroupsQueryKeys = {
  all: ['prefill-groups'] as const,
  lists: () => [...prefillGroupsQueryKeys.all, 'list'] as const,
  list: (type?: string) => [...prefillGroupsQueryKeys.lists(), type] as const,
}

/**
 * React Query cache keys for deployments
 */
export const deploymentsQueryKeys = {
  all: ['deployments'] as const,
  lists: () => [...deploymentsQueryKeys.all, 'list'] as const,
  list: (filters: {
    keyword?: string
    status?: string
    p?: number
    page_size?: number
  }) => [...deploymentsQueryKeys.lists(), filters] as const,
  detail: (id: string | number) =>
    [...deploymentsQueryKeys.all, 'detail', id] as const,
}
