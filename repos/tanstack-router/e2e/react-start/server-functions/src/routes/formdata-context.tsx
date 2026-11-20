import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import React from 'react'
import { z } from 'zod'

// Middleware that creates context on client and sends it to server
const testMiddleware = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    const testString = 'context-from-middleware-' + Date.now()
    return next({
      sendContext: { testString },
    })
  })
  .server(async ({ next, context }) => {
    if (!context.testString) {
      throw new Error(
        'BUG: testString is missing from server middleware context!',
      )
    }
    return await next({ context: { ...context } })
  })

// Server function with FormData
export const formDataWithContextFn = createServerFn({ method: 'POST' })
  .middleware([testMiddleware])
  .validator((data: unknown) => {
    const formData = z.instanceof(FormData).parse(data)
    return {
      name: z.string().parse(formData.get('name')),
    }
  })
  .handler(({ data, context }) => {
    if (!context.testString) {
      throw new Error('BUG: testString is missing in handler context!')
    }
    return {
      success: true,
      name: data.name,
      testString: context.testString,
      hasContext: true,
    }
  })

// Server function without parameters
export const simpleTestFn = createServerFn({ method: 'POST' })
  .middleware([testMiddleware])
  .handler(({ context }) => {
    if (!context.testString) {
      throw new Error('BUG: testString is missing in handler context!')
    }
    return {
      success: true,
      testString: context.testString,
      hasContext: true,
    }
  })

export const Route = createFileRoute('/formdata-context')({
  component: FormDataContextComponent,
})

function FormDataContextComponent() {
  const [result, setResult] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState<string | null>(null)

  const testValues = {
    name: 'TestUser',
    expectedContextValue: 'context-from-middleware',
  }

  const handleClick = async (fn: () => Promise<any>, type: string) => {
    setLoading(type)
    setError(null)
    setResult(null)
    try {
      const response = await fn()
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-2 m-2 grid gap-2">
      <h3>FormData with Context Test</h3>
      <div className="overflow-y-auto">
        Expected context value:{' '}
        <code>
          <pre data-testid="expected-formdata-context-value">
            {testValues.expectedContextValue}
          </pre>
        </code>
      </div>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() =>
            handleClick(
              () =>
                formDataWithContextFn({
                  data: (() => {
                    const fd = new FormData()
                    fd.append('name', testValues.name)
                    return fd
                  })(),
                }),
              'formdata',
            )
          }
          disabled={!!loading}
          data-testid="test-formdata-context-btn"
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading === 'formdata'
            ? 'Calling...'
            : 'Call Server Function (FormData)'}
        </button>
        <button
          type="button"
          onClick={() => handleClick(() => simpleTestFn(), 'simple')}
          disabled={!!loading}
          data-testid="test-simple-context-btn"
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading === 'simple'
            ? 'Calling...'
            : 'Call Server Function (No Params)'}
        </button>
      </div>
      {error && (
        <div data-testid="formdata-context-error" className="text-red-500">
          Error: {error}
        </div>
      )}
      {result && (
        <div className="overflow-y-auto">
          <pre data-testid="formdata-context-result">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
