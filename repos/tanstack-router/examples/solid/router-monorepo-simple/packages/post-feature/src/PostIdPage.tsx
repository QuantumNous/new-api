import { getRouteApi } from '@router-solid-mono-simple/router'

const route = getRouteApi('/$postId')

export function PostIdComponent() {
  const post = route.useLoaderData()

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{post().title}</h4>
      <div class="text-sm">{post().body}</div>
    </div>
  )
}
