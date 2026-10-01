import { useQuery } from '@tanstack/solid-query'
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/layout/page2')({
  component: RouteComponent,
})

function RouteComponent() {
  const query = useQuery(() => ({
    queryKey: ['page2'],
    queryFn: async () => ({ data: 'page2-data' }),
  }))

  return (
    <div data-testid="page2-content">
      Page data: {JSON.stringify(query.data)}
    </div>
  )
}
