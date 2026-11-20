import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import type { NestedOuter } from '~/data'
import { RenderNestedData, makeNested } from '~/data'

const serverFnReturningNested = createServerFn().handler(() => {
  return makeNested()
})

export const Route = createFileRoute('/server-function/nested')({
  component: RouteComponent,
})

function RouteComponent() {
  const [nestedResponse, setNestedResponse] = useState<NestedOuter>()

  return (
    <div>
      <button
        data-testid="server-function-trigger"
        onClick={() => serverFnReturningNested().then(setNestedResponse)}
      >
        trigger
      </button>

      {nestedResponse ? (
        <RenderNestedData nested={nestedResponse} />
      ) : (
        <div data-testid="waiting-for-response">waiting for response...</div>
      )}
    </div>
  )
}
