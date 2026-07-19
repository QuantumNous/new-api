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
  formatImageTaskDuration,
  getImageTaskMedia,
  getImageTaskStreamSummary,
  getSafeImageUrl,
  parseImageTaskInfo,
} from './image-task-info'

const completedTaskInfo = {
  version: 1,
  kind: 'image_generation',
  status: 'SUCCESS',
  result: {
    public_base: 'https://cdn.example.com/generated',
    images: [
      {
        url: 'https://cdn.example.com/generated/first.png',
        revised_prompt: 'A calmer evening sky',
      },
      {
        url: 'https://cdn.example.com/generated/second.jpg',
        width: 1024,
        height: 1024,
      },
    ],
    count: 2,
  },
  timing: {
    submitted_at: 1_720_000_000,
    completed_at: 1_720_000_019,
    total_ms: 18_765,
  },
}

describe('image task log presentation', () => {
  test('parses the versioned task_info image result contract', () => {
    const taskInfo = parseImageTaskInfo(
      JSON.stringify({ task_info: completedTaskInfo })
    )

    assert.ok(taskInfo)
    assert.equal(taskInfo.version, 1)
    assert.equal(taskInfo.kind, 'image_generation')
    assert.equal(taskInfo.status, 'SUCCESS')
    assert.equal(
      taskInfo.result.public_base,
      'https://cdn.example.com/generated'
    )
    assert.equal(taskInfo.result.count, 2)
    assert.deepEqual(
      taskInfo.result.images.map((image) => image.url),
      [
        'https://cdn.example.com/generated/first.png',
        'https://cdn.example.com/generated/second.jpg',
      ]
    )
    assert.equal(
      taskInfo.result.images[0]?.revised_prompt,
      'A calmer evening sky'
    )
    assert.equal(taskInfo.timing?.total_ms, 18_765)
    assert.equal(taskInfo.timing?.submitted_at, 1_720_000_000)
    assert.equal(taskInfo.timing?.completed_at, 1_720_000_019)
  })

  test('returns null for malformed, unrelated, or unsupported task_info', () => {
    assert.equal(parseImageTaskInfo(''), null)
    assert.equal(parseImageTaskInfo('{not-json'), null)
    assert.equal(
      parseImageTaskInfo(
        JSON.stringify({ task_info: { version: 1, kind: 'video' } })
      ),
      null
    )
    assert.equal(
      parseImageTaskInfo(
        JSON.stringify({
          task_info: { version: 2, kind: 'image_generation' },
        })
      ),
      null
    )
    assert.equal(
      parseImageTaskInfo(
        JSON.stringify({
          task_info: { version: 1, kind: 'image_generation', status: ' ' },
        })
      ),
      null
    )
  })

  test('shows N/A for missing or zero image duration instead of 0.0s or NaN', () => {
    const taskInfo = parseImageTaskInfo(
      JSON.stringify({
        task_info: {
          version: 1,
          kind: 'image_generation',
          status: 'FAILURE',
          result: { images: [], count: 0 },
        },
      })
    )

    assert.ok(taskInfo)
    assert.equal(formatImageTaskDuration(taskInfo, 0), 'N/A')
    assert.equal(formatImageTaskDuration(taskInfo, undefined), 'N/A')
    assert.equal(formatImageTaskDuration(taskInfo, Number.NaN), 'N/A')
    assert.doesNotMatch(formatImageTaskDuration(taskInfo, 0), /0\.0s|NaN/)
  })

  test('prefers task_info total_ms and falls back to a positive use_time', () => {
    const taskInfo = parseImageTaskInfo(
      JSON.stringify({ task_info: completedTaskInfo })
    )

    assert.ok(taskInfo)
    assert.equal(formatImageTaskDuration(taskInfo, 0), '18.8s')

    const taskInfoWithoutTiming = parseImageTaskInfo(
      JSON.stringify({
        task_info: {
          ...completedTaskInfo,
          timing: undefined,
        },
      })
    )
    assert.ok(taskInfoWithoutTiming)
    assert.equal(formatImageTaskDuration(taskInfoWithoutTiming, 3.24), '3.2s')
  })

  test('uses async-image semantics and the generated image count in the stream column', () => {
    const taskInfo = parseImageTaskInfo(
      JSON.stringify({ task_info: completedTaskInfo })
    )

    assert.ok(taskInfo)
    assert.deepEqual(getImageTaskStreamSummary(taskInfo), {
      kind: 'async-image',
      imageCount: 2,
    })
  })

  test('preserves a bounded declared count when image URLs are redacted', () => {
    const taskInfo = parseImageTaskInfo(
      JSON.stringify({
        task_info: {
          version: 1,
          kind: 'image_generation',
          status: 'SUCCESS',
          result: { images: [], count: 2 },
        },
      })
    )

    assert.ok(taskInfo)
    assert.deepEqual(getImageTaskStreamSummary(taskInfo), {
      kind: 'async-image',
      imageCount: 2,
    })
    assert.deepEqual(getImageTaskMedia(taskInfo), {
      thumbnail: undefined,
      gallery: [],
    })

    const oversized = parseImageTaskInfo(
      JSON.stringify({
        task_info: {
          version: 1,
          kind: 'image_generation',
          status: 'SUCCESS',
          result: { images: [], count: 1_000_000 },
        },
      })
    )
    assert.ok(oversized)
    assert.equal(getImageTaskStreamSummary(oversized).imageCount, 128)

    const twentyImages = parseImageTaskInfo(
      JSON.stringify({
        task_info: {
          version: 1,
          kind: 'image_generation',
          status: 'SUCCESS',
          result: {
            images: Array.from({ length: 20 }, (_, index) => ({
              url: `https://cdn.example.com/generated/${index}.png`,
            })),
            public_base: 'https://cdn.example.com/generated',
            count: 20,
          },
        },
      })
    )
    assert.ok(twentyImages)
    assert.equal(getImageTaskStreamSummary(twentyImages).imageCount, 20)
    assert.equal(getImageTaskMedia(twentyImages).gallery.length, 20)
  })

  test('accepts only HTTP image URLs and exposes thumbnail and gallery data', () => {
    assert.equal(
      getSafeImageUrl('https://cdn.example.com/generated/first.png'),
      'https://cdn.example.com/generated/first.png'
    )
    assert.equal(
      getSafeImageUrl('https://user:pass@example.com/image.png'),
      null
    )
    assert.equal(getSafeImageUrl('javascript:alert(1)'), null)
    assert.equal(getSafeImageUrl('http://127.0.0.1/private.png'), null)
    assert.equal(
      getSafeImageUrl('http://169.254.169.254/latest/meta-data'),
      null
    )
    assert.equal(getSafeImageUrl('http://192.168.1.10/private.png'), null)
    assert.equal(getSafeImageUrl('http://localhost/private.png'), null)
    assert.equal(getSafeImageUrl('http://[fe80::1]/private.png'), null)
    assert.equal(getSafeImageUrl('http://[::ffff:7f00:1]/private.png'), null)
    assert.equal(getSafeImageUrl('http://[::7f00:1]/private.png'), null)
    assert.equal(getSafeImageUrl('http://[fec0::1]/private.png'), null)
    assert.equal(getSafeImageUrl('https://127.0.0.1.nip.io/private.png'), null)

    const trustedBase = new URL('https://cdn.example.com/generated')
    assert.equal(
      getSafeImageUrl(
        'https://cdn.example.com/generated/first.png',
        trustedBase
      ),
      'https://cdn.example.com/generated/first.png'
    )
    assert.equal(
      getSafeImageUrl('https://cdn.example.com/other.png', trustedBase),
      null
    )
    assert.equal(
      getSafeImageUrl(
        'https://cdn.example.com/generated/tracked.png?token=secret',
        trustedBase
      ),
      null
    )
    assert.equal(
      getSafeImageUrl('https://attacker.example/image.png', trustedBase),
      null
    )

    const untrustedTaskInfo = parseImageTaskInfo(
      JSON.stringify({
        task_info: {
          version: 1,
          kind: 'image_generation',
          status: 'SUCCESS',
          result: {
            images: [{ url: 'https://attacker.example/generated.png' }],
            count: 1,
          },
        },
      })
    )
    assert.ok(untrustedTaskInfo)
    assert.equal(untrustedTaskInfo.result.count, 1)
    assert.deepEqual(getImageTaskMedia(untrustedTaskInfo).gallery, [])

    const taskInfo = parseImageTaskInfo(
      JSON.stringify({
        task_info: {
          ...completedTaskInfo,
          result: {
            ...completedTaskInfo.result,
            images: [
              ...completedTaskInfo.result.images,
              { url: 'https://attacker.example/generated.png' },
              { url: 'https://127.0.0.1.nip.io/generated.png' },
              { url: 'javascript:alert(1)' },
              { url: 'data:image/png;base64,AAAA' },
              { url: 'file:///tmp/private.png' },
              { url: '/relative/generated.png' },
              { url: 'not a URL' },
            ],
            count: 7,
          },
        },
      })
    )

    assert.ok(taskInfo)
    const media = getImageTaskMedia(taskInfo)

    assert.equal(
      media.thumbnail?.url,
      'https://cdn.example.com/generated/first.png'
    )
    assert.deepEqual(
      media.gallery.map((image) => image.url),
      [
        'https://cdn.example.com/generated/first.png',
        'https://cdn.example.com/generated/second.jpg',
      ]
    )
    assert.equal(media.gallery[0]?.revised_prompt, 'A calmer evening sky')
    assert.equal(media.gallery[1]?.width, 1024)
    assert.equal(media.gallery[1]?.height, 1024)
  })
})
