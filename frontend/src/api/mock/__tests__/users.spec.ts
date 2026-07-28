import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api } from '@/api/console'
import { writeDemoUser } from '@/api/demoStorage'
import { adminUsers, mockUser } from '@/api/mock/data'
import { DEMO_OPERATOR_LEVEL } from '@/api/mock/handlers'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import type { AdminUser, AdminUserPage } from '@/types/console'

/**
 * The demo session's persisted role is pinned to 1 by `isDemoUser` (an
 * anti-escalation guard), so authority comes from the auth stub instead:
 * `isAdmin: true` / `isRoot: false` = level 10.
 */
const OPERATOR_LEVEL = 10

/** A row the demo operator is allowed to mutate. */
function manageableUser(): AdminUser {
  const hit = adminUsers.find(
    (user) => user.id !== mockUser.id && user.role < OPERATOR_LEVEL
  )
  if (!hit) throw new Error('expected a manageable user seed')
  return hit
}

/** A row at or above the operator's level — every mutation must be refused. */
function peerUser(): AdminUser {
  const hit = adminUsers.find(
    (user) => user.id !== mockUser.id && user.role >= OPERATOR_LEVEL
  )
  if (!hit) throw new Error('expected a peer-role user seed')
  return hit
}

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
  writeDemoUser(mockUser)
})

afterEach(() => resetMockState())

