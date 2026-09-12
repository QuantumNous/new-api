import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/dashboard/')({
  loader: ({ context: { trpc } }) => trpc.posts.query(),
  component: DashboardIndexComponent,
})

function DashboardIndexComponent() {
  const posts = Route.useLoaderData()

  return (
    <div class="p-2">
      <div class="p-2">
        Welcome to the dashboard! You have{' '}
        <strong>{posts().length} total posts</strong>.
      </div>
    </div>
  )
}
