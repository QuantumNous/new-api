import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { createServerFn } from '@tanstack/react-start'
import { fnOnlyCalledByServer } from '~/functions/fnOnlyCalledByServer'

/**
 * This tests that server functions called only from the server (not from the client)
 * are still included in the build and work correctly at runtime.
 *
 * The `fnOnlyCalledByServer` is only called from `proxyFnThatCallsServerOnlyFn` on the server,
 * and is never referenced directly from client code.
 */

// This function IS called from the client, and it calls serverOnlyFn on the server
const proxyFnThatCallsServerOnlyFn = createServerFn().handler(async () => {
  // Call the server-only function from within another server function
  const result = await fnOnlyCalledByServer()
  return {
    fromServerOnlyFn: result,
    wrapper: 'client-callable wrapper',
  }
})

const getFnOnlyCalledByServer = createServerFn().handler(async () => {
  return fnOnlyCalledByServer
})

export const Route = createFileRoute('/server-only-fn')({
  component: ServerOnlyFnTest,
})

function ServerOnlyFnTest() {
  const [result, setResult] = React.useState<{
    fromServerOnlyFn: { message: string; secret: number }
    wrapper: string
  } | null>(null)

  const [callFromServerResult, setCallFromServerResult] = React.useState<
    string | null
  >(null)

  return (
    <div className="p-2 m-2 grid gap-2">
      <h3>Server-Only Function Test</h3>
      <p>
        This tests that server functions which are only called from other server
        functions (and never directly from the client) still work correctly.
      </p>
      <div>
        Expected result:{' '}
        <code>
          <pre data-testid="expected-server-only-fn-result">
            {JSON.stringify({
              fromServerOnlyFn: {
                message: 'hello from server-only function',
                secret: 42,
              },
              wrapper: 'client-callable wrapper',
            })}
          </pre>
        </code>
      </div>
      <div>
        Actual result:{' '}
        <code>
          <pre data-testid="server-only-fn-result">
            {result ? JSON.stringify(result) : 'null'}
          </pre>
        </code>
      </div>
      <button
        data-testid="test-server-only-fn-btn"
        type="button"
        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        onClick={async () => {
          const res = await proxyFnThatCallsServerOnlyFn()
          setResult(res)
        }}
      >
        Test Server-Only Function
      </button>

      <button
        data-testid="call-server-fn-from-client-btn"
        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        onClick={async () => {
          try {
            const fn = await getFnOnlyCalledByServer()
            await fn()
            setCallFromServerResult('success')
          } catch (e) {
            setCallFromServerResult('error')
          }
        }}
      >
        Call Server Fn From Client
      </button>
      {callFromServerResult && (
        <div data-testid="call-server-fn-from-client-result">
          {callFromServerResult}
        </div>
      )}
    </div>
  )
}
