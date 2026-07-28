import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { authApi } from '@/api/auth'
import { api } from '@/api/console'
import { readDemoUser, writeDemoUser } from '@/api/demoStorage'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import type { PageResult } from '@/api/types'
import type { UserInfo } from '@/types/auth'
import type { InviteInfo, MarketListing, TokenSummary } from '@/types/console'

beforeEach(async () => {
  resetMockState()
  setMockDelay(0)
  const { user } = await authApi.login('demo', 'password123')
  writeDemoUser(user)
})

afterEach(() => {
  vi.restoreAllMocks()
  resetMockState()
})

describe('mock API input boundaries', () => {
  it('normalizes non-finite pagination values', async () => {
    const page = await api.get<PageResult<TokenSummary>>('/api/token/', {
      page: Number.NaN,
      page_size: Number.POSITIVE_INFINITY,
    })

    expect(page).toMatchObject({ page: 1, pageSize: 10 })
  })

  it('updates only editable profile fields', async () => {
    const before = readDemoUser()!
    const result = await api.put<{ user: UserInfo }>('/api/user/self', {
      display_name: 'Ren',
      id: 999,
      username: 'hijacked',
      quota: 999_999_999,
      group: 'root',
    })

    expect(result.user).toEqual({ ...before, display_name: 'Ren' })
  })

  it('rejects a non-finite invite transfer without corrupting state', async () => {
    const before = await api.get<InviteInfo>('/api/invite/self')

    await expect(
      api.post('/api/invite/transfer', { amount: Number.NaN })
    ).rejects.toMatchObject({ business: true })

    expect((await api.get<InviteInfo>('/api/invite/self')).transferable).toBe(
      before.transferable
    )
  })

  it.each([
    { remain_quota: Number.NaN },
    { rate_limit: Number.POSITIVE_INFINITY },
    { expired_time: Number.NEGATIVE_INFINITY },
    { model_limits: {} },
    { channels: {} },
  ])('rejects malformed token creation payloads', async (invalid) => {
    await expect(
      api.post('/api/token/', {
        name: 'invalid',
        type: 'manual',
        ...invalid,
      })
    ).rejects.toMatchObject({ business: true })
  })

  it.each(['platform', 'market'])(
    'rejects the legacy %s token type',
    async (type) => {
      await expect(
        api.post('/api/token/', { name: 'legacy token', type })
      ).rejects.toMatchObject({ business: true })
    }
  )

  it('defaults an omitted token type to auto', async () => {
    const created = await api.post<{ item: TokenSummary }>('/api/token/', {
      name: 'default token',
    })

    expect(created.item.type).toBe('auto')
  })

  it('keeps manual channels editable and auto channels read-only', async () => {
    const manual = await api.post<{ item: TokenSummary }>('/api/token/', {
      name: 'manual token',
      type: 'manual',
      channels: [{ name: 'OpenAI 官方', enabled: true }],
    })
    expect(manual.item).toMatchObject({
      type: 'manual',
      channels: [{ name: 'OpenAI 官方', enabled: true }],
    })

    const updated = await api.put<{ item: TokenSummary }>(
      `/api/token/${manual.item.id}`,
      { channels: [{ name: 'Azure 美东', enabled: true }] }
    )
    expect(updated.item.channels).toEqual([
      { name: 'Azure 美东', enabled: true },
    ])

    const automatic = await api.post<{ item: TokenSummary }>('/api/token/', {
      name: 'auto token',
      type: 'auto',
      channels: [{ name: 'submitted channel', enabled: true }],
    })
    expect(automatic.item.channels.length).toBeGreaterThan(0)
    expect(automatic.item.channels).not.toContainEqual({
      name: 'submitted channel',
      enabled: true,
    })
    await expect(
      api.put(`/api/token/${automatic.item.id}`, {
        channels: [{ name: 'Azure 美东', enabled: true }],
      })
    ).rejects.toMatchObject({ business: true })
  })

  it('validates token updates atomically', async () => {
    const page = await api.get<PageResult<TokenSummary>>('/api/token/', {
      page: 1,
      page_size: 1,
    })
    const token = page.items[0]

    await expect(
      api.put(`/api/token/${token.id}`, { name: 'mutated', status: 3 })
    ).rejects.toMatchObject({ business: true })

    const refreshed = await api.get<PageResult<TokenSummary>>('/api/token/', {
      page: 1,
      page_size: 100,
    })
    expect(refreshed.items.find((item) => item.id === token.id)?.name).toBe(
      token.name
    )
  })

  it('handles token batch input safely and reports actual deletions', async () => {
    await expect(
      api.post('/api/token/batch', { ids: {} })
    ).rejects.toMatchObject({ business: true })

    const page = await api.get<PageResult<TokenSummary>>('/api/token/', {
      page: 1,
      page_size: 1,
    })
    const result = await api.post<{ deleted: number }>('/api/token/batch', {
      ids: [page.items[0].id, page.items[0].id, -1, Number.NaN],
    })
    expect(result.deleted).toBe(1)
  })

  it('rejects unsafe wallet, invoice and ticket payloads', async () => {
    await expect(
      api.post('/api/user/topup', { amount: 10, method: 'wire' })
    ).rejects.toMatchObject({ business: true })
    await expect(
      api.post('/api/invoice/apply', {
        title: 'Example',
        amount: Number.POSITIVE_INFINITY,
      })
    ).rejects.toMatchObject({ business: true })
    await expect(
      api.post('/api/ticket/', {
        title: 'Example',
        content: 'Example',
        category: 'root',
        priority: 'normal',
      })
    ).rejects.toMatchObject({ business: true })
    await expect(
      api.post('/api/ticket/', {
        title: 'Example',
        content: 'Example',
        category: 'api',
        priority: 'normal',
        images: [123],
      })
    ).rejects.toMatchObject({ business: true })
  })

  it('rejects invalid marketplace mutations without partial writes', async () => {
    await expect(
      api.post('/api/market/listing', {
        title: 'invalid',
        type: 'chat',
        supportedModels: ['gpt-4o'],
        priceUSD: Number.POSITIVE_INFINITY,
      })
    ).rejects.toMatchObject({ business: true })

    const created = await api.post<{ listing: MarketListing }>(
      '/api/market/listing',
      {
        title: 'Valid listing',
        type: 'chat',
        supportedModels: ['gpt-4o'],
        priceUSD: 1,
      }
    )
    await expect(
      api.put(`/api/market/listing/${created.listing.id}`, {
        title: 'mutated',
        priceUSD: Number.NaN,
      })
    ).rejects.toMatchObject({ business: true })
    await expect(
      api.put(`/api/market/listing/${created.listing.id}`, {
        status: 'active',
      })
    ).rejects.toMatchObject({ business: true })
    await expect(
      api.post(`/api/market/listing/${created.listing.id}/add`)
    ).rejects.toMatchObject({ business: true })

    const mine = await api.get<{ listings: MarketListing[] }>(
      '/api/market/self/listings'
    )
    expect(
      mine.listings.find((item) => item.id === created.listing.id)?.title
    ).toBe('Valid listing')
  })

  it('credits successful transfers and prevents redeem-code reuse', async () => {
    const before = await api.get<{ quota: number }>('/api/data/self')

    await api.post('/api/invite/transfer', { amount: 1_000 })
    expect((await api.get<{ quota: number }>('/api/data/self')).quota).toBe(
      before.quota + 1_000
    )

    await api.post('/api/user/topup/redeem', { code: 'PROMO-2026' })
    const afterRedeem = await api.get<{ quota: number }>('/api/data/self')
    expect(afterRedeem.quota).toBe(before.quota + 5_001_000)
    await expect(
      api.post('/api/user/topup/redeem', { code: 'promo-2026' })
    ).rejects.toMatchObject({ business: true })
    expect((await api.get<{ quota: number }>('/api/data/self')).quota).toBe(
      afterRedeem.quota
    )

    const settlement = await api.post<{ quota: number }>('/api/market/settle')
    expect((await api.get<{ quota: number }>('/api/data/self')).quota).toBe(
      afterRedeem.quota + settlement.quota
    )
  })

  it('credits activity and game quota rewards exactly once', async () => {
    const before = await api.get<{ quota: number }>('/api/data/self')
    const checkin = await api.post<{ reward: number }>(
      '/api/activity/checkin',
      { activity_id: 1 }
    )
    expect((await api.get<{ quota: number }>('/api/data/self')).quota).toBe(
      before.quota + checkin.reward
    )

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.45)
    const spin = await api.post<{
      prize: { type: string; value: number }
      wallet: { balance: number }
    }>('/api/bigame/spin')
    random.mockRestore()

    expect(spin.prize.type).toBe('quota')
    expect((await api.get<{ quota: number }>('/api/data/self')).quota).toBe(
      before.quota + checkin.reward + spin.prize.value
    )
  })
})
