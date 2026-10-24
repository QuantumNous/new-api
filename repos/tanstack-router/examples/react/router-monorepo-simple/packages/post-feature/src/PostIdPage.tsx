import { getRouteApi } from '@router-mono-simple/router'

const route = getRouteApi('/$postId')

export function PostIdComponent() {
  const post = route.useLoaderData()

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
    </div>
  )
}
