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
export const CHANNEL_CONNECTION_INFO_TYPE = 'newapi_channel_conn'

export type ChannelConnectionInfo = {
  key: string
  url: string
}

export type ChannelConnectionConfidence = 'high' | 'medium'

export type ChannelConnectionGroup = {
  url: string
  keys: string[]
  confidence: ChannelConnectionConfidence
}

export type ChannelConnectionParseResult = {
  groups: ChannelConnectionGroup[]
  unmatchedKeys: string[]
  unmatchedUrls: string[]
}

type PositionedValue = {
  value: string
  index: number
}

const CHANNEL_KEY_PATTERN = /\bsk-[A-Za-z0-9][A-Za-z0-9._-]{5,}\b/g
const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"'`]+/giu
const TRAILING_URL_PUNCTUATION = /[\])}>.,;!?，。；！？]+$/u
const URL_FIELD_NAMES = new Set([
  'url',
  'baseurl',
  'endpoint',
  'apiurl',
  'host',
])
const KEY_FIELD_NAMES = new Set([
  'key',
  'keys',
  'apikey',
  'apikeys',
  'token',
  'tokens',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z]/g, '')
}

function extractKeyValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return extractKeys(value).map((item) => item.value)
  }
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => extractKeyValues(item))
}

function extractKeys(text: string): PositionedValue[] {
  CHANNEL_KEY_PATTERN.lastIndex = 0
  return [...text.matchAll(CHANNEL_KEY_PATTERN)].map((match) => ({
    value: match[0],
    index: match.index,
  }))
}

function extractUrls(text: string): PositionedValue[] {
  HTTP_URL_PATTERN.lastIndex = 0
  const values: PositionedValue[] = []
  for (const match of text.matchAll(HTTP_URL_PATTERN)) {
    const candidate = match[0].replace(TRAILING_URL_PUNCTUATION, '')
    const normalized = normalizeChannelBaseUrl(candidate)
    if (normalized) {
      values.push({ value: normalized, index: match.index })
    }
  }
  return values
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

export function normalizeChannelBaseUrl(value: string): string | null {
  const trimmed = value.trim().replace(TRAILING_URL_PUNCTUATION, '')
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username ||
      parsed.password
    ) {
      return null
    }

    parsed.search = ''
    parsed.hash = ''
    let pathname = parsed.pathname.replace(/\/+$/, '')
    pathname = pathname.replace(
      /\/v1\/(?:chat\/completions|responses(?:\/compact)?|models|completions|embeddings)$/i,
      ''
    )
    pathname = pathname.replace(/\/(?:chat\/completions|models)$/i, '')
    pathname = pathname.replace(/\/v1$/i, '')
    pathname = pathname.replace(/\/+$/, '')

    return `${parsed.origin}${pathname}`
  } catch {
    return null
  }
}

