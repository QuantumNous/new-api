import { createFileRoute } from '@tanstack/solid-router'

function PostsIndexComponent() {
  return <div>Select a post.</div>
}

export const Route = createFileRoute('/_authed/posts/')({
  component: PostsIndexComponent,
})
