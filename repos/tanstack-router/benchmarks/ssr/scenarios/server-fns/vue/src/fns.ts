import { createMiddleware, createServerFn } from '@tanstack/vue-start'
import { notFound, redirect } from '@tanstack/vue-router'

const mwA = createMiddleware({ type: 'function' }).server(({ next }) =>
  next({ context: { a: 1 } }),
)
const mwB = createMiddleware({ type: 'function' }).server(({ next }) =>
  next({ context: { b: 2 } }),
)

const sendContextMw = createMiddleware({ type: 'function' })
  .client(({ data, next }) => {
    return next({
      sendContext: { token: createContextToken(data as unknown as Payload) },
    })
  })
  .server(({ context, next }) => {
    const { token } = context as { token?: string }

    if (typeof token !== 'string') {
      throw new Error('missing sendContext token')
    }

    return next({
      context: { token },
      sendContext: { stamp: `stamp-${token}` },
    })
  })

type Payload = { q: string; n: number; nested: { list: Array<string> } }

function createContextToken(data: Payload) {
  return `token-${data.q}-${data.nested.list[0]}`
}

const validate = (input: unknown): Payload => {
  const p = input as Payload

  if (
    typeof p?.q !== 'string' ||
    typeof p?.n !== 'number' ||
    !Array.isArray(p?.nested?.list)
  ) {
    throw new Error('invalid payload')
  }

  return p
}

function echo(data: Payload, context: { a: number; b: number }) {
  return {
    echoed: data,
    sum: data.n + context.a + context.b,
    list: data.nested.list.map((s) => `out-${s}`),
  }
}

export const echoGet = createServerFn({ method: 'GET' })
  .middleware([mwA, mwB])
  .validator(validate)
  .handler(({ data, context }) => echo(data, context))

export const echoPost = createServerFn({ method: 'POST' })
  .middleware([mwA, mwB])
  .validator(validate)
  .handler(({ data, context }) => echo(data, context))

export const redirector = createServerFn({ method: 'POST' }).handler(() => {
  throw redirect({ to: '/', statusCode: 307 })
})

export const notFounder = createServerFn({ method: 'POST' }).handler(() => {
  throw notFound()
})

export const ctxEcho = createServerFn({ method: 'POST' })
  .middleware([sendContextMw])
  .validator(validate)
  .handler(({ data, context }) => {
    const { token } = context as { token: string }

    return {
      marker: `ctx-${token}-${data.nested.list[0]}`,
      q: data.q,
      token,
    }
  })
