import { createFileRoute } from '@tanstack/vue-router'
import { createServerFn } from '@tanstack/vue-start'
import { defineComponent, ref } from 'vue'

/**
 * This checks whether the returned payloads from a
 * server function are the same, regardless of whether the server function is
 * called directly from the client or from within the server function.
 * @link https://github.com/TanStack/router/issues/1866
 * @link https://github.com/TanStack/router/issues/2481
 */

const cons_getFn1 = createServerFn()
  .validator((d: { username: string }) => d)
  .handler(({ data }) => {
    return { payload: data }
  })

const cons_serverGetFn1 = createServerFn()
  .validator((d: { username: string }) => d)
  .handler(async ({ data }) => {
    return cons_getFn1({ data })
  })

const cons_postFn1 = createServerFn({ method: 'POST' })
  .validator((d: { username: string }) => d)
  .handler(({ data }) => {
    return { payload: data }
  })

const cons_serverPostFn1 = createServerFn({ method: 'POST' })
  .validator((d: { username: string }) => d)
  .handler(({ data }) => {
    return cons_postFn1({ data })
  })

const ConsistentServerFnCalls = defineComponent({
  setup() {
    const getServerResult = ref<unknown>({})
    const getDirectResult = ref<unknown>({})

    const postServerResult = ref<unknown>({})
    const postDirectResult = ref<unknown>({})

    return () => (
      <div class="p-2 m-2 grid gap-2">
        <h3>Consistent Server Fn GET Calls</h3>
        <p>
          This component checks whether the returned payloads from server
          function are the same, regardless of whether the server function is
          called directly from the client or from within the server function.
        </p>
        <div>
          It should return{' '}
          <code>
            <pre data-testid="expected-consistent-server-fns-result">
              {JSON.stringify({ payload: { username: 'TEST' } })}
            </pre>
          </code>
        </div>
        <p>
          {`GET: cons_getFn1 called from server cons_serverGetFn1 returns`}
          <br />
          <span data-testid="cons_serverGetFn1-response">
            {JSON.stringify(getServerResult.value)}
          </span>
        </p>
        <p>
          {`GET: cons_getFn1 called directly returns`}
          <br />
          <span data-testid="cons_getFn1-response">
            {JSON.stringify(getDirectResult.value)}
          </span>
        </p>
        <p>
          {`POST: cons_postFn1 called from cons_serverPostFn1 returns`}
          <br />
          <span data-testid="cons_serverPostFn1-response">
            {JSON.stringify(postServerResult.value)}
          </span>
        </p>
        <p>
          {`POST: cons_postFn1 called directly returns`}
          <br />
          <span data-testid="cons_postFn1-response">
            {JSON.stringify(postDirectResult.value)}
          </span>
        </p>
        <button
          data-testid="test-consistent-server-fn-calls-btn"
          type="button"
          class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          onClick={() => {
            // GET calls
            cons_serverGetFn1({ data: { username: 'TEST' } }).then((data) => {
              getServerResult.value = data
            })
            cons_getFn1({ data: { username: 'TEST' } }).then((data) => {
              getDirectResult.value = data
            })

            // POST calls
            cons_serverPostFn1({ data: { username: 'TEST' } }).then((data) => {
              postServerResult.value = data
            })
            cons_postFn1({ data: { username: 'TEST' } }).then((data) => {
              postDirectResult.value = data
            })

            cons_postFn1({ data: { username: 'TEST' } }).then((data) => {
              postDirectResult.value = data
            })
          }}
        >
          Test Consistent server function responses
        </button>
      </div>
    )
  },
})

export const Route = createFileRoute('/consistent')({
  component: ConsistentServerFnCalls,
  loader: async () => {
    const data = await cons_serverGetFn1({ data: { username: 'TEST' } })
    console.log('cons_serverGetFn1', data)
    return { data }
  },
})
