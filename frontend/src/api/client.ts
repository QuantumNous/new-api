import { createApiClient } from './createClient'
import { getAuthSessionGeneration } from './authSession'
import { httpTransport } from './httpTransport'
import { isMockApi } from './mode'
import { mockTransport } from './mock/transport'
import { isPrototypeEndpoint, prototypeRequest } from './prototypeTransport'
import type { ApiTransport } from './transport'

/**
 * Transport selection for the console/auth client. This refactor phase ships
 * against the stateful mock; set VITE_API_MODE=http to point the same call
 * sites at the real same-origin backend.
 */
let unauthorizedHandler: (() => void) | null = null

const liveTransport: ApiTransport = {
  request(method, url, options) {
    if (isPrototypeEndpoint(url)) return prototypeRequest(method, url, options)
    return httpTransport.request(method, url, options)
  },
}

export function setApiUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export const api = createApiClient(isMockApi ? mockTransport : liveTransport, {
  onUnauthorized: () => unauthorizedHandler?.(),
  getRequestScope: isMockApi ? undefined : getAuthSessionGeneration,
})
export { isMockApi }
