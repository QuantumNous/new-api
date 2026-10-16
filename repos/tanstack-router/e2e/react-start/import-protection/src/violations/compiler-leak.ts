import { createServerFn } from '@tanstack/react-start'
import { getSecret } from './secret.server'

export const secretServerFn = createServerFn().handler(async () => {
  return getSecret()
})

export function leakyReference() {
  // Intentionally outside createServerFn().handler() so the compiler can't
  // compile away the import in client builds.
  return getSecret()
}
