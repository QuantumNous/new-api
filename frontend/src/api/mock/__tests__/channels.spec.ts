import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api } from '@/api/console'
import { writeDemoUser } from '@/api/demoStorage'
import { adminChannels, mockUser } from '@/api/mock/data'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import type { AdminChannel, AdminChannelPage } from '@/types/console'

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
  writeDemoUser(mockUser)
})

afterEach(() => resetMockState())

describe('administrator channel mock API', () => {
  it('lists the default ID-descending page in the production response shape', async () => {
    const page = await api.get<AdminChannelPage>('/api/channel/')

    expect(page).toMatchObject({
      total: 32,
      page: 1,
      page_size: 20,
    })
    expect(page.items).toHaveLength(20)
    expect(page.items[0]?.id).toBeGreaterThan(page.items[1]?.id ?? 0)
    expect(Object.keys(page.type_counts).length).toBeGreaterThan(5)
  })

  it('searches by name, ID and supplier and combines filters', async () => {
    const target = adminChannels.find((channel) => channel.status === 1)
    if (!target) throw new Error('expected an enabled channel seed')

    const byName = await api.get<AdminChannelPage>('/api/channel/search', {
      keyword: target.name.slice(0, 8),
      page_size: 100,
    })
    expect(byName.items.some((channel) => channel.id === target.id)).toBe(true)

    const byId = await api.get<AdminChannelPage>('/api/channel/search', {
      keyword: String(target.id),
      page_size: 100,
    })
    expect(byId.items.map((channel) => channel.id)).toContain(target.id)

    const bySupplier = await api.get<AdminChannelPage>('/api/channel/search', {
      keyword: target.supplier.toLowerCase(),
      page_size: 100,
    })
    expect(bySupplier.items.length).toBeGreaterThan(0)
    expect(
      bySupplier.items.every((channel) =>
        channel.supplier.toLowerCase().includes(target.supplier.toLowerCase())
      )
    ).toBe(true)

    const filtered = await api.get<AdminChannelPage>('/api/channel/', {
      type: target.type,
      status: 'enabled',
      page_size: 100,
    })
    expect(filtered.items.length).toBeGreaterThan(0)
    expect(
      filtered.items.every(
        (channel) => channel.type === target.type && channel.status === 1
      )
    ).toBe(true)
  })

  it('sorts supported fields and paginates without leaking mutable records', async () => {
    const first = await api.get<AdminChannelPage>('/api/channel/', {
      sort_by: 'name',
      sort_order: 'asc',
      p: 1,
      page_size: 10,
    })
    const second = await api.get<AdminChannelPage>('/api/channel/', {
      sort_by: 'name',
      sort_order: 'asc',
      p: 2,
      page_size: 10,
    })

    expect(first.items).toHaveLength(10)
    expect(second.items).toHaveLength(10)
    expect(
      first.items.at(-1)?.name.localeCompare(second.items[0]?.name ?? '')
    ).toBeLessThanOrEqual(0)
    expect(second.page).toBe(2)

    first.items[0]!.name = 'local mutation'
    expect(
      adminChannels.some((channel) => channel.name === 'local mutation')
    ).toBe(false)
  })

  it('rejects invalid numeric and status updates atomically', async () => {
    const target = adminChannels[0]!
    const original = { priority: target.priority, weight: target.weight }

    await expect(
      api.put('/api/channel/', {
        id: target.id,
        priority: original.priority + 1,
        weight: -1,
      })
    ).rejects.toThrow('权重格式不正确')
    expect(target).toMatchObject(original)

    await expect(
      api.put('/api/channel/', { id: target.id, priority: 1.5 })
    ).rejects.toThrow('优先级格式不正确')
    await expect(
      api.put('/api/channel/', { id: target.id, name: '   ' })
    ).rejects.toThrow('渠道名称不能为空')
    await expect(
      api.put('/api/channel/', { id: target.id, balance: 50 })
    ).rejects.toThrow('没有可更新的渠道字段')
    await expect(
      api.put('/api/channel/', {
        id: target.id,
        capacity_total: target.capacity_used - 1,
      })
    ).rejects.toThrow('总容量格式不正确')
    await expect(
      api.post(`/api/channel/${target.id}/status`, { status: 3 })
    ).rejects.toThrow('渠道状态格式不正确')
    await expect(
      api.post('/api/channel/', { mode: 'batch', channel: {} })
    ).rejects.toThrow('当前仅支持新建单个渠道')
    await expect(
      api.post('/api/channel/', {
        mode: 'single',
        channel: {
          name: 'Incomplete',
          type: 1,
        },
      })
    ).rejects.toThrow('请填写完整的渠道信息')
  })

  it('updates numbers, status, balance and response with row-shaped results', async () => {
    const target = adminChannels.find((channel) => channel.status === 3)
    if (!target) throw new Error('expected an auto-disabled channel seed')

    const updated = await api.put<AdminChannel>('/api/channel/', {
      id: target.id,
      priority: 31,
      weight: 71,
    })
    expect(updated).toMatchObject({ priority: 31, weight: 71 })

    const enabled = await api.post<AdminChannel>(
      `/api/channel/${target.id}/status`,
      { status: 1 }
    )
    expect(enabled.status).toBe(1)

    const balance = await api.get<AdminChannel>(
      `/api/channel/update_balance/${target.id}`
    )
    expect(balance.balance).toBeGreaterThan(updated.balance)
    expect(balance.upstream_ratio).not.toBe(updated.upstream_ratio)

    const tested = await api.get<AdminChannel>(`/api/channel/test/${target.id}`)
    expect(tested.response_time).toBeGreaterThan(0)
    expect(tested.test_time).toBeGreaterThan(0)
  })

  it('batch updates status and reports only changed channels', async () => {
    const autoDisabled = adminChannels.find((channel) => channel.status === 3)
    const enabled = adminChannels.find((channel) => channel.status === 1)
    if (!autoDisabled || !enabled) throw new Error('expected channel statuses')

    const changed = await api.post<number>('/api/channel/status/batch', {
      ids: [autoDisabled.id, enabled.id],
      status: 1,
    })
    expect(changed).toBe(1)
    expect(autoDisabled.status).toBe(1)
    expect(enabled.status).toBe(1)

    await expect(
      api.post('/api/channel/status/batch', {
        ids: [autoDisabled.id],
        status: 3,
      })
    ).rejects.toThrow('渠道状态格式不正确')
    await expect(
      api.post('/api/channel/status/batch', {
        ids: [],
        status: 2,
      })
    ).rejects.toThrow('渠道 ID 列表格式不正确')
  })

  it('creates, edits and deletes channels with derived suppliers', async () => {
    const created = await api.post<AdminChannel>('/api/channel/', {
      mode: 'single',
      channel: {
        name: 'Managed Gemini',
        type: 24,
        status: 2,
        priority: 4,
        weight: 30,
        capacity_total: 80,
        channel_ratio: 1.18,
      },
    })

    expect(created).toMatchObject({
      name: 'Managed Gemini',
      supplier: 'Google',
      status: 2,
      capacity_used: 0,
      used_quota: 0,
      channel_ratio: 1.18,
      balance: 0,
      upstream_ratio: 1,
      response_time: 0,
      test_time: 0,
    })

    const updated = await api.put<AdminChannel>('/api/channel/', {
      id: created.id,
      name: 'Managed Bedrock',
      type: 33,
      priority: 9,
      weight: 45,
      capacity_total: 120,
      channel_ratio: 0,
    })
    expect(updated).toMatchObject({
      name: 'Managed Bedrock',
      supplier: 'Anthropic',
      type: 33,
      channel_ratio: 0,
    })

    await expect(
      api.put('/api/channel/', {
        id: created.id,
        capacity_total: -1,
      })
    ).rejects.toThrow('总容量格式不正确')
    await expect(
      api.put('/api/channel/', {
        id: created.id,
        channel_ratio: Number.NaN,
      })
    ).rejects.toThrow('渠道倍率格式不正确')
    await expect(
      api.put('/api/channel/', {
        id: created.id,
        channel_ratio: 1_001,
      })
    ).rejects.toThrow('渠道倍率格式不正确')

    await api.delete(`/api/channel/${created.id}`)
    expect(adminChannels.some((channel) => channel.id === created.id)).toBe(
      false
    )
    await expect(api.delete(`/api/channel/${created.id}`)).rejects.toThrow(
      '渠道不存在'
    )
  })

  it('batch deletes channels and reports the actual count', async () => {
    const targets = adminChannels.slice(0, 3)
    const ids = targets.map((channel) => channel.id)

    const deleted = await api.post<number>('/api/channel/batch', {
      ids,
    })
    expect(deleted).toBe(ids.length)
    expect(adminChannels.some((channel) => ids.includes(channel.id))).toBe(
      false
    )

    const remaining = adminChannels.length
    await expect(
      api.post('/api/channel/batch', { ids: [adminChannels[0]!.id, -1] })
    ).rejects.toThrow('渠道 ID 列表格式不正确')
    const partial = await api.post<number>('/api/channel/batch', {
      ids: [adminChannels[0]!.id, 999999],
    })
    expect(partial).toBe(1)
    expect(adminChannels).toHaveLength(remaining - 1)
  })

  it('restores every channel mutation through resetMockState', async () => {
    const target = adminChannels[0]!
    const original = structuredClone(target)

    await api.put('/api/channel/', { id: target.id, priority: 99 })
    await api.post(`/api/channel/${target.id}/status`, { status: 2 })
    await api.get(`/api/channel/update_balance/${target.id}`)
    await api.get(`/api/channel/test/${target.id}`)
    const created = await api.post<AdminChannel>('/api/channel/', {
      mode: 'single',
      channel: {
        name: 'Temporary channel',
        type: 1,
        status: 1,
        priority: 0,
        weight: 0,
        capacity_total: 20,
        channel_ratio: 1,
      },
    })
    expect(target).not.toEqual(original)

    resetMockState()
    writeDemoUser(mockUser)
    expect(adminChannels[0]).toEqual(original)
    expect(adminChannels.some((channel) => channel.id === created.id)).toBe(
      false
    )

    const recreated = await api.post<AdminChannel>('/api/channel/', {
      mode: 'single',
      channel: {
        name: 'Recreated channel',
        type: 1,
        status: 1,
        priority: 0,
        weight: 0,
        capacity_total: 20,
        channel_ratio: 1,
      },
    })
    expect(recreated.id).toBe(created.id)
  })
})
