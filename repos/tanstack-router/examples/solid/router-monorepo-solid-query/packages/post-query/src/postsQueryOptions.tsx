import { queryOptions } from '@tanstack/solid-query'
import { fetchPosts } from './posts'

export const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetchPosts(),
})
