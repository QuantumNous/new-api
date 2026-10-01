import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

import { createServerFn } from '@tanstack/react-start'

export const Route = createFileRoute('/raw-response')({
  component: RouteComponent,
})

const expectedValue = 'Hello from a server function!'
export const rawResponseFn = createServerFn().handler(() => {
  return new Response(expectedValue)
})

function RouteComponent() {
  const [formDataResult, setFormDataResult] = React.useState({})

  return (
    <div className="p-2 m-2 grid gap-2">
      <h3>Raw Response</h3>
      <div className="overflow-y-auto">
        It should return{' '}
        <code>
          <pre data-testid="expected">{expectedValue}</pre>
        </code>
      </div>

      <button
        onClick={async () => {
          const response = await rawResponseFn()
          console.log('response', response)

          const text = await response.text()
          setFormDataResult(text)
        }}
        data-testid="button"
        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
      >
        Submit
      </button>

      <div className="overflow-y-auto">
        <pre data-testid="response">{JSON.stringify(formDataResult)}</pre>
      </div>
    </div>
  )
}
