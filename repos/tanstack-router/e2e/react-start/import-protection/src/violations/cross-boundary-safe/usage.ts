import { createServerFn } from '@tanstack/react-start'
import { getSessionData } from './session-util'
import { createAuthServerFn } from './auth-wrapper'

// Pattern 1: Direct use of session utility inside a server fn handler.
// This mirrors login.tsx importing useAppSession and using it in
// createServerFn().handler().
export const crossBoundarySafeServerFn = createServerFn().handler(async () => {
  return getSessionData()
})

// Pattern 2: Using the pre-configured server fn from auth-wrapper.
// This mirrors user.tsx importing createAuthServerFn().handler().
export const crossBoundarySafeWithAuth = createAuthServerFn().handler(
  async () => {
    return { ok: true }
  },
)
