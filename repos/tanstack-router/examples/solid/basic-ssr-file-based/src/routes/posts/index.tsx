import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/posts/')({
  component: PostsIndexComponent,
  wrapInSuspense: true,
  errorComponent: ({ error }) => {
    return <div class="text-red-500">Failed to load post: {error.message}</div>
  },
})

function PostsIndexComponent() {
  return <div>Select a post.</div>
}
