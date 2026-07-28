import { createApiClient, setUnauthorizedHandler } from './createClient'
import { httpTransport } from './httpTransport'
import { isMockApi } from './mode'
import { mockTransport } from './mock/transport'

/**
 * Transport selection for the console/auth client. This refactor phase ships
 * against the stateful mock; set VITE_API_MODE=http to point the same call
 * sites at the real same-origin backend.
 */
export const api = createApiClient(isMockApi ? mockTransport : httpTransport)
export { isMockApi }
export { setUnauthorizedHandler }
