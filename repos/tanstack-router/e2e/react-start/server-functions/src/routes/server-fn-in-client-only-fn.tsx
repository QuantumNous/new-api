import { createFileRoute } from '@tanstack/react-router'
import { createClientOnlyFn, createServerFn } from '@tanstack/react-start'
import { useState } from 'react'

// Server function that should be callable from client-only function
const serverFn = createServerFn().handler(() => {
  return 'server function executed successfully'
})

// Client-only function that calls the server function
// This scenario currently fails due to compilation order issues:
// 1. createClientOnlyFn is processed first, removing the serverFn reference on server
// 2. Dead code elimination removes the serverFn entirely
// 3. The server function is never registered, causing runtime errors
const clientOnlyFnThatCallsServerFn = createClientOnlyFn(async () => {
  const result = await serverFn()
  return 'client-only fn received: ' + result
})

export const Route = createFileRoute('/server-fn-in-client-only-fn')({
  component: RouteComponent,
})

function RouteComponent() {
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    try {
      const res = await clientOnlyFnThatCallsServerFn()
      setResult(res)
      setError(null)
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div>
      <h1>Server Function in Client-Only Function Test</h1>
      <p>
        This test verifies that a server function can be called from inside a
        createClientOnlyFn.
      </p>
      <button
        onClick={handleClick}
        data-testid="test-server-fn-in-client-only-fn-btn"
      >
        Call client-only function that calls server function
      </button>
      <pre data-testid="expected-result">
        client-only fn received: server function executed successfully
      </pre>
      {result && (
        <pre data-testid="server-fn-in-client-only-fn-result">{result}</pre>
      )}
      {error && (
        <pre data-testid="server-fn-in-client-only-fn-error">{error}</pre>
      )}
    </div>
  )
}
