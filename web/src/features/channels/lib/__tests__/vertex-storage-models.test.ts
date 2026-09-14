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
import { describe, expect, test } from 'vitest'

import {
  mergeVertexStorageModels,
  normalizeVertexStorageBucket,
  splitVertexStorageModels,
  VERTEX_STORAGE_MODEL_PREFIX,
} from '../vertex-storage-models'

describe('normalizeVertexStorageBucket', () => {
  test('keeps a plain bucket name and trims surrounding spaces', () => {
    expect(normalizeVertexStorageBucket('  example-bucket  ')).toBe(
      'example-bucket'
    )
  })

  test.each([
    ['empty input', '   '],
    ['dot segment', '.'],
    ['parent segment', '..'],
    ['gs scheme', 'gs://example-bucket'],
    ['object path', 'example-bucket/docs'],
    ['query string', 'example-bucket?alt=media'],
    ['fragment', 'example-bucket#docs'],
    ['already prefixed model', `${VERTEX_STORAGE_MODEL_PREFIX}example-bucket`],
  ])('rejects %s', (_name, value) => {
    expect(normalizeVertexStorageBucket(value)).toBeNull()
  })
})

describe('splitVertexStorageModels', () => {
  test('separates buckets from models and drops duplicates', () => {
    expect(
      splitVertexStorageModels([
        'gemini-2.5-pro',
        'storage:gs:example-bucket',
        ' gemini-2.5-pro ',
        'storage:gs: example-bucket ',
        '',
        'storage:gs:archive-bucket',
      ])
    ).toEqual({
      models: ['gemini-2.5-pro'],
      buckets: ['example-bucket', 'archive-bucket'],
    })
  })

  test('drops bucket entries that are not usable bucket names', () => {
    expect(
      splitVertexStorageModels(['storage:gs:gs://example-bucket'])
    ).toEqual({ models: [], buckets: [] })
  })
})

describe('mergeVertexStorageModels', () => {
  test('appends the configured buckets after the regular models', () => {
    expect(
      mergeVertexStorageModels(['gemini-2.5-pro'], ['example-bucket'])
    ).toEqual(['gemini-2.5-pro', 'storage:gs:example-bucket'])
  })

  test('keeps buckets when the model list is cleared', () => {
    expect(mergeVertexStorageModels([], ['example-bucket'])).toEqual([
      'storage:gs:example-bucket',
    ])
  })

  test('never duplicates buckets already present in the model list', () => {
    expect(
      mergeVertexStorageModels(
        ['gemini-2.5-pro', 'storage:gs:example-bucket'],
        ['example-bucket', ' example-bucket ']
      )
    ).toEqual(['gemini-2.5-pro', 'storage:gs:example-bucket'])
  })

  test('drops invalid bucket input instead of writing it to the channel', () => {
    expect(
      mergeVertexStorageModels(
        ['gemini-2.5-pro'],
        ['gs://example-bucket', '..']
      )
    ).toEqual(['gemini-2.5-pro'])
  })
})
