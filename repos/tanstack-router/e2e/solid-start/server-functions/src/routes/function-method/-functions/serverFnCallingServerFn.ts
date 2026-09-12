import { createServerFn } from '@tanstack/solid-start'

const postServerFn = createServerFn({ method: 'POST' }).handler(
  ({ method }) => {
    return {
      method,
    }
  },
)

const getServerFn = createServerFn({ method: 'GET' }).handler(({ method }) => {
  return {
    method,
  }
})

export const getServerFnCallingPost = createServerFn({ method: 'GET' }).handler(
  async ({ method }) => {
    const innerFnResult = await postServerFn({})

    return {
      name: 'getServerFnCallingPost',
      method,
      innerFnResult,
    }
  },
)

export const postServerFnCallingGet = createServerFn({
  method: 'POST',
}).handler(async ({ method }) => {
  const innerFnResult = await getServerFn({})

  return {
    name: 'postServerFnCallingGet',
    method,
    innerFnResult,
  }
})