export function maskChannelKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 12) {
    return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`
  }
  return `${trimmed.slice(0, 7)}••••••${trimmed.slice(-4)}`
}

export function encodeChannelConnectionInfo(key: string, url: string): string {
  return JSON.stringify({
    _type: CHANNEL_CONNECTION_INFO_TYPE,
    key,
    url,
  })
}

export function parseChannelConnectionInfo(
  text: string | null | undefined
): ChannelConnectionInfo | null {
  if (!text || typeof text !== 'string') return null

  try {
    const parsed: unknown = JSON.parse(text.trim())
    if (
      isRecord(parsed) &&
      parsed._type === CHANNEL_CONNECTION_INFO_TYPE &&
      typeof parsed.key === 'string' &&
      typeof parsed.url === 'string'
    ) {
      return { key: parsed.key, url: parsed.url }
    }
  } catch {
    /* not valid connection info JSON */
  }

  return null
}

export function parseChannelConnectionInfos(
  text: string | null | undefined
): ChannelConnectionParseResult {
  if (!text || typeof text !== 'string') {
    return { groups: [], unmatchedKeys: [], unmatchedUrls: [] }
  }

  const groupMap = new Map<string, ChannelConnectionGroup>()
  const allKeys = new Set<string>()
  const allUrls = new Set<string>()
  const assignedKeys = new Set<string>()
  const assignedUrls = new Set<string>()

  const addGroup = (
    url: string,
    keys: string[],
    confidence: ChannelConnectionConfidence
  ) => {
    const normalizedUrl = normalizeChannelBaseUrl(url)
    const normalizedKeys = unique(
      keys.map((key) => key.trim()).filter((key) => key.startsWith('sk-'))
    )
    if (!normalizedUrl || normalizedKeys.length === 0) return

    const existing = groupMap.get(normalizedUrl)
    if (existing) {
      existing.keys = unique([...existing.keys, ...normalizedKeys])
      if (confidence === 'high') existing.confidence = confidence
    } else {
      groupMap.set(normalizedUrl, {
        url: normalizedUrl,
        keys: normalizedKeys,
        confidence,
      })
    }
    assignedUrls.add(normalizedUrl)
    for (const key of normalizedKeys) assignedKeys.add(key)
  }

  const visitStructuredValue = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visitStructuredValue(item)
      return
    }
    if (!isRecord(value)) return

    const urls: string[] = []
    const keys: string[] = []
    for (const [field, fieldValue] of Object.entries(value)) {
      const normalizedField = normalizeFieldName(field)
      if (
        URL_FIELD_NAMES.has(normalizedField) &&
        typeof fieldValue === 'string'
      ) {
        const normalizedUrl = normalizeChannelBaseUrl(fieldValue)
        if (normalizedUrl) {
          urls.push(normalizedUrl)
          allUrls.add(normalizedUrl)
        }
      }
      if (KEY_FIELD_NAMES.has(normalizedField)) {
        const extracted = extractKeyValues(fieldValue)
        keys.push(...extracted)
        for (const key of extracted) allKeys.add(key)
      }
    }
    if (urls.length === 1 && keys.length > 0) {
      addGroup(urls[0], keys, 'high')
    }

    for (const fieldValue of Object.values(value)) {
      visitStructuredValue(fieldValue)
    }
  }

  try {
    visitStructuredValue(JSON.parse(text.trim()) as unknown)
  } catch {
    // Ordinary clipboard text is expected to be non-JSON.
  }

  for (const item of extractKeys(text)) allKeys.add(item.value)
  for (const item of extractUrls(text)) allUrls.add(item.value)

  const blocks = text.split(/\r?\n\s*\r?\n+/)
  for (const block of blocks) {
    const blockUrls = extractUrls(block)
    const blockKeys = extractKeys(block)
    if (blockUrls.length === 1 && blockKeys.length > 0) {
      addGroup(
        blockUrls[0].value,
        blockKeys.map((item) => item.value),
        'high'
      )
      continue
    }
    if (blockUrls.length <= 1 || blockKeys.length === 0) continue

    const keysByUrl = new Map<string, string[]>()
    let hasKeyBeforeFirstUrl = false
    for (const key of blockKeys) {
      let owner: PositionedValue | undefined
      for (const url of blockUrls) {
        if (url.index > key.index) break
        owner = url
      }
      if (!owner) {
        hasKeyBeforeFirstUrl = true
        break
      }
      keysByUrl.set(owner.value, [
        ...(keysByUrl.get(owner.value) ?? []),
        key.value,
      ])
    }
    const everyUrlHasKeys = blockUrls.every((url) => keysByUrl.has(url.value))
    if (hasKeyBeforeFirstUrl || !everyUrlHasKeys) continue

    for (const url of blockUrls) {
      addGroup(url.value, keysByUrl.get(url.value) ?? [], 'medium')
    }
  }

  if (groupMap.size === 0 && allUrls.size === 1 && allKeys.size > 0) {
    addGroup([...allUrls][0], [...allKeys], 'high')
  }

  return {
    groups: [...groupMap.values()],
    unmatchedKeys: [...allKeys].filter((key) => !assignedKeys.has(key)),
    unmatchedUrls: [...allUrls].filter((url) => !assignedUrls.has(url)),
  }
}
