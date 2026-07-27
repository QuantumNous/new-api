/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { usePlaygroundStore } from '@/stores/playground-store'

import { uploadPlaygroundAsset } from '../../../api'
import { rememberAttachmentAsset } from '../../../lib/attachments/attachment-assets'
import {
  isServerParsedDocument,
  isTextDocumentFile,
  readTextDocument,
} from '../../../lib/attachments/document-extract'
import {
  DocumentParseError,
  parseDocumentAsset,
} from '../../../lib/attachments/document-parse'
import type { ChatAttachment, ChatDocumentAttachment } from '../../../types'

const MAX_CHAT_ATTACHMENTS = 4
const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_CHAT_DOCUMENT_BYTES = 20 * 1024 * 1024
const MAX_CHAT_TEXT_BYTES = 10 * 1024 * 1024

type AttachmentKind = 'image' | 'document' | 'text'

function classifyFile(file: File): AttachmentKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (isServerParsedDocument(file)) return 'document'
  if (isTextDocumentFile(file)) return 'text'
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

async function buildImageAttachment(file: File): Promise<ChatAttachment> {
  const dataUrl = await readAsDataUrl(file)
  const attachment: ChatAttachment = {
    id: crypto.randomUUID(),
    kind: 'image',
    name: file.name,
    mimeType: file.type,
    dataUrl,
  }
  // Upload so the image survives a reload. Failure is non-fatal: the turn
  // still sends the inline bytes, only cross-reload replay is lost.
  try {
    const asset = await uploadPlaygroundAsset(file, undefined, 'attachment')
    rememberAttachmentAsset(asset.id, dataUrl)
    attachment.assetId = asset.id
  } catch {
    // keep inline-only attachment
  }
  return attachment
}

/**
 * Chat attachments: images, documents (PDF/Word/Excel/PowerPoint), and
 * plain-text files, with file-dialog, paste, and drag-drop ingestion.
 *
 * Documents are uploaded and parsed server-side into plain text (with a
 * client-driven OCR pass for scanned PDFs), so their content reaches any
 * model as text. Sending is blocked while a document is still parsing.
 */
export function useChatAttachments() {
  const { t } = useTranslation()
  const group = usePlaygroundStore((state) => state.config.group)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const isAddingRef = useRef(false)
  const operationRef = useRef(0)
  const groupRef = useRef(group)
  groupRef.current = group

  useEffect(
    () => () => {
      operationRef.current += 1
    },
    []
  )

  const updateDocument = (
    id: string,
    patch: Partial<ChatDocumentAttachment>
  ) => {
    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === id && attachment.kind === 'document'
          ? { ...attachment, ...patch }
          : attachment
      )
    )
  }

  const runParse = async (id: string, assetId: number) => {
    updateDocument(id, {
      status: 'processing',
      error: undefined,
      ocrDone: undefined,
      ocrTotal: undefined,
    })
    try {
      const text = await parseDocumentAsset(
        assetId,
        groupRef.current,
        (progress) =>
          updateDocument(id, {
            status: 'ocr',
            ocrDone: progress.done,
            ocrTotal: progress.total,
          })
      )
      if (text.trim() === '') {
        updateDocument(id, {
          status: 'failed',
          error: t('No readable text found in this document.'),
        })
        return
      }
      updateDocument(id, { status: 'done', text })
    } catch (error) {
      const message =
        error instanceof DocumentParseError
          ? error.message
          : t('Could not read this document.')
      updateDocument(id, { status: 'failed', error: message })
    }
  }

  const addDocumentFile = async (file: File): Promise<void> => {
    let assetId: number
    try {
      const asset = await uploadPlaygroundAsset(file, 'document', 'attachment')
      assetId = asset.id
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast.error(
        message || t('Could not upload {{name}}.', { name: file.name })
      )
      return
    }
    const attachment: ChatDocumentAttachment = {
      id: crypto.randomUUID(),
      kind: 'document',
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      text: '',
      assetId,
      status: 'processing',
    }
    setAttachments((prev) =>
      prev.length < MAX_CHAT_ATTACHMENTS ? [...prev, attachment] : prev
    )
    void runParse(attachment.id, assetId)
  }

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
      if (kind === 'document' && file.size > MAX_CHAT_DOCUMENT_BYTES) {
        toast.error(t('Document is too large (max 20MB).'))
        continue
      }
      if (kind === 'text' && file.size > MAX_CHAT_TEXT_BYTES) {
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

    for (const entry of acceptedFiles) {
      if (operationRef.current !== operation) return
      if (entry.kind === 'document') {
        await addDocumentFile(entry.file)
        continue
      }
      try {
        if (entry.kind === 'image') {
          const attachment = await buildImageAttachment(entry.file)
          setAttachments((prev) =>
            prev.length < MAX_CHAT_ATTACHMENTS ? [...prev, attachment] : prev
          )
          continue
        }
        const text = await readTextDocument(entry.file)
        if (text.trim() === '') {
          toast.error(
            t('No readable text found in {{name}}.', { name: entry.file.name })
          )
          continue
        }
        setAttachments((prev) =>
          prev.length < MAX_CHAT_ATTACHMENTS
            ? [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  kind: 'document',
                  name: entry.file.name,
                  mimeType: entry.file.type || 'text/plain',
                  text,
                },
              ]
            : prev
        )
      } catch {
        toast.error(t('Could not read {{name}}.', { name: entry.file.name }))
      }
    }

    if (operationRef.current === operation) {
      isAddingRef.current = false
      setIsAdding(false)
    }
  }

  const removeAt = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index))

  const retryAt = (index: number) => {
    const attachment = attachments[index]
    if (
      attachment?.kind === 'document' &&
      attachment.assetId !== undefined &&
      attachment.status === 'failed'
    ) {
      void runParse(attachment.id, attachment.assetId)
    }
  }

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

  const isParsing = useMemo(
    () =>
      attachments.some(
        (attachment) =>
          attachment.kind === 'document' &&
          (attachment.status === 'processing' || attachment.status === 'ocr')
      ),
    [attachments]
  )

  return {
    attachments,
    addFiles,
    removeAt,
    retryAt,
    clear,
    handlePaste,
    handleDrop,
    handleDragOver,
    isAdding,
    isParsing,
    isFull: attachments.length >= MAX_CHAT_ATTACHMENTS,
  }
}
