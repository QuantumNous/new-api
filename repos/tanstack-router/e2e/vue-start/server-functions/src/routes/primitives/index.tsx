import { useQuery } from '@tanstack/vue-query'
import { createFileRoute } from '@tanstack/vue-router'
import { createServerFn } from '@tanstack/vue-start'
import { defineComponent } from 'vue'
import { z } from 'zod'

function stringify(data: any) {
  return JSON.stringify(data === undefined ? '$undefined' : data)
}

const $stringPost = createServerFn({ method: 'POST' })
  .validator(z.string())
  .handler((ctx) => ctx.data)

const $stringGet = createServerFn({ method: 'GET' })
  .validator(z.string())
  .handler((ctx) => ctx.data)

const $undefinedPost = createServerFn({ method: 'POST' })
  .validator(z.undefined())
  .handler((ctx) => ctx.data)

const $undefinedGet = createServerFn({ method: 'GET' })
  .validator(z.undefined())
  .handler((ctx) => ctx.data)

const $nullPost = createServerFn({ method: 'POST' })
  .validator(z.null())
  .handler((ctx) => ctx.data)

const $nullGet = createServerFn({ method: 'GET' })
  .validator(z.null())
  .handler((ctx) => ctx.data)

interface PrimitiveComponentProps<T> {
  serverFn: {
    get: (opts: { data: T }) => Promise<T>
    post: (opts: { data: T }) => Promise<T>
  }
  data: {
    value: T
    type: string
  }
}

function makeTestCase<T>(props: PrimitiveComponentProps<T>) {
  return props
}
const testCases = [
  makeTestCase({
    data: {
      value: null,
      type: 'null',
    },
    serverFn: {
      get: $nullGet,
      post: $nullPost,
    },
  }),
  makeTestCase({
    data: {
      value: undefined,
      type: 'undefined',
    },
    serverFn: {
      get: $undefinedGet,
      post: $undefinedPost,
    },
  }),
  makeTestCase({
    data: {
      value: 'foo-bar',
      type: 'string',
    },
    serverFn: {
      get: $stringGet,
      post: $stringPost,
    },
  }),
] as Array<PrimitiveComponentProps<any>>

type Method = 'get' | 'post'

const RouteComponent = defineComponent({
  setup() {
    const testQueries = testCases.map((testCase) => {
      const makeQuery = (method: Method) =>
        useQuery(() => ({
          queryKey: [testCase.data.type, method],
          queryFn: async () => {
            const result = await testCase.serverFn[method]({
              data: testCase.data.value,
            })
            if (result === undefined) {
              return '$undefined'
            }
            return result
          },
        }))

      return {
        testCase,
        queries: {
          post: makeQuery('post'),
          get: makeQuery('get'),
        },
      }
    })

    return () => (
      <>
        {testQueries.map(({ testCase, queries }) => (
          <div key={testCase.data.type}>
            <h2>data type: {testCase.data.type}</h2>

            {(['post', 'get'] as const).map((method) => {
              const testId = `${method}-${testCase.data.type}`
              const query = queries[method]
              return (
                <div key={testId}>
                  <h3>serverFn method={method}</h3>
                  <h4> expected </h4>
                  <div data-testid={`expected-${testId}`}>
                    {stringify(testCase.data.value)}
                  </div>
                  <h4> result</h4>
                  <div data-testid={`result-${testId}`}>
                    {query.isSuccess.value ? stringify(query.data.value) : ''}
                  </div>
                  <br />
                </div>
              )
            })}
            <br />
            <br />
          </div>
        ))}
      </>
    )
  },
})

export const Route = createFileRoute('/primitives/')({
  component: RouteComponent,
  ssr: true,
})
