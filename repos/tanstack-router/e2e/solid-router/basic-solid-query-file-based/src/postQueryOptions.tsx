import { queryOptions } from '@tanstack/solid-query'
import { fetchPost } from './posts'

export const postQueryOptions = (postId: string) =>
  queryOptions({
    queryKey: ['posts', { postId }],
    queryFn: () => fetchPost(postId),
  })
