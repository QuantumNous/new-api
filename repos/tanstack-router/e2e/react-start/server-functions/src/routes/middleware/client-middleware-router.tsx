import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  createMiddleware,
  createServerFn,
  getRouterInstance,
} from '@tanstack/react-start'
import React from 'react'

const middleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const router = await getRouterInstance()
    return next({
      sendContext: {
        routerContext: router.options.context,
      },
    })
  },
)

const serverFn = createServerFn()
  .middleware([middleware])
  .handler(({ context }) => {
    return context.routerContext
  })
export const Route = createFileRoute('/middleware/client-middleware-router')({
  component: RouteComponent,
  loader: async () => ({ serverFnLoaderResult: await serverFn() }),
})

function RouteComponent() {
  const [serverFnClientResult, setServerFnClientResult] = React.useState({})
  const { serverFnLoaderResult } = Route.useLoaderData()

  const router = useRouter()
  return (
    <div
      className="p-2 m-2 grid gap-2"
      data-testid="client-middleware-router-route-component"
    >
      <h3>Client Middleware has access to router instance</h3>
      <p>
        This component checks that the client middleware has access to the
        router instance and thus its context.
      </p>
      <div>
        It should return{' '}
        <code>
          <pre data-testid="expected-server-fn-result">
            {JSON.stringify(router.options.context)}
          </pre>
        </code>
      </div>
      <p>
        serverFn when invoked in the loader returns:
        <br />
        <span data-testid="serverFn-loader-result">
          {JSON.stringify(serverFnClientResult)}
        </span>
      </p>
      <p>
        serverFn when invoked on the client returns:
        <br />
        <span data-testid="serverFn-client-result">
          {JSON.stringify(serverFnLoaderResult)}
        </span>
      </p>
      <button
        data-testid="btn-serverFn"
        type="button"
        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        onClick={() => {
          serverFn().then(setServerFnClientResult)
        }}
      >
        Invoke Server Function
      </button>
    </div>
  )
}
