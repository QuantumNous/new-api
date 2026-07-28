import { readDemoUser } from '@/api/demoStorage'

import { dispatchMock } from './handlers'
import type { ApiTransport } from '../transport'

export const mockTransport: ApiTransport = {
  request(method, url, options = {}) {
    const user = readDemoUser()
    const headers = { ...options.headers }
    if (user) headers['X-Ren2Hub-Demo-User'] = String(user.id)
    return dispatchMock(method, url, { ...options, headers })
  },
}
