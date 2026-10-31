import { createFileRoute } from '@tanstack/solid-router'
import { useQuery } from '@tanstack/solid-query'
import { For } from 'solid-js'

export const Route = createFileRoute('/methods/only-any')({
  ssr: false,
  component: RouteComponent,
})

const HttpMethods = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
] as const
type HttpMethods = (typeof HttpMethods)[number]

function Test(props: { method: HttpMethods }) {
  const query = useQuery(() => ({
    queryKey: [props.method],
    queryFn: async () => {
      const response = await fetch(`/api/only-any`, {
        method: props.method,
      })
      try {
        const json = (await response.json()) as Promise<{
          method: HttpMethods
          handler: HttpMethods & 'ANY'
        }>
        return json
      } catch (e) {}
      // handle HEAD and OPTIONS that have no body
      const result = {
        handler: response.headers.get('x-handler') as HttpMethods & 'ANY',
        method: response.headers.get('x-method') as HttpMethods,
      }
      return result
    },
  }))

  return (
    <div>
      <h3>method={props.method}</h3>
      <h4> expected </h4>
      <div data-testid={`expected-${props.method}`}>{props.method}</div>
      <h4> result</h4>
      {query.data ? (
        <div data-testid={`result-${props.method}`}>{query.data.method}</div>
      ) : null}
    </div>
  )
}

function RouteComponent() {
  return (
    <div class="p-2 m-2 grid gap-2" data-testid="route-component">
      <h3>Server Route has only ANY handler</h3>
      <For each={HttpMethods}>{(method) => <Test method={method} />}</For>
    </div>
  )
}
