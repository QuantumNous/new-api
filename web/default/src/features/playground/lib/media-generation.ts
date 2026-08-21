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

export type PlaygroundModelKind = 'chat' | 'image' | 'video' | 'unsupported'

export type MediaGenerationFamily =
  | 'gpt-image'
  | 'gemini-image-pro'
  | 'gemini-image-flash'
  | 'grok-image'
  | 'veo-3.1'
  | 'seedance-2.0'

export type MediaParameterKey =
  | 'count'
  | 'size'
  | 'quality'
  | 'outputFormat'
  | 'background'
  | 'compression'
  | 'resolution'
  | 'aspectRatio'
  | 'duration'
  | 'responseFormat'
  | 'generateAudio'
  | 'seed'

export type MediaParameterValue = string | number | boolean

export type MediaGenerationSettings = Partial<
  Record<MediaParameterKey, MediaParameterValue>
>

export interface MediaParameterOption {
  value: string
  labelKey?: string
}

interface MediaParameterFieldBase {
  key: MediaParameterKey
  labelKey: string
}

export interface MediaSelectParameterField extends MediaParameterFieldBase {
  control: 'select'
  options: MediaParameterOption[]
}

export interface MediaNumberParameterField extends MediaParameterFieldBase {
  control: 'number'
  min: number
  max: number
  step?: number
  unitKey?: string
  visibleWhen?: {
    key: MediaParameterKey
    values: MediaParameterValue[]
  }
}

export interface MediaSwitchParameterField extends MediaParameterFieldBase {
  control: 'switch'
}

export type MediaParameterField =
  | MediaSelectParameterField
  | MediaNumberParameterField
  | MediaSwitchParameterField

export interface MediaGenerationProfile {
  kind: 'image' | 'video'
  family: MediaGenerationFamily
  fields: MediaParameterField[]
  defaults: MediaGenerationSettings
  noteKey?: string
}

export interface MediaGenerationRequest {
  kind: 'image' | 'video'
  endpoint: '/pg/chat/completions' | '/pg/images/generations' | '/pg/videos'
  payload: Record<string, unknown>
}

const imageRatios = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9']

const seedance20Ratios = [
  'adaptive',
  '16:9',
  '4:3',
  '1:1',
  '3:4',
  '9:16',
  '21:9',
]

const GPT_IMAGE_SIZE = '1024x1024'

function selectField(
  key: MediaParameterKey,
  labelKey: string,
  values: Array<string | MediaParameterOption>
): MediaSelectParameterField {
  return {
    key,
    labelKey,
    control: 'select',
    options: values.map((value) => {
      if (typeof value === 'string') return { value }
      return value
    }),
  }
}

const gptImageProfile: MediaGenerationProfile = {
  kind: 'image',
  family: 'gpt-image',
  defaults: {
    count: 1,
    size: GPT_IMAGE_SIZE,
    quality: 'auto',
    outputFormat: 'png',
    background: 'auto',
    compression: 90,
  },
  fields: [
    selectField('quality', 'Quality', [
      { value: 'auto', labelKey: 'Auto' },
      { value: 'low', labelKey: 'Low' },
      { value: 'medium', labelKey: 'Medium' },
      { value: 'high', labelKey: 'High' },
    ]),
    selectField('outputFormat', 'Output format', ['png', 'jpeg']),
    selectField('background', 'Background', [
      { value: 'auto', labelKey: 'Auto' },
      { value: 'opaque', labelKey: 'Opaque' },
    ]),
    {
      key: 'compression',
      labelKey: 'Compression',
      control: 'number',
      min: 0,
      max: 100,
      step: 1,
      unitKey: '%',
      visibleWhen: {
        key: 'outputFormat',
        values: ['jpeg'],
      },
    },
  ],
}

const geminiImageProProfile: MediaGenerationProfile = {
  kind: 'image',
  family: 'gemini-image-pro',
  defaults: {
    resolution: '2K',
    aspectRatio: '1:1',
  },
  fields: [
    selectField('resolution', 'Resolution', ['1K', '2K', '4K']),
    selectField('aspectRatio', 'Aspect ratio', imageRatios),
  ],
}

const geminiImageFlashProfile: MediaGenerationProfile = {
  kind: 'image',
  family: 'gemini-image-flash',
  defaults: {
    resolution: '1K',
    aspectRatio: '1:1',
  },
  fields: [
    selectField('resolution', 'Resolution', ['1K']),
    selectField('aspectRatio', 'Aspect ratio', imageRatios),
  ],
}

const grokImageProfile: MediaGenerationProfile = {
  kind: 'image',
  family: 'grok-image',
  defaults: {
    count: 1,
    responseFormat: 'url',
  },
  fields: [
    {
      key: 'count',
      labelKey: 'Image count',
      control: 'number',
      min: 1,
      max: 10,
      step: 1,
    },
    selectField('responseFormat', 'Response format', [
      { value: 'url', labelKey: 'URL' },
      { value: 'b64_json', labelKey: 'Base64' },
    ]),
  ],
}

