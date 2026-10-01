import { createFileRoute } from '@tanstack/vue-router'
import { createMiddleware, createServerFn } from '@tanstack/vue-start'
import { getRequest } from '@tanstack/vue-start/server'
import { defineComponent, ref } from 'vue'

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

type ServerFnResult = Awaited<ReturnType<typeof serverFn>>

const RouteComponent = defineComponent({
  setup() {
    const loaderData = Route.useLoaderData()
    const clientData = ref<ServerFnResult | null>(null)

    return () => (
      <div>
        <h2>Request Middleware in combination with server function</h2>
        <br />
        <div>
          <div data-testid="loader-data">
            <h3>Loader Data</h3>Request Param:
            <div data-testid="loader-data-request-param">
              {loaderData.value.requestParam}
            </div>
            Request Func:
            <div data-testid="loader-data-request-func">
              {loaderData.value.requestFunc}
            </div>
          </div>
          <br />
          <div data-testid="client-call">
            <button
              data-testid="client-call-button"
              onClick={async () => {
                const data = await serverFn()
                clientData.value = data
              }}
            >
              Call server function from client
            </button>
          </div>
          <br />
          <div data-testid="client-data-container">
            <h3>Client Data</h3>
            {clientData.value ? (
              <div data-testid="client-data">
                Request Param:
                <div data-testid="client-data-request-param">
                  {clientData.value.requestParam}
                </div>
                Request Func:
                <div data-testid="client-data-request-func">
                  {clientData.value.requestFunc}
                </div>
              </div>
            ) : (
              ' Loading ...'
            )}
          </div>
        </div>
      </div>
    )
  },
})

export const Route = createFileRoute('/middleware/request-middleware')({
  loader: () => serverFn(),
  component: RouteComponent,
})
