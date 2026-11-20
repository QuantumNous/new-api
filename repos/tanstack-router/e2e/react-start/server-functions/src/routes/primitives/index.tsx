import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useCallback } from 'react'
import { z } from 'zod'
export const Route = createFileRoute('/primitives/')({
  component: RouteComponent,
})

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

interface TestProps<T> extends PrimitiveComponentProps<T> {
  method: 'get' | 'post'
}
function Test<T>(props: TestProps<T>) {
  const queryFn = useCallback(async () => {
    const result = await props.serverFn[props.method]({
      data: props.data.value,
    })
    if (result === undefined) {
      return '$undefined'
    }
    return result
  }, [props])
  const query = useQuery({ queryKey: [props.data.type, props.method], queryFn })
  const testId = `${props.method}-${props.data.type}`
  return (
    <div>
      <h3>serverFn method={props.method}</h3>
      <h4> expected </h4>
      <div data-testid={`expected-${testId}`}>
        {stringify(props.data.value)}
      </div>
      <h4> result</h4>
      {query.isSuccess ? (
        <div data-testid={`result-${testId}`}>{stringify(query.data)}</div>
      ) : null}
    </div>
  )
}
function PrimitiveComponent<T>(props: PrimitiveComponentProps<T>) {
  return (
    <div>
      <h2>data type: {props.data.type}</h2>
      <Test {...props} method="post" />
      <br />
      <Test {...props} method="get" />
      <br />
      <br />
    </div>
  )
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

function RouteComponent() {
  return testCases.map((t) => <PrimitiveComponent {...t} key={t.data.type} />)
}
