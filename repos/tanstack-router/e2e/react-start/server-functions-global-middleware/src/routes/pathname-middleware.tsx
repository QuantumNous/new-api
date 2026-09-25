import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

// Regression test for issue #6647:
// Global request middleware in createStartHandler was not receiving `pathname`.
// The `pathnameMiddleware` (registered as requestMiddleware in start.ts)
// captures `pathname` into context as `requestMiddlewarePathname`.
// This route verifies that value is defined and matches the actual route path.

const getPathnameFromMiddleware = createServerFn().handler(
  async ({ context }) => {
    return {
      requestMiddlewarePathname: context.requestMiddlewarePathname,
    }
  },
)

export const Route = createFileRoute('/pathname-middleware')({
  loader: async () => {
    return await getPathnameFromMiddleware()
  },
  component: PathnameMiddlewareComponent,
})

function PathnameMiddlewareComponent() {
  const data = Route.useLoaderData()
  const pathname = data.requestMiddlewarePathname

  return (
    <div className="p-8">
      <h1 className="font-bold text-lg mb-4">
        Pathname in Global Request Middleware (Issue #6647)
      </h1>
      <div>
        <span data-testid="request-middleware-pathname">
          {String(pathname)}
        </span>
      </div>
    </div>
  )
}
