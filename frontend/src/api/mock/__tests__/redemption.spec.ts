import { describe, expect, it, beforeEach } from 'vitest'

import {
  formatRedemptionValue,
  maskRedemptionCode,
  adminRedemptionTypeTone,
  adminRedemptionStatusTone,
} from '@/constants/adminRedemption'
import { resetMockState } from '@/api/mock/state'
import { adminRedemptionCodes } from '@/api/mock/data'
import { dispatchMock } from '@/api/mock/handlers'
import type { AdminRedemptionCode, AdminRedemptionPage } from '@/types/console'

const AUTH = { headers: { 'X-Ren2Hub-Demo-User': '1' } }

function ctx(params?: Record<string, unknown>, data?: Record<string, unknown>) {
  return { ...AUTH, params: params ?? {}, data: data ?? {} }
}

// Seed a demo user so requireAuth passes.
import { writeDemoUser } from '@/api/demoStorage'
import { mockUser } from '@/api/mock/data'

beforeEach(() => {
  resetMockState()
  writeDemoUser({ ...mockUser })
})

/* ------------------------------------------------------------------ */
/* Helper functions                                                     */
/* ------------------------------------------------------------------ */

describe('formatRedemptionValue', () => {
  it('formats quota type with amount', () => {
    expect(formatRedemptionValue({ type: 'quota', amount: 5 })).toBe('$5.00')
  })

  it('formats quota type from quota units when amount missing', () => {
    // 500_000 units = $1.00
    expect(formatRedemptionValue({ type: 'quota', quota: 500_000 })).toBe(
      '$1.00'
    )
  })

  it('returns $0.00 when no amount and no quota', () => {
    expect(formatRedemptionValue({ type: 'quota' })).toBe('$0.00')
  })

  it('formats concurrency type', () => {
    expect(formatRedemptionValue({ type: 'concurrency', concurrency: 3 })).toBe(
      '3 并发'
    )
  })

  it('formats subscription type', () => {
    expect(formatRedemptionValue({ type: 'subscription' })).toBe('订阅')
  })

  it('formats invite type', () => {
    expect(formatRedemptionValue({ type: 'invite' })).toBe('邀请码')
  })
})

describe('maskRedemptionCode', () => {
  it('masks middle of a 32-char hex code', () => {
    const code = 'abcdefgh12345678xxxxxxxx0000ffff'
    const masked = maskRedemptionCode(code)
    expect(masked).toBe('abcdefgh' + '********' + 'ffff')
  })

  it('returns short code unchanged', () => {
    expect(maskRedemptionCode('short')).toBe('short')
  })
})

describe('adminRedemptionTypeTone', () => {
  it('maps quota → accent', () => {
    expect(adminRedemptionTypeTone('quota')).toBe('accent')
  })
  it('maps concurrency → success', () => {
    expect(adminRedemptionTypeTone('concurrency')).toBe('success')
  })
  it('maps subscription → info', () => {
    expect(adminRedemptionTypeTone('subscription')).toBe('info')
  })
  it('maps invite → neutral', () => {
    expect(adminRedemptionTypeTone('invite')).toBe('neutral')
  })
})

describe('adminRedemptionStatusTone', () => {
  it('maps unused → success', () => {
    expect(adminRedemptionStatusTone('unused')).toBe('success')
  })
  it('maps used → neutral', () => {
    expect(adminRedemptionStatusTone('used')).toBe('neutral')
  })
  it('maps expired → warning', () => {
    expect(adminRedemptionStatusTone('expired')).toBe('warning')
  })
  it('maps disabled → danger', () => {
    expect(adminRedemptionStatusTone('disabled')).toBe('danger')
  })
})

/* ------------------------------------------------------------------ */
/* Mock API — list                                                      */
/* ------------------------------------------------------------------ */

describe('GET /api/redemption/ — list', () => {
  it('returns paginated list with counts', async () => {
    const res = await dispatchMock('GET', '/api/redemption/', ctx())
    expect(res.success).toBe(true)
    const data = res.data as AdminRedemptionPage
    expect(Array.isArray(data.items)).toBe(true)
    expect(typeof data.total).toBe('number')
    expect(data.total).toBeGreaterThan(0)
    expect(typeof data.type_counts).toBe('object')
    expect(typeof data.status_counts).toBe('object')
  })

  it('filters by type=quota', async () => {
    const res = await dispatchMock(
      'GET',
      '/api/redemption/',
      ctx({ type: 'quota' })
    )
    const data = res.data as AdminRedemptionPage
    expect(data.items.every((c) => c.type === 'quota')).toBe(true)
  })

  it('filters by status=unused', async () => {
    const res = await dispatchMock(
      'GET',
      '/api/redemption/',
      ctx({ status: 'unused' })
    )
    const data = res.data as AdminRedemptionPage
    expect(data.items.every((c) => c.status === 'unused')).toBe(true)
  })

  it('paginates correctly', async () => {
    const res = await dispatchMock(
      'GET',
      '/api/redemption/',
      ctx({ p: 1, page_size: 3 })
    )
    const data = res.data as AdminRedemptionPage
    expect(data.items.length).toBeLessThanOrEqual(3)
    expect(data.page).toBe(1)
    expect(data.page_size).toBe(3)
  })

  it('keyword search matches code prefix', async () => {
    const firstCode = adminRedemptionCodes[0]!.code
    const prefix = firstCode.slice(0, 6)
    const res = await dispatchMock(
      'GET',
      '/api/redemption/search',
      ctx({ keyword: prefix })
    )
    const data = res.data as AdminRedemptionPage
    expect(data.items.length).toBeGreaterThan(0)
    expect(data.items[0]!.code).toContain(prefix)
  })
})

