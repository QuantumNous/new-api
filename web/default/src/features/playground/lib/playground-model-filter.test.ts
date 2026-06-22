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
import { isPlaygroundChatModelName } from './playground-model-filter'

describe('isPlaygroundChatModelName', () => {
  test('keeps chat-compatible text models visible in Playground', () => {
    for (const model of [
      'gpt-4o',
      'gpt-5.5',
      'anthropic/claude-sonnet-4.5',
      'claude-haiku-4-5',
      'gemini-2.5-flash',
      'antigravity-preview-05-2026',
    ]) {
      expect(isPlaygroundChatModelName(model)).toBe(true)
    }
  })

  test('hides image, video, audio, embedding, and task models', () => {
    for (const model of [
      'gpt-image-1',
      'dall-e-3',
      'black-forest-labs/flux-1.1-pro',
      'gemini-2.5-flash-image',
      'qwen-image-edit-plus',
      'z-image',
      'sora-2',
      'bytedance/seedance-2.0-fast',
      'doubao-seedance-2-0-260128',
      'kling-v1',
      'veo-3',
      'mj_video',
      'tts-1',
      'whisper-1',
      'gpt-4o-audio-preview',
      'text-embedding-3-large',
      'bge-reranker-v2',
      'text-moderation-stable',
      'suno_music',
    ]) {
      expect(isPlaygroundChatModelName(model)).toBe(false)
    }
  })

  test('rejects invalid runtime model values', () => {
    expect(isPlaygroundChatModelName('')).toBe(false)
    expect(isPlaygroundChatModelName('   ')).toBe(false)
    expect(isPlaygroundChatModelName(null)).toBe(false)
    expect(isPlaygroundChatModelName({})).toBe(false)
  })
})
