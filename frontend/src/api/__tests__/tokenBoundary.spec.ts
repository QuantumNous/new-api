import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { authApi } from '@/api/auth'
import { api } from '@/api/console'
import { writeDemoUser } from '@/api/demoStorage'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import type { PageResult, TokenSecretResponse } from '@/api/types'
import type { TokenSummary } from '@/types/console'

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
})

afterEach(() => resetMockState())

describe('token secret boundary', () => {
  it('keeps secrets out of list responses and reveals them explicitly', async () => {
    const { user } = await authApi.login('demo', 'password123')
    writeDemoUser(user)

    const page = await api.get<PageResult<TokenSummary>>('/api/token/', {
      page: 1,
      page_size: 10,
    })
    const first = page.items[0]
    expect(first).toBeDefined()
    expect(first).toHaveProperty('key_preview')
    expect(first.key_preview).toMatch(/^sk-[A-Za-z0-9]{3}••••[A-Za-z0-9]{4}$/)
    expect(first).not.toHaveProperty('key')

    const secret = await api.get<TokenSecretResponse>(
      `/api/token/${first.id}/key`
    )
    expect(secret.key).toMatch(/^sk-/)
  })
})
