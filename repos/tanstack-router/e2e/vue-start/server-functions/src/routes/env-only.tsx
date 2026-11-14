import { createFileRoute } from '@tanstack/vue-router'
import {
  createClientOnlyFn,
  createServerFn,
  createServerOnlyFn,
} from '@tanstack/vue-start'
import { defineComponent, ref } from 'vue'

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

const RouteComponent = defineComponent({
  setup() {
    const results = ref<Partial<Record<string, string>> | undefined>()

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
      results.value = {
        serverOnServer,
        clientOnServer,
        clientOnClient,
        serverOnClient,
      }
    }

    return () => (
      <div>
        <button onClick={handleClick} data-testid="test-env-only-results-btn">
          Run
        </button>
        {!!results.value && (
          <div>
            <h1>
              <code>serverEcho</code>
            </h1>
            When we called the function on the server:
            <pre data-testid="server-on-server">
              {results.value.serverOnServer}
            </pre>
            When we called the function on the client:
            <pre data-testid="server-on-client">
              {results.value.serverOnClient}
            </pre>
            <br />
            <h1>
              <code>clientEcho</code>
            </h1>
            When we called the function on the server:
            <pre data-testid="client-on-server">
              {results.value.clientOnServer}
            </pre>
            When we called the function on the client:
            <pre data-testid="client-on-client">
              {results.value.clientOnClient}
            </pre>
          </div>
        )}
      </div>
    )
  },
})

export const Route = createFileRoute('/env-only')({
  component: RouteComponent,
})
