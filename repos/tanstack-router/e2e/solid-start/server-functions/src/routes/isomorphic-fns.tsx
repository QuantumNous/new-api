import { createFileRoute } from '@tanstack/solid-router'
import { createIsomorphicFn, createServerFn } from '@tanstack/solid-start'
import { createSignal } from 'solid-js'

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

export const Route = createFileRoute('/isomorphic-fns')({
  component: RouteComponent,
  loader() {
    return {
      envOnLoad: getEnv(),
    }
  },
})

function RouteComponent() {
  const loaderData = Route.useLoaderData()
  const [results, setResults] = createSignal<Partial<Record<string, string>>>()
  async function handleClick() {
    const envOnClick = getEnv()
    const echo = getEcho('hello')
    const [serverEnv, serverEcho] = await Promise.all([
      getServerEnv(),
      getServerEcho({ data: 'hello' }),
    ])
    setResults({ envOnClick, echo, serverEnv, serverEcho })
  }

  return (
    <div>
      <button onClick={handleClick} data-testid="test-isomorphic-results-btn">
        Run
      </button>
      {!!results() && (
        <div>
          <h1>
            <code>getEnv</code>
          </h1>
          When we called the function on the server it returned:
          <pre data-testid="server-result">
            {JSON.stringify(results()?.serverEnv)}
          </pre>
          When we called the function on the client it returned:
          <pre data-testid="client-result">
            {JSON.stringify(results()?.envOnClick)}
          </pre>
          When we called the function during SSR it returned:
          <pre data-testid="ssr-result">
            {JSON.stringify(loaderData().envOnLoad)}
          </pre>
          <br />
          <h1>
            <code>echo</code>
          </h1>
          When we called the function on the server it returned:
          <pre data-testid="server-echo-result">
            {JSON.stringify(results()?.serverEcho)}
          </pre>
          When we called the function on the client it returned:
          <pre data-testid="client-echo-result">
            {JSON.stringify(results()?.echo)}
          </pre>
        </div>
      )}
    </div>
  )
}
