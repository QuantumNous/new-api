import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  invokeServerFnHmr,
  serverFnHmrMarker,
} from '../hmr/server-fn-hmr-entry'

export const Route = createFileRoute('/server-fn-hmr')({
  component: ServerFnHmrComponent,
})

function ServerFnHmrComponent() {
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function invokeServerFn() {
    try {
      const next = await invokeServerFnHmr()
      setResult(next.result)
      setError(null)
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <main className="hmr-card flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="hmr-label">Server function invalidation</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-[var(--color-night)]">
            Server function HMR
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This route validates that transitive compiler invalidation updates a
            server function caller after HMR edits.
          </p>
        </div>
        <p className="hmr-marker" data-testid="server-fn-hmr-marker">
          {serverFnHmrMarker}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="hmr-button w-full sm:w-fit"
          data-testid="invoke-server-fn-hmr"
          onClick={() => invokeServerFn()}
        >
          Invoke server function
        </button>
        <span className="hmr-kbd">createServerOnlyFn transitively</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="hmr-stat">
          <p className="hmr-label">Result</p>
          <p
            className="mt-2 text-sm font-semibold text-[var(--color-night)]"
            data-testid="server-fn-hmr-result"
          >
            {result ?? 'idle'}
          </p>
        </div>
        <div className="hmr-stat">
          <p className="hmr-label">Error</p>
          <p
            className="mt-2 text-sm font-semibold text-[var(--color-coral)]"
            data-testid="server-fn-hmr-error"
          >
            {error ?? 'none'}
          </p>
        </div>
      </div>
    </main>
  )
}
