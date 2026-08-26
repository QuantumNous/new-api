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
  validateMediaGenerationAttachments,
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
    expect(resolvePlaygroundModelKind('veo-3.0-generate-001')).toBe('video')
    expect(resolvePlaygroundModelKind('google/veo-3-0-fast-generate-001')).toBe(
      'video'
    )
    expect(resolvePlaygroundModelKind('bytedance/seedance-2.0-fast')).toBe(
      'video'
    )
    expect(resolvePlaygroundModelKind('seedance-2.5')).toBe('video')
    expect(resolvePlaygroundModelKind('seedance-2-5')).toBe('video')
    expect(resolvePlaygroundModelKind('doubao-seedance-2-5-260628')).toBe(
      'video'
    )
    expect(resolvePlaygroundModelKind('grok-imagine-video')).toBe('video')
    expect(resolvePlaygroundModelKind('grok-imagine-video-1.5')).toBe('video')
    expect(resolvePlaygroundModelKind('minimax-h3')).toBe('unsupported')
    expect(resolvePlaygroundModelKind('gpt-4o')).toBe('chat')
    expect(resolvePlaygroundModelKind('tts-1')).toBe('unsupported')
  })

  test('keeps supported media models visible without exposing other task models', () => {
    expect(isSupportedPlaygroundModelName('gpt-image-2')).toBe(true)
    expect(
      isSupportedPlaygroundModelName('veo-3.1-fast-generate-preview')
    ).toBe(true)
    expect(isSupportedPlaygroundModelName('grok-imagine-video-1.5')).toBe(true)
    expect(isSupportedPlaygroundModelName('whisper-1')).toBe(false)
    expect(isSupportedPlaygroundModelName('text-embedding-3-large')).toBe(false)
    expect(isSupportedPlaygroundModelName('sora-2')).toBe(false)
  })

  test('allows image attachments for GPT Image 2 editing', () => {
    const image = {
      kind: 'image' as const,
      filename: 'reference.png',
      mediaType: 'image/png',
      url: 'data:image/png;base64,AA==',
    }

    expect(validateMediaGenerationAttachments('gpt-image-2', [image])).toBe(
      undefined
    )

    expect(
      buildMediaGenerationRequest(
        'Turn this into a watercolor illustration',
        'gpt-image-2',
        'plg',
        {},
        [image]
      )
    ).toEqual({
      kind: 'image',
      endpoint: '/pg/images/edits',
      payload: expect.objectContaining({
        model: 'gpt-image-2',
        prompt: 'Turn this into a watercolor illustration',
        images: ['data:image/png;base64,AA=='],
      }),
    })
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

  test('Seedance 2.5 exposes only parameters accepted by the current relay', () => {
    const profile = resolveMediaGenerationProfile('doubao-seedance-2-5-260628')

    expect(profile?.family).toBe('seedance-2.5')
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
    ).toEqual(['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16'])
    expect(
      profile?.fields.find((field) => field.key === 'duration')
    ).toMatchObject({ min: 4, max: 30, step: 1, unitKey: 'seconds' })
    expect(profile?.fields.map((field) => field.key)).not.toContain('seed')
  })

  test('normalizes scalar media controls to values the relay can accept', () => {
    const profile = resolveMediaGenerationProfile('seedance-2.5')

    expect(
      normalizeMediaGenerationSettings(profile!, {
        duration: 4.5,
        generateAudio: 'false',
      })
    ).toMatchObject({ duration: 5, generateAudio: true })
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

  test('Veo 3.0 exposes its supported video profile', () => {
    const profile = resolveMediaGenerationProfile('veo-3.0-generate-001')

    expect(profile?.family).toBe('veo-3.0')
    expect(
      profile?.fields
        .find((field) => field.key === 'resolution')
        ?.options.map((option) => option.value)
    ).toEqual(['720p'])
    expect(
      normalizeMediaGenerationSettings(profile!, {
        resolution: '4k',
        duration: 4,
      })
    ).toMatchObject({ resolution: '720p', duration: 4 })
  })

  test('Grok video profiles expose only supported generation controls', () => {
    const legacy = resolveMediaGenerationProfile('grok-imagine-video')
    const current = resolveMediaGenerationProfile('grok-imagine-video-1.5')

    expect(legacy?.defaults).toEqual({
      resolution: '720p',
      duration: 5,
      aspectRatio: '16:9',
    })
    expect(
      legacy?.fields
        .find((field) => field.key === 'resolution')
        ?.options.map((option) => option.value)
    ).toEqual(['480p', '720p'])
    expect(
      current?.fields
        .find((field) => field.key === 'resolution')
        ?.options.map((option) => option.value)
    ).toEqual(['480p', '720p', '1080p'])
    expect(current?.fields.map((field) => field.key)).toEqual([
      'resolution',
      'duration',
      'aspectRatio',
    ])
  })
})

describe('Playground media request building', () => {
  test('allows image references for video models but rejects unsupported media', () => {
    const image = {
      kind: 'image' as const,
      filename: 'frame.png',
      mediaType: 'image/png',
      url: 'data:image/png;base64,AA==',
    }
    const video = {
      kind: 'video' as const,
      filename: 'clip.mp4',
      mediaType: 'video/mp4',
      url: 'data:video/mp4;base64,AA==',
    }

    expect(
      validateMediaGenerationAttachments('veo-3.1-generate-preview', [image])
    ).toBeUndefined()
    expect(
      validateMediaGenerationAttachments('seedance-2.0', [video])
    ).toBeUndefined()
    expect(
      validateMediaGenerationAttachments('veo-3.1-generate-preview', [video])
    ).toBe('Veo supports image-to-video, not video-to-video')
    expect(
      validateMediaGenerationAttachments('grok-imagine-video', [video])
    ).toBe('Grok video editing is not available in Playground yet')
  })

  test('builds Veo image-to-video requests from an attached frame', () => {
    const request = buildMediaGenerationRequest(
      'Animate this frame',
      'veo-3.1-generate-preview',
      'plg',
      { resolution: '720p', duration: 8, aspectRatio: '16:9' },
      [
        {
          kind: 'image',
          filename: 'frame.png',
          mediaType: 'image/png',
          url: 'data:image/png;base64,AA==',
        },
      ]
    )

    expect(request?.payload).toMatchObject({
      images: ['data:image/png;base64,AA=='],
    })
  })

  test('builds Seedance image and video reference content', () => {
    const request = buildMediaGenerationRequest(
      'Follow the reference motion',
      'seedance-2.0',
      'plg',
      { resolution: '720p', duration: 5, aspectRatio: '16:9' },
      [
        {
          kind: 'image',
          filename: 'frame.png',
          mediaType: 'image/png',
          url: 'data:image/png;base64,AA==',
        },
        {
          kind: 'video',
          filename: 'motion.mp4',
          mediaType: 'video/mp4',
          url: 'data:video/mp4;base64,AA==',
        },
      ]
    )

    expect(request?.payload.content).toEqual([
      { type: 'text', text: 'Follow the reference motion' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,AA==' },
      },
      {
        type: 'video_url',
        video_url: { url: 'data:video/mp4;base64,AA==' },
        role: 'reference_video',
      },
    ])
  })

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

  test('builds the authenticated Playground request for Veo 3.0', () => {
    const request = buildMediaGenerationRequest(
      'A cinematic sunrise',
      'veo-3.0-generate-001',
      'plg',
      { resolution: '720p', duration: 8, aspectRatio: '16:9' }
    )

    expect(request).toEqual({
      kind: 'video',
      endpoint: '/pg/videos',
      payload: {
        model: 'veo-3.0-generate-001',
        group: 'plg',
        prompt: 'A cinematic sunrise',
        duration: 8,
        metadata: {
          resolution: '720p',
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

  test('builds Seedance 2.5 through the official content request without seed', () => {
    const request = buildMediaGenerationRequest(
      'Clouds moving across a mountain ridge',
      'seedance-2.5',
      'plg',
      {
        resolution: '720p',
        aspectRatio: '9:16',
        duration: 30,
        seed: -1,
        generateAudio: true,
      }
    )

    expect(request).toEqual({
      kind: 'video',
      endpoint: '/pg/videos',
      payload: {
        model: 'seedance-2.5',
        group: 'plg',
        prompt: 'Clouds moving across a mountain ridge',
        content: [
          { type: 'text', text: 'Clouds moving across a mountain ridge' },
        ],
        resolution: '720p',
        ratio: '9:16',
        duration: 30,
        generate_audio: true,
      },
    })
    expect(request?.payload).not.toHaveProperty('seed')
  })

  test('builds a Grok video request with the upstream field names', () => {
    const request = buildMediaGenerationRequest(
      'A blue square slowly rotates',
      'grok-imagine-video-1.5',
      'lxy',
      {
        resolution: '720p',
        aspectRatio: '1:1',
        duration: 5,
      }
    )

    expect(request).toEqual({
      kind: 'video',
      endpoint: '/pg/videos',
      payload: {
        model: 'grok-imagine-video-1.5',
        group: 'lxy',
        prompt: 'A blue square slowly rotates',
        resolution: '720p',
        aspect_ratio: '1:1',
        duration: 5,
      },
    })
  })
})
