import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import React from 'react'

const middleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    return next({
      sendContext: {
        serverFn: barFn,
      },
    })
  },
)

const fooFn = createServerFn()
  .middleware([middleware])
  .handler(({ context }) => {
    return context.serverFn()
  })
const barFn = createServerFn().handler(() => {
  return 'bar'
})

export const Route = createFileRoute('/middleware/send-serverFn')({
  component: RouteComponent,
  loader: async () => ({ serverFnLoaderResult: await fooFn() }),
})

function RouteComponent() {
  const [serverFnClientResult, setServerFnClientResult] = React.useState({})
  const { serverFnLoaderResult } = Route.useLoaderData()

  return (
    <div
      className="p-2 m-2 grid gap-2"
      data-testid="client-middleware-router-route-component"
    >
      <h3>Send server function in context</h3>
      <p>
        This component checks that the client middleware can send a reference to
        a server function in the context, which can then be invoked in the
        server function handler.
      </p>
      <div>
        It should return{' '}
        <code>
          <pre data-testid="expected-server-fn-result">
            {JSON.stringify('bar')}
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
          fooFn().then(setServerFnClientResult)
        }}
      >
        Invoke Server Function
      </button>
    </div>
  )
}
