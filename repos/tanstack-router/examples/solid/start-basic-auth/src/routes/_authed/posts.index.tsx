import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/_authed/posts/')({
  component: PostsIndexComponent,
})

function PostsIndexComponent() {
  return <div>Select a post.</div>
}
