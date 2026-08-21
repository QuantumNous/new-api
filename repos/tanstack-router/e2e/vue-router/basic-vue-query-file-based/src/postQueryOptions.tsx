import { queryOptions } from '@tanstack/vue-query'
import { fetchPost } from './posts'

export const postQueryOptions = (postId: string) =>
  queryOptions({
    queryKey: ['posts', { postId }],
    queryFn: () => fetchPost(postId),
  })
