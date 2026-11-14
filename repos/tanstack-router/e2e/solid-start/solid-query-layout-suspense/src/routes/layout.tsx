import { useQuery } from '@tanstack/solid-query'
import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/layout')({
  component: RouteComponent,
})

function RouteComponent() {
  const query = useQuery(() => ({
    queryKey: ['layout'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 200))
      return { data: 'layout-data' }
    },
  }))

  return (
    <div>
      <pre data-testid="layout-content">
        Layout data: {JSON.stringify(query.data?.data)}
      </pre>
      <Outlet />
    </div>
  )
}
