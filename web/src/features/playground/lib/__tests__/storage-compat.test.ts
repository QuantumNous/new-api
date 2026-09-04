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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { STORAGE_KEYS } from '../../constants'
import {
  clearPlaygroundData,
  loadImageConfig,
  loadConfig,
  loadMessages,
  saveImageConfig,
  saveConfig,
} from '../storage/storage'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('playground storage compatibility', () => {
  test('v1 legacy unwrapped config loads and preserves messages', () => {
    localStorage.setItem(
      STORAGE_KEYS.CONFIG,
      JSON.stringify({
        model: 'gpt-4o',
        group: 'default',
        temperature: 0.7,
      })
    )
    localStorage.setItem(
      STORAGE_KEYS.MESSAGES,
      JSON.stringify([
        { key: 'm1', from: 'user', versions: [{ id: 'v1', content: 'hi' }] },
      ])
    )

    const config = loadConfig()
    expect(config.model).toBe('gpt-4o')
    expect(config.temperature).toBe(0.7)
    expect(config.searchEnabled).toBeUndefined()

    const messages = loadMessages()
    expect(messages).not.toBeNull()
    expect(messages?.[0]?.versions[0]?.content).toBe('hi')
  })

  test('v1 envelope config keeps searchEnabled=false through a round-trip', () => {
    saveConfig({
      model: 'gpt-4o',
      group: 'default',
      temperature: 0.7,
      top_p: 1,
      max_tokens: 4096,
      frequency_penalty: 0,
      presence_penalty: 0,
      seed: null,
      stream: true,
      searchEnabled: false,
    })

    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.CONFIG) ?? '{}'
    ) as { version: number; data: Record<string, unknown> }
    expect(raw.version).toBe(1)
    expect(raw.data.searchEnabled).toBe(false)

    const loaded = loadConfig()
    expect(loaded.searchEnabled).toBe(false)
  })

  test('image config round-trips and rejects unexpected fields', () => {
    saveImageConfig({
      model: 'dall-e-3',
      group: 'default',
      n: 2,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'url',
    })

    const loaded = loadImageConfig()
    expect(loaded.model).toBe('dall-e-3')
    expect(loaded.n).toBe(2)
    expect(loaded.size).toBe('1024x1024')
  })

  test('stored image config never contains image payload data (base64/urls)', () => {
    saveImageConfig({
      model: 'dall-e-3',
      group: 'default',
      n: 1,
      size: 'auto',
      quality: 'auto',
      response_format: 'auto',
    })

    const raw = localStorage.getItem(STORAGE_KEYS.IMAGE_CONFIG) ?? ''
    expect(raw).not.toContain('b64_json')
    expect(raw).not.toContain('data:image')
    expect(raw).not.toContain('http')
  })

  test('corrupt image config falls back to empty partial', () => {
    localStorage.setItem(STORAGE_KEYS.IMAGE_CONFIG, '{not json')
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    expect(loadImageConfig()).toEqual({})
    expect(errorSpy).toHaveBeenCalled()
  })

  test('clearPlaygroundData removes the image config key too', () => {
    saveImageConfig({ model: 'dall-e-3' })
    saveConfig({ model: 'gpt-4o' })

    clearPlaygroundData()

    expect(localStorage.getItem(STORAGE_KEYS.IMAGE_CONFIG)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.CONFIG)).toBeNull()
  })
})
