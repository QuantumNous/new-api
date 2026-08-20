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
  extractGeneratedImages,
  parseVideoTaskResponse,
  sanitizeGeneratedMediaUrl,
} from './media-response'

describe('sanitizeGeneratedMediaUrl', () => {
  test('allows same-origin, http(s), and generated image data URLs', () => {
    expect(sanitizeGeneratedMediaUrl('/v1/videos/task_123/content')).toBe(
      '/v1/videos/task_123/content'
    )
    expect(sanitizeGeneratedMediaUrl('https://cdn.example/video.mp4')).toBe(
      'https://cdn.example/video.mp4'
    )
    expect(sanitizeGeneratedMediaUrl('data:image/png;base64,QUJDRA==')).toBe(
      'data:image/png;base64,QUJDRA=='
    )
  })

  test('rejects executable, non-image, and protocol-relative URLs', () => {
    expect(sanitizeGeneratedMediaUrl('javascript:alert(1)')).toBeUndefined()
    expect(sanitizeGeneratedMediaUrl('data:text/html,<script>x</script>')).toBe(
      undefined
    )
    expect(sanitizeGeneratedMediaUrl('//tracking.example/image.png')).toBe(
      undefined
    )
    expect(sanitizeGeneratedMediaUrl('/\\tracking.example/image.png')).toBe(
      undefined
    )
    expect(
      sanitizeGeneratedMediaUrl('https://\\tracking.example/image.png')
    ).toBeUndefined()
    expect(
      sanitizeGeneratedMediaUrl('https://user:password@cdn.example/image.png')
    ).toBeUndefined()
    expect(sanitizeGeneratedMediaUrl('https://')).toBeUndefined()
  })
})

describe('extractGeneratedImages', () => {
  test('extracts URL and base64 image responses without dropping order', () => {
    expect(
      extractGeneratedImages({
        data: [
          { url: 'https://cdn.example/one.png' },
          { b64_json: 'aGVsbG8=', output_format: 'webp' },
        ],
      })
    ).toEqual([
      {
        type: 'image',
        url: 'https://cdn.example/one.png',
      },
      {
        type: 'image',
        url: 'data:image/webp;base64,aGVsbG8=',
      },
    ])
  })

  test('ignores malformed image entries', () => {
    expect(extractGeneratedImages({ data: [{}, null, 'invalid'] })).toEqual([])
  })

  test('drops image URLs that are not safe media sources', () => {
    expect(
      extractGeneratedImages({
        data: [
          { url: 'javascript:alert(1)' },
          { url: 'https://cdn.example/safe.png' },
        ],
      })
    ).toEqual([{ type: 'image', url: 'https://cdn.example/safe.png' }])
  })
})

describe('parseVideoTaskResponse', () => {
  test('parses the OpenAI-style submission response', () => {
    expect(
      parseVideoTaskResponse({
        id: 'task_123',
        status: 'queued',
        progress: 0,
      })
    ).toEqual({
      taskId: 'task_123',
      status: 'queued',
      progress: 0,
    })
  })

  test('parses the wrapped Playground fetch response and result URL', () => {
    expect(
      parseVideoTaskResponse({
        code: 'success',
        data: {
          task_id: 'task_123',
          status: 'SUCCESS',
          progress: '100%',
          result_url: '/v1/videos/task_123/content',
        },
      })
    ).toEqual({
      taskId: 'task_123',
      status: 'completed',
      progress: 100,
      url: '/v1/videos/task_123/content',
    })
  })

  test('normalizes failed task details', () => {
    expect(
      parseVideoTaskResponse({
        data: {
          task_id: 'task_456',
          status: 'FAILURE',
          fail_reason: 'upstream rejected prompt',
        },
      })
    ).toEqual({
      taskId: 'task_456',
      status: 'failed',
      error: 'upstream rejected prompt',
    })
  })

  test('omits unsafe completed-task result URLs', () => {
    expect(
      parseVideoTaskResponse({
        data: {
          task_id: 'task_789',
          status: 'completed',
          result_url: 'javascript:alert(1)',
        },
      })
    ).toEqual({
      taskId: 'task_789',
      status: 'completed',
    })
  })
})
