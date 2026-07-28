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
/* eslint-disable react-refresh/only-export-components */
'use client'

import type { FileUIPart } from 'ai'
import { nanoid } from 'nanoid'
import {
  type ChangeEventHandler,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { InputGroup } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

import {
  type AttachmentsContext,
  LocalAttachmentsProvider,
  useOptionalPromptInputController,
} from './prompt-input-context'

export type PromptInputMessage = {
  text?: string
  files?: FileUIPart[]
}

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  'onSubmit' | 'onError'
> & {
  accept?: string // e.g., "image/*" or leave undefined for any
  multiple?: boolean
  // When true, accepts drops anywhere on document. Default false (opt-in).
  globalDrop?: boolean
  // Render a hidden input with given name and keep it in sync for native form posts. Default false.
  syncHiddenInput?: boolean
  // Minimal constraints
  maxFiles?: number
  maxFileSize?: number // bytes
  onError?: (err: {
    code: 'max_files' | 'max_file_size' | 'accept'
    message: string
  }) => void
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => void | Promise<void>
  /**
   * Optional className applied to the inner InputGroup wrapper
   * (useful for layout or semantic radius utilities such as rounded-xl).
   */
  groupClassName?: string
}

export const PromptInput = ({
  className,
  groupClassName,
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const { t } = useTranslation()
  // Try to use a provider controller if present
  const controller = useOptionalPromptInputController()
  const usingProvider = !!controller

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  // Find nearest form to scope drag & drop
  useEffect(() => {
    const root = anchorRef.current?.closest('form')
    if (root instanceof HTMLFormElement) {
      formRef.current = root
    }
  }, [])

  // ----- Local attachments (only used when no provider)
  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([])
  const files = usingProvider ? controller.attachments.files : items

  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const matchesAccept = useCallback(
    (f: File) => {
      if (!accept || accept.trim() === '') {
        return true
      }
      if (accept.includes('image/*')) {
        return f.type.startsWith('image/')
      }
      // NOTE: keep simple; expand as needed
      return true
    },
    [accept]
  )

  const addLocal = useCallback(
    (fileList: File[] | FileList) => {
      const incoming = [...fileList]
      const accepted = incoming.filter((f) => matchesAccept(f))
      if (incoming.length && accepted.length === 0) {
        onError?.({
          code: 'accept',
          message: t('No files match the accepted types.'),
        })
        return
      }
      const withinSize = (f: File) =>
        maxFileSize ? f.size <= maxFileSize : true
      const sized = accepted.filter(withinSize)
      if (accepted.length > 0 && sized.length === 0) {
        onError?.({
          code: 'max_file_size',
          message: t('All files exceed the maximum size.'),
        })
        return
      }

      setItems((prev) => {
        const capacity =
          typeof maxFiles === 'number'
            ? Math.max(0, maxFiles - prev.length)
            : undefined
        const capped =
          typeof capacity === 'number' ? sized.slice(0, capacity) : sized
        if (typeof capacity === 'number' && sized.length > capacity) {
          onError?.({
            code: 'max_files',
            message: t('Too many files. Some were not added.'),
          })
        }
        const next: (FileUIPart & { id: string })[] = []
        for (const file of capped) {
          next.push({
            id: nanoid(),
            type: 'file',
            url: URL.createObjectURL(file),
            mediaType: file.type,
            filename: file.name,
          })
        }
        return [...prev, ...next]
      })
    },
    [matchesAccept, maxFiles, maxFileSize, onError, t]
  )

  const add = useMemo(
    () =>
      controller
        ? (files: File[] | FileList) => controller.attachments.add(files)
        : addLocal,
    [controller, addLocal]
  )

  const remove = useMemo(
    () =>
      controller
        ? (id: string) => controller.attachments.remove(id)
        : (id: string) =>
            setItems((prev) => {
              const found = prev.find((file) => file.id === id)
              if (found?.url) {
                URL.revokeObjectURL(found.url)
              }
              return prev.filter((file) => file.id !== id)
            }),
    [controller]
  )

  const clear = useMemo(
    () =>
      controller
        ? () => controller.attachments.clear()
        : () =>
            setItems((prev) => {
              for (const file of prev) {
                if (file.url) {
                  URL.revokeObjectURL(file.url)
                }
              }
              return []
            }),
    [controller]
  )

  const openFileDialog = useMemo(
    () =>
      controller
        ? () => controller.attachments.openFileDialog()
        : openFileDialogLocal,
    [controller, openFileDialogLocal]
  )

  // Let provider know about our hidden file input so external menus can call openFileDialog()
  useEffect(() => {
    if (!usingProvider) return
    controller.__registerFileInput(inputRef, () => inputRef.current?.click())
  }, [usingProvider, controller])

  // Note: File input cannot be programmatically set for security reasons
  // The syncHiddenInput prop is no longer functional
  useEffect(() => {
    if (syncHiddenInput && inputRef.current && files.length === 0) {
      inputRef.current.value = ''
    }
  }, [files, syncHiddenInput])

  // Attach drop handlers on nearest form and document (opt-in)
  useEffect(() => {
    const form = formRef.current
    if (!form) return

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
      }
    }
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files)
      }
    }
    form.addEventListener('dragover', onDragOver)
    form.addEventListener('drop', onDrop)
    return () => {
      form.removeEventListener('dragover', onDragOver)
      form.removeEventListener('drop', onDrop)
    }
  }, [add])

  useEffect(() => {
    if (!globalDrop) return

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
      }
    }
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files)
      }
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [add, globalDrop])

  useEffect(
    () => () => {
      if (!usingProvider) {
        for (const f of files) {
          if (f.url) URL.revokeObjectURL(f.url)
        }
      }
    },
    [usingProvider, files]
  )

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (event.currentTarget.files) {
      add(event.currentTarget.files)
    }
  }

  const convertBlobUrlToDataUrl = async (url: string): Promise<string> => {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.addEventListener('loadend', () => resolve(reader.result as string))
      reader.addEventListener('error', () => reject(reader.error))
      reader.readAsDataURL(blob)
    })
  }

  const ctx = useMemo<AttachmentsContext>(
    () => ({
      files: files.map((item) => ({ ...item, id: item.id })),
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef: inputRef,
    }),
    [files, add, remove, clear, openFileDialog]
  )

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()

    const form = event.currentTarget
    const text = usingProvider
      ? controller.textInput.value
      : (() => {
          const formData = new FormData(form)
          return (formData.get('message') as string) || ''
        })()

    // Reset form immediately after capturing text to avoid race condition
    // where user input during async blob conversion would be lost
    if (!usingProvider) {
      form.reset()
    }

    // Convert blob URLs to data URLs asynchronously
    Promise.all(
      files.map(async ({ id, ...item }) => {
        if (item.url && item.url.startsWith('blob:')) {
          return {
            ...item,
            url: await convertBlobUrlToDataUrl(item.url),
          }
        }
        return item
      })
    )
      .then((convertedFiles: FileUIPart[]) => {
        try {
          const result = onSubmit({ text, files: convertedFiles }, event)

          // Handle both sync and async onSubmit
          if (result instanceof Promise) {
            result
              .then(() => {
                clear()
                if (usingProvider) {
                  controller.textInput.clear()
                }
              })
              .catch(() => {
                // Don't clear on error - user may want to retry
              })
          } else {
            // Sync function completed without throwing, clear attachments
            clear()
            if (usingProvider) {
              controller.textInput.clear()
            }
          }
        } catch {
          // Don't clear on error - user may want to retry
        }
      })
      .catch(() => {
        // A blob URL failed to convert; keep the composer intact so the user can retry.
      })
  }

  // Render with or without local provider
  const inner = (
    <>
      <span aria-hidden='true' className='hidden' ref={anchorRef} />
      <input
        accept={accept}
        aria-label={t('Upload files')}
        className='hidden'
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        title={t('Upload files')}
        type='file'
      />
      <form
        className={cn('w-full', className)}
        onSubmit={handleSubmit}
        {...props}
      >
        <InputGroup className={groupClassName}>{children}</InputGroup>
      </form>
    </>
  )

  return usingProvider ? (
    inner
  ) : (
    <LocalAttachmentsProvider value={ctx}>{inner}</LocalAttachmentsProvider>
  )
}

export * from './prompt-input-attachments'
export * from './prompt-input-command'
export * from './prompt-input-context'
export * from './prompt-input-controls'
export * from './prompt-input-hover-card'
export * from './prompt-input-model-select'
export * from './prompt-input-speech-button'
export * from './prompt-input-tabs'
