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
  buildMediaGenerationRequest,
  resolveMediaGenerationProfile,
  resolvePlaygroundModelKind,
} from './media-generation'
import { isSupportedPlaygroundModelName } from './playground-model-filter'

describe('Playground media model profiles', () => {
  test('classifies only implemented media families as image or video', () => {
    expect(resolvePlaygroundModelKind('gpt-image-2')).toBe('image')
    expect(resolvePlaygroundModelKind('gemini-3-pro-image-preview')).toBe(
      'image'
    )
    expect(resolvePlaygroundModelKind('nano-banana-pro-preview')).toBe('image')
    expect(resolvePlaygroundModelKind('gemini-3.1-flash-image-preview')).toBe(
      'image'
    )
    expect(resolvePlaygroundModelKind('grok-imagine-image')).toBe('image')
    expect(resolvePlaygroundModelKind('veo-3.1-generate-preview')).toBe('video')
    expect(resolvePlaygroundModelKind('veo-3-1-fast-generate-preview')).toBe(
      'video'
    )
    expect(resolvePlaygroundModelKind('bytedance/seedance-2.0-fast')).toBe(
      'video'
    )
    expect(resolvePlaygroundModelKind('seedance-2-5')).toBe('unsupported')
    expect(resolvePlaygroundModelKind('minimax-h3')).toBe('unsupported')
    expect(resolvePlaygroundModelKind('gpt-4o')).toBe('chat')
    expect(resolvePlaygroundModelKind('tts-1')).toBe('unsupported')
  })

  test('keeps supported media models visible without exposing other task models', () => {
    expect(isSupportedPlaygroundModelName('gpt-image-2')).toBe(true)
    expect(
      isSupportedPlaygroundModelName('veo-3.1-fast-generate-preview')
    ).toBe(true)
    expect(isSupportedPlaygroundModelName('whisper-1')).toBe(false)
    expect(isSupportedPlaygroundModelName('text-embedding-3-large')).toBe(false)
    expect(isSupportedPlaygroundModelName('sora-2')).toBe(false)
  })

  test('does not apply a concrete model profile to adjacent image families', () => {
    expect(resolvePlaygroundModelKind('gpt-image-1')).toBe('unsupported')
    expect(resolvePlaygroundModelKind('gemini-2.5-flash-image')).toBe(
      'unsupported'
    )
    expect(resolvePlaygroundModelKind('google/nano-banana-pro')).toBe(
      'unsupported'
    )
    expect(resolvePlaygroundModelKind('gemini-3-1-flash-lite-image')).toBe(
      'unsupported'
    )
  })

  test('GPT Image 2 exposes only relay-supported controls', () => {
    const profile = resolveMediaGenerationProfile('gpt-image-2')

    expect(profile?.family).toBe('gpt-image')
    expect(profile?.fields.map((field) => field.key)).toEqual([
      'count',
      'size',
      'quality',
      'outputFormat',
      'background',
      'compression',
    ])
    expect(
      profile?.fields.find((field) => field.key === 'size')?.labelKey
    ).toBe('Resolution')
  })

  test('Seedance duration uses the shared localized seconds unit', () => {
    const profile = resolveMediaGenerationProfile('seedance-2.0')

    expect(
      profile?.fields.find((field) => field.key === 'duration')?.unitKey
    ).toBe('seconds')
  })

  test('Grok image does not invent unsupported quality or resolution controls', () => {
    const profile = resolveMediaGenerationProfile('grok-imagine-image')

    expect(profile?.fields.map((field) => field.key)).toEqual([
      'count',
      'responseFormat',
    ])
  })

  test('Veo high resolutions normalize duration to eight seconds', () => {
    const request = buildMediaGenerationRequest(
      'A cinematic sunrise',
      'veo-3.1-generate-preview',
      'plg',
      {
        resolution: '4k',
        duration: 4,
        aspectRatio: '16:9',
      }
    )

    expect(request).toEqual({
      kind: 'video',
      endpoint: '/pg/videos',
      payload: {
        model: 'veo-3.1-generate-preview',
        group: 'plg',
        prompt: 'A cinematic sunrise',
        duration: 8,
        metadata: {
          resolution: '4k',
          aspectRatio: '16:9',
        },
      },
    })
  })
})

describe('Playground media request building', () => {
  test('builds the GPT Image 2 image endpoint payload', () => {
    const request = buildMediaGenerationRequest(
      'A red paper boat',
      'gpt-image-2',
      'plg',
      {
        count: 2,
        size: '1536x1024',
        quality: 'high',
        outputFormat: 'webp',
        background: 'transparent',
        compression: 82,
      }
    )

    expect(request).toEqual({
      kind: 'image',
      endpoint: '/pg/images/generations',
      payload: {
        model: 'gpt-image-2',
        group: 'plg',
        prompt: 'A red paper boat',
        n: 2,
        size: '1536x1024',
        quality: 'high',
        response_format: 'b64_json',
        output_format: 'webp',
        background: 'transparent',
        output_compression: 82,
      },
    })
  })

  test('omits GPT image compression for PNG output', () => {
    const request = buildMediaGenerationRequest(
      'A red paper boat',
      'gpt-image-2',
      'plg',
      {
        outputFormat: 'png',
        compression: 25,
      }
    )

    expect(request?.payload).not.toHaveProperty('output_compression')
  })

  test('builds Gemini image settings through the chat image config', () => {
    const request = buildMediaGenerationRequest(
      'A botanical poster',
      'gemini-3-pro-image-preview',
      'plg',
      {
        resolution: '4K',
        aspectRatio: '3:2',
      }
    )

    expect(request).toEqual({
      kind: 'image',
      endpoint: '/pg/chat/completions',
      payload: {
        model: 'gemini-3-pro-image-preview',
        group: 'plg',
        messages: [{ role: 'user', content: 'A botanical poster' }],
        stream: false,
        extra_body: {
          google: {
            image_config: {
              image_size: '4K',
              aspect_ratio: '3:2',
            },
          },
        },
      },
    })
  })

  test('builds Grok image payload with only supported fields', () => {
    const request = buildMediaGenerationRequest(
      'A chrome fox',
      'grok-imagine-image',
      'plg',
      { count: 3, responseFormat: 'url' }
    )

    expect(request?.payload).toEqual({
      model: 'grok-imagine-image',
      group: 'plg',
      prompt: 'A chrome fox',
      n: 3,
      response_format: 'url',
    })
  })

  test('builds the official Seedance content request and preserves explicit values', () => {
    const request = buildMediaGenerationRequest(
      'A dancer in the rain',
      'bytedance/seedance-2.0',
      'plg',
      {
        resolution: '1080p',
        aspectRatio: '9:16',
        duration: 12,
        seed: 0,
        generateAudio: false,
      }
    )

    expect(request).toEqual({
      kind: 'video',
      endpoint: '/pg/videos',
      payload: {
        model: 'bytedance/seedance-2.0',
        group: 'plg',
        prompt: 'A dancer in the rain',
        content: [{ type: 'text', text: 'A dancer in the rain' }],
        resolution: '1080p',
        ratio: '9:16',
        duration: 12,
        seed: 0,
        generate_audio: false,
      },
    })
  })
})
