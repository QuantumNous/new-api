import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { authApi } from '@/api/auth'
import { api } from '@/api/console'
import { clearDemoUser, writeDemoUser } from '@/api/demoStorage'
import { resetMockState, setMockDelay } from '@/api/mock/state'

beforeEach(async () => {
  resetMockState()
  setMockDelay(0)
  const { user } = await authApi.login('demo', 'password123')
  writeDemoUser(user)
})

afterEach(clearDemoUser)

describe('wallet amount boundary', () => {
  it('rejects non-finite top-up amounts', async () => {
    await expect(
      api.post('/api/user/topup', {
        amount: Number.POSITIVE_INFINITY,
        method: 'epay',
      })
    ).rejects.toMatchObject({ business: true })

    await expect(
      api.post('/api/user/topup', {
        amount: Number.NaN,
        method: 'epay',
      })
    ).rejects.toMatchObject({ business: true })
  })
})