const veoProfile: MediaGenerationProfile = {
  kind: 'video',
  family: 'veo-3.1',
  defaults: {
    resolution: '720p',
    duration: 8,
    aspectRatio: '16:9',
  },
  fields: [
    selectField('resolution', 'Resolution', ['720p', '1080p', '4k']),
    selectField('duration', 'Duration', [
      { value: '4', labelKey: '4 seconds' },
      { value: '6', labelKey: '6 seconds' },
      { value: '8', labelKey: '8 seconds' },
    ]),
    selectField('aspectRatio', 'Aspect ratio', ['16:9', '9:16']),
  ],
  noteKey: 'Veo 1080p and 4K output requires an 8-second duration.',
}

function createSeedance20Profile(
  resolutions: string[]
): MediaGenerationProfile {
  return {
    kind: 'video',
    family: 'seedance-2.0',
    defaults: {
      resolution: '720p',
      duration: 5,
      aspectRatio: 'adaptive',
      generateAudio: true,
    },
    fields: [
      selectField('resolution', 'Resolution', resolutions),
      selectField('aspectRatio', 'Aspect ratio', seedance20Ratios),
      {
        key: 'duration',
        labelKey: 'Duration',
        control: 'number',
        min: 4,
        max: 15,
        step: 1,
        unitKey: 'seconds',
      },
      {
        key: 'generateAudio',
        labelKey: 'Generate audio',
        control: 'switch',
      },
    ],
  }
}

const seedance20FullProfile = createSeedance20Profile([
  '480p',
  '720p',
  '1080p',
  '4k',
])

const seedance20EconomyProfile = createSeedance20Profile(['480p', '720p'])

const unsupportedPatterns = [
  /(^|[-_/])(?:dall[ -]?e|imagen|flux|stable-diffusion|sdxl|midjourney|jimeng|qwen-image|z-image)(?:$|[-_/])/,
  /(^|\/)nano-banana(?:$|[-_/])/,
  /(^|\/)minimax-h3(?:$|[-_/])/,
  /(^|[-_/])(?:image|video|seedance|sora|kling|veo|wan|hailuo|runway|pika|luma)(?:$|[-_/])/,
  /(^|[-_/])(?:tts|whisper|transcribe|speech|audio-preview|audio)(?:$|[-_/])/,
  /(^|[-_/])(?:embedding|embeddings|rerank|reranker|moderation|suno|music|lyrics)(?:$|[-_/])/,
  /^mj_/,
]

function normalizeModelName(model: unknown): string {
  return typeof model === 'string' ? model.trim().toLowerCase() : ''
}

function cloneProfile(profile: MediaGenerationProfile): MediaGenerationProfile {
  return {
    ...profile,
    defaults: { ...profile.defaults },
    fields: profile.fields.map((field) => {
      if (field.control === 'select') {
        return {
          ...field,
          options: field.options.map((option) => ({ ...option })),
        }
      }
      if (field.control === 'number' && field.visibleWhen) {
        return {
          ...field,
          visibleWhen: {
            ...field.visibleWhen,
            values: [...field.visibleWhen.values],
          },
        }
      }
      return { ...field }
    }),
  }
}

export function resolveMediaGenerationProfile(
  model: unknown
): MediaGenerationProfile | undefined {
  const normalized = normalizeModelName(model)
  if (!normalized) return undefined

  if (/(^|\/)gpt-image-2(?:$|[-_/])/.test(normalized)) {
    return cloneProfile(gptImageProfile)
  }
  if (normalized.includes('grok-imagine-image')) {
    return cloneProfile(grokImageProfile)
  }
  if (/(^|\/)gemini-3\.1-flash-image-preview(?:$|[-_/])/.test(normalized)) {
    return cloneProfile(geminiImageFlashProfile)
  }
  if (
    normalized.includes('gemini-3-pro-image') ||
    /(^|\/)nano-banana-pro-preview(?:$|[-_/])/.test(normalized)
  ) {
    return cloneProfile(geminiImageProProfile)
  }
  if (/(^|\/)veo-3(?:\.|-)1(?:$|[-_/])/.test(normalized)) {
    return cloneProfile(veoProfile)
  }
  if (normalized.includes('seedance')) {
    if (/2(?:[.-]|-)?0/.test(normalized)) {
      const isEconomyVariant = /(?:^|[-_/])(?:fast|mini)(?:$|[-_/])/.test(
        normalized
      )
      return cloneProfile(
        isEconomyVariant ? seedance20EconomyProfile : seedance20FullProfile
      )
    }
  }
  return undefined
}

