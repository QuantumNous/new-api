import { createFileRoute } from '@tanstack/vue-router'
import { useQuery } from '@tanstack/vue-query'
import { defineComponent } from 'vue'

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

type OnlyAnyApiResponse = {
  method: HttpMethods
  handler: 'ANY'
}

const Test = defineComponent({
  name: 'OnlyAnyTest',
  props: {
    method: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const query = useQuery(() => ({
      queryKey: ['only-any', props.method],
      queryFn: async () => {
        const method = props.method as HttpMethods
        const response = await fetch(`/api/only-any`, { method })

        try {
          return (await response.json()) as OnlyAnyApiResponse
        } catch {
          // handle HEAD and OPTIONS that have no body
          return {
            handler: (response.headers.get('x-handler') ??
              'ANY') as OnlyAnyApiResponse['handler'],
            method: (response.headers.get('x-method') ??
              method) as OnlyAnyApiResponse['method'],
          }
        }
      },
    }))

    return () => (
      <div>
        <h3>method={props.method}</h3>
        <h4> expected </h4>
        <div data-testid={`expected-${props.method}`}>{props.method}</div>
        <h4> result</h4>
        {query.data.value ? (
          <div data-testid={`result-${props.method}`}>
            {query.data.value.method}
          </div>
        ) : null}
      </div>
    )
  },
})

function RouteComponent() {
  return (
    <div class="p-2 m-2 grid gap-2" data-testid="route-component">
      <h3>Server Route has only ANY handler</h3>
      {HttpMethods.map((method) => (
        <Test method={method} />
      ))}
    </div>
  )
}
