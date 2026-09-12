import { createFileRoute } from '@tanstack/solid-router'
import { ErrorComponent } from '@tanstack/solid-router'
import { fetchPost } from '../posts'
import type { ErrorComponentProps } from '@tanstack/solid-router'

export function PostErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => fetchPost(postId),
  errorComponent: PostErrorComponent,
  notFoundComponent: () => {
    return <p>Post not found</p>
  },
  component: PostComponent,
})

function PostComponent() {
  const post = Route.useLoaderData()

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline" data-testid="post-title">
        {post().title}
      </h4>
      <div class="text-sm">{post().body}</div>
    </div>
  )
}
