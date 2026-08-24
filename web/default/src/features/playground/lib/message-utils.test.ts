/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of
the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { describe, expect, test } from 'bun:test'
import { MESSAGE_STATUS } from '../constants'
import type { Message } from '../types'
import {
  sanitizeMessagesOnLoad,
  updateCurrentVersionContent,
  updateCurrentVersionMedia,
} from './message-utils'

describe('updateCurrentVersionContent', () => {
  test('preserves alternate message versions', () => {
    const message: Message = {
      key: 'assistant-versions',
      from: 'assistant',
      status: MESSAGE_STATUS.STREAMING,
      versions: [
        { id: 'version-1', content: 'partial result' },
        {
          id: 'version-2',
          content: 'older result',
          generatedMedia: [
            { type: 'image', url: 'https://cdn.example/older.png' },
          ],
        },
      ],
    }

    const updated = updateCurrentVersionContent(message, 'complete result')

    expect(updated.versions).toEqual([
      { id: 'version-1', content: 'complete result' },
      {
        id: 'version-2',
        content: 'older result',
        generatedMedia: [
          { type: 'image', url: 'https://cdn.example/older.png' },
        ],
      },
    ])
  })
})

describe('updateCurrentVersionMedia', () => {
  test('stores generated media on the current message version', () => {
    const message: Message = {
      key: 'assistant-1',
      from: 'assistant',
      status: MESSAGE_STATUS.COMPLETE,
      versions: [
        { id: 'version-1', content: 'first result' },
        { id: 'version-2', content: 'second result' },
      ],
    }

    const updated = updateCurrentVersionMedia(message, [
      { type: 'image', url: 'https://cdn.example/first.png' },
    ])

    expect(updated.generatedMedia).toBeUndefined()
    expect(updated.versions[0]?.generatedMedia).toEqual([
      { type: 'image', url: 'https://cdn.example/first.png' },
    ])
    expect(updated.versions[1]?.generatedMedia).toBeUndefined()
  })
})

describe('sanitizeMessagesOnLoad', () => {
  test('migrates legacy message media to the current version', () => {
    const messages: Message[] = [
      {
        key: 'assistant-legacy',
        from: 'assistant',
        status: MESSAGE_STATUS.COMPLETE,
        versions: [
          { id: 'version-1', content: 'current result' },
          { id: 'version-2', content: 'older result' },
        ],
        generatedMedia: [
          { type: 'image', url: 'https://cdn.example/legacy.png' },
        ],
      },
    ]

    const sanitized = sanitizeMessagesOnLoad(messages)

    expect(sanitized).not.toBe(messages)
    expect(sanitized[0]?.generatedMedia).toBeUndefined()
    expect(sanitized[0]?.versions[0]?.generatedMedia).toEqual([
      { type: 'image', url: 'https://cdn.example/legacy.png' },
    ])
    expect(sanitized[0]?.versions[1]?.generatedMedia).toBeUndefined()
  })

  test('keeps version media authoritative while removing the legacy field', () => {
    const messages: Message[] = [
      {
        key: 'assistant-mixed',
        from: 'assistant',
        status: MESSAGE_STATUS.COMPLETE,
        versions: [
          {
            id: 'version-1',
            content: 'current result',
            generatedMedia: [
              { type: 'image', url: 'https://cdn.example/current.png' },
            ],
          },
        ],
        generatedMedia: [
          { type: 'image', url: 'https://cdn.example/legacy.png' },
        ],
      },
    ]

    const sanitized = sanitizeMessagesOnLoad(messages)

    expect(sanitized[0]?.generatedMedia).toBeUndefined()
    expect(sanitized[0]?.versions[0]?.generatedMedia).toEqual([
      { type: 'image', url: 'https://cdn.example/current.png' },
    ])
  })
})
