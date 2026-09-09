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
  getSafePluginAuthorUrl,
  parseTaskArtifactsResponse,
  resolveTaskPreviewMode,
  shouldLoadTaskArtifacts,
  TaskArtifactApiError,
} from '../lib/task-artifacts'
import type { TaskLog } from '../types'

const artifactAccessToken = `${'A'.repeat(41)}-_`

function artifactContentUrl(
  artifactKey: string,
  baseUrl = 'https://media.example.com/media-prefix'
): string {
  return `${baseUrl}/v1/tasks/task-public/artifacts/${artifactKey}/content?access=${artifactAccessToken}`
}

function taskFixture(overrides: Partial<TaskLog> = {}): TaskLog {
  return {
    id: 1,
    user_id: 7,
    platform: 'openrouter',
    task_id: 'task-public',
    action: 'generate',
    channel_id: 3,
    group: 'default',
    quota: 100,
    submit_time: 1,
    status: 'SUCCESS',
    admin_info: {
      task_plugin: {
        key: 'openrouter-video',
        name: 'OpenRouter Video',
        version: '1.0.0',
      },
    },
    ...overrides,
  }
}

describe('task artifact projection', () => {
  test('enables projection only after a successful artifact viewer opens', () => {
    const successfulPluginTask = taskFixture()

    expect(shouldLoadTaskArtifacts(successfulPluginTask, false)).toBe(false)
    expect(shouldLoadTaskArtifacts(successfulPluginTask, true)).toBe(true)
    expect(
      shouldLoadTaskArtifacts(taskFixture({ status: 'IN_PROGRESS' }), true)
    ).toBe(false)
    expect(
      shouldLoadTaskArtifacts(taskFixture({ admin_info: undefined }), true)
    ).toBe(true)
  })

  test('accepts an empty artifact result without inventing a preview', () => {
    expect(
      parseTaskArtifactsResponse({
        success: true,
        data: { artifacts: [] },
      })
    ).toStrictEqual({ artifacts: [] })
  })

  test('keeps stable absolute cross-origin content URLs', () => {
    expect(
      parseTaskArtifactsResponse({
        success: true,
        data: {
          artifacts: [
            {
              key: 'video-main',
              type: 'video',
              mime_type: 'video/mp4',
              content_url: artifactContentUrl('video-main'),
            },
            {
              key: 'poster~main',
              type: 'image',
              mime_type: 'image/webp',
              content_url: artifactContentUrl(
                'poster~main',
                'http://127.0.0.1:3001/nginx/tasks'
              ),
            },
            {
              key: 'result-file',
              type: 'file',
              content_url: artifactContentUrl(
                'result-file',
                'https://files.example.net'
              ),
            },
          ],
          legacy_content_url: artifactContentUrl(
            'video',
            'https://legacy-media.example.com/public'
          ),
        },
      })
    ).toStrictEqual({
      artifacts: [
        {
          key: 'video-main',
          type: 'video',
          mime_type: 'video/mp4',
          content_url: artifactContentUrl('video-main'),
        },
        {
          key: 'poster~main',
          type: 'image',
          mime_type: 'image/webp',
          content_url: artifactContentUrl(
            'poster~main',
            'http://127.0.0.1:3001/nginx/tasks'
          ),
        },
        {
          key: 'result-file',
          type: 'file',
          content_url: artifactContentUrl(
            'result-file',
            'https://files.example.net'
          ),
        },
      ],
      legacyContentUrl: artifactContentUrl(
        'video',
        'https://legacy-media.example.com/public'
      ),
    })
  })

  test('rejects failed, malformed, or duplicate artifact results', () => {
    expect(() =>
      parseTaskArtifactsResponse({
        success: false,
        message: 'plugin unavailable',
      })
    ).toThrow(TaskArtifactApiError)
    expect(() =>
      parseTaskArtifactsResponse({
        success: true,
        data: {
          artifacts: [
            {
              key: 'video-main',
              type: 'video',
              content_url: artifactContentUrl('video-main'),
            },
            {
              key: 'video-main',
              type: 'image',
              content_url: artifactContentUrl('poster-main'),
            },
          ],
        },
      })
    ).toThrow(TaskArtifactApiError)
    expect(() =>
      parseTaskArtifactsResponse({
        success: true,
        data: {
          artifacts: [
            {
              key: 'video:0',
              type: 'video',
              content_url: artifactContentUrl('video-main'),
            },
          ],
        },
      })
    ).toThrow(TaskArtifactApiError)
    expect(() =>
      parseTaskArtifactsResponse({
        success: true,
        data: {
          artifacts: [
            {
              key: ' video-main',
              type: 'video',
              content_url: artifactContentUrl('video-main'),
            },
          ],
        },
      })
    ).toThrow(TaskArtifactApiError)
  })

  test('rejects unsafe or missing content URLs', () => {
    const validContentUrl = artifactContentUrl('video-main')
    const unsafeUrls: unknown[] = [
      undefined,
      'javascript:alert(1)',
      'data:text/plain,artifact',
      'https:media.example.com/task',
      '//media.example.com/task',
      `/v1/tasks/task-public/artifacts/video-main/content?access=${artifactAccessToken}`,
      '/\\media.example.com/task',
      validContentUrl.replace('https://', 'https://user:secret@'),
      validContentUrl.replace('https://', 'https://@'),
      `${validContentUrl}#fragment`,
      `${validContentUrl}#`,
      ` ${validContentUrl}`,
      `${validContentUrl}\n`,
      'https://media.example.com/video.mp4',
      `https://media.example.com/v1/videos/task-public/content?access=${artifactAccessToken}`,
      `https://media.example.com/v1/tasks/task-public/artifacts/video-main/content?token=${artifactAccessToken}`,
      `https://media.example.com/v1/tasks/task-public/artifacts/video-main/content?access=${'A'.repeat(42)}`,
      `${validContentUrl}&access=${artifactAccessToken}`,
      `${validContentUrl}&download=1`,
    ]

    for (const contentUrl of unsafeUrls) {
      expect(() =>
        parseTaskArtifactsResponse({
          success: true,
          data: {
            artifacts: [
              {
                key: 'video-main',
                type: 'video',
                content_url: contentUrl,
              },
            ],
          },
        })
      ).toThrow(TaskArtifactApiError)
    }

    expect(() =>
      parseTaskArtifactsResponse({
        success: true,
        data: {
          artifacts: [],
          legacy_content_url: `https://media.example.com/v1/videos/task-public/content?access=${artifactAccessToken}`,
        },
      })
    ).toThrow(TaskArtifactApiError)
  })
})

