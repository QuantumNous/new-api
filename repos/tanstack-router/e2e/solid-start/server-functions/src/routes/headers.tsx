import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'
import { createServerFn } from '@tanstack/solid-start'
import {
  getRequestHeaders,
  setResponseHeader,
} from '@tanstack/solid-start/server'
import type { RequestHeaderName } from '@tanstack/solid-start/server'

export const Route = createFileRoute('/headers')({
  loader: async () => {
    return {
      testHeaders: await getTestHeaders(),
    }
  },
  component: () => {
    const loaderData = Route.useLoaderData()
    return <ResponseHeaders initialTestHeaders={loaderData().testHeaders} />
  },
})

export const getTestHeaders = createServerFn().handler(() => {
  setResponseHeader('x-test-header', 'test-value')
  const reqHeaders = Object.fromEntries(getRequestHeaders().entries())

  return {
    serverHeaders: reqHeaders,
    headers: reqHeaders,
  }
})

type TestHeadersResult = {
  headers?: Partial<Record<RequestHeaderName, string | undefined>>
  serverHeaders?: Partial<Record<RequestHeaderName, string | undefined>>
}

function ResponseHeaders({
  initialTestHeaders,
}: {
  initialTestHeaders: TestHeadersResult
}) {
  const [testHeadersResult, setTestHeadersResult] =
    Solid.createSignal<TestHeadersResult | null>(null)

  return (
    <div class="p-2 m-2 grid gap-2">
      <h3>Headers Test</h3>
      <form
        class="flex flex-col gap-2"
        data-testid="serialize-formdata-form"
        onSubmit={(evt) => {
          evt.preventDefault()
          getTestHeaders().then(setTestHeadersResult)
        }}
      >
        <button
          type="submit"
          data-testid="test-headers-btn"
          class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Get Headers
        </button>
      </form>
      <div class="overflow-y-auto">
        <h4>Initial Headers:</h4>
        <pre data-testid="initial-headers-result">
          {JSON.stringify(initialTestHeaders.headers, null, 2)}
        </pre>
        {testHeadersResult() && (
          <>
            <h4>Updated Headers:</h4>
            <pre data-testid="updated-headers-result">
              {JSON.stringify(testHeadersResult()?.headers, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  )
}
