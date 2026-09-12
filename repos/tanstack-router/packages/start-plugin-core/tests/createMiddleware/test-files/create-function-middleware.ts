import { createMiddleware } from '@tanstack/react-start'

import { foo } from '@some/lib'

export const fnMw = createMiddleware({
  type: 'function',
})
  .server(({ next }) => {
    console.log('server')
    foo()
    return next()
  })
  .client(() => {
    console.log('client')
  })
