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
 * Client half of the server-side document parse pipeline. Native extraction
 * (text-layer PDFs, Office files) completes inside the start call. Scanned
 * PDFs come back as a needs_ocr contract: the server has rendered the pages,
 * and this module transcribes them through the normal /pg relay (billed to
 * the signed-in user like any chat turn) and imports the text back, so the
 * transcription is cached for every future use of the same file.
 */
import {
  fetchPlaygroundParsePageBlob,
  importPlaygroundAssetParse,
  sendChatCompletion,
  startPlaygroundAssetParse,
  type PlaygroundDocumentParseState,
  type PlaygroundParseOCRContract,
} from '../../api'
import type { ContentPart } from '../../types'

export type DocumentOCRProgress = { done: number; total: number }

const OCR_PAGES_PER_REQUEST = 2
const PROCESSING_POLL_MS = 3000
const PROCESSING_MAX_POLLS = 60

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)), {
      once: true,
    })
    reader.addEventListener('error', () => reject(reader.error), { once: true })
    reader.readAsDataURL(blob)
  })
}

async function transcribePageBatch(
  ocr: PlaygroundParseOCRContract,
  group: string | undefined,
  pageUrls: string[]
): Promise<string> {
  const parts: ContentPart[] = [{ type: 'text', text: ocr.prompt }]
  for (const url of pageUrls) {
    const dataUrl = await blobToDataUrl(await fetchPlaygroundParsePageBlob(url))
    parts.push({ type: 'image_url', image_url: { url: dataUrl } })
  }
  const response = await sendChatCompletion({
    model: ocr.model,
    group,
    stream: false,
    messages: [{ role: 'user', content: parts }],
  })
  const content = response?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content.trim() : ''
}

async function runClientOCR(
  assetId: number,
  ocr: PlaygroundParseOCRContract,
  group: string | undefined,
  onProgress?: (progress: DocumentOCRProgress) => void
): Promise<PlaygroundDocumentParseState> {
  const total = ocr.page_urls.length
  const chunks: string[] = []
  try {
    for (let start = 0; start < total; start += OCR_PAGES_PER_REQUEST) {
      const batch = ocr.page_urls.slice(start, start + OCR_PAGES_PER_REQUEST)
      const text = await transcribePageBatch(ocr, group, batch)
      if (text) chunks.push(text)
      onProgress?.({ done: Math.min(start + batch.length, total), total })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OCR failed'
    // Report the failure so the parse settles instead of holding needs_ocr.
    return importPlaygroundAssetParse(assetId, {
      execution_token: ocr.execution_token,
      error: message,
    })
  }
  return importPlaygroundAssetParse(assetId, {
    execution_token: ocr.execution_token,
    text: chunks.join('\n\n'),
  })
}

export class DocumentParseError extends Error {}

/**
 * Resolve the parsed text for an uploaded document asset, driving the OCR
 * contract when the server asks for it. Throws DocumentParseError with a
 * user-presentable message when the document cannot be read.
 */
export async function parseDocumentAsset(
  assetId: number,
  group: string | undefined,
  onOcrProgress?: (progress: DocumentOCRProgress) => void
): Promise<string> {
  let state = await startPlaygroundAssetParse(assetId, group)

  // Another tab or user may be parsing the same content hash right now.
  let polls = 0
  while (state.status === 'processing') {
    if (polls >= PROCESSING_MAX_POLLS) {
      throw new DocumentParseError('document parsing timed out')
    }
    polls += 1
    await new Promise((resolve) => setTimeout(resolve, PROCESSING_POLL_MS))
    state = await startPlaygroundAssetParse(assetId, group)
  }

  if (state.status === 'needs_ocr' && state.ocr) {
    state = await runClientOCR(assetId, state.ocr, group, onOcrProgress)
  }

  if (state.status === 'done') {
    return state.text ?? ''
  }
  throw new DocumentParseError(state.error || 'document parsing failed')
}