/* ------------------------------------------------------------------ */
/* Mock API — generate                                                  */
/* ------------------------------------------------------------------ */

describe('POST /api/redemption/ — generate', () => {
  it('creates a single quota code', async () => {
    const before = adminRedemptionCodes.length
    const res = await dispatchMock(
      'POST',
      '/api/redemption/',
      ctx(
        {},
        {
          type: 'quota',
          count: 1,
          amount: 5,
          expired_time: -1,
        }
      )
    )
    expect(res.success).toBe(true)
    const data = res.data as { codes: string[]; items: AdminRedemptionCode[] }
    expect(data.codes).toHaveLength(1)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]!.type).toBe('quota')
    expect(data.items[0]!.amount).toBe(5)
    expect(adminRedemptionCodes.length).toBe(before + 1)
  })

  it('creates multiple codes at once (count=5)', async () => {
    const before = adminRedemptionCodes.length
    const res = await dispatchMock(
      'POST',
      '/api/redemption/',
      ctx(
        {},
        {
          type: 'invite',
          count: 5,
          expired_time: -1,
        }
      )
    )
    expect(res.success).toBe(true)
    const data = res.data as { codes: string[]; items: AdminRedemptionCode[] }
    expect(data.codes).toHaveLength(5)
    expect(adminRedemptionCodes.length).toBe(before + 5)
  })

  it('rejects count > 100', async () => {
    const res = await dispatchMock(
      'POST',
      '/api/redemption/',
      ctx(
        {},
        {
          type: 'quota',
          count: 101,
          amount: 1,
          expired_time: -1,
        }
      )
    )
    expect(res.success).toBe(false)
  })

  it('rejects invalid type', async () => {
    const res = await dispatchMock(
      'POST',
      '/api/redemption/',
      ctx(
        {},
        {
          type: 'unknown_type',
          count: 1,
          expired_time: -1,
        }
      )
    )
    expect(res.success).toBe(false)
  })

  it('rejects non-positive quota amount', async () => {
    const res = await dispatchMock(
      'POST',
      '/api/redemption/',
      ctx(
        {},
        {
          type: 'quota',
          count: 1,
          amount: 0,
          expired_time: -1,
        }
      )
    )
    expect(res.success).toBe(false)
  })
})

describe('POST /api/redemption/:id/status — toggle', () => {
  it('disables an unused code', async () => {
    const unused = adminRedemptionCodes.find((c) => c.status === 'unused')!
    const res = await dispatchMock(
      'POST',
      `/api/redemption/${unused.id}/status`,
      ctx({}, {})
    )
    expect(res.success).toBe(true)
    expect((res.data as AdminRedemptionCode).status).toBe('disabled')
  })

  it('re-enables a disabled code', async () => {
    const disabled = adminRedemptionCodes.find((c) => c.status === 'disabled')!
    const res = await dispatchMock(
      'POST',
      `/api/redemption/${disabled.id}/status`,
      ctx({}, {})
    )
    expect(res.success).toBe(true)
    expect((res.data as AdminRedemptionCode).status).toBe('unused')
  })

  it('refuses to toggle a used code', async () => {
    const used = adminRedemptionCodes.find((c) => c.status === 'used')!
    const res = await dispatchMock(
      'POST',
      `/api/redemption/${used.id}/status`,
      ctx({}, {})
    )
    expect(res.success).toBe(false)
  })

  it('returns failure for unknown id', async () => {
    const res = await dispatchMock(
      'POST',
      '/api/redemption/999999/status',
      ctx({}, {})
    )
    expect(res.success).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* Mock API — delete                                                    */
/* ------------------------------------------------------------------ */

describe('DELETE /api/redemption/:id — single delete', () => {
  it('deletes a code by id', async () => {
    const code = adminRedemptionCodes[0]!
    const id = code.id
    const before = adminRedemptionCodes.length
    const res = await dispatchMock('DELETE', `/api/redemption/${id}`, ctx())
    expect(res.success).toBe(true)
    expect(adminRedemptionCodes.length).toBe(before - 1)
    expect(adminRedemptionCodes.find((c) => c.id === id)).toBeUndefined()
  })

  it('returns failure for unknown id', async () => {
    const res = await dispatchMock('DELETE', '/api/redemption/999999', ctx())
    expect(res.success).toBe(false)
  })
})

describe('POST /api/redemption/batch — bulk delete', () => {
  it('deletes multiple codes', async () => {
    const ids = adminRedemptionCodes.slice(0, 3).map((c) => c.id)
    const before = adminRedemptionCodes.length
    const res = await dispatchMock(
      'POST',
      '/api/redemption/batch',
      ctx({}, { ids })
    )
    expect(res.success).toBe(true)
    expect(res.data as number).toBe(3)
    expect(adminRedemptionCodes.length).toBe(before - 3)
  })

  it('rejects empty ids array', async () => {
    const res = await dispatchMock(
      'POST',
      '/api/redemption/batch',
      ctx({}, { ids: [] })
    )
    expect(res.success).toBe(false)
  })
})
