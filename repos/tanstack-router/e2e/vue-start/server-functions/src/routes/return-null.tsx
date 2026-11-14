import { createFileRoute } from '@tanstack/vue-router'
import { createServerFn } from '@tanstack/vue-start'
import { defineComponent, ref } from 'vue'

/**
 * This checks whether the server function can
 * return null without throwing an error or returning something else.
 * @link https://github.com/TanStack/router/issues/2776
 */

const $allow_return_null_getFn = createServerFn().handler(async () => {
  return null
})
const $allow_return_null_postFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    return null
  },
)

const AllowServerFnReturnNull = defineComponent({
  setup() {
    const getServerResult = ref<any>('-')
    const postServerResult = ref<any>('-')

    return () => (
      <div class="p-2 m-2 grid gap-2">
        <h3>Allow ServerFn to return `null`</h3>
        <p>
          This component checks whether the server function can return null
          without throwing an error.
        </p>
        <div>
          It should return{' '}
          <code>
            <pre>{JSON.stringify(null)}</pre>
          </code>
        </div>
        <p>
          {`GET: $allow_return_null_getFn returns`}
          <br />
          <span data-testid="allow_return_null_getFn-response">
            {JSON.stringify(getServerResult.value)}
          </span>
        </p>
        <p>
          {`POST: $allow_return_null_postFn returns`}
          <br />
          <span data-testid="allow_return_null_postFn-response">
            {JSON.stringify(postServerResult.value)}
          </span>
        </p>
        <button
          data-testid="test-allow-server-fn-return-null-btn"
          type="button"
          class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          onClick={() => {
            $allow_return_null_getFn().then((data) => {
              getServerResult.value = data
            })
            $allow_return_null_postFn().then((data) => {
              postServerResult.value = data
            })
          }}
        >
          Test Allow Server Fn Return Null
        </button>
      </div>
    )
  },
})

export const Route = createFileRoute('/return-null')({
  component: AllowServerFnReturnNull,
})