describe('legacy task preview compatibility', () => {
  test('preserves old Suno and video previews without duplicating plugin previews', () => {
    expect(
      resolveTaskPreviewMode(
        taskFixture({
          platform: 'suno',
          admin_info: undefined,
          data: [{ audio_url: 'https://media.example/audio.mp3' }],
        })
      )
    ).toBe('legacy-suno')
    expect(
      resolveTaskPreviewMode(
        taskFixture({
          admin_info: undefined,
          legacy_video_available: true,
        })
      )
    ).toBe('legacy-video')
    expect(
      resolveTaskPreviewMode(
        taskFixture({
          admin_info: undefined,
          legacy_video_available: true,
        }),
        true
      )
    ).toBe('plugin')
    expect(
      resolveTaskPreviewMode(
        taskFixture({
          legacy_video_available: true,
        })
      )
    ).toBe('plugin')
    expect(
      resolveTaskPreviewMode(
        taskFixture({
          status: 'FAILURE',
          legacy_video_available: true,
        })
      )
    ).toBe('none')
    expect(
      resolveTaskPreviewMode(
        taskFixture({
          admin_info: undefined,
          legacy_video_available: false,
        })
      )
    ).toBe('plugin')
  })
})

describe('plugin author links', () => {
  test('allows HTTP authors and rejects executable URL schemes', () => {
    expect(
      getSafePluginAuthorUrl({
        name: 'Community Maintainer',
        url: 'https://plugins.example.com/maintainer',
      })
    ).toBe('https://plugins.example.com/maintainer')
    expect(
      getSafePluginAuthorUrl({
        name: 'Unsafe Maintainer',
        url: 'javascript:alert(1)',
      })
    ).toBe(undefined)
  })
})
