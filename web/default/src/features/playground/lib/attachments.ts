import type { FileUIPart } from 'ai'
import type { PlaygroundAttachment } from '../types'

export const MAX_ATTACHMENTS = 5
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_TEXT_BYTES = 1024 * 1024

const IMAGE_MEDIA_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const TEXT_EXTENSIONS = new Set(['.csv', '.json', '.md', '.txt'])
const IMAGE_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp'])
const VIDEO_MEDIA_TYPES = new Set(['video/mp4'])
const VIDEO_EXTENSIONS = new Set(['.mp4'])

interface ParsedDataUrl {
  mediaType: string
  bytes: Uint8Array
}

function parseDataUrl(url: string): ParsedDataUrl {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]*)$/i.exec(url)
  if (!match) throw new Error('Attachment data is invalid')

  const encoded = match[2].replace(/[\r\n]/g, '')
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const estimatedBytes = Math.floor((encoded.length * 3) / 4) - padding
  if (estimatedBytes > MAX_FILE_BYTES) {
    throw new Error('Attachment exceeds the maximum size')
  }

  try {
    const decoded = atob(encoded)
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0))
    return { mediaType: match[1].toLowerCase(), bytes }
  } catch {
    throw new Error('Attachment data is invalid')
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, '')
  } catch {
    throw new Error('Text attachment is not valid UTF-8')
  }
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot).toLowerCase()
}

function normalizeFilename(filename: string | undefined): string {
  const normalized = filename?.trim()
  return normalized || 'attachment'
}

function isImageAttachment(mediaType: string, filename: string): boolean {
  return (
    IMAGE_MEDIA_TYPES.has(mediaType) ||
    IMAGE_EXTENSIONS.has(extensionOf(filename))
  )
}

function isTextAttachment(mediaType: string, filename: string): boolean {
  return (
    mediaType.startsWith('text/') ||
    (mediaType === 'application/json' && extensionOf(filename) === '.json') ||
    TEXT_EXTENSIONS.has(extensionOf(filename))
  )
}

function isVideoAttachment(mediaType: string, filename: string): boolean {
  return (
    VIDEO_MEDIA_TYPES.has(mediaType) ||
    VIDEO_EXTENSIONS.has(extensionOf(filename))
  )
}

export async function normalizePlaygroundAttachments(
  files: FileUIPart[]
): Promise<PlaygroundAttachment[]> {
  if (files.length > MAX_ATTACHMENTS) {
    throw new Error('Too many attachments')
  }

  const attachments: PlaygroundAttachment[] = []
  for (const file of files) {
    const filename = normalizeFilename(file.filename)
    const parsed = parseDataUrl(file.url)
    const mediaType = (file.mediaType || parsed.mediaType).toLowerCase()

    if (parsed.bytes.length === 0) {
      throw new Error('Attachment is empty')
    }
    if (parsed.bytes.length > MAX_FILE_BYTES) {
      throw new Error('Attachment exceeds the maximum size')
    }

    if (isImageAttachment(mediaType, filename)) {
      if (!IMAGE_MEDIA_TYPES.has(parsed.mediaType)) {
        throw new Error('Attachment data is invalid')
      }
      attachments.push({ kind: 'image', filename, mediaType, url: file.url })
      continue
    }

    if (isVideoAttachment(mediaType, filename)) {
      if (!VIDEO_MEDIA_TYPES.has(parsed.mediaType)) {
        throw new Error('Attachment data is invalid')
      }
      attachments.push({ kind: 'video', filename, mediaType, url: file.url })
      continue
    }

    if (!isTextAttachment(mediaType, filename)) {
      throw new Error('Unsupported attachment type')
    }
    if (parsed.bytes.length > MAX_TEXT_BYTES) {
      throw new Error('Text attachment exceeds the maximum size')
    }

    const text = decodeUtf8(parsed.bytes)
    if (!text.trim()) {
      throw new Error('Attachment is empty')
    }
    attachments.push({ kind: 'text', filename, mediaType, text })
  }

  return attachments
}
