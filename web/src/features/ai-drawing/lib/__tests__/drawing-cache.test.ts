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
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearLegacyDrawingCache } from '../drawing-cache'

afterEach(() => vi.unstubAllGlobals())
describe('legacy drawing cache removal', () => {
  it('removes the old non-expiring database', async () => {
    const request = {} as IDBOpenDBRequest
    const remove = vi.fn(() => {
      queueMicrotask(() => request.onsuccess?.(new Event('success')))
      return request
    })
    vi.stubGlobal('indexedDB', { deleteDatabase: remove })
    await clearLegacyDrawingCache()
    expect(remove).toHaveBeenCalledWith('hardy-ai-drawing')
  })
  it('reports an old tab blocking cleanup instead of claiming deletion succeeded', async () => {
    const request = {} as IDBOpenDBRequest
    vi.stubGlobal('indexedDB', {
      deleteDatabase: () => {
        queueMicrotask(() =>
          request.onblocked?.(new Event('blocked') as IDBVersionChangeEvent)
        )
        return request
      },
    })
    await expect(clearLegacyDrawingCache()).rejects.toThrow(
      'Close older drawing tabs'
    )
  })
})
