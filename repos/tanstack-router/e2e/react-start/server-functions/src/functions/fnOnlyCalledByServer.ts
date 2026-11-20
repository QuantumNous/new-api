import { createServerFn } from '@tanstack/react-start'

// This function is ONLY called from the server, never directly from client code
export const fnOnlyCalledByServer = createServerFn().handler(() => {
  return { message: 'hello from server-only function', secret: 42 }
})
