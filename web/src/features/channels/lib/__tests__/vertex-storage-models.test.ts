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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  mergeVertexStorageModels,
  normalizeVertexStorageBucket,
  splitVertexStorageModels,
} from '../vertex-storage-models'

describe('Vertex storage model values', () => {
  test('separates regular models from valid bucket markers without changing order', () => {
    assert.deepEqual(
      splitVertexStorageModels([
        'gemini-2.5-pro',
        ' storage:gs:bucket-a ',
        'gemini-2.5-flash',
        'storage:gs:bucket-b',
        'storage:gs:bucket-a',
      ]),
      {
        models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
        buckets: ['bucket-a', 'bucket-b'],
      }
    )
  })

  test('accepts plain bucket names and rejects prefixes, paths, and URL syntax', () => {
    assert.equal(normalizeVertexStorageBucket(' bucket-a '), 'bucket-a')
    for (const value of [
      '',
      '.',
      '..',
      'bucket-a/path',
      'bucket-a\\path',
      'storage:gs:bucket-a',
      'gs://bucket-a',
      'bucket-a?alt=media',
      'bucket-a#fragment',
    ]) {
      assert.equal(normalizeVertexStorageBucket(value), null, value)
    }
  })

  test('replaces old markers with unique valid buckets while preserving regular models', () => {
    assert.deepEqual(
      mergeVertexStorageModels(
        ['gemini-2.5-pro', 'storage:gs:stale-bucket'],
        [' bucket-a ', 'bucket-a', 'bucket-b/path', 'bucket-c']
      ),
      ['gemini-2.5-pro', 'storage:gs:bucket-a', 'storage:gs:bucket-c']
    )
  })

  test('drops malformed stored markers instead of exposing them as regular models', () => {
    assert.deepEqual(
      splitVertexStorageModels([
        'storage:gs:',
        'storage:gs:bucket-a/path',
        'gemini-2.5-pro',
      ]),
      { models: ['gemini-2.5-pro'], buckets: [] }
    )
  })
})
