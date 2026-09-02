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

import {
  loadCachedDrawingResult,
  saveCachedDrawingResult,
} from '../drawing-cache'

function createFakeIndexedDb(): IDBFactory {
  const values = new Map<string, { key: string; url: string }>()
  let initialized = false
  const database = {
    objectStoreNames: { contains: () => initialized },
    createObjectStore: () => {
      initialized = true
    },
    transaction: () => {
      const transaction: {
        oncomplete: (() => void) | null
        onerror: (() => void) | null
        error: null
        objectStore: () => {
          get: (key: string) => IDBRequest
          put: (value: { key: string; url: string }) => void
        }
      } = {
        oncomplete: null,
        onerror: null,
        error: null,
        objectStore: () => ({
          get: (key) => {
            const request = {} as IDBRequest
            queueMicrotask(() => {
              Object.assign(request, { result: values.get(key) })
              request.onsuccess?.(
                new Event('success') as IDBRequestEventMap['success']
              )
            })
            return request
          },
          put: (value) => {
            values.set(value.key, value)
            queueMicrotask(() => transaction.oncomplete?.())
          },
        }),
      }
      return transaction
    },
    close: () => undefined,
  }

  return {
    open: () => {
      const request = {} as IDBOpenDBRequest
      queueMicrotask(() => {
        Object.assign(request, { result: database })
        if (!initialized) {
          request.onupgradeneeded?.(
            new Event('upgradeneeded') as IDBVersionChangeEvent
          )
        }
        request.onsuccess?.(
          new Event('success') as IDBRequestEventMap['success']
        )
      })
      return request
    },
  } as unknown as IDBFactory
}

describe('AI drawing result cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restores the latest generated image for the same user', async () => {
    vi.stubGlobal('indexedDB', createFakeIndexedDb())

    await saveCachedDrawingResult('latest:7', 'data:image/png;base64,image')

    await expect(loadCachedDrawingResult('latest:7')).resolves.toBe(
      'data:image/png;base64,image'
    )
  })

  it('does not expose one user cached image to another user', async () => {
    vi.stubGlobal('indexedDB', createFakeIndexedDb())

    await saveCachedDrawingResult('latest:7', 'private-image')

    await expect(loadCachedDrawingResult('latest:8')).resolves.toBe('')
  })

  it('keeps drawing usable when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)

    await expect(
      saveCachedDrawingResult('latest:7', 'image')
    ).resolves.toBeUndefined()
    await expect(loadCachedDrawingResult('latest:7')).resolves.toBe('')
  })
})
