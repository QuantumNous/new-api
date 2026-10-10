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
/** Files the user may attach to a playground message. */
export const MAX_ATTACHMENT_COUNT = 6
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** Per-document extraction cap, and the budget shared by one message. */
export const MAX_ATTACHMENT_TEXT_CHARS = 20_000
export const MAX_MESSAGE_CONTEXT_CHARS = 60_000
export const MAX_PDF_PAGES = 100

/**
 * Attachment payload kept in localStorage across all messages. Images are far
 * larger than this, so in practice only document text survives a reload.
 */
export const MAX_STORED_ATTACHMENT_PAYLOAD_CHARS = 400_000

/** How many attachments per message survive a reload. */
export const MAX_STORED_ATTACHMENTS = 6

export const TRUNCATED_TEXT_SUFFIX = '\n\n[...]'

export const ATTACHMENT_KINDS = {
  IMAGE: 'image',
  DOCUMENT: 'document',
} as const

/** Error codes double as translation keys, like ERROR_MESSAGES. */
export const ATTACHMENT_ERRORS = {
  UNSUPPORTED_TYPE: 'Unsupported file type',
  FILE_TOO_LARGE: 'File is too large',
  READ_FAILED: 'Failed to read file',
  TOO_MANY_FILES: 'Too many files',
  CONTEXT_FULL: 'Attachment context is already full',
} as const

/**
 * Image extensions mapped to the media type to send upstream. The MIME type is
 * not always present — a pasted or drag-and-dropped file can arrive with an
 * empty or wrong type — so the extension is the fallback for both classifying
 * the file and labelling it.
 */
const IMAGE_EXTENSION_MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
}

const IMAGE_EXTENSIONS = Object.keys(IMAGE_EXTENSION_MEDIA_TYPES)

const DOCUMENT_EXTENSIONS = [
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'txt',
  'text',
  'md',
  'markdown',
  'csv',
  'tsv',
  'json',
  'jsonl',
  'log',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'py',
  'go',
  'java',
  'kt',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'rb',
  'php',
  'rs',
  'swift',
  'dart',
  'vue',
  'svelte',
  'sh',
  'bash',
  'zsh',
  'sql',
]

/** Extensions rendered as plain text rather than parsed by a document reader. */
const PLAIN_TEXT_EXTENSIONS = new Set(
  DOCUMENT_EXTENSIONS.filter(
    (extension) => !['pdf', 'docx', 'xlsx', 'pptx'].includes(extension)
  )
)

export const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
]

/** Value for the file input's `accept` attribute. */
export const ATTACHMENT_ACCEPT = [
  'image/*',
  ...SUPPORTED_ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`),
].join(',')

export function isPlainTextExtension(extension: string): boolean {
  return PLAIN_TEXT_EXTENSIONS.has(extension)
}

/**
 * Image extensions, for callers that only have a filename to go on. The MIME
 * type is not always present — a pasted or drag-and-dropped file can arrive
 * with an empty type — and without this check such a file would be filed as a
 * document and have its binary bytes run through text extraction.
 */
export function isImageExtension(extension: string): boolean {
  return IMAGE_EXTENSIONS.includes(extension)
}

/**
 * Media type for an image extension, or `null` when the extension has no known
 * type. The bytes are forwarded to the model unchanged, so an unknown extension
 * must not be relabelled as a type it is not — a decoder would then be handed a
 * format it cannot read. Callers reject the attachment in that case.
 */
export function getImageMediaType(filename: string): string | null {
  const match = /\.([^.]+)$/.exec(filename.trim().toLowerCase())

  return IMAGE_EXTENSION_MEDIA_TYPES[match?.[1] ?? ''] ?? null
}

/**
 * Whether an `image/*` media type is one we can label and forward as-is. Used
 * for attachments that carry no usable extension and are identified by their
 * MIME type alone.
 */
export function isSupportedImageMediaType(mediaType: string): boolean {
  return Object.values(IMAGE_EXTENSION_MEDIA_TYPES).includes(
    mediaType.trim().toLowerCase()
  )
}
