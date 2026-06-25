/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'bun:test'
import {
  buildDefaultApiKeyPayload,
  ensureInitialApiKeyCreateOnce,
  resetInitialApiKeyCreateOnce,
  runInitialApiKeyCreate,
} from './auto-create-api-key'

describe('runInitialApiKeyCreate', () => {
  test('builds a stable default payload and leaves group policy to the backend', () => {
    expect(buildDefaultApiKeyPayload({})).toMatchObject({
      name: 'default',
      group: '',
      cross_group_retry: false,
      unlimited_quota: true,
    })
  })

  test('skips creation and consumes the search param when a key exists', async () => {
    const result = await runInitialApiKeyCreate({
      scopeKey: 'user:1',
      ensureInitialKey: async () => ({
        success: true,
        data: { created: false },
      }),
    })

    expect(result).toEqual({ status: 'skipped-existing', consumeSearch: true })
  })

  test('creates a default key and returns the reveal key when no key exists', async () => {
    const result = await runInitialApiKeyCreate({
      scopeKey: 'user:1',
      ensureInitialKey: async () => ({
        success: true,
        data: { created: true, id: 7, key: 'raw-key' },
      }),
    })

    expect(result).toEqual({
      status: 'created',
      consumeSearch: true,
      key: 'raw-key',
    })
  })

  test('keeps the create search param when the ensure request fails', async () => {
    const result = await runInitialApiKeyCreate({
      scopeKey: 'user:1',
      ensureInitialKey: async () => ({
        success: false,
        message: 'failed',
      }),
    })

    expect(result).toEqual({
      status: 'create-failed',
      consumeSearch: false,
      message: 'failed',
    })
  })
})

describe('ensureInitialApiKeyCreateOnce', () => {
  test('shares an in-flight initial key create request', async () => {
    resetInitialApiKeyCreateOnce()
    let calls = 0

    const deps = {
      scopeKey: 'user:1',
      ensureInitialKey: async () => {
        calls += 1
        await Promise.resolve()
        return {
          success: true,
          data: { created: true, id: 7, key: 'raw-key' },
        }
      },
    }

    const [first, second] = await Promise.all([
      ensureInitialApiKeyCreateOnce(deps),
      ensureInitialApiKeyCreateOnce(deps),
    ])

    expect(calls).toBe(1)
    expect(first).toEqual(second)
    expect(first).toEqual({
      status: 'created',
      consumeSearch: true,
      key: 'raw-key',
    })
  })

  test('keeps a created key scoped until reset so it can be revealed after remount', async () => {
    resetInitialApiKeyCreateOnce()
    let calls = 0

    const deps = {
      scopeKey: 'user:1',
      ensureInitialKey: async () => {
        calls += 1
        return {
          success: true,
          data: { created: true, id: calls, key: `raw-key-${calls}` },
        }
      },
    }

    const first = await ensureInitialApiKeyCreateOnce(deps)
    const second = await ensureInitialApiKeyCreateOnce(deps)

    expect(calls).toBe(1)
    expect(first).toEqual({
      status: 'created',
      consumeSearch: true,
      key: 'raw-key-1',
    })
    expect(second).toEqual(first)
  })

  test('does not share created keys across user scopes', async () => {
    resetInitialApiKeyCreateOnce()
    let calls = 0

    const createDeps = (scopeKey: string) => ({
      scopeKey,
      ensureInitialKey: async () => {
        calls += 1
        return {
          success: true,
          data: { created: true, id: calls, key: `raw-key-${calls}` },
        }
      },
    })

    const first = await ensureInitialApiKeyCreateOnce(createDeps('user:1'))
    const second = await ensureInitialApiKeyCreateOnce(createDeps('user:2'))

    expect(calls).toBe(2)
    expect(first).toEqual({
      status: 'created',
      consumeSearch: true,
      key: 'raw-key-1',
    })
    expect(second).toEqual({
      status: 'created',
      consumeSearch: true,
      key: 'raw-key-2',
    })
  })

  test('ignores stale in-flight results after the user scope changes', async () => {
    resetInitialApiKeyCreateOnce()
    let resolveFirst:
      | ((value: {
          success: true
          data: { created: true; id: number; key: string }
        }) => void)
      | undefined

    const firstPromise = ensureInitialApiKeyCreateOnce({
      scopeKey: 'user:1',
      ensureInitialKey: async () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    })
    const second = await ensureInitialApiKeyCreateOnce({
      scopeKey: 'user:2',
      ensureInitialKey: async () => ({
        success: true,
        data: { created: true, id: 2, key: 'raw-key-2' },
      }),
    })
    resolveFirst?.({
      success: true,
      data: { created: true, id: 1, key: 'raw-key-1' },
    })
    await firstPromise

    const cachedSecond = await ensureInitialApiKeyCreateOnce({
      scopeKey: 'user:2',
      ensureInitialKey: async () => ({
        success: true,
        data: { created: true, id: 3, key: 'raw-key-3' },
      }),
    })

    expect(second).toEqual({
      status: 'created',
      consumeSearch: true,
      key: 'raw-key-2',
    })
    expect(cachedSecond).toEqual(second)
  })

  test('returns a cached skipped-existing result until reset', async () => {
    resetInitialApiKeyCreateOnce()
    let calls = 0

    const deps = {
      scopeKey: 'user:1',
      ensureInitialKey: async () => {
        calls += 1
        return {
          success: true,
          data: { created: false },
        }
      },
    }

    await ensureInitialApiKeyCreateOnce(deps)
    const result = await ensureInitialApiKeyCreateOnce(deps)

    expect(calls).toBe(1)
    expect(result).toEqual({ status: 'skipped-existing', consumeSearch: true })

    resetInitialApiKeyCreateOnce()
    await ensureInitialApiKeyCreateOnce(deps)
    expect(calls).toBe(2)
  })

  test('does not cache failed create results', async () => {
    resetInitialApiKeyCreateOnce()
    let calls = 0

    const deps = {
      scopeKey: 'user:1',
      ensureInitialKey: async () => {
        calls += 1
        return {
          success: false,
          message: `failed-${calls}`,
        }
      },
    }

    const first = await ensureInitialApiKeyCreateOnce(deps)
    const second = await ensureInitialApiKeyCreateOnce(deps)

    expect(calls).toBe(2)
    expect(first).toEqual({
      status: 'create-failed',
      consumeSearch: false,
      message: 'failed-1',
    })
    expect(second).toEqual({
      status: 'create-failed',
      consumeSearch: false,
      message: 'failed-2',
    })
  })
})
