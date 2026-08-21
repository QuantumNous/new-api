import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '../router'

export const Route = createFileRoute('/dashboard/')({
  loader: async ({ context: { trpc, queryClient } }) => {
    await queryClient.ensureQueryData(trpc.posts.queryOptions())
    return
  },
  component: DashboardIndexComponent,
})

function DashboardIndexComponent() {
  const postsQuery = useQuery(trpc.posts.queryOptions())

  const posts = postsQuery.data || []

  return (
    <div className="p-2">
      <div className="p-2">
        Welcome to the dashboard! You have{' '}
        <strong>{posts.length} total posts</strong>.
      </div>
    </div>
  )
}
