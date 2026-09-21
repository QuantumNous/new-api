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
 * In-browser equivalents of the document loaders Open WebUI runs server-side
 * (see `backend/open_webui/retrieval/loaders/`). Keeping extraction on the
 * client means the gateway relays nothing but a normal chat completion.
 */
import JSZip from 'jszip'
import mammoth from 'mammoth'
// The legacy build avoids `Promise.try` and other bleeding-edge runtime APIs,
// so it works in browsers and test environments that the modern build rejects.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

import {
  ATTACHMENT_ERRORS,
  MAX_PDF_PAGES,
  TRUNCATED_TEXT_SUFFIX,
} from './attachment-constants'
import {
  AttachmentExtractionError,
  decodePlainText,
} from './attachment-file-utils'

/**
 * True when `?url` imports resolve to an asset the runtime can actually fetch.
 *
 * Vitest sets `location.protocol` to `http:` even without a server behind it,
 * so the worker module path it hands back is unusable. Detect that case and
 * let pdf.js fall back to reading in-process.
 */
function hasUsableWorker(): boolean {
  if (typeof location === 'undefined') return false
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    return false
  }

  // A bundled asset URL is a real path/URL; vitest's is a bare /node_modules
  // reference that only its own module runner understands.
  return !pdfWorkerUrl.startsWith('/node_modules/')
}

// The worker is served from our own origin, so no CDN or CORS setup is needed.
// Without a served origin we keep pdf.js's in-process fallback, since Node
// cannot resolve a URL import path from disk.
if (hasUsableWorker()) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
}

type XmlNode = {
  attributes: Record<string, string>
  children: XmlNode[]
  name: string
  text: string
}

type XmlDocument = {
  root: XmlNode | null
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
}

/**
 * Drop any namespace prefix so tag matching can use local names.
 *
 * The parts we read mix default and prefixed namespaces: XLSX writes `<row>`
 * while PPTX writes `<a:p>`. Stripping the prefix lets one selector handle
 * both, which is what we want since we never need the namespace itself.
 */
function localName(name: string): string {
  const colon = name.indexOf(':')

  return colon === -1 ? name : name.slice(colon + 1)
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    }
    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    }

    return XML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/**
 * Parse a single OOXML part.
 *
 * `DOMParser` is not guaranteed to be available (jsdom without the xml library
 * cannot parse XML, and some browsers restrict it), so this walks the markup
 * directly. The parts we read are machine-generated, well-formed XML.
 */
function parseXml(source: string): XmlDocument {
  const root: XmlNode = { attributes: {}, children: [], name: '#root', text: '' }
  const stack: XmlNode[] = [root]
  const tag = /<([^>]*)>/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = tag.exec(source)) !== null) {
    const raw = source.slice(cursor, match.index)
    if (raw.trim()) {
      const current = stack.at(-1)
      if (current) current.text += decodeXmlEntities(raw)
    }
    cursor = match.index + match[0].length

    const body = match[1]
    if (body.startsWith('?') || body.startsWith('!')) continue

    if (body.startsWith('/')) {
      if (stack.length > 1) stack.pop()
      continue
    }

    const selfClosing = body.endsWith('/')
    const content = selfClosing ? body.slice(0, -1) : body
    const nameEnd = content.search(/[\s/]/)
    const name = nameEnd === -1 ? content : content.slice(0, nameEnd)
    const node: XmlNode = { attributes: {}, children: [], name: localName(name), text: '' }
    const attribute = /([^\s=]+)\s*=\s*"([^"]*)"/g
    let attributeMatch: RegExpExecArray | null
    while ((attributeMatch = attribute.exec(content.slice(nameEnd + 1)))) {
      node.attributes[attributeMatch[1]] = decodeXmlEntities(
        attributeMatch[2]
      )
    }

    const parent = stack.at(-1)
    if (parent) parent.children.push(node)
    if (!selfClosing) stack.push(node)
  }

  const trailing = source.slice(cursor)
  if (trailing.trim()) {
    const tail = stack.at(-1)
  if (tail) tail.text += decodeXmlEntities(trailing)
  }

  return { root: root.children[0] ?? null }
}

/** Every descendant with the given local tag name, in document order. */
function selectAll(node: XmlNode | null, name: string): XmlNode[] {
  if (!node) return []

  const found: XmlNode[] = []
  const walk = (current: XmlNode) => {
    if (current.name === name) found.push(current)
    for (const child of current.children) walk(child)
  }
  walk(node)

  return found
}

