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
/**
 * Attachment classification and browser-side reading of plain-text files.
 * Binary documents (PDF/Word/Excel/PowerPoint) are parsed server-side; see
 * document-parse.ts.
 */

export const MAX_DOCUMENT_TEXT_CHARS = 60_000

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|log|xml|ya?ml|html?)$/i

const SERVER_DOCUMENT_EXTENSIONS = /\.(pdf|docx|xlsx|pptx)$/i

const SERVER_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

export const DOCUMENT_ACCEPT = [
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.log',
  '.xml',
  '.yaml',
  '.yml',
  '.html',
  '.htm',
].join(',')

/** Binary document that goes through the server-side parse pipeline. */
export function isServerParsedDocument(file: File): boolean {
  return (
    SERVER_DOCUMENT_MIMES.has(file.type) ||
    SERVER_DOCUMENT_EXTENSIONS.test(file.name)
  )
}

/** Plain-text file read directly in the browser. */
export function isTextDocumentFile(file: File): boolean {
  return TEXT_EXTENSIONS.test(file.name) || file.type.startsWith('text/')
}

export function truncateDocumentText(text: string): string {
  const normalized = text.replaceAll('\r\n', '\n').trim()
  if (normalized.length <= MAX_DOCUMENT_TEXT_CHARS) return normalized
  return `${normalized.slice(0, MAX_DOCUMENT_TEXT_CHARS)}\n…[truncated]`
}

/** Read a plain-text attachment, truncated for prompts. */
export async function readTextDocument(file: File): Promise<string> {
  return truncateDocumentText(await file.text())
}
