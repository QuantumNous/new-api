import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

// All shared state lives in declarations — no bare expression statements.
// The singleton tracks how many times this module scope executes.
const singleton = (() => {
  const g = globalThis as any
  g.__tsrSharedSingleton ??= { initCount: 0 }
  g.__tsrSharedSingleton.initCount++
  return { initCountAtCreate: g.__tsrSharedSingleton.initCount as number }
})()

function getInitCount() {
  return (globalThis as any).__tsrSharedSingleton?.initCount as number
}

export const Route = createFileRoute('/shared-singleton')({
  loader: () => {
    return {
      loaderSawInitCount: getInitCount(),
      initCountAtCreateFromLoader: singleton.initCountAtCreate,
    }
  },
  component: SharedSingletonComponent,
})

function SharedSingletonComponent() {
  const data = Route.useLoaderData()

  return (
    <div className="p-2 space-y-2">
      <h3 className="text-lg font-bold">Shared Singleton</h3>
      <div>
        initCount (global):{' '}
        <span data-testid="shared-init-count">{getInitCount()}</span>
      </div>
      <div>
        loaderSawInitCount:{' '}
        <span data-testid="shared-loader-saw">{data.loaderSawInitCount}</span>
      </div>
      <div>
        initCountAtCreate (loader module):{' '}
        <span data-testid="shared-created-at-loader">
          {data.initCountAtCreateFromLoader}
        </span>
      </div>
      <div>
        initCountAtCreate (component module):{' '}
        <span data-testid="shared-created-at-module">
          {singleton.initCountAtCreate}
        </span>
      </div>
    </div>
  )
}
