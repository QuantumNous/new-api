import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/')({
  loader: ({ context: { trpc } }) => trpc.posts.query(),
  component: DashboardIndexComponent,
})

function DashboardIndexComponent() {
  const posts = Route.useLoaderData()

  return (
    <div className="p-2">
      <div className="p-2">
        Welcome to the dashboard! You have{' '}
        <strong>{posts.length} total posts</strong>.
      </div>
    </div>
  )
}
