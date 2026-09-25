import { createStart } from '@tanstack/vue-start'
import { carAdapter, fooAdapter, nestedOuterAdapter } from './data'
import { customErrorAdapter } from './CustomError'

export const startInstance = createStart(() => {
  return {
    defaultSsr: true,
    serializationAdapters: [
      fooAdapter,
      carAdapter,
      customErrorAdapter,
      // only register nestedOuterAdapter here, nestedInnerAdapter is registered as an "extends" of nestedOuterAdapter
      nestedOuterAdapter,
    ],
  }
})
