import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { createServerFn } from '@tanstack/react-start'

/**
 * This checks whether the returned payloads from a
 * server function are the same, regardless of whether the server function is
 * called directly from the client or from within the server function.
 * @link https://github.com/TanStack/router/issues/1866
 * @link https://github.com/TanStack/router/issues/2481
 */

export const Route = createFileRoute('/consistent')({
  component: ConsistentServerFnCalls,
  loader: async () => {
    const data = await cons_serverGetFn1({ data: { username: 'TEST' } })
    console.log('cons_serverGetFn1', data)
    return { data }
  },
})

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

function ConsistentServerFnCalls() {
  const [getServerResult, setGetServerResult] = React.useState({})
  const [getDirectResult, setGetDirectResult] = React.useState({})

  const [postServerResult, setPostServerResult] = React.useState({})
  const [postDirectResult, setPostDirectResult] = React.useState({})

  return (
    <div className="p-2 m-2 grid gap-2">
      <h3>Consistent Server Fn GET Calls</h3>
      <p>
        This component checks whether the returned payloads from server function
        are the same, regardless of whether the server function is called
        directly from the client or from within the server function.
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
          {JSON.stringify(getServerResult)}
        </span>
      </p>
      <p>
        {`GET: cons_getFn1 called directly returns`}
        <br />
        <span data-testid="cons_getFn1-response">
          {JSON.stringify(getDirectResult)}
        </span>
      </p>
      <p>
        {`POST: cons_postFn1 called from cons_serverPostFn1 returns`}
        <br />
        <span data-testid="cons_serverPostFn1-response">
          {JSON.stringify(postServerResult)}
        </span>
      </p>
      <p>
        {`POST: cons_postFn1 called directly returns`}
        <br />
        <span data-testid="cons_postFn1-response">
          {JSON.stringify(postDirectResult)}
        </span>
      </p>
      <button
        data-testid="test-consistent-server-fn-calls-btn"
        type="button"
        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        onClick={() => {
          // GET calls
          cons_serverGetFn1({ data: { username: 'TEST' } }).then(
            setGetServerResult,
          )
          cons_getFn1({ data: { username: 'TEST' } }).then(setGetDirectResult)

          // POST calls
          cons_serverPostFn1({ data: { username: 'TEST' } }).then(
            setPostServerResult,
          )
          cons_postFn1({ data: { username: 'TEST' } }).then(setPostDirectResult)

          cons_postFn1({ data: { username: 'TEST' } }).then(setPostDirectResult)
        }}
      >
        Test Consistent server function responses
      </button>
      <ClientOnly>
        <span data-testid="consistent-client-hydrated" hidden />
      </ClientOnly>
    </div>
  )
}
