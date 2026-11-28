import { createFileRoute } from '@tanstack/react-router'
import {
  createClientOnlyFn,
  createServerFn,
  createServerOnlyFn,
} from '@tanstack/react-start'
import { useState } from 'react'

const serverEcho = createServerOnlyFn((input: string) => 'server got: ' + input)
const clientEcho = createClientOnlyFn((input: string) => 'client got: ' + input)

const testOnServer = createServerFn().handler(() => {
  const serverOnServer = serverEcho('hello')
  let clientOnServer: string
  try {
    clientOnServer = clientEcho('hello')
  } catch (e) {
    clientOnServer =
      'clientEcho threw an error: ' +
      (e instanceof Error ? e.message : String(e))
  }
  return { serverOnServer, clientOnServer }
})

export const Route = createFileRoute('/env-only')({
  component: RouteComponent,
})

function RouteComponent() {
  const [results, setResults] = useState<Partial<Record<string, string>>>()

  async function handleClick() {
    const { serverOnServer, clientOnServer } = await testOnServer()
    const clientOnClient = clientEcho('hello')
    let serverOnClient: string
    try {
      serverOnClient = serverEcho('hello')
    } catch (e) {
      serverOnClient =
        'serverEcho threw an error: ' +
        (e instanceof Error ? e.message : String(e))
    }
    setResults({
      serverOnServer,
      clientOnServer,
      clientOnClient,
      serverOnClient,
    })
  }

  const { serverOnServer, clientOnServer, clientOnClient, serverOnClient } =
    results || {}

  return (
    <div>
      <button onClick={handleClick} data-testid="test-env-only-results-btn">
        Run
      </button>
      {!!results && (
        <div>
          <h1>
            <code>serverEcho</code>
          </h1>
          When we called the function on the server:
          <pre data-testid="server-on-server">{serverOnServer}</pre>
          When we called the function on the client:
          <pre data-testid="server-on-client">{serverOnClient}</pre>
          <br />
          <h1>
            <code>clientEcho</code>
          </h1>
          When we called the function on the server:
          <pre data-testid="client-on-server">{clientOnServer}</pre>
          When we called the function on the client:
          <pre data-testid="client-on-client">{clientOnClient}</pre>
        </div>
      )}
    </div>
  )
}
