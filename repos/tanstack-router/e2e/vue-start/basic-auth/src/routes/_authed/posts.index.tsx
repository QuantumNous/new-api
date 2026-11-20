import { createFileRoute } from '@tanstack/vue-router'

function PostsIndexComponent() {
  return <div>Select a post.</div>
}

export const Route = createFileRoute('/_authed/posts/')({
  component: PostsIndexComponent,
})
