import { createServerFn, createMiddleware } from '@tanstack/react-start'

const authMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    return next({
      context: { auth: 'auth' },
    })
  },
)

const adminMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    return next({
      context: { admin: 'admin' },
    })
  },
)

export const createAuthServerFn = createServerFn().middleware([authMiddleware])
const createAdminServerFn = createAuthServerFn().middleware([adminMiddleware])

export const myAuthedFn = createAuthServerFn().handler(() => {
  return 'myAuthedFn'
})
export const deleteUserFn = createAdminServerFn().handler(() => {
  return 'deleteUserFn'
})

function createFakeFn() {
  return {
    handler: (cb) => {
      return cb()
    },
  }
}

const x = createFakeFn().handler(() => {
  return 'fakeFn'
})
