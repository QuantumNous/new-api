import { createFileRoute } from '@tanstack/vue-router'
import { createIsomorphicFn, createServerFn } from '@tanstack/vue-start'
import { defineComponent, ref } from 'vue'

const getEnv = createIsomorphicFn()
  .server(() => 'server')
  .client(() => 'client')

const getServerEnv = createServerFn().handler(() => getEnv())

const getEcho = createIsomorphicFn()
  .server((input: string) => 'server received ' + input)
  .client((input) => 'client received ' + input)

const getServerEcho = createServerFn()
  .validator((input: string) => input)
  .handler(({ data }) => getEcho(data))

const RouteComponent = defineComponent({
  setup() {
    const loaderData = Route.useLoaderData()
    const results = ref<Partial<Record<string, string>> | undefined>()

    async function handleClick() {
      const envOnClick = getEnv()
      const echo = getEcho('hello')
      const [serverEnv, serverEcho] = await Promise.all([
        getServerEnv(),
        getServerEcho({ data: 'hello' }),
      ])
      results.value = { envOnClick, echo, serverEnv, serverEcho }
    }

    return () => (
      <div>
        <button onClick={handleClick} data-testid="test-isomorphic-results-btn">
          Run
        </button>
        {!!results.value && (
          <div>
            <h1>
              <code>getEnv</code>
            </h1>
            When we called the function on the server it returned:
            <pre data-testid="server-result">
              {JSON.stringify(results.value.serverEnv)}
            </pre>
            When we called the function on the client it returned:
            <pre data-testid="client-result">
              {JSON.stringify(results.value.envOnClick)}
            </pre>
            When we called the function during SSR it returned:
            <pre data-testid="ssr-result">
              {JSON.stringify(loaderData.value.envOnLoad)}
            </pre>
            <br />
            <h1>
              <code>echo</code>
            </h1>
            When we called the function on the server it returned:
            <pre data-testid="server-echo-result">
              {JSON.stringify(results.value.serverEcho)}
            </pre>
            When we called the function on the client it returned:
            <pre data-testid="client-echo-result">
              {JSON.stringify(results.value.echo)}
            </pre>
          </div>
        )}
      </div>
    )
  },
})

export const Route = createFileRoute('/isomorphic-fns')({
  component: RouteComponent,
  loader() {
    return {
      envOnLoad: getEnv(),
    }
  },
})
