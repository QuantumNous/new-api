import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { getSecret } from '../secret.server'

// This file intentionally contains denied imports (./secret.server and
// @tanstack/react-start/server), but they are only referenced inside
// compiler-recognized server boundaries.

const secretMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    const req = getRequest()
    const secret = getSecret()
    return next({
      context: { method: req.method, secret } as const,
    })
  },
)

export const createSecretFactoryServerFn = createServerFn().middleware([
  secretMiddleware,
])
