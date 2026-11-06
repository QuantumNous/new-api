import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { loggingMiddleware } from '~/shared-lib'

/**
 * This route tests that the compiler can handle re-exports through type-only modules.
 *
 * The loggingMiddleware is imported from ~/shared-lib, which re-exports from:
 * - ./middleware (has runtime code)
 * - ./types (has ONLY type exports - compiles to empty JS)
 *
 * If the compiler doesn't handle empty modules correctly, the build will fail with:
 * "could not load module .../types/actions.ts"
 */

const getMessage = createServerFn()
  .middleware([loggingMiddleware])
  .handler(async () => {
    return 'Hello from server with type-only module re-exports!'
  })

export const Route = createFileRoute('/type-only-reexport')({
  component: TypeOnlyReexportPage,
  loader: async () => {
    const message = await getMessage()
    return { message }
  },
})

function TypeOnlyReexportPage() {
  const { message } = Route.useLoaderData()
  return (
    <div className="p-2">
      <h3 data-testid="type-only-heading">Type-Only Re-export Test</h3>
      <p data-testid="message">{message}</p>
      <p>
        This page tests that the compiler can handle barrel files that re-export
        from type-only modules (which compile to empty JavaScript).
      </p>
    </div>
  )
}
