import { createSecretFactoryServerFn } from './createSecretFactory'

export const factorySafeServerFn = createSecretFactoryServerFn().handler(
  async ({ context, method }) => {
    return {
      name: 'factorySafeServerFn',
      method,
      context,
    }
  },
)
