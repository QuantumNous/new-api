import { createMiddleware, createServerFn } from '@tanstack/react-start'
import {
  makeServerFnChurnPayload,
  validateServerFnInput,
} from '../../server-fn-payload'

const contextMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) =>
    next({
      context: {
        ctx: 'ctx-server-fn-churn',
      },
    }),
)

export const churnGet = createServerFn({ method: 'GET' })
  .middleware([contextMiddleware])
  .validator(validateServerFnInput)
  .handler(({ data, context }) => makeServerFnChurnPayload(data, context))

export const churnPost = createServerFn({ method: 'POST' })
  .middleware([contextMiddleware])
  .validator(validateServerFnInput)
  .handler(({ data, context }) => makeServerFnChurnPayload(data, context))
