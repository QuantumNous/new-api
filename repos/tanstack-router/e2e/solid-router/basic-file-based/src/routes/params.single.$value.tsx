import { createFileRoute } from '@tanstack/solid-router'
import * as React from 'react'
import { Link } from '@tanstack/solid-router'

export const Route = createFileRoute('/params/single/$value')({
  component: RouteComponent,
})

function RouteComponent() {
  const value = Route.useParams({ select: (s) => s.value })

  return (
    <div class="p-2 grid gap-4">
      <div>
        <h2>What's the value???</h2>
        <p>Check path param value is printed correctly for a single param.</p>
      </div>
      <p>
        Value: <span data-testid="parsed-param-value">{value()}</span>
      </p>
      <div class="flex gap-2">
        <Link
          to="/params/single/$value"
          params={{ value: value() }}
          reloadDocument
          class="border p-2"
          data-testid="self-link-same"
        >
          Self link to same
        </Link>
        <Link
          to="/params/single/$value"
          params={{ value: `e2e${value()}` }}
          reloadDocument
          class="border p-2"
          data-testid="self-link-amended"
        >
          Self link to amended value {`e2e${value()}`}
        </Link>
      </div>
    </div>
  )
}
