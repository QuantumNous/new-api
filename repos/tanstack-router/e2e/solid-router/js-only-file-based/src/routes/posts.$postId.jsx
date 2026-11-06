import { createFileRoute } from '@tanstack/solid-router'

import { ErrorComponent } from '@tanstack/solid-router'
import { fetchPost } from '../posts'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => fetchPost(postId),
  errorComponent: PostErrorComponent,
  notFoundComponent: () => {
    return <p>Post not found</p>
  },
  component: PostComponent,
})

export function PostErrorComponent({ error }) {
  return <ErrorComponent error={error} />
}

function PostComponent() {
  const post = Route.useLoaderData()

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{post().title}</h4>
      <div class="text-sm">{post().body}</div>
    </div>
  )
}
