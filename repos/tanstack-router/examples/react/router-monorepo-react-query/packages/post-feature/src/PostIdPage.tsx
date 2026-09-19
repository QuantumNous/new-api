import { useSuspenseQuery } from '@tanstack/react-query'
import { postQueryOptions } from '@router-mono-react-query/post-query'

import { getRouteApi } from '@router-mono-react-query/router'

const route = getRouteApi('/$postId')

export function PostIdComponent() {
  const postId = route.useParams().postId
  const { data: post } = useSuspenseQuery(postQueryOptions(postId))

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
    </div>
  )
}
