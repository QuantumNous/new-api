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
 * Browser-side text extraction for office and plain-text attachments.
 * Heavy parsers (jszip, SheetJS) are lazy-loaded so the main bundle
 * stays unaffected until a document is actually attached.
 */

export const MAX_DOCUMENT_TEXT_CHARS = 60_000

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|log|xml|ya?ml|html?)$/i
const DOCX_EXTENSION = /\.docx$/i
const XLSX_EXTENSIONS = /\.(xlsx|xls)$/i
const PPTX_EXTENSION = /\.pptx$/i

export const DOCUMENT_ACCEPT = [
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
  '.docx',
  '.xlsx',
  '.xls',
  '.pptx',
].join(',')

export function isDocumentFile(file: File): boolean {
  if (
    TEXT_EXTENSIONS.test(file.name) ||
    DOCX_EXTENSION.test(file.name) ||
    XLSX_EXTENSIONS.test(file.name) ||
    PPTX_EXTENSION.test(file.name)
  ) {
    return true
  }
  return file.type.startsWith('text/')
}

export function truncateDocumentText(text: string): string {
  const normalized = text.replaceAll('\r\n', '\n').trim()
  if (normalized.length <= MAX_DOCUMENT_TEXT_CHARS) return normalized
  return `${normalized.slice(0, MAX_DOCUMENT_TEXT_CHARS)}\n…[truncated]`
}

/** Decode XML entities produced by OOXML text runs. */
function decodeXmlEntities(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replaceAll(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    )
    .replaceAll('&amp;', '&')
}

/** Pull the text runs matched by `runPattern` out of one OOXML part. */
function extractXmlRuns(xml: string, runPattern: RegExp): string {
  const paragraphs = xml.split(/<\/(?:w:p|a:p)>/)
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    const runs = [...paragraph.matchAll(runPattern)]
      .map((match) => decodeXmlEntities(match[1]))
      .join('')
    if (runs.trim() !== '') lines.push(runs)
  }
  return lines.join('\n')
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)
  const document = zip.file('word/document.xml')
  if (!document) throw new Error('word/document.xml not found')
  const xml = await document.async('string')
  return extractXmlRuns(xml, /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)
}

export async function extractPptxText(buffer: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numberOf = (name: string) =>
        Number(/slide(\d+)\.xml$/.exec(name)?.[1] ?? 0)
      return numberOf(a) - numberOf(b)
    })
  const slides: string[] = []
  for (const name of slideNames) {
    const xml = await zip.files[name].async('string')
    const text = extractXmlRuns(xml, /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)
    if (text.trim() !== '') slides.push(text)
  }
  return slides.join('\n\n')
}

export async function extractSpreadsheetText(
  buffer: ArrayBuffer
): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheets: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]).trim()
    if (csv === '') continue
    sheets.push(workbook.SheetNames.length > 1 ? `# ${sheetName}\n${csv}` : csv)
  }
  return sheets.join('\n\n')
}

/** Extract plain text from a supported document file, truncated for prompts. */
export async function extractDocumentText(file: File): Promise<string> {
  if (DOCX_EXTENSION.test(file.name)) {
    return truncateDocumentText(await extractDocxText(await file.arrayBuffer()))
  }
  if (XLSX_EXTENSIONS.test(file.name)) {
    return truncateDocumentText(
      await extractSpreadsheetText(await file.arrayBuffer())
    )
  }
  if (PPTX_EXTENSION.test(file.name)) {
    return truncateDocumentText(await extractPptxText(await file.arrayBuffer()))
  }
  return truncateDocumentText(await file.text())
}
