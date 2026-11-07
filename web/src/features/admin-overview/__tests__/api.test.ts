import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { getAdminQuotaRows } from '../api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

describe('admin overview API', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('rejects an HTML fallback instead of reporting zero usage', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: '<html></html>' })
    await expect(
      getAdminQuotaRows({ start_timestamp: 1, end_timestamp: 2 })
    ).rejects.toThrow()
  })

  it('accepts a valid empty usage response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { success: true, data: [] },
    })
    await expect(
      getAdminQuotaRows({ start_timestamp: 1, end_timestamp: 2 })
    ).resolves.toEqual({ success: true, data: [] })
  })
})
