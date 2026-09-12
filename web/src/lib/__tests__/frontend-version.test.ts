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
import { describe, expect, it, vi } from 'vitest'

import { checkFrontendVersion, frontendUpdateUrl } from '../frontend-version'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('frontend version synchronization', () => {
  it('bypasses an old cached entry without dropping the route or query, and stops reload loops', () => {
    const next = frontendUpdateUrl(
      'https://example.test/drawing?group=default#result',
      'new'
    )
    expect(next).toBe(
      'https://example.test/drawing?group=default&_app_build=new#result'
    )
    if (!next) throw new Error('Expected a versioned entry URL')
    expect(frontendUpdateUrl(next, 'new')).toBeUndefined()
    expect(frontendUpdateUrl(next, 'newer')).toContain('_app_build=newer')
  })
  it('updates even when browser storage is blocked', async () => {
    const reload = vi.fn()
    await checkFrontendVersion({
      currentVersion: 'old',
      fetchVersion: async () => 'new',
      reload,
      storage: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
      },
    })
    expect(reload).toHaveBeenCalledWith('new')
  })
  it('reloads once when the server runs a newer frontend build', async () => {
    const storage = createStorage()
    const reload = vi.fn()
    const fetchVersion = vi.fn().mockResolvedValue('build-new')

    await checkFrontendVersion({
      currentVersion: 'build-old',
      fetchVersion,
      reload,
      storage,
    })
    await checkFrontendVersion({
      currentVersion: 'build-old',
      fetchVersion,
      reload,
      storage,
    })

    expect(reload).toHaveBeenCalledOnce()
  })

  it('keeps the current document when its build matches the server', async () => {
    const reload = vi.fn()

    await checkFrontendVersion({
      currentVersion: 'build-current',
      fetchVersion: vi.fn().mockResolvedValue('build-current'),
      reload,
      storage: createStorage(),
    })

    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload when a version check fails', async () => {
    const reload = vi.fn()

    await checkFrontendVersion({
      currentVersion: 'build-current',
      fetchVersion: vi.fn().mockRejectedValue(new Error('offline')),
      reload,
      storage: createStorage(),
    })

    expect(reload).not.toHaveBeenCalled()
  })
})
