import { createServerFn } from '@tanstack/react-start'

export const getServerFn = createServerFn().handler(({ serverFnMeta }) => {
  return serverFnMeta
})

export const postServerFn = createServerFn({ method: 'POST' }).handler(
  ({ serverFnMeta }) => {
    return serverFnMeta
  },
)
