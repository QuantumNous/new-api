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
  normalizeMediaGenerationSettings,
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
    expect(profile?.defaults.size).toBe('1024x1024')
    expect(profile?.fields.map((field) => field.key)).toEqual([
      'quality',
      'outputFormat',
      'background',
      'compression',
    ])
    expect(
      profile?.fields.find((field) => field.key === 'size')
    ).toBeUndefined()
    expect(
      profile?.fields
        .find((field) => field.key === 'outputFormat')
        ?.options.map((option) => option.value)
    ).toEqual(['png', 'jpeg'])
    expect(
      profile?.fields
        .find((field) => field.key === 'background')
        ?.options.map((option) => option.value)
    ).toEqual(['auto', 'opaque'])
    expect(
      profile?.fields.find((field) => field.key === 'compression')?.visibleWhen
        ?.values
    ).toEqual(['jpeg'])
  })

  test('GPT Image 2 normalizes stale unsupported settings to safe values', () => {
    const profile = resolveMediaGenerationProfile('gpt-image-2')

    const settings = normalizeMediaGenerationSettings(profile!, {
      count: 2,
      size: '1536x1024',
      outputFormat: 'webp',
      background: 'transparent',
    })

    expect(settings.count).toBe(1)
    expect(settings.size).toBe('1024x1024')
    expect(settings.outputFormat).toBe('png')
    expect(settings.background).toBe('auto')
  })

  test('Seedance duration uses the shared localized seconds unit', () => {
    const profile = resolveMediaGenerationProfile('seedance-2.0')

    expect(
      profile?.fields.find((field) => field.key === 'duration')?.unitKey
    ).toBe('seconds')
  })

  test('Seedance Base and Pro expose the full supported parameter set', () => {
    const modelNames = [
      'seedance-2.0',
      'seedance2.0-pro',
      'seedance-2.0-pro',
      'bytedance/seedance-2.0-pro-20260811',
      'doubao/doubao-seedance-2-0-260128',
    ]

    for (const modelName of modelNames) {
      const profile = resolveMediaGenerationProfile(modelName)

      expect(profile?.defaults).toEqual({
        resolution: '720p',
        duration: 5,
        aspectRatio: 'adaptive',
        generateAudio: true,
      })
      expect(
        profile?.fields
          .find((field) => field.key === 'resolution')
          ?.options.map((option) => option.value)
      ).toEqual(['480p', '720p', '1080p', '4k'])
      expect(
        profile?.fields
          .find((field) => field.key === 'aspectRatio')
          ?.options.map((option) => option.value)
      ).toEqual(['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'])
      expect(profile?.fields.map((field) => field.key)).not.toContain('seed')
    }
  })

  test('Seedance Fast and Mini expose only their supported resolutions', () => {
    const modelNames = [
      'bytedance/seedance-2.0-fast',
      'seedance-2.0-fast-20260811',
      'seedance-2.0-mini',
      'seedance2.0-mini',
      'doubao/doubao-seedance-2-0-fast-260128',
    ]

    for (const modelName of modelNames) {
      const profile = resolveMediaGenerationProfile(modelName)

      expect(profile?.defaults).toEqual({
        resolution: '720p',
        duration: 5,
        aspectRatio: 'adaptive',
        generateAudio: true,
      })
      expect(
        profile?.fields
          .find((field) => field.key === 'resolution')
          ?.options.map((option) => option.value)
      ).toEqual(['480p', '720p'])
      expect(
        profile?.fields
          .find((field) => field.key === 'aspectRatio')
          ?.options.map((option) => option.value)
      ).toEqual(['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'])
      expect(profile?.fields.map((field) => field.key)).not.toContain('seed')
    }
  })

  test('Seedance Fast and Mini normalize stale unsupported resolutions', () => {
    const fastProfile = resolveMediaGenerationProfile('seedance-2.0-fast')
    const miniProfile = resolveMediaGenerationProfile('seedance-2.0-mini')

    expect(
      normalizeMediaGenerationSettings(fastProfile!, {
        resolution: '1080p',
      }).resolution
    ).toBe('720p')
    expect(
      normalizeMediaGenerationSettings(miniProfile!, {
        resolution: '4K',
      }).resolution
    ).toBe('720p')
  })

  test('Grok image does not invent unsupported quality or resolution controls', () => {
    const profile = resolveMediaGenerationProfile('grok-imagine-image')

    expect(profile?.fields.map((field) => field.key)).toEqual([
      'count',
      'responseFormat',
    ])
  })

  test('Veo configuration normalizes high resolution duration to eight seconds', () => {
    const profile = resolveMediaGenerationProfile('veo-3.1-generate-preview')

    expect(profile).toBeDefined()
    expect(
      normalizeMediaGenerationSettings(profile!, {
        resolution: '4k',
        duration: 4,
        aspectRatio: '16:9',
      }).duration
    ).toBe(8)
  })
})

describe('Playground media request building', () => {
  test('does not silently rewrite configured Veo duration while building the request', () => {
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
        duration: 4,
        metadata: {
          resolution: '4k',
          aspectRatio: '16:9',
        },
      },
    })
  })
  test('builds a safe GPT Image 2 payload from stale unsupported settings', () => {
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
        n: 1,
        size: '1024x1024',
        quality: 'high',
        response_format: 'b64_json',
        output_format: 'png',
        background: 'auto',
      },
    })
  })

  test('keeps GPT Image 2 JPEG compression in the request', () => {
    const request = buildMediaGenerationRequest(
      'A red paper boat',
      'gpt-image-2',
      'plg',
      {
        count: 1,
        quality: 'auto',
        outputFormat: 'jpeg',
        background: 'opaque',
        compression: 50,
      }
    )

    expect(request?.payload).toEqual({
      model: 'gpt-image-2',
      group: 'plg',
      prompt: 'A red paper boat',
      n: 1,
      size: '1024x1024',
      quality: 'auto',
      response_format: 'b64_json',
      output_format: 'jpeg',
      background: 'opaque',
      output_compression: 50,
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

  test('builds the official Seedance content request without stale seed', () => {
    const request = buildMediaGenerationRequest(
      'A dancer in the rain',
      'bytedance/seedance-2.0',
      'plg',
      {
        resolution: '4k',
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
        resolution: '4k',
        ratio: '9:16',
        duration: 12,
        generate_audio: false,
      },
    })
    expect(request?.payload).not.toHaveProperty('seed')
  })
})
