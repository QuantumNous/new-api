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
  isPlaygroundChatModelName,
  isSupportedPlaygroundModelName,
} from './playground-model-filter'

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

  test('keeps only implemented Gemini image families selectable', () => {
    for (const model of [
      'nano-banana-pro-preview',
      'gemini-3-pro-image-preview',
      'gemini-3.1-flash-image-preview',
    ]) {
      expect(isSupportedPlaygroundModelName(model)).toBe(true)
      expect(isPlaygroundChatModelName(model)).toBe(false)
    }
  })

  test('keeps implemented video families selectable but out of first-run chat', () => {
    for (const model of [
      'veo-3.1-fast-generate-preview',
      'veo-3.1-generate-preview',
      'google/veo-3.1-fast-generate-preview',
      'bytedance/seedance-2.0-fast',
    ]) {
      expect(isSupportedPlaygroundModelName(model)).toBe(true)
      expect(isPlaygroundChatModelName(model)).toBe(false)
    }
  })

  test('hides image, video, audio, embedding, and task models', () => {
    for (const model of [
      'gpt-image-1',
      'gpt-image-2',
      'dall-e-3',
      'black-forest-labs/flux-1.1-pro',
      'imagen-3.0-generate',
      'qwen-image-edit-plus',
      'z-image',
      'sora-2',
      'bytedance/seedance-2.0-fast',
      'doubao-seedance-2-0-260128',
      'kling-v1',
      'veo-3',
      'veo-2.0',
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

  test('allows the concrete image and video families implemented by Playground', () => {
    for (const model of [
      'gpt-image-2',
      'gemini-3-pro-image-preview',
      'gemini-3.1-flash-image-preview',
      'nano-banana-pro-preview',
      'grok-imagine-image',
      'veo-3.1-generate-preview',
      'bytedance/seedance-2.0-fast',
    ]) {
      expect(isSupportedPlaygroundModelName(model)).toBe(true)
    }
  })
})
