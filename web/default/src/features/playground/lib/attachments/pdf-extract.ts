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
import { truncateDocumentText } from './document-extract'

/** Page cap keeps a pathological PDF from freezing the tab. */
const MAX_PDF_PAGES = 200

/**
 * Extract the text layer of a PDF in the browser. Returns an empty string for
 * scanned documents that carry no text layer; callers treat that as "no
 * fallback available" rather than an error.
 *
 * pdf.js is loaded lazily. Publishing `globalThis.pdfjsWorker` makes it run the
 * message handler on the main thread, so we never have to resolve a worker URL
 * through the bundler — text extraction is far cheaper than rendering.
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const [pdfjs, pdfjsWorker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.mjs'),
  ])
  ;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const document = await loadingTask.promise
  try {
    const pages: string[] = []
    const pageCount = Math.min(document.numPages, MAX_PDF_PAGES)
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replaceAll(/[ \t]+/g, ' ')
        .trim()
      page.cleanup()
      if (text !== '') pages.push(text)
    }
    return truncateDocumentText(pages.join('\n\n'))
  } finally {
    await loadingTask.destroy()
  }
}
