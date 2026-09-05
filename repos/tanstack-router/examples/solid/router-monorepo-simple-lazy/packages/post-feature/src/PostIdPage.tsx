import { createLazyRoute } from '@router-solid-mono-simple-lazy/router'

export const PostIdRoute = createLazyRoute('/$postId')({
  component: PostIdComponent,
})

export function PostIdComponent() {
  const post = PostIdRoute.useLoaderData()

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{post().title}</h4>
      <div class="text-sm">{post().body}</div>
    </div>
  )
}
