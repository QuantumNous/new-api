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
import { formatUseTime } from '@/lib/format'

const MAX_IMAGE_TASK_RESULT_COUNT = 128

export interface ImageTaskLogImage {
  url: string
  revised_prompt?: string
  width?: number
  height?: number
}

export interface ImageTaskLogRequest {
  request_id?: string
  request_path?: string
  operation?: string
  prompt?: string
  size?: string
  quality?: string
  n?: number
  output_format?: string
  aspect_ratio?: string
  resolution?: string
  style?: string
  input_image_count?: number
  has_mask?: boolean
  webhook_configured?: boolean
}

export interface ImageTaskInfo {
  version: 1
  kind: 'image_generation'
  status: string
  request?: ImageTaskLogRequest
  result: {
    public_base?: string
    images: ImageTaskLogImage[]
    count: number
  }
  timing?: {
    submitted_at?: number
    completed_at?: number
    total_ms?: number
  }
}

interface ImageTaskStreamSummary {
  kind: 'async-image'
  imageCount: number
}

interface ImageTaskMedia {
  thumbnail?: ImageTaskLogImage
  gallery: ImageTaskLogImage[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized === '' ? undefined : normalized
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalNonNegativeInteger(value: unknown): number | undefined {
  const numberValue = optionalFiniteNumber(value)
  if (
    numberValue == null ||
    numberValue < 0 ||
    !Number.isInteger(numberValue)
  ) {
    return undefined
  }
  return numberValue
}

function parsePublicImageBase(value: unknown): URL | null {
  const rawBase = optionalString(value)
  if (!rawBase) return null

  try {
    const parsed = new URL(rawBase)
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.hostname === '' ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.search !== '' ||
      parsed.hash !== '' ||
      isPrivateImageHost(parsed.hostname)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function matchesPublicImageBase(candidate: URL, publicBase: URL): boolean {
  if (
    candidate.protocol !== publicBase.protocol ||
    candidate.hostname !== publicBase.hostname ||
    candidate.port !== publicBase.port
  ) {
    return false
  }
  const basePath = publicBase.pathname.replace(/\/+$/, '')
  if (basePath === '') return true
  return (
    candidate.pathname === basePath ||
    candidate.pathname.startsWith(`${basePath}/`)
  )
}

export function getSafeImageUrl(
  value: unknown,
  publicBase?: URL | null
): string | null {
  const rawUrl = optionalString(value)
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl)
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.hostname === '' ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      isPrivateImageHost(parsed.hostname) ||
      (publicBase != null &&
        (parsed.search !== '' ||
          parsed.hash !== '' ||
          !matchesPublicImageBase(parsed, publicBase)))
    ) {
      return null
    }
    return rawUrl
  } catch {
    return null
  }
}

function isPrivateImageHost(rawHostname: string): boolean {
  const hostname = rawHostname
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '')
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.nip.io') ||
    hostname.endsWith('.sslip.io') ||
    hostname.endsWith('.localtest.me') ||
    hostname.endsWith('.lvh.me') ||
    hostname.endsWith('.vcap.me') ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return true
  }
  if (hostname.includes(':')) {
    if (hostname.startsWith('::ffff:') || hostname.startsWith('::')) {
      const mappedPrefix = hostname.startsWith('::ffff:') ? '::ffff:' : '::'
      const mappedGroups = hostname.slice(mappedPrefix.length).split(':')
      const mappedHex = mappedGroups
        .map((group) => group.padStart(4, '0'))
        .join('')
      if (
        mappedGroups.length <= 2 &&
        mappedGroups.every((group) => /^[0-9a-f]{1,4}$/.test(group)) &&
        mappedHex.length === 8
      ) {
        const padded = mappedHex
        const first = Number.parseInt(padded.slice(0, 2), 16)
        const second = Number.parseInt(padded.slice(2, 4), 16)
        return isPrivateIPv4(first, second)
      }
    }
    return (
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      hostname.startsWith('fe') ||
      hostname.startsWith('ff') ||
      hostname === '::' ||
      hostname.startsWith('::ffff:127.')
    )
  }
  const octets = hostname.split('.')
  if (octets.length !== 4 || octets.some((octet) => !/^\d+$/.test(octet))) {
    return false
  }
  const numbers = octets.map(Number)
  if (numbers.some((octet) => octet < 0 || octet > 255)) return true
  return isPrivateIPv4(numbers[0], numbers[1])
}

