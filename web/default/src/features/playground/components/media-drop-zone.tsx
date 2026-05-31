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
import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { UploadIcon, XIcon, ImageIcon, VideoIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface MediaDropZoneProps {
  accept: 'image' | 'video'
  value?: string
  onChange: (url: string) => void
}

export function MediaDropZone({ accept, value, onChange }: MediaDropZoneProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isImage = accept === 'image'
  const acceptAttr = isImage ? 'image/*' : 'video/*'
  const placeholder = isImage
    ? t('Drop image here, paste URL, or click to upload')
    : t('Drop video here, paste URL, or click to upload')

  const prevUrlRef = useRef<string | undefined>(undefined)

  const handleFile = useCallback(
    (file: File) => {
      if (prevUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(prevUrlRef.current)
      }
      const url = URL.createObjectURL(file)
      prevUrlRef.current = url
      onChange(url)
    },
    [onChange],
  )

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(prevUrlRef.current)
      }
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const items = e.clipboardData.items
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            handleFile(file)
            return
          }
        }
      }
      // If pasted text looks like a URL, use it directly
      const text = e.clipboardData.getData('text/plain').trim()
      if (text && /^https?:\/\//i.test(text)) {
        e.preventDefault()
        onChange(text)
      }
    },
    [handleFile, onChange],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const url = e.target.value.trim()
      onChange(url)
    },
    [onChange],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile],
  )

  const clearValue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange('')
    },
    [onChange],
  )

  return (
    <div className='flex flex-col gap-1.5'>
      <div
        role='button'
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'border-muted flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed p-4 transition-colors',
          isDragging && 'border-primary bg-primary/5',
          !value && 'hover:bg-muted/50',
        )}
      >
        {value ? (
          <div className='relative w-full'>
            {isImage ? (
              <img
                src={value}
                alt='preview'
                className='mx-auto max-h-40 rounded object-contain'
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <video
                src={value}
                className='mx-auto max-h-40 rounded object-contain'
                controls
              />
            )}
            <button
              type='button'
              onClick={clearValue}
              className='bg-destructive text-destructive-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-full text-xs'
            >
              <XIcon className='size-3' />
            </button>
          </div>
        ) : (
          <>
            {isImage ? (
              <ImageIcon className='text-muted-foreground size-6' />
            ) : (
              <VideoIcon className='text-muted-foreground size-6' />
            )}
            <span className='text-muted-foreground text-xs'>{placeholder}</span>
          </>
        )}
      </div>

      <Input
        ref={inputRef as any}
        type='file'
        accept={acceptAttr}
        className='hidden'
        onChange={handleFileInput}
      />

      <Input
        placeholder={isImage ? t('Image URL') : t('Video URL')}
        value={value ?? ''}
        onChange={handleInputChange}
        onPaste={handlePaste}
        className='text-sm'
      />
    </div>
  )
}
