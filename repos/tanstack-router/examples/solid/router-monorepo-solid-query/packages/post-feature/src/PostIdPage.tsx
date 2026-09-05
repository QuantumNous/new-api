import { useQuery } from '@tanstack/solid-query'
import { postQueryOptions } from '@router-solid-mono-solid-query/post-query'

import { getRouteApi } from '@router-solid-mono-solid-query/router'

const route = getRouteApi('/$postId')

export function PostIdComponent() {
  const postId = route.useParams()().postId
  const { data: post } = useQuery(() => postQueryOptions(postId))

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{post?.title}</h4>
      <div class="text-sm">{post?.body}</div>
    </div>
  )
}
