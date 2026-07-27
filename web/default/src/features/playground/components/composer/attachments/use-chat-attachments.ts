/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { uploadPlaygroundAsset } from '../../../api'
import { rememberAttachmentAsset } from '../../../lib/attachments/attachment-assets'
import {
  extractDocumentText,
  isDocumentFile,
} from '../../../lib/attachments/document-extract'
import { extractPdfText } from '../../../lib/attachments/pdf-extract'
import type { ChatAttachment } from '../../../types'

const MAX_CHAT_ATTACHMENTS = 4
const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_CHAT_PDF_BYTES = 10 * 1024 * 1024
const MAX_CHAT_DOCUMENT_BYTES = 10 * 1024 * 1024

type AttachmentKind = 'image' | 'pdf' | 'document'

function classifyFile(file: File): AttachmentKind | null {
  if (
    file.type === 'application/pdf' ||
    (file.type === '' && /\.pdf$/i.test(file.name))
  ) {
    return 'pdf'
  }
  if (file.type.startsWith('image/')) return 'image'
  if (isDocumentFile(file)) return 'document'
  return null
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)), {
      once: true,
    })
    reader.addEventListener('error', () => reject(reader.error), { once: true })
    reader.readAsDataURL(file)
  })
}

/**
 * Upload the attachment so it survives a reload. Failures are non-fatal: the
 * turn still sends the inline bytes, only cross-reload replay is lost.
 */
async function persistAttachmentAsset(
  file: File,
  dataUrl: string
): Promise<number | undefined> {
  try {
    const asset = await uploadPlaygroundAsset(file, undefined, 'attachment')
    rememberAttachmentAsset(asset.id, dataUrl)
    return asset.id
  } catch {
    return undefined
  }
}

async function buildAttachment(
  file: File,
  kind: AttachmentKind
): Promise<ChatAttachment> {
  const id = crypto.randomUUID()
  if (kind === 'document') {
    return {
      id,
      kind: 'document',
      name: file.name,
      mimeType: file.type || 'text/plain',
      text: await extractDocumentText(file),
    }
  }

  const rawDataUrl = await readAsDataUrl(file)
  if (kind === 'image') {
    const attachment: ChatAttachment = {
      id,
      kind: 'image',
      name: file.name,
      mimeType: file.type,
      dataUrl: rawDataUrl,
    }
    attachment.assetId = await persistAttachmentAsset(file, rawDataUrl)
    return attachment
  }

  // Browsers report an empty type for PDFs picked from some file managers, and
  // upstreams key document handling off the declared MIME.
  const dataUrl = rawDataUrl.replace(
    /^data:[^;]*;base64,/,
    'data:application/pdf;base64,'
  )
  const attachment: ChatAttachment = {
    id,
    kind: 'file',
    name: file.name,
    mimeType: 'application/pdf',
    dataUrl,
  }
  // Extract eagerly: the target model can change between turns, and the payload
  // builder must be able to choose text over a native file part synchronously.
  const [text, assetId] = await Promise.all([
    extractPdfText(await file.arrayBuffer()).catch(() => ''),
    persistAttachmentAsset(file, dataUrl),
  ])
  if (text) attachment.text = text
  attachment.assetId = assetId
  return attachment
}

/**
 * Chat attachments (images, PDFs, and office/text documents) with
 * file-dialog, paste, and drag-drop ingestion paths. Images and PDFs are
 * uploaded to the playground asset store so they survive reloads; documents
 * and PDFs are also extracted to plain text in the browser so models without
 * native file input still receive their content.
 */
export function useChatAttachments() {
  const { t } = useTranslation()
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const isAddingRef = useRef(false)
  const operationRef = useRef(0)

  useEffect(
    () => () => {
      operationRef.current += 1
    },
    []
  )

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0 || isAddingRef.current) return
    const validFiles: Array<{ file: File; kind: AttachmentKind }> = []
    for (const file of files) {
      const kind = classifyFile(file)
      if (!kind) {
        toast.error(
          t(
            'Unsupported file type. Use images, PDF, Word, Excel, PowerPoint, or text files.'
          )
        )
        continue
      }
      if (kind === 'image' && file.size > MAX_CHAT_IMAGE_BYTES) {
        toast.error(t('Image is too large (max 8MB).'))
        continue
      }
      if (kind === 'pdf' && file.size > MAX_CHAT_PDF_BYTES) {
        toast.error(t('PDF is too large (max 10MB).'))
        continue
      }
      if (kind === 'document' && file.size > MAX_CHAT_DOCUMENT_BYTES) {
        toast.error(t('Document is too large (max 10MB).'))
        continue
      }
      validFiles.push({ file, kind })
    }

    const remaining = MAX_CHAT_ATTACHMENTS - attachments.length
    if (remaining <= 0) {
      toast.error(
        t('You can attach up to {{count}} files.', {
          count: MAX_CHAT_ATTACHMENTS,
        })
      )
      return
    }
    const acceptedFiles = validFiles.slice(0, remaining)
    if (acceptedFiles.length === 0) return
    if (validFiles.length > remaining) {
      toast.error(
        t('You can attach up to {{count}} files.', {
          count: MAX_CHAT_ATTACHMENTS,
        })
      )
    }

    const operation = operationRef.current + 1
    operationRef.current = operation
    isAddingRef.current = true
    setIsAdding(true)
    const results = await Promise.allSettled(
      acceptedFiles.map((entry) => buildAttachment(entry.file, entry.kind))
    )

    if (operationRef.current !== operation) return
    const failedIndex = results.findIndex(
      (result) => result.status === 'rejected'
    )
    if (failedIndex >= 0) {
      toast.error(
        t('Could not read {{name}}.', {
          name: acceptedFiles[failedIndex].file.name,
        })
      )
    } else {
      const loaded = results.map(
        (result) => (result as PromiseFulfilledResult<ChatAttachment>).value
      )
      // An empty extraction would be filtered out when the request is built, so
      // reject it here instead of showing a chip that silently sends nothing.
      const readable = loaded.filter((attachment) => {
        if (attachment.kind !== 'document' || attachment.text.trim() !== '') {
          return true
        }
        toast.error(
          t('No readable text found in {{name}}.', { name: attachment.name })
        )
        return false
      })
      setAttachments((prev) => [
        ...prev,
        ...readable.slice(0, MAX_CHAT_ATTACHMENTS - prev.length),
      ])
    }
    if (operationRef.current === operation) {
      isAddingRef.current = false
      setIsAdding(false)
    }
  }

  const removeAt = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index))

  const clear = () => {
    operationRef.current += 1
    isAddingRef.current = false
    setIsAdding(false)
    setAttachments([])
  }

  const handlePaste: React.ClipboardEventHandler = (event) => {
    const files = [...event.clipboardData.files].filter(
      (file) => classifyFile(file) !== null
    )
    if (files.length === 0) return
    event.preventDefault()
    void addFiles(files)
  }

  const handleDrop: React.DragEventHandler = (event) => {
    if (event.dataTransfer.files.length === 0) return
    event.preventDefault()
    void addFiles(event.dataTransfer.files)
  }

  const handleDragOver: React.DragEventHandler = (event) => {
    if ([...event.dataTransfer.types].includes('Files')) {
      event.preventDefault()
    }
  }

  return {
    attachments,
    addFiles,
    removeAt,
    clear,
    handlePaste,
    handleDrop,
    handleDragOver,
    isAdding,
    isFull: attachments.length >= MAX_CHAT_ATTACHMENTS,
  }
}
