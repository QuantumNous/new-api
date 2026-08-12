import { createServerFn } from '@tanstack/solid-start'
import { makeServerFnMarker, type GlobalMiddlewareContext } from '../../shared'

type Payload = { q: string; n: number; nested: { list: Array<string> } }

const validate = (input: unknown): Payload => {
  const payload = input as Payload

  if (
    typeof payload?.q !== 'string' ||
    typeof payload?.n !== 'number' ||
    !Array.isArray(payload?.nested?.list)
  ) {
    throw new Error('invalid payload')
  }

  return payload
}

export const echoPost = createServerFn({ method: 'POST' })
  .validator(validate)
  .handler(({ data, context }) => {
    const middlewareContext = (context ?? {}) as GlobalMiddlewareContext

    return {
      echoed: data,
      marker: makeServerFnMarker(data.q, middlewareContext),
      sum:
        data.n +
        (middlewareContext.requestTotal ?? 0) +
        (middlewareContext.functionTotal ?? 0),
      list: data.nested.list.map((item) => `global-${item}`),
    }
  })