function selectFirst(node: XmlNode | null, name: string): XmlNode | null {
  if (!node) return null
  if (node.name === name) return node
  for (const child of node.children) {
    const found = selectFirst(child, name)
    if (found) return found
  }

  return null
}

/**
 * Resolve a relationship target against the part that declares it, matching
 * OOXML's "a relative reference resolves against the source part's folder".
 */
function resolvePartPath(sourcePath: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)

  const base = sourcePath.split('/').slice(0, -1)
  for (const segment of target.split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') base.pop()
    else base.push(segment)
  }

  return base.join('/')
}

async function readPart(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path)
  if (!file) {
    throw new AttachmentExtractionError(ATTACHMENT_ERRORS.READ_FAILED)
  }

  return file.async('string')
}

/**
 * Follow `_rels` from a part to every related part of the requested type,
 * e.g. workbook -> worksheets or presentation -> slides.
 */
async function readRelatedParts(
  zip: JSZip,
  sourcePath: string,
  relationshipSuffix: string
): Promise<{ path: string; xml: XmlDocument }[]> {
  const directory = sourcePath.split('/').slice(0, -1).join('/')
  const filename = sourcePath.split('/').pop() ?? ''
  const relsPath = `${directory ? `${directory}/` : ''}_rels/${filename}.rels`
  const relsFile = zip.file(relsPath)
  if (!relsFile) return []

  const rels = parseXml(await relsFile.async('string'))
  const targets = selectAll(rels.root, 'Relationship')
    .filter((node) =>
      (node.attributes.Type ?? '').endsWith(relationshipSuffix)
    )
    .map((node) => resolvePartPath(sourcePath, node.attributes.Target ?? ''))
    .filter((path) => path !== '')

  // Slides and worksheets are numeric; read them in the order the user sees.
  targets.sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true })
  )

  const parts: { path: string; xml: XmlDocument }[] = []
  for (const path of targets) {
    parts.push({ path, xml: parseXml(await readPart(zip, path)) })
  }

  return parts
}

/** Concatenate every `<t>` under a container, preserving paragraph breaks. */
function collectText(node: XmlNode | null): string {
  if (!node) return ''

  const pieces: string[] = []
  const walk = (current: XmlNode) => {
    if (current.name === 't') {
      pieces.push(current.text)
      return
    }
    if (current.name === 'br') {
      pieces.push('\n')
      return
    }
    for (const child of current.children) walk(child)
  }
  walk(node)

  return pieces.join('')
}

function collapseBlankLines(text: string): string {
  return text.replaceAll(/[ \t]+\n/g, '\n').replaceAll(/\n{3,}/g, '\n\n').trim()
}

/**
 * DOCX: delegate to mammoth, the same library Open WebUI's loader uses.
 *
 * mammoth ships two readers with different contracts: the browser build reads
 * `{ arrayBuffer }`, the Node build reads `{ buffer }`. Bundlers pick the
 * browser build via its package `browser` field, but the unit tests run the
 * Node build, so pass both keys to work under either.
 */
async function extractDocx(bytes: Uint8Array): Promise<string> {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer

  try {
    const input = { arrayBuffer: buffer, buffer } as unknown as Parameters<
      typeof mammoth.extractRawText
    >[0]

    return (await mammoth.extractRawText(input)).value
  } catch (cause) {
    throw new AttachmentExtractionError(ATTACHMENT_ERRORS.READ_FAILED, {
      cause,
    })
  }
}

const CELL_REFERENCE = /^([A-Z]+)(\d+)$/

function columnIndex(reference: string): number {
  let index = 0
  for (const char of reference) {
    index = index * 26 + (char.charCodeAt(0) - 64)
  }

  return index - 1
}

function sheetToRows(sheet: XmlDocument, sharedStrings: string[]): string[][] {
  const rows: string[][] = []

  for (const row of selectAll(sheet.root, 'row')) {
    const cells: string[] = []
    for (const cell of selectAll(row, 'c')) {
      const reference = cell.attributes.r ?? ''
      const match = CELL_REFERENCE.exec(reference)
      const index = match ? columnIndex(match[1]) : cells.length
      const value = selectFirst(cell, 'v')?.text ?? ''
      const type = cell.attributes.t

      if (type === 'inlineStr') {
        cells[index] = collapseBlankLines(collectText(cell))
        continue
      }

      if (type === 's') {
        cells[index] = sharedStrings[Number.parseInt(value, 10)] ?? ''
        continue
      }

      // Formula cells expose the cached result in <v>, which is what a reader
      // wants; errors surface as their `#REF!`-style token.
      cells[index] = value
    }

    if (cells.some((cell) => (cell ?? '').trim() !== '')) {
      rows.push(cells.map((cell) => cell ?? ''))
    }
  }

  return rows
}

function rowsToCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell))
        .join(',')
    )
    .join('\n')
}

/** XLSX: one CSV block per sheet, labelled so the model can tell them apart. */
async function extractXlsx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)
  const workbook = parseXml(await readPart(zip, 'xl/workbook.xml'))

  const sharedStringsFile = zip.file('xl/sharedStrings.xml')
  const sharedStrings = sharedStringsFile
    ? selectAll(parseXml(await sharedStringsFile.async('string')).root, 'si').map(
        (item) => collapseBlankLines(collectText(item))
      )
    : []

  const sheets = await readRelatedParts(zip, 'xl/workbook.xml', '/worksheet')
  const blocks: string[] = []

  for (const sheet of sheets) {
    const rows = sheetToRows(sheet.xml, sharedStrings)
    if (rows.length === 0) continue

    blocks.push(`## ${getSheetName(workbook, sheet.path)}\n${rowsToCsv(rows)}`)
  }

  return blocks.join('\n\n')
}

function getSheetName(workbook: XmlDocument, sheetPath: string): string {
  const indexMatch = /sheet(\d+)\.xml$/.exec(sheetPath)
  const sheets = selectAll(workbook.root, 'sheet')

  return (
    (indexMatch
      ? sheets[Number.parseInt(indexMatch[1], 10) - 1]?.attributes.name
      : null) ?? sheetPath.replace(/^xl\//, '')
  )
}

/** PPTX: text of each slide, in slide order. */
async function extractPptx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)
  const slides = await readRelatedParts(zip, 'ppt/presentation.xml', '/slide')

  const blocks: string[] = []
  slides.forEach((slide, index) => {
    const paragraphs = selectAll(slide.xml.root, 'p')
      .map((paragraph) => collectText(paragraph).trim())
      .filter((paragraph) => paragraph !== '')

    if (paragraphs.length > 0) {
      blocks.push(`## Slide ${index + 1}\n${paragraphs.join('\n')}`)
    }
  })

  return blocks.join('\n\n')
}

/** PDF: per-page text via pdf.js, mirroring the loader Open WebUI ships. */
async function extractPdf(bytes: Uint8Array): Promise<string> {
  let document: pdfjs.PDFDocumentProxy
  try {
    document = await pdfjs.getDocument({
      data: bytes,
      // Pages are never rendered, only read, so skip font work entirely.
      disableFontFace: true,
      useSystemFonts: true,
    }).promise
  } catch (cause) {
    throw new AttachmentExtractionError(ATTACHMENT_ERRORS.READ_FAILED, {
      cause,
    })
  }

  const pageCount = Math.min(document.numPages, MAX_PDF_PAGES)
  const blocks: string[] = []

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = collapseBlankLines(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replaceAll(/\s+/g, ' ')
    )

    if (text) blocks.push(`Page ${pageNumber}\n${text}`)
  }

  if (document.numPages > pageCount) {
    blocks.push(`[...] ${document.numPages - pageCount} more pages omitted`)
  }

  return blocks.join('\n\n')
}

export async function extractTextFromBytes(
  bytes: Uint8Array,
  extension: string
): Promise<string> {
  switch (extension) {
    case 'pdf':
      return extractPdf(bytes)
    case 'docx':
      return extractDocx(bytes)
    case 'xlsx':
      return extractXlsx(bytes)
    case 'pptx':
      return extractPptx(bytes)
    default:
      return decodePlainText(bytes)
  }
}

/**
 * Trim extracted text to the per-attachment budget.
 *
 * `nextLimit` is what the message still has room for; the smaller of the two
 * wins so one document cannot starve the others.
 */
export function truncateAttachmentText(
  text: string,
  nextLimit: number
): { text: string; truncated: boolean } {
  const trimmed = collapseBlankLines(text)
  const limit = Math.max(0, nextLimit)

  if (trimmed.length <= limit) {
    return { text: trimmed, truncated: false }
  }

  if (limit <= TRUNCATED_TEXT_SUFFIX.length) {
    return { text: trimmed.slice(0, limit), truncated: true }
  }

  return {
    text: `${trimmed.slice(0, limit - TRUNCATED_TEXT_SUFFIX.length)}${TRUNCATED_TEXT_SUFFIX}`,
    truncated: true,
  }
}
