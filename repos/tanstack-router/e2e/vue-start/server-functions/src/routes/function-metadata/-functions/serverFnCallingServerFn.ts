import { createServerFn } from '@tanstack/vue-start'
import { getServerFn, postServerFn } from './normalServerFn'

export const getServerFnCallingServerFn = createServerFn().handler(
  async ({ serverFnMeta }) => {
    const post = await postServerFn()
    const get = await getServerFn()

    return {
      meta: serverFnMeta,
      inner: {
        get,
        post,
      },
    }
  },
)

export const postServerFnCallingServerFn = createServerFn().handler(
  async ({ serverFnMeta }) => {
    const post = await postServerFn()
    const get = await getServerFn()

    return {
      meta: serverFnMeta,
      inner: {
        get,
        post,
      },
    }
  },
)
