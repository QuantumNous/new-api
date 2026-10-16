import { queryOptions } from '@tanstack/vue-query'
import { fetchPosts } from './posts'

export const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetchPosts(),
})
