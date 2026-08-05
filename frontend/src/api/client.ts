import { createApiClient } from './createClient'
import { getAuthSessionGeneration } from './authSession'
import { httpTransport } from './httpTransport'
import { isMockApi } from './mode'
import { mockTransport } from './mock/transport'

/**
 * Transport selection for the console/auth client. This refactor phase ships
 * against the stateful mock; set VITE_API_MODE=http to point the same call
 * sites at the real same-origin backend.
 */
let unauthorizedHandler: (() => void) | null = null

export function setApiUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export const api = createApiClient(isMockApi ? mockTransport : httpTransport, {
  onUnauthorized: () => unauthorizedHandler?.(),
  getRequestScope: isMockApi ? undefined : getAuthSessionGeneration,
})
export { isMockApi }
