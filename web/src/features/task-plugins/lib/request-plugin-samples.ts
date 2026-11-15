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
import type { RequestPluginSample } from '../types'

/** A list item of a sample body that stands for the console's own image. */
export const REQUEST_PLUGIN_SAMPLE_IMAGE = '[sample-image]'

/** "zhCN", "zh-TW" and "zh" are all "zh"; "en-US" is "en". */
function baseLanguage(tag: string) {
  const lower = tag.trim().toLowerCase()
  return lower.startsWith('zh') ? 'zh' : lower.split(/[-_]/)[0]
}

/**
 * The samples shown in an interface language: those written in it, or else
 * those for any language followed by the English ones.
 */
export function requestPluginSamplesFor(
  samples: RequestPluginSample[],
  language: string
): RequestPluginSample[] {
  const base = baseLanguage(language)
  const own = samples.filter(
    (sample) => sample.lang && baseLanguage(sample.lang) === base
  )
  if (own.length > 0) return own
  return [
    ...samples.filter((sample) => !sample.lang),
    ...samples.filter(
      (sample) => sample.lang && baseLanguage(sample.lang) === 'en'
    ),
  ]
}

/** The console's sample image as one content part of a request format. */
function sampleImagePart(format: string, image: string) {
  const data = image.slice(image.indexOf(',') + 1)
  if (format === 'openai_responses') {
    return { type: 'input_image', image_url: image }
  }
  if (format === 'claude') {
    return {
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data },
    }
  }
  if (format === 'gemini') {
    return { inlineData: { mimeType: 'image/png', data } }
  }
  return { type: 'image_url', image_url: { url: image } }
}

/**
 * A sample body ready to run: each "[sample-image]" list item becomes the
 * console's PNG data URL in the part shape of the format, or is dropped when
 * the browser could not draw it.
 */
export function requestPluginSampleBody(
  value: unknown,
  format: string,
  image: string | null
): unknown {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (item !== REQUEST_PLUGIN_SAMPLE_IMAGE) {
        return [requestPluginSampleBody(item, format, image)]
      }
      return image ? [sampleImagePart(format, image)] : []
    })
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, member]) => [
        key,
        requestPluginSampleBody(member, format, image),
      ])
    )
  }
  return value
}

/** Whether a sample body asks for the console's image anywhere. */
export function requestPluginSampleHasImage(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(
      (item) =>
        item === REQUEST_PLUGIN_SAMPLE_IMAGE ||
        requestPluginSampleHasImage(item)
    )
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(requestPluginSampleHasImage)
  }
  return false
}

// Members that hold what the user or the system wrote, in every format.
const SAMPLE_TEXT_MEMBERS = new Set([
  'text',
  'content',
  'input',
  'system',
  'instructions',
])

/** The texts a request carries, in document order, as the sample card shows them. */
export function requestPluginSampleTexts(
  value: unknown,
  member = '',
  found: string[] = []
): string[] {
  if (typeof value === 'string') {
    if (SAMPLE_TEXT_MEMBERS.has(member) && value.trim()) found.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) requestPluginSampleTexts(item, member, found)
  } else if (value && typeof value === 'object') {
    for (const [name, item] of Object.entries(value)) {
      requestPluginSampleTexts(item, name, found)
    }
  }
  return found
}
