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
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  ATTACHMENT_ERRORS,
  MAX_ATTACHMENT_COUNT,
} from '../lib/attachment/attachment-constants'
import { AttachmentExtractionError } from '../lib/attachment/attachment-file-utils'
import { parseAttachments } from '../lib/attachment/attachment-service'
import type { PlaygroundAttachment } from '../types'

const UNKNOWN_FAILURE = 'Could not read file'

/**
 * Translate a parse failure into something a user can act on.
 */
function describeFailure(error: unknown, t: (key: string) => string): string {
  const code =
    error instanceof AttachmentExtractionError
      ? error.message
      : ATTACHMENT_ERRORS.READ_FAILED

  switch (code) {
    case ATTACHMENT_ERRORS.FILE_TOO_LARGE:
      return t('File is too large')
    case ATTACHMENT_ERRORS.TOO_MANY_FILES:
      return t('Too many attachments')
    case ATTACHMENT_ERRORS.UNSUPPORTED_TYPE:
      return t('Unsupported file type')
    case ATTACHMENT_ERRORS.CONTEXT_FULL:
      return t('Attachment context is already full')
    default:
      return t(UNKNOWN_FAILURE)
  }
}

/**
 * Own the composer's attachment list.
 *
 * The parsed attachments are the single source of truth: the file picker feeds
 * raw `File`s in, parsing turns them into sendable payloads, and the chips
 * render from the parsed list. Keeping one list means a chip can never outlive
 * the payload it represents.
 */
export function usePlaygroundAttachments() {
  const { t } = useTranslation()
  const [attachments, setAttachments] = useState<PlaygroundAttachment[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      // Reading files is async; a second batch starting mid-parse would
      // interleave context budgets and duplicate error toasts.
      if (busy) return
      setBusy(true)
      setIsParsing(true)

      try {
        const room = MAX_ATTACHMENT_COUNT - attachments.length
        if (room <= 0) {
          toast.error(t('Too many attachments'))
          return
        }

        const accepted = files.slice(0, room)
        if (accepted.length < files.length) {
          toast.error(t('Too many attachments'))
        }

        const parsed = await parseAttachments(accepted, attachments)
        setAttachments((current) => [...current, ...parsed])
      } catch (error) {
        toast.error(describeFailure(error, t))
      } finally {
        setBusy(false)
        setIsParsing(false)
      }
    },
    [attachments, busy, t]
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) =>
      current.filter((attachment) => attachment.id !== id)
    )
  }, [])

  const clearAttachments = useCallback(() => setAttachments([]), [])

  const openFilePicker = useCallback(() => {
    if (attachments.length >= MAX_ATTACHMENT_COUNT) {
      toast.error(t('Too many attachments'))
      return
    }

    inputRef.current?.click()
  }, [attachments.length, t])

  return {
    addFiles,
    attachments,
    clearAttachments,
    inputRef,
    isParsing,
    openFilePicker,
    removeAttachment,
  }
}
