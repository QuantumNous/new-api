import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import { useSystemSettings } from '@/composables/useSystemSettings'

vi.mock('@/api/console', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ error: vi.fn() }),
}))

describe('system settings saves', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue([])
    vi.mocked(api.put).mockResolvedValue(null)
  })

  it('persists prerequisites before enabling a dependent integration', async () => {
    const { saveOptions } = useSystemSettings()

    await expect(
      saveOptions({
        GitHubOAuthEnabled: true,
        GitHubClientId: 'client-id',
        GitHubClientSecret: 'client-secret',
      })
    ).resolves.toBe(true)

    expect(vi.mocked(api.put).mock.calls.map((call) => call[1])).toEqual([
      { key: 'GitHubClientId', value: 'client-id' },
      { key: 'GitHubClientSecret', value: 'client-secret' },
      { key: 'GitHubOAuthEnabled', value: true },
    ])
  })

  it('reloads server state when a later option fails after a partial save', async () => {
    vi.mocked(api.put)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('save failed'))
    const { saveOptions } = useSystemSettings()

    await expect(
      saveOptions({ FirstOption: 'saved', SecondOption: 'rejected' })
    ).resolves.toBe(false)

    expect(api.get).toHaveBeenCalledWith('/api/option/')
  })
})
