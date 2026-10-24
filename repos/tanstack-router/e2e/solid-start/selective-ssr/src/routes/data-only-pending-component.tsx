import { createFileRoute } from '@tanstack/solid-router'
import { z } from 'zod'
import { ssrSchema } from '~/search'

export const Route = createFileRoute('/data-only-pending-component')({
  validateSearch: z.object({ root: ssrSchema }),
  ssr: 'data-only',
  loader: async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return { loadedAt: new Date().toISOString() }
  },
  pendingComponent: () => (
    <div data-testid="data-only-pending-component-pending" />
  ),
  component: DataOnlyPendingComponentRoute,
})

function DataOnlyPendingComponentRoute() {
  const data = Route.useLoaderData()

  return (
    <div data-testid="data-only-pending-component-ready">
      <p data-testid="data-only-pending-component-ready-label">
        OK - loader finished
      </p>
      <pre data-testid="data-only-pending-component-ready-data">
        {JSON.stringify(data(), null, 2)}
      </pre>
    </div>
  )
}