describe('administrator user mock API', () => {
  it('lists the default ID-descending page in the production response shape', async () => {
    const page = await api.get<AdminUserPage>('/api/user/')

    expect(page).toMatchObject({
      total: adminUsers.length,
      page: 1,
      page_size: 20,
    })
    expect(page.items).toHaveLength(20)
    expect(page.items[0]!.id).toBeGreaterThan(page.items[1]!.id)
    expect(page.role_counts['1']).toBeGreaterThan(0)
    expect(page.status_counts.enabled).toBeGreaterThan(0)
    expect(page.status_counts.disabled).toBeGreaterThan(0)
  })
  it('searches by username, display name, email and ID', async () => {
    const target = manageableUser()

    const byUsername = await api.get<AdminUserPage>('/api/user/search', {
      keyword: target.username,
      page_size: 100,
    })
    expect(byUsername.items.map((user) => user.id)).toContain(target.id)

    const byEmail = await api.get<AdminUserPage>('/api/user/search', {
      keyword: target.email.toUpperCase(),
      page_size: 100,
    })
    expect(byEmail.items.map((user) => user.id)).toContain(target.id)

    const byId = await api.get<AdminUserPage>('/api/user/search', {
      keyword: String(target.id),
      page_size: 100,
    })
    expect(byId.items.map((user) => user.id)).toContain(target.id)

    const byDisplayName = await api.get<AdminUserPage>('/api/user/search', {
      keyword: target.display_name,
      page_size: 100,
    })
    expect(byDisplayName.items.map((user) => user.id)).toContain(target.id)
  })

  it('filters by role and status without collapsing the other facet count', async () => {
    const all = await api.get<AdminUserPage>('/api/user/', { page_size: 100 })

    const disabled = await api.get<AdminUserPage>('/api/user/', {
      status: 'disabled',
      page_size: 100,
    })
    expect(disabled.items.length).toBe(all.status_counts.disabled)
    expect(disabled.items.every((user) => user.status === 2)).toBe(true)
    // Facets are computed before either filter applies, so the role facet still
    // reports the unfiltered totals while the status filter is active.
    expect(disabled.role_counts).toEqual(all.role_counts)

    const admins = await api.get<AdminUserPage>('/api/user/', {
      role: 10,
      page_size: 100,
    })
    expect(admins.items.length).toBe(all.role_counts['10'])
    expect(admins.items.every((user) => user.role === 10)).toBe(true)
  })

  it('sorts by the whitelisted fields and ignores unknown ones', async () => {
    const ascending = await api.get<AdminUserPage>('/api/user/', {
      sort_by: 'quota',
      sort_order: 'asc',
      page_size: 100,
    })
    const quotas = ascending.items.map((user) => user.quota)
    expect([...quotas].sort((a, b) => a - b)).toEqual(quotas)

    const bogus = await api.get<AdminUserPage>('/api/user/', {
      sort_by: 'password',
      page_size: 5,
    })
    expect(bogus.items[0]!.id).toBeGreaterThan(bogus.items[1]!.id)
  })
  it('creates a user and rejects malformed or duplicate input', async () => {
    const before = adminUsers.length
    const created = await api.post<AdminUser>('/api/user/', {
      username: 'newcomer.01',
      display_name: '新同学',
      email: 'newcomer01@example.com',
      role: 1,
      quota: 250_000,
    })

    expect(created).toMatchObject({
      username: 'newcomer.01',
      role: 1,
      status: 1,
      quota: 250_000,
      used_quota: 0,
      last_login_time: 0,
    })
    expect(adminUsers).toHaveLength(before + 1)
    expect(adminUsers[0]!.id).toBe(created.id)

    await expect(
      api.post('/api/user/', { username: 'ab', email: '', role: 1 })
    ).rejects.toThrow('请填写完整的用户信息')
    await expect(
      api.post('/api/user/', {
        username: 'ab',
        display_name: '',
        email: '',
        role: 1,
      })
    ).rejects.toThrow('用户名需为 3-32 位字母、数字、点、下划线或连字符')
    await expect(
      api.post('/api/user/', {
        username: 'valid.name',
        display_name: '',
        email: 'not-an-email',
        role: 1,
      })
    ).rejects.toThrow('邮箱格式不正确')
    await expect(
      api.post('/api/user/', {
        username: 'newcomer.01',
        display_name: '',
        email: '',
        role: 1,
      })
    ).rejects.toThrow('用户名已被占用')
    await expect(
      api.post('/api/user/', {
        username: 'another.one',
        display_name: '',
        email: '',
        role: 1,
        quota: -5,
      })
    ).rejects.toThrow('初始额度格式不正确')
  })

  it('updates a manageable user and bounds promotion by the operator level', async () => {
    const target = manageableUser()

    const updated = await api.put<AdminUser>('/api/user/', {
      id: target.id,
      display_name: '改名成功',
      role: 1,
    })
    expect(updated).toMatchObject({ display_name: '改名成功', role: 1 })

    await expect(api.put('/api/user/', { id: target.id })).rejects.toThrow(
      '没有可更新的用户字段'
    )
    // Equal-level promotion is refused, not just higher — an operator at level
    // 10 must not be able to mint a peer.
    await expect(
      api.put('/api/user/', { id: target.id, role: DEMO_OPERATOR_LEVEL })
    ).rejects.toThrow('无权将用户提升到同级或更高权限')
    await expect(
      api.put('/api/user/', { id: target.id, role: 100 })
    ).rejects.toThrow('无权将用户提升到同级或更高权限')
    await expect(
      api.put('/api/user/', { id: 999_999, display_name: 'x' })
    ).rejects.toThrow('用户不存在')
  })

  it('adjusts quota by a signed delta and refuses a negative result', async () => {
    const target = manageableUser()
    const start = target.quota

    const credited = await api.post<AdminUser>('/api/user/quota', {
      id: target.id,
      delta: 500_000,
    })
    expect(credited.quota).toBe(start + 500_000)

    const debited = await api.post<AdminUser>('/api/user/quota', {
      id: target.id,
      delta: -500_000,
    })
    expect(debited.quota).toBe(start)

    await expect(
      api.post('/api/user/quota', { id: target.id, delta: 0 })
    ).rejects.toThrow('额度变更值格式不正确')
    await expect(
      api.post('/api/user/quota', { id: target.id, delta: -(start + 1) })
    ).rejects.toThrow('扣减后的额度不能为负')
    await expect(
      api.post('/api/user/quota', { id: target.id, delta: 2_000_000_000 })
    ).rejects.toThrow('单次额度变更不能超过 10 亿')
  })

  it('toggles a single status and deletes a manageable row', async () => {
    const target = manageableUser()

    const disabled = await api.post<AdminUser>(
      `/api/user/${target.id}/status`,
      {
        status: 2,
      }
    )
    expect(disabled.status).toBe(2)

    await expect(
      api.post(`/api/user/${target.id}/status`, { status: 7 })
    ).rejects.toThrow('用户状态格式不正确')

    const before = adminUsers.length
    const removed = await api.delete<{ id: number }>(`/api/user/${target.id}`)
    expect(removed.id).toBe(target.id)
    expect(adminUsers).toHaveLength(before - 1)

    await expect(api.delete(`/api/user/${target.id}`)).rejects.toThrow(
      '用户不存在'
    )
  })

  it('skips unmanageable rows in a batch instead of failing the whole call', async () => {
    const target = manageableUser()
    const peer = peerUser()
    const ids = [target.id, peer.id, mockUser.id]

    const changed = await api.post<number>('/api/user/status/batch', {
      ids,
      status: 2,
    })
    expect(changed).toBe(1)
    expect(adminUsers.find((user) => user.id === target.id)?.status).toBe(2)
    expect(adminUsers.find((user) => user.id === peer.id)?.status).toBe(
      peer.status
    )

    const deleted = await api.post<number>('/api/user/batch', { ids })
    expect(deleted).toBe(1)
    expect(adminUsers.some((user) => user.id === target.id)).toBe(false)
    expect(adminUsers.some((user) => user.id === peer.id)).toBe(true)
    expect(adminUsers.some((user) => user.id === mockUser.id)).toBe(true)

    await expect(api.post('/api/user/batch', { ids: [] })).rejects.toThrow(
      '用户 ID 列表格式不正确'
    )
    await expect(
      api.post('/api/user/status/batch', { ids: [target.id], status: 9 })
    ).rejects.toThrow('用户状态格式不正确')
  })

  it('refuses every mutation against self and against a same-level peer', async () => {
    const peer = peerUser()

    for (const id of [mockUser.id, peer.id]) {
      const expected =
        id === mockUser.id
          ? '不能对自己的账号执行该操作'
          : '无权操作同级或更高权限的用户'

      await expect(
        api.put('/api/user/', { id, display_name: 'nope' })
      ).rejects.toThrow(expected)
      await expect(
        api.post('/api/user/quota', { id, delta: 1_000 })
      ).rejects.toThrow(expected)
      await expect(
        api.post(`/api/user/${id}/status`, { status: 2 })
      ).rejects.toThrow(expected)
      await expect(api.delete(`/api/user/${id}`)).rejects.toThrow(expected)
    }
  })
})
