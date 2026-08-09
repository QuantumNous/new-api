import { createApiClient } from './createClient'
import { getAuthSessionGeneration } from './authSession'
import { httpTransport } from './httpTransport'
import type { ApiTransport } from './transport'

let unauthorizedHandler: (() => void) | null = null

const liveTransport: ApiTransport = httpTransport

export function setApiUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export const api = createApiClient(liveTransport, {
  onUnauthorized: () => unauthorizedHandler?.(),
  getRequestScope: getAuthSessionGeneration,
})