export function resolvePlaygroundModelKind(
  model: unknown
): PlaygroundModelKind {
  const normalized = normalizeModelName(model)
  if (!normalized) return 'unsupported'

  const mediaProfile = resolveMediaGenerationProfile(normalized)
  if (mediaProfile) return mediaProfile.kind

  if (unsupportedPatterns.some((pattern) => pattern.test(normalized))) {
    return 'unsupported'
  }
  return 'chat'
}

function normalizedNumber(
  value: MediaParameterValue | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export function normalizeMediaGenerationSettings(
  profile: MediaGenerationProfile,
  settings: MediaGenerationSettings
): MediaGenerationSettings {
  const normalized: MediaGenerationSettings = {
    ...profile.defaults,
    ...settings,
  }

  profile.fields.forEach((field) => {
    if (field.control === 'number') {
      const fallback = Number(profile.defaults[field.key] ?? field.min)
      normalized[field.key] = normalizedNumber(
        normalized[field.key],
        fallback,
        field.min,
        field.max
      )
      return
    }
    if (field.control === 'select') {
      const value = String(normalized[field.key] ?? '')
      const supported = field.options.some((option) => option.value === value)
      if (!supported) normalized[field.key] = profile.defaults[field.key]
    }
  })

  if (profile.family === 'gpt-image') {
    normalized.count = 1
    normalized.size = GPT_IMAGE_SIZE
  }

  if (
    profile.family === 'veo-3.1' &&
    (normalized.resolution === '1080p' || normalized.resolution === '4k')
  ) {
    normalized.duration = 8
  }
  return normalized
}

function buildGptImagePayload(
  prompt: string,
  model: string,
  group: string,
  settings: MediaGenerationSettings
): Record<string, unknown> {
  const outputFormat = settings.outputFormat === 'jpeg' ? 'jpeg' : 'png'
  const background = settings.background === 'opaque' ? 'opaque' : 'auto'
  const payload: Record<string, unknown> = {
    model,
    group,
    prompt,
    n: 1,
    size: GPT_IMAGE_SIZE,
    quality: settings.quality,
    response_format: 'b64_json',
    output_format: outputFormat,
    background,
  }
  if (outputFormat === 'jpeg') {
    payload.output_compression = settings.compression
  }
  return payload
}

function buildGeminiImagePayload(
  prompt: string,
  model: string,
  group: string,
  settings: MediaGenerationSettings
): Record<string, unknown> {
  return {
    model,
    group,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    extra_body: {
      google: {
        image_config: {
          image_size: settings.resolution,
          aspect_ratio: settings.aspectRatio,
        },
      },
    },
  }
}

function buildVideoPayload(
  prompt: string,
  model: string,
  group: string,
  family: MediaGenerationFamily,
  settings: MediaGenerationSettings
): Record<string, unknown> {
  if (family === 'seedance-2.0') {
    return {
      model,
      group,
      prompt,
      content: [{ type: 'text', text: prompt }],
      resolution: settings.resolution,
      ratio: settings.aspectRatio,
      duration: settings.duration,
      generate_audio: settings.generateAudio,
    }
  }

  if (family === 'veo-3.1') {
    return {
      model,
      group,
      prompt,
      duration: settings.duration,
      metadata: {
        resolution: settings.resolution,
        aspectRatio: settings.aspectRatio,
      },
    }
  }

  return {
    model,
    group,
    prompt,
    resolution: settings.resolution,
    ratio: settings.aspectRatio,
    duration: settings.duration,
  }
}

export function buildMediaGenerationRequest(
  prompt: string,
  model: string,
  group: string,
  settings: MediaGenerationSettings
): MediaGenerationRequest | undefined {
  const profile = resolveMediaGenerationProfile(model)
  if (!profile) return undefined

  // The Playground state normalizes settings when the user edits them. Keep
  // request construction serialization-only so the submitted values always
  // match the values visible in the parameter panel.

  if (profile.family === 'gpt-image') {
    return {
      kind: 'image',
      endpoint: '/pg/images/generations',
      payload: buildGptImagePayload(prompt, model, group, settings),
    }
  }
  if (profile.family === 'grok-image') {
    return {
      kind: 'image',
      endpoint: '/pg/images/generations',
      payload: {
        model,
        group,
        prompt,
        n: settings.count,
        response_format: settings.responseFormat,
      },
    }
  }
  if (
    profile.family === 'gemini-image-pro' ||
    profile.family === 'gemini-image-flash'
  ) {
    return {
      kind: 'image',
      endpoint: '/pg/chat/completions',
      payload: buildGeminiImagePayload(prompt, model, group, settings),
    }
  }
  return {
    kind: 'video',
    endpoint: '/pg/videos',
    payload: buildVideoPayload(prompt, model, group, profile.family, settings),
  }
}
