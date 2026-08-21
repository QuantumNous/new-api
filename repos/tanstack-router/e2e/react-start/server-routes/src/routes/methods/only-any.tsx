import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

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
function Test({ method }: { method: HttpMethods }) {
  const queryFn = React.useCallback(async () => {
    const response = await fetch(`/api/only-any`, {
      method,
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
  }, [method])

  const query = useQuery({ queryKey: [method], queryFn })
  return (
    <div>
      <h3>method={method}</h3>
      <h4> expected </h4>
      <div data-testid={`expected-${method}`}>{method}</div>
      <h4> result</h4>
      {query.data ? (
        <div data-testid={`result-${method}`}>{query.data.method}</div>
      ) : null}
    </div>
  )
}

function RouteComponent() {
  return (
    <div className="p-2 m-2 grid gap-2" data-testid="route-component">
      <h3>Server Route has only ANY handler</h3>
      {HttpMethods.map((method) => (
        <Test key={method} method={method} />
      ))}
    </div>
  )
}