function isPrivateIPv4(first: number, second: number): boolean {
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function parseImage(
  value: unknown,
  publicBase: URL | null
): ImageTaskLogImage | null {
  if (!isRecord(value)) return null
  const url = getSafeImageUrl(value.url, publicBase)
  if (!url) return null

  const image: ImageTaskLogImage = { url }
  const revisedPrompt = optionalString(value.revised_prompt)
  const width = optionalNonNegativeInteger(value.width)
  const height = optionalNonNegativeInteger(value.height)
  if (revisedPrompt) image.revised_prompt = revisedPrompt
  if (width != null && width > 0) image.width = width
  if (height != null && height > 0) image.height = height
  return image
}

function parseRequest(value: unknown): ImageTaskLogRequest | undefined {
  if (!isRecord(value)) return undefined

  const request: ImageTaskLogRequest = {}
  const stringFields = [
    'request_id',
    'request_path',
    'operation',
    'prompt',
    'size',
    'quality',
    'output_format',
    'aspect_ratio',
    'resolution',
    'style',
  ] as const
  for (const field of stringFields) {
    const fieldValue = optionalString(value[field])
    if (fieldValue) request[field] = fieldValue
  }

  const n = optionalNonNegativeInteger(value.n)
  const inputImageCount = optionalNonNegativeInteger(value.input_image_count)
  if (n != null && n > 0) request.n = n
  if (inputImageCount != null) request.input_image_count = inputImageCount
  if (typeof value.has_mask === 'boolean') request.has_mask = value.has_mask
  if (typeof value.webhook_configured === 'boolean') {
    request.webhook_configured = value.webhook_configured
  }

  return Object.keys(request).length > 0 ? request : undefined
}

function parseTiming(value: unknown): ImageTaskInfo['timing'] {
  if (!isRecord(value)) return undefined

  const submittedAt = optionalFiniteNumber(value.submitted_at)
  const completedAt = optionalFiniteNumber(value.completed_at)
  const totalMs = optionalFiniteNumber(value.total_ms)
  const timing: NonNullable<ImageTaskInfo['timing']> = {}
  if (submittedAt != null && submittedAt > 0) timing.submitted_at = submittedAt
  if (completedAt != null && completedAt > 0) timing.completed_at = completedAt
  if (totalMs != null && totalMs > 0) timing.total_ms = totalMs
  return Object.keys(timing).length > 0 ? timing : undefined
}

export function parseImageTaskInfo(other: string): ImageTaskInfo | null {
  if (!other) return null

  let parsedOther: unknown
  try {
    parsedOther = JSON.parse(other)
  } catch {
    return null
  }
  if (!isRecord(parsedOther) || !isRecord(parsedOther.task_info)) return null

  const rawTaskInfo = parsedOther.task_info
  if (
    rawTaskInfo.version !== 1 ||
    rawTaskInfo.kind !== 'image_generation' ||
    typeof rawTaskInfo.status !== 'string' ||
    rawTaskInfo.status.trim() === ''
  ) {
    return null
  }

  const rawResult = isRecord(rawTaskInfo.result)
    ? rawTaskInfo.result
    : undefined
  const rawPublicBase = optionalString(rawResult?.public_base)
  const publicBase = parsePublicImageBase(rawPublicBase)
  const rawImages = Array.isArray(rawResult?.images)
    ? rawResult.images.slice(0, MAX_IMAGE_TASK_RESULT_COUNT)
    : []
  let images: ImageTaskLogImage[] = []
  if (rawPublicBase != null && publicBase != null) {
    images = rawImages
      .map((image) => parseImage(image, publicBase))
      .filter((image): image is ImageTaskLogImage => image != null)
  }
  const declaredCount = optionalNonNegativeInteger(rawResult?.count) ?? 0
  const boundedDeclaredCount = Math.min(
    declaredCount,
    MAX_IMAGE_TASK_RESULT_COUNT
  )

  return {
    version: 1,
    kind: 'image_generation',
    status: rawTaskInfo.status.trim(),
    request: parseRequest(rawTaskInfo.request),
    result: {
      public_base: publicBase?.toString(),
      images,
      count: Math.max(images.length, boundedDeclaredCount),
    },
    timing: parseTiming(rawTaskInfo.timing),
  }
}

export function formatImageTaskDuration(
  taskInfo: ImageTaskInfo,
  useTimeSec?: number
): string {
  const totalMs = taskInfo.timing?.total_ms
  if (totalMs != null && Number.isFinite(totalMs) && totalMs > 0) {
    return formatUseTime(totalMs / 1000)
  }
  if (useTimeSec == null || !Number.isFinite(useTimeSec) || useTimeSec <= 0) {
    return 'N/A'
  }
  return formatUseTime(useTimeSec)
}

export function getImageTaskStreamSummary(
  taskInfo: ImageTaskInfo
): ImageTaskStreamSummary {
  return {
    kind: 'async-image',
    imageCount: taskInfo.result.count,
  }
}

export function getImageTaskMedia(taskInfo: ImageTaskInfo): ImageTaskMedia {
  const gallery = [...taskInfo.result.images]
  return {
    thumbnail: gallery[0],
    gallery,
  }
}
