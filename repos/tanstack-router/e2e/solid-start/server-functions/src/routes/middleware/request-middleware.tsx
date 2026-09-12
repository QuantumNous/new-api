import { createFileRoute } from '@tanstack/solid-router'
import { createMiddleware, createServerFn } from '@tanstack/solid-start'
import { getRequest } from '@tanstack/solid-start/server'
import { createSignal, Show } from 'solid-js'

const requestMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next, request }) => {
    return next({
      context: {
        requestParam: request.url,
        requestFunc: getRequest().url,
      },
    })
  },
)

const serverFn = createServerFn()
  .middleware([requestMiddleware])
  .handler(async ({ context: { requestParam, requestFunc } }) => {
    return { requestParam, requestFunc }
  })

export const Route = createFileRoute('/middleware/request-middleware')({
  loader: () => serverFn(),
  component: RouteComponent,
})

function RouteComponent() {
  const loaderData = Route.useLoaderData()

  const [clientData, setClientData] = createSignal<ReturnType<
    typeof loaderData
  > | null>(null)

  return (
    <div>
      <h2>Request Middleware in combination with server function</h2>
      <br />
      <div>
        <div data-testid="loader-data">
          <h3>Loader Data</h3>Request Param:
          <div data-testid="loader-data-request-param">
            {loaderData().requestParam}
          </div>
          Request Func:
          <div data-testid="loader-data-request-func">
            {loaderData().requestFunc}
          </div>
        </div>
        <br />
        <div data-testid="client-call">
          <button
            data-testid="client-call-button"
            onClick={async () => {
              const data = await serverFn()
              setClientData(data)
            }}
          >
            Call server function from client
          </button>
        </div>
        <br />
        <div data-testid="client-data-container">
          <h3>Client Data</h3>
          <Show when={clientData()} fallback=" Loading ...">
            {(data) => (
              <div data-testid="client-data">
                Request Param:
                <div data-testid="client-data-request-param">
                  {data().requestParam}
                </div>
                Request Func:
                <div data-testid="client-data-request-func">
                  {data().requestFunc}
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  )
}
