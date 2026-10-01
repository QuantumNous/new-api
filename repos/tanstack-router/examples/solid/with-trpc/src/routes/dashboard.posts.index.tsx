import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/dashboard/posts/')({
  component: DashboardPostsIndexComponent,
})

function DashboardPostsIndexComponent() {
  return <div class="p-2">Select a post to view.</div>
}
